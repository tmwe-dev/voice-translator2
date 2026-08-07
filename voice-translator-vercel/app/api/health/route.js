import { NextResponse } from 'next/server';
import { createLogger } from '../../lib/logger.js';
import { getSession } from '../../lib/users.js';

const log = createLogger('health');

// ═══════════════════════════════════════════════════════════════
// STATO DEL SERVIZIO (b.121)
//
// ── COSA RACCONTAVA A CHIUNQUE ──
//
// Interrogata dal vivo, senza credenziali, questa rotta rispondeva:
//
//   devMode: false
//   openai: configured        anthropic: configured
//   gemini: not_configured    dashscope: configured
//   bigmodel: configured      elevenlabs: configured
//   stripe: configured        sentry: NOT_CONFIGURED
//   redis: { latencyMs: 261, httpStatus: 200 }
//
// Preso singolarmente ogni dato sembra innocuo. Messi insieme sono la
// pianta del posto: quali fornitori ci sono e quali no (cioe dove
// mirare), com'e messo il database, e — la riga che conta —
// **sentry: not_configured**, che vuol dire: nessuno sta guardando.
//
// Chi prova a forzare una porta ha il diritto di sapere se c'e
// l'allarme? Questa rotta glielo diceva, gratis e su richiesta.
//
// C'era anche di peggio, piu in basso: in caso di guasto scriveva
// `error: e.message`. Il messaggio d'errore di una fetch verso Upstash
// contiene l'INDIRIZZO del database. Non e mai capitato perche il
// database non e mai caduto — cioe: non era protetto, era fortunato.
//
// ── PERCHE NON SI CHIUDE E BASTA ──
//
// A questa rotta serve rispondere a un sorvegliante esterno, che non ha
// e non deve avere credenziali. Se si chiude tutto, si perde l'unico
// modo automatico di sapere che l'applicazione e viva.
//
// Quindi due risposte diverse alla stessa domanda:
//
//   · SENZA credenziali → sono viva, e sto bene o male (ok/degraded).
//     Basta a un sorvegliante: e quello che gli serve per suonare.
//   · CON una sessione da amministratore → tutto il dettaglio.
//     A chi deve ripararla serve sapere QUALE pezzo si e rotto.
//
// La differenza fra "sto male" e "sto male per via del database" e
// esattamente la differenza fra cio che serve a chi sorveglia e cio
// che serve a chi ripara. Solo il secondo ha bisogno di un nome.
// ═══════════════════════════════════════════════════════════════

// INVENTARIO: pubblica — un sorvegliante esterno deve poter chiedere se l'applicazione e viva, senza credenziali
//
// Aperta solo per la risposta breve (viva / malmessa). Tutto il
// dettaglio — quali fornitori ci sono, se l'allarme e acceso, come sta
// il database — richiede una sessione da amministratore. Vedi sopra.

const coldStartTime = Date.now();
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

async function chiedeUnAmministratore(req) {
  // Il gettone dall'intestazione, mai dalla query: un indirizzo finisce
  // nella cronologia del browser e nei registri del server.
  const intestazione = req.headers.get('authorization') || '';
  const token = intestazione.startsWith('Bearer ') ? intestazione.slice(7) : null;
  if (!token) return false;
  try {
    const sessione = await getSession(token);
    const email = (sessione?.email || '').toLowerCase();
    return !!email && ADMIN_EMAILS.includes(email);
  } catch (e) {
    // Un gettone illeggibile non e un amministratore: si nega e si
    // annota. Restituire true "nel dubbio" sarebbe la porta aperta.
    log.warn('verifica sessione fallita nello stato servizio:', e?.message);
    return false;
  }
}

export async function GET(req) {
  const dettaglio = await chiedeUnAmministratore(req);

  const servizi = {};
  let guasti = false;

  // ── Redis: si prova davvero, perche e l'unico modo di sapere se e vivo ──
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = { envSet: !!(upstashUrl && upstashToken) };
  if (upstashUrl && upstashToken) {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(upstashUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['PING']),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      redis.status = data.result === 'PONG' ? 'ok' : 'error';
      redis.latencyMs = Date.now() - start;
      redis.response = data.result || data.error || 'unknown';
      redis.httpStatus = res.status;
    } catch (e) {
      redis.status = 'error';
      // `e.message` di una fetch verso Upstash contiene l'indirizzo del
      // database: si conserva, ma esce solo per un amministratore.
      redis.error = e.message;
    }
  } else {
    redis.status = 'not_configured';
  }
  servizi.redis = redis;

  try {
    const { isSupabaseEnabled } = await import('../../lib/supabase.js');
    servizi.supabase = { status: isSupabaseEnabled() ? 'ok' : 'not_configured' };
  } catch (e) {
    log.warn('supabase non interrogabile:', e?.message);
    servizi.supabase = { status: 'error' };
  }

  // Presenza delle chiavi, non validita.
  const chiavi = {
    openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY',
    dashscope: 'DASHSCOPE_API_KEY', bigmodel: 'BIGMODEL_API_KEY', elevenlabs: 'ELEVENLABS_API_KEY',
    sentry: 'NEXT_PUBLIC_SENTRY_DSN', stripe: 'STRIPE_SECRET_KEY',
  };
  for (const [nome, variabile] of Object.entries(chiavi)) {
    servizi[nome] = { status: process.env[variabile] ? 'configured' : 'not_configured' };
  }

  let interruttori = {};
  let apertiCount = 0;
  try {
    const { apiCircuitBreaker } = await import('../../lib/circuitBreaker.js');
    interruttori = apiCircuitBreaker.getMetrics();
    apertiCount = apiCircuitBreaker.openCount;
  } catch (e) {
    log.warn('metriche interruttori non disponibili:', e?.message);
  }

  guasti = Object.values(servizi).some((v) => v.status === 'error');
  const stato = guasti || apertiCount > 0 ? 'degraded' : 'ok';

  // ── La risposta pubblica: viva o no, bene o male. Nient'altro. ──
  // Non si dice nemmeno CHE COSA e rotto: sapere che il database e giu
  // e gia un'informazione utile a chi la sta aspettando.
  const pubblica = {
    status: stato,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - coldStartTime) / 1000),
  };

  const corpo = dettaglio
    ? { ...pubblica, version: '2.1.0', devMode: process.env.DEV_MODE === 'true', services: servizi, circuitBreakers: interruttori, openCircuits: apertiCount }
    : pubblica;

  return NextResponse.json(corpo, {
    status: guasti ? 503 : 200,
    headers: { 'Cache-Control': 'no-cache, no-store' },
  });
}

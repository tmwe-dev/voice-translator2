import { NextResponse } from 'next/server';
import { safeCompare } from '../../../lib/apiGuard.js';
import { TESTATE, perIlRegistro } from '../../../lib/topics/testate.js';
import { fontiViste, fontiDaProvare } from '../../../lib/topics/deposito.js';
import { feedDelDominio } from '../../../lib/topics/registro.js';

// ═══════════════════════════════════════════════════════════════
// IL GUARDIANO DEL REGISTRO (b.565)
//
// Gira ogni ora e fa le due cose che nessuno faceva:
//
// ① SEMINA le testate scritte a mano (`testate.js`) nel registro, ognuna
//    nel suo Paese e nell'elenco generale. Si puo rifare all'infinito:
//    `mondo_fonti_viste` fa upsert, quindi la seconda volta non
//    duplica niente — aggiunge solo apparizioni, che e' il modo in cui
//    una fonte guadagna merito.
//
// ② VA A CACCIA DEI FLUSSI MANCANTI. Misurato prima di scrivere questa
//    rotta: 71 fonti nel registro, 9 con un flusso trovato, **49 mai
//    nemmeno interrogate**. Trovare un flusso costa una visita alla
//    home piu cinque tentativi — troppo per farlo mentre qualcuno
//    aspetta il giornale, giusto per un lavoro che gira di notte.
//    Venti per volta: ogni ora, e in un giorno sono quasi cinquecento.
//
// Perche' un CRON e non «quando serve»: le fonti si seguono, e seguire
// vuol dire essere pronti PRIMA che qualcuno chieda. E' la stessa idea
// del giornale di ieri gia in mano (b.564), un piano piu sotto.
// ═══════════════════════════════════════════════════════════════

const QUANTE_PER_GIRO = 20;

export async function GET(req) {
  // stesso controllo delle altre rotte di servizio: la chiave del cron
  // o quella dell'amministratore, con un tetto ai tentativi (b.166).
  const { checkRateLimit, getRateLimitKey } = await import('../../../lib/rateLimit.js');
  const rl = await checkRateLimit(getRateLimitKey(req, 'mondo-registro'), 5);
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const pass = req.headers.get('x-admin-pass') || req.headers.get('authorization')?.replace('Bearer ', '');
  const ok = safeCompare(pass, process.env.ADMIN_PASS) || safeCompare(pass, process.env.CRON_SECRET);
  if (!ok) return NextResponse.json({ error: 'no' }, { status: 401 });

  const esito = { seminate: 0, provate: 0, trovati: 0, senzaFlusso: 0 };

  // ── ① le testate scritte a mano ──
  try {
    // nell'elenco generale (valgono ovunque)
    esito.seminate += await fontiViste(perIlRegistro().map((v) => ({ ...v, url: `https://${v.dominio}/` })), {}) || 0;
    // e ognuna nel suo Paese, dove pesa di piu
    const perPaese = new Map();
    for (const t of TESTATE) {
      if (!perPaese.has(t.p)) perPaese.set(t.p, []);
      perPaese.get(t.p).push({ dominio: t.d, nome: t.n, quante: 2, url: `https://${t.d}/` });
    }
    for (const [paese, voci] of perPaese) {
      await fontiViste(voci, { paese, settore: '' });
    }
  } catch (e) {
    return NextResponse.json({ errore: 'semina', dettaglio: String(e?.message || e).slice(0, 120) }, { status: 500 });
  }

  // ── ② i flussi mancanti ──
  // Una fonte alla volta puo fallire senza fermare le altre: qui si
  // lavora per tutte, e chi non risponde oggi si riprova domani (il
  // «non ce l'ha» resta scritto e non si ricerca ogni ora).
  try {
    const daProvare = await fontiDaProvare({ quante: QUANTE_PER_GIRO });
    esito.provate = daProvare.length;
    const esiti = await Promise.all(daProvare.map((f) => feedDelDominio(f.dominio).catch(() => '')));
    esito.trovati = esiti.filter(Boolean).length;
    esito.senzaFlusso = esiti.length - esito.trovati;
  } catch (e) {
    esito.errore = String(e?.message || e).slice(0, 120);
  }

  return NextResponse.json({ ok: true, ...esito });
}

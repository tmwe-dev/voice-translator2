// ═══════════════════════════════════════════════════════════════
// GLI AVVISI SUI CONTENUTI CHE SEGUO (b.545).
//
// Ordine di Luca: «dobbiamo avvisare l'utente in alto nelle pagine di
// commenti come instagram o facebook, nella sua stanza potra quindi
// aprire il commento/lista direttamente dal pulsante».
//
// Qui non nasce niente di nuovo: gli avvisi si RICAVANO dai fili di
// commenti che gia esistono (le liste `commenti:{chiave}` di
// /api/mondo/commenti). Nessuna coda di notifiche da tenere allineata,
// nessuna scadenza in piu da gestire: quando il filo scade dopo novanta
// giorni, spariscono da soli anche gli avvisi.
//
// Chi segue cosa lo dice il telefono, a ogni domanda: le chiavi dei
// contenuti dove ho commentato o messo il cuore viaggiano nella query e
// non vengono scritte da nessuna parte. Qui dentro NON si registra chi
// chiede, ne cosa segue — la stessa regola dei cuori e dei commenti:
// meno cose sappiamo delle persone, meglio e'.
//
// Due cautele, le solite di questa famiglia di rotte:
//   · sessanta chiavi al massimo (come i cuori e i commenti): una
//     schermata di contenuti, non l'intero archivio;
//   · si guardano solo le ultime code delle liste e si torna al massimo
//     cinquanta avvisi — una campanella non e' un archivio.
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { QUANTI_RICORDO } from '../../../lib/campanella.js';

const log = createLogger('mondo/avvisi');
const MAX_CHIAVI = 60;
// quanti commenti si guardano in coda a ogni filo: chi ha lasciato la
// campanella chiusa per un mese non ha bisogno di rileggersi tutto.
const QUANTI_PER_FILO = 20;
const MAX_TITOLO = 90;
// il muro all'indietro: anche con `da=0` non si torna piu in la di due
// settimane. Un avviso vecchio di due mesi non e' un avviso, e' storia.
const FINESTRA = 14 * 24 * 3600 * 1000;

// stessa pulizia della chiave che usano /api/mondo/gradimento e
// /api/mondo/commenti: le tre rotte parlano dello stesso contenuto e
// devono chiamarlo allo stesso modo.
const pulita = (k) => String(k || '').trim().slice(0, 200).replace(/\s/g, '');

const leggiRiga = (riga) => {
  if (riga && typeof riga === 'object') return riga;
  try { return JSON.parse(riga); } catch { return null; /* riga illeggibile: si scarta, la campanella resta in piedi */ }
};

const sanaTesto = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITOLO);

async function handleGet(req) {
  try {
    const url = new URL(req.url);
    const chiavi = (url.searchParams.get('chiavi') || '')
      .split(',').map(pulita).filter(Boolean).slice(0, MAX_CHIAVI);
    if (!chiavi.length) return NextResponse.json({ avvisi: [] });

    const daDetto = Number(url.searchParams.get('da'));
    const daValido = Number.isFinite(daDetto) && daDetto > 0 ? daDetto : 0;
    const da = Math.max(daValido, Date.now() - FINESTRA);

    const code = await Promise.all(chiavi.map((c) => (
      redis('LRANGE', `commenti:${c}`, String(-QUANTI_PER_FILO), '-1').catch(() => [])
    )));

    const avvisi = [];
    chiavi.forEach((chiave, i) => {
      const righe = Array.isArray(code[i]) ? code[i] : [];
      for (const riga of righe) {
        const c = leggiRiga(riga);
        if (!c || typeof c !== 'object') continue;
        const quando = Number(c.quando);
        if (!Number.isFinite(quando) || quando <= da) continue;
        const testo = sanaTesto(c.testo);
        if (!testo) continue;
        avvisi.push({
          // l'identita dell'avviso e' quella del commento, allungata con
          // il contenuto: cosi la fusione lato telefono (unisciAvvisi)
          // riconosce i doppioni anche se la stessa lista torna due volte.
          id: `commento:${chiave}:${String(c.id || quando)}`,
          tipo: 'commento',
          chiave,
          // il titolo della riga e' l'inizio di quel che e' stato detto:
          // e' gia pubblico sotto l'articolo, non e' un dato in piu.
          titolo: testo,
          nome: sanaTesto(c.nome),
          quando,
        });
      }
    });

    avvisi.sort((a, b) => b.quando - a.quando);
    return NextResponse.json({ avvisi: avvisi.slice(0, QUANTI_RICORDO) });
  } catch (e) {
    // b.545 — una campanella che esplode non deve portarsi dietro la
    // pagina: elenco vuoto e si tira avanti.
    log.warn('lettura avvisi fallita', { errore: e?.message });
    return NextResponse.json({ avvisi: [] });
  }
}

export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'avvisi-get', skipBodyCheck: true });

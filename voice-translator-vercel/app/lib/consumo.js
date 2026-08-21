// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';
// consumo — traccia il consumo (caratteri tradotti) lato client.
//
// Perche lato client e non dal ledger: il ledger NON registra QUALE
// chat consuma (dettaglio = tipo/caratteri/costo, mai roomId), e la
// deduzione passa da una RPC atomica di riserva/commit (migrazione 006)
// che la regola 8 dice di non toccare senza verifica. Quindi il consumo
// PER CHAT si accumula qui, con lo stesso segnale che gia arriva dal
// server (charsUsed della risposta di /api/translate) — coerente col
// conteggio reale, ma senza mettere le mani sul percorso di fatturazione.
//
// Il CREDITO/MINUTI autorevoli restano nella pillola (/api/wallet/saldo).
// Questo e il "consumo che cresce" e la "history", in caratteri.
//
// Persistenza: localStorage 'vt-consumo' = { perChat:{id:chars},
// giorni:{'YYYY-MM-DD':chars} }. La sessione (dall'ultimo caricamento)
// vive in memoria. Un evento 'vt:consumo' avvisa la UI di aggiornarsi.
// ═══════════════════════════════════════════════════════════════

const CHIAVE = 'vt-consumo';
let sessione = 0; // caratteri consumati da quando l'app e stata caricata

function leggiGrezzo() {
  try {
    const s = memGet(CHIAVE);
    if (s) { const d = JSON.parse(s); if (d && typeof d === 'object') return { perChat: d.perChat || {}, giorni: d.giorni || {} }; }
  } catch { /* memoria piena o navigazione privata: si riparte da zero */ }
  return { perChat: {}, giorni: {} };
}

function scrivi(d) {
  try { memSet(CHIAVE, JSON.stringify(d)); } catch { /* senza persistenza si vive: resta il conteggio di sessione */ }
}

function oggiUTC() {
  return new Date().toISOString().split('T')[0];
}

/** Aggiunge `chars` al consumo della chat `roomId`, del giorno e della sessione. */
export function tracciaConsumo(roomId, chars) {
  const n = Number(chars) || 0;
  if (n <= 0) return;
  sessione += n;
  const d = leggiGrezzo();
  if (roomId) d.perChat[roomId] = (d.perChat[roomId] || 0) + n;
  const g = oggiUTC();
  d.giorni[g] = (d.giorni[g] || 0) + n;
  scrivi(d);
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('vt:consumo')); } catch { /* eventi non disponibili: la UI si aggiorna al prossimo giro */ }
  }
}

/** Lo stato completo del consumo, per la UI. */
export function leggiConsumo() {
  const d = leggiGrezzo();
  const perChat = d.perChat || {};
  const giorni = d.giorni || {};
  const totale = Object.values(giorni).reduce((a, b) => a + (Number(b) || 0), 0);
  const oggi = giorni[oggiUTC()] || 0;
  // storico dei giorni, dal piu recente
  const storico = Object.entries(giorni)
    .map(([data, chars]) => ({ data, chars: Number(chars) || 0 }))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  return { sessione, oggi, totale, perChat, storico };
}

/** Il consumo di una singola chat. */
// b.363 — qui c'era consumoChat, che rispondeva quanto era costata una
// singola stanza. Non lo chiedeva nessuno: le schermate del consumo
// mostrano solo il totale.

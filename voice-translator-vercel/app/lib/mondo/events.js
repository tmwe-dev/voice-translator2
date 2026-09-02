// ═══════════════════════════════════════════════════════════════
// GLI EVENTI E QUANTO PESANO — UN SOLO POSTO (b.575, FASE 1)
//
// Documento di Luca, capitolo 8: «usare un solo sistema eventi», e i
// pesi «configurabili in un unico file». Questo e' quel file.
//
// Oggi i segnali sono sparsi: `regia.js` ha i suoi pesi, il gradimento
// ha i suoi, i «gusti» un'altra scala ancora. Tre listini per la stessa
// merce: nessuno puo dire quanto vale un cuore, perche' dipende da chi
// glielo chiede.
//
// I numeri qui sotto sono quelli del documento, senza ritocchi miei:
// se vanno cambiati si cambiano QUI e cambiano ovunque. Questo e' tutto
// il punto di avere un listino solo.
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

export const EVENTI = [
  'OPEN', 'VIEW', 'COMPLETE_VIEW', 'SKIP', 'LIKE',
  'COMMENT', 'SAVE', 'HIDE', 'FOLLOW', 'UNFOLLOW', 'SEARCH',
];

/** I pesi del documento, capitolo 8. */
export const PESI = {
  SAVE: 8,
  FOLLOW: 8,
  COMMENT: 6,
  LIKE: 4,
  COMPLETE_VIEW: 3,
  OPEN: 2,
  VIEW: 1,
  SEARCH: 2,
  SKIP: -2,
  HIDE: -10,
  UNFOLLOW: -10,
};

export function pesoDi(evento) {
  return PESI[String(evento || '').toUpperCase()] ?? 0;
}

function eventoValido(evento) {
  return EVENTI.includes(String(evento || '').toUpperCase());
}

/**
 * Un evento in forma sana. `at` esiste sempre: senza l'ora un segnale
 * non puo invecchiare, e un segnale che non invecchia diventa una
 * condanna (e' il capitolo 9, il decadimento).
 */
export function evento(tipo, { topics = [], source = '', contentId = '', query = '', at = Date.now() } = {}) {
  const t = String(tipo || '').toUpperCase();
  if (!eventoValido(t)) return null;
  return {
    type: t,
    topics: (Array.isArray(topics) ? topics : []).map((x) => String(x || '')).filter(Boolean),
    source: String(source || '').toLowerCase(),
    contentId: String(contentId || ''),
    query: String(query || ''),
    at: Number(at) || Date.now(),
  };
}

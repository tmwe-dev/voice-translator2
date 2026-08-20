// ═══════════════════════════════════════════════════════════════
// b.265 — il segnale «questa voce e rimasta muta DEL TUTTO».
//
// TROVATO NELL'AUDIT (confronto col codice di b.224): la protezione dai
// doppioni ha DUE strati. Quello interno (playedMsgIdsRef, useAudioSystem)
// dal b.262 libera la chiave quando il suono fallisce del tutto — ma
// quello ESTERNO (processedForTTSRef, useRoomPolling) non lo veniva mai
// a sapere: la chiave restava marcata, il cursore del polling e monotono,
// e la consegna successiva dello stesso messaggio veniva scartata PRIMA
// di arrivare alla coda audio. L'avviso diceva di toccare lo schermo,
// ma il messaggio era gia perso per sempre.
//
// I due strati vivono in due hook diversi che non si conoscono: questo
// filo li collega senza accoppiarli. Chi suona segnala la chiave muta,
// chi filtra la libera. Stesso disegno degli altri segnali della base
// (ascoltaLingueCaricate in i18n.js).
// ═══════════════════════════════════════════════════════════════

const ascoltatori = new Set();

/** Chi filtra i doppioni si iscrive qui; ritorna la funzione per smettere. */
export function ascoltaVociMute(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}

/** Chi suona chiama qui quando un messaggio e rimasto muto del tutto. */
export function segnalaVoceMuta(chiave) {
  for (const fn of [...ascoltatori]) {
    try { fn(chiave); } catch { /* un ascoltatore rotto non zittisce gli altri */ }
  }
}

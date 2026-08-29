// CANTIERE — collegato alla FASE 5 del documento di Mondo (b.575).
// Finche' quella fase non arriva questo file esiste e non lo chiama
// ancora nessuno: e' voluto, il documento dice «nessun cambio UI».
// Quando verra collegato, questa riga se ne va con la fase.
// ═══════════════════════════════════════════════════════════════
// SESSION — SOLO QUELLO CHE STA SUCCEDENDO ADESSO (b.575, FASE 1)
//
// Documento di Luca, capitolo 12: «queste informazioni non devono
// diventare preferenze permanenti».
//
// E' il difetto che ha morso proprio oggi. Il filtro contenuti veniva
// salvato dentro `prefs` come se fosse una scelta di vita: schiacci
// «solo video» per curiosita e da quel momento, per sempre, su ogni
// apparecchio, Mondo si apre con soli video. Non era una preferenza:
// era un gesto di dieci secondi.
//
// Qui dentro sta cio che muore quando chiudi. L'unica eccezione la dice
// il capitolo 14: il sistema puo IMPARARE indirettamente che preferisci
// i video — ma quello finisce in memory.js come osservazione nostra,
// non qui come dichiarazione tua.
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

export const MODI = ['forYou', 'latest', 'following'];
export const FILTRI = ['all', 'video', 'articles', 'discussions'];

export const SESSION_INIZIALE = {
  mode: 'forYou',
  contentFilter: 'all',
  selectedCountry: null,
  currentQuery: null,
  currentTopic: null,
};

export function normalizzaSession(x) {
  const d = (x && typeof x === 'object') ? x : {};
  return {
    mode: MODI.includes(d.mode) ? d.mode : SESSION_INIZIALE.mode,
    contentFilter: FILTRI.includes(d.contentFilter) ? d.contentFilter : SESSION_INIZIALE.contentFilter,
    selectedCountry: d.selectedCountry ? String(d.selectedCountry).toUpperCase().slice(0, 2) : null,
    currentQuery: d.currentQuery ? String(d.currentQuery) : null,
    currentTopic: d.currentTopic ? String(d.currentTopic) : null,
  };
}

/** Il vecchio filtro del feed, tradotto nei nomi nuovi. */
export function filtroDaVecchio(v) {
  if (v === 'video') return 'video';
  if (v === 'articoli') return 'articles';
  return 'all';
}

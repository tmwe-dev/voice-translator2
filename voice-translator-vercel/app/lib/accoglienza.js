// ═══════════════════════════════════════════════════════════════
// L'ACCOGLIENZA — la prima domanda che facciamo (b.562)
//
// NOTA SUL NOME, e non e' un dettaglio: questo file doveva chiamarsi
// `interessi.js`, ma quel nome era gia occupato da un pezzo che pesa
// gli argomenti aperti (dal b.517). L'ho scoperto perche' lo scandaglio
// degli import fantasma (b.539) e' diventato rosso: avevo scritto sopra
// a un file vivo — esattamente l'errore di b.545 con `reazioni.js`, che
// aveva tenuto morta una rotta per otto versioni.
// LA REGOLA, che stavolta e' scritta anche qui: prima di creare un file
// si guarda se il nome e' libero. `ls` costa un secondo.
//
// Ordine di Luca: «quando entri la prima volta nella sezione Mondo crea
// una pagina di onboarding semplice con scelta di interessi come su
// Instagram, Facebook, LinkedIn, e su conferma imposta gia la
// piattaforma con contenuti per partire».
//
// PERCHE' TUTTI LO FANNO, ed e' la ragione vera: un sistema di
// raccomandazione nasce senza semi. Non sa niente di te, e le prime
// sessioni servirebbero solo a raccogliere segnali — cioe a farti
// vedere roba a caso finche' non sbaglia abbastanza da capire.
// Chiedere e' il modo piu rapido e piu onesto di saltare quel giro.
//
// LA SCELTA CHE HO FATTO QUI: l'etichetta E' la ricerca. «Cinema» in
// italiano, «Cinéma» in francese, «映画» in giapponese: la parola che
// leggi e' la parola che si va a cercare. Niente seconda tabella di
// query da tenere allineata a mano in trentotto lingue — una cosa sola,
// che non puo sfasarsi.
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

/**
 * Diciotto, non quaranta: una griglia che si legge in un colpo d'occhio.
 * Le prime sei riusano etichette che esistono da b.147 (le categorie
 * del giornale), le altre dodici sono nate in b.555 apposta per qui.
 */
export const INTERESSI = [
  { id: 'mondo',      chiave: 'catWorld',    icona: 'globe' },
  { id: 'sport',      chiave: 'catSport',    icona: 'trophy' },
  { id: 'tecnologia', chiave: 'catTech',     icona: 'zap' },
  { id: 'economia',   chiave: 'catEconomy',  icona: 'credit' },
  { id: 'scienza',    chiave: 'catScience',  icona: 'graduation' },
  { id: 'arte',       chiave: 'catArt',      icona: 'wand' },
  { id: 'cinema',     chiave: 'intCinema',   icona: 'video' },
  { id: 'musica',     chiave: 'intMusica',   icona: 'music' },
  { id: 'viaggi',     chiave: 'intViaggi',   icona: 'doorOpen' },
  { id: 'cucina',     chiave: 'intCucina',   icona: 'gift' },
  { id: 'salute',     chiave: 'intSalute',   icona: 'heart' },
  { id: 'ambiente',   chiave: 'intAmbiente', icona: 'wave' },
  { id: 'motori',     chiave: 'intMotori',   icona: 'swap' },
  { id: 'giochi',     chiave: 'intGiochi',   icona: 'target' },
  { id: 'moda',       chiave: 'intModa',     icona: 'star' },
  { id: 'storia',     chiave: 'intStoria',   icona: 'history' },
  { id: 'spazio',     chiave: 'intSpazio',   icona: 'refresh' },
  { id: 'animali',    chiave: 'intAnimali',  icona: 'users' },
];

/** Almeno tre: sotto, il giornale nasce storto e non impara niente. */
export const MINIMO = 3;

/** Gli interessi scelti, ripuliti da quelli che non esistono piu. */
export function interessiDi(prefs) {
  const dentro = new Set(INTERESSI.map((i) => i.id));
  return (Array.isArray(prefs?.interessi) ? prefs.interessi : []).filter((x) => dentro.has(x));
}

/**
 * LA PRIMA VOLTA E' LA PRIMA VOLTA.
 * Si chiede una volta sola: se hai scelto, o se hai detto «non adesso»,
 * non si chiede piu. Un'applicazione che ripete la stessa domanda ad
 * ogni ingresso ha gia perso.
 */
export function daChiedere(prefs) {
  if (interessiDi(prefs).length > 0) return false;
  if (prefs?.interessiSaltati) return false;
  // ═══ b.571 — E CHI HA GIA UNA STORIA NON E' NUOVO ═══
  // Collaudo di Luca: «quando faccio back da quella pagina mostra il
  // menu onboarding». Giusto: lui non aveva mai risposto alla domanda —
  // la domanda non esisteva quando ha cominciato — e quindi gli
  // ricompariva ad ogni ingresso.
  // Ma la domanda serve a UNA cosa sola: avere dei semi da cui partire.
  // Chi ha gia cercato qualcosa, o messo una stella, i semi ce li ha —
  // e sono migliori di qualunque risposta a un questionario, perche' se
  // li e' scelti facendo. Chiedergli gli interessi non e' accogliere: e'
  // rifargli compilare un modulo che ha gia riempito vivendo.
  const storia = (Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti.length : 0)
    + (Array.isArray(prefs?.ricerchePreferite) ? prefs.ricerchePreferite.length : 0);
  return storia === 0;
}

/**
 * DA INTERESSE A SEME.
 * `L` e' la funzione di traduzione: l'etichetta nella lingua di chi
 * guarda diventa la domanda da fare al mondo. Il peso e' 2 — sotto le
 * ricerche che hai salvato con la stella (3), sopra le predefinite (1):
 * l'hai scelto tu, ma con un tocco, non con un gesto di affetto.
 */
export function semiDaInteressi(prefs, L) {
  if (typeof L !== 'function') return [];
  return interessiDi(prefs).map((id) => {
    const voce = INTERESSI.find((i) => i.id === id);
    const parola = String(L(voce.chiave) || '').trim();
    return parola ? { query: parola, origine: 'interesse', peso: 2 } : null;
  }).filter(Boolean);
}

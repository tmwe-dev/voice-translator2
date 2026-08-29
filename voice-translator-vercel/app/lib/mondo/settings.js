// ═══════════════════════════════════════════════════════════════
// SETTINGS — SOLO CIO CHE L'UTENTE HA DECISO (b.575, FASE 1)
//
// Documento di Luca, capitoli 2 e 3. La regola che li tiene insieme e'
// la numero 6 delle Regole Fondamentali: «nessuna preferenza tecnica
// esposta all'utente se puo essere automatizzata».
//
// Oggi nel pannello ci sono cose come «modo approfondito», «ritmo»,
// «numero fonti», «aggiorna ogni N minuti». Non sono preferenze: sono
// DECISIONI DEL MOTORE travestite da scelte. Chiedere a chi legge un
// giornale quante fonti interrogare e' come chiedergli quanti
// giornalisti mandare in piazza: non e' rispetto, e' scaricargli
// addosso un lavoro nostro.
//
// Qui resta solo cio che una persona puo davvero volere:
//   · che mix di contenuti mi va                      (contentMix)
//   · i titoli tradotti o in lingua originale         (titles)
//   · quanto ultim'ora voglio                         (breaking)
//   · i video partono da soli o no                    (autoplayVideo)
//   · voglio essere seguito o no                      (personalization)
//
// FASE 1: questo file NON cambia l'interfaccia. Definisce la forma e sa
// leggere le preferenze vecchie senza perderne nessuna.
//
// File PURO: nessun import (lezione di b.559).
// ═══════════════════════════════════════════════════════════════

export const VALORI = {
  contentMix:      ['balanced', 'moreVideo', 'moreArticles'],
  titles:          ['translated', 'original'],
  breaking:        ['important', 'all', 'off'],
  autoplayVideo:   [true, false],
  personalization: [true, false],
};

export const SETTINGS_DEFAULT = {
  contentMix: 'balanced',
  titles: 'translated',
  breaking: 'important',
  autoplayVideo: true,
  personalization: true,
};

/** Un valore ammesso, o il default. Nessun valore inventato entra. */
function buono(campo, valore) {
  const ammessi = VALORI[campo];
  if (!ammessi) return undefined;
  return ammessi.includes(valore) ? valore : SETTINGS_DEFAULT[campo];
}

/** Impostazioni sane, sempre complete, da qualunque cosa arrivi. */
export function normalizzaSettings(x) {
  const dentro = (x && typeof x === 'object') ? x : {};
  const fuori = { ...SETTINGS_DEFAULT };
  for (const campo of Object.keys(SETTINGS_DEFAULT)) {
    if (Object.prototype.hasOwnProperty.call(dentro, campo)) {
      fuori[campo] = buono(campo, dentro[campo]);
    }
  }
  return fuori;
}

/**
 * DALLE PREFERENZE VECCHIE, SENZA PERDERE NIENTE (capitolo 41).
 *
 * Le corrispondenze sono quelle scritte nel documento; dove il
 * documento non dice niente si tiene il default, che e' sempre meglio
 * di una traduzione inventata.
 */
export function settingsDaPrefs(prefs) {
  const p = (prefs && typeof prefs === 'object') ? prefs : {};
  const gia = p.mondoSettings;
  if (gia && typeof gia === 'object') return normalizzaSettings(gia);

  const fuori = { ...SETTINGS_DEFAULT };

  // mondoFeedFiltro (video | articoli | entrambi) → contentMix
  if (p.mondoFeedFiltro === 'video') fuori.contentMix = 'moreVideo';
  else if (p.mondoFeedFiltro === 'articoli') fuori.contentMix = 'moreArticles';

  // mondoTitoli (tradotti | originali) → titles
  if (p.mondoTitoli === 'originali' || p.mondoTitoli === 'original') fuori.titles = 'original';

  // l'ultim'ora: chi l'aveva spenta resta senza, e nessun timer
  // sopravvive — il motore decide da solo quanto guardare (cap. 29)
  if (p.mondoBreaking === 'off' || p.mondoBreaking === false) fuori.breaking = 'off';
  else if (p.mondoBreaking === 'all' || p.mondoBreaking === 'tutte') fuori.breaking = 'all';

  // b.580 — b.515 salvava la scelta come mondoAutoplayVideo. Durante
  // la migrazione era rimasto fuori da questo ponte e chi l'aveva
  // disattivato tornava involontariamente al default true.
  if (p.autoPlay === false || p.mondoAutoplay === false || p.mondoAutoplayVideo === false) fuori.autoplayVideo = false;
  if (p.personalizzazione === false || p.mondoPersonalizza === false) fuori.personalization = false;

  return fuori;
}

// Le chiavi che il documento (cap. 3) toglie di mezzo: non sono
// preferenze di nessuno, sono mestiere del motore. Elencate qui perche'
// la pulizia dell'interfaccia (FASE 11) sappia esattamente cosa
// togliere, e perche' nessuno le rimetta per distrazione.
export const NON_PIU_PREFERENZE = [
  'mondoModo',        // veloce / approfondita  → FAST/VERIFY/DEEP automatici
  'mondoRitmo',
  'mondoAggiorna',    // ogni N minuti          → lo decide il motore
  'numFonti',
  'mondoNumFonti',
  'deepSearch',
];
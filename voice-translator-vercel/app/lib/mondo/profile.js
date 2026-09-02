// ═══════════════════════════════════════════════════════════════
// PROFILE — COSA MI INTERESSA (b.575, FASE 1)
//
// Documento di Luca, capitolo 4. Il Profile contiene solo cose STABILI
// e DICHIARATE: quello che una persona direbbe di se stessa se
// glielo chiedessi. Non e' la memoria di cosa ha fatto — quella e'
// un'altra cosa e sta in memory.js, e mescolarle e' il motivo per cui
// oggi non si capisce piu chi ha deciso cosa.
//
// La differenza, in una riga:
//   · PROFILE  = «mi interessa la Formula 1»   → l'hai detto tu
//   · MEMORY   = «apre sempre roba di F1»      → l'abbiamo notato noi
//
// E vale la regola 7 delle Regole Fondamentali: «il comando esplicito
// dell'utente batte sempre il comportamento appreso». Se le due cose
// non stanno in due posti diversi, quella regola non si puo nemmeno
// scrivere.
//
// Gli interessi sono ID canonici (taxonomy.js), mai parole tradotte.
//
// Unico import: la tassonomia, che e' pura a sua volta.
// ═══════════════════════════════════════════════════════════════
import { canonico, esiste } from './taxonomy.js';

export const PROFILE_VUOTO = {
  interests: [],
  followedTopics: [],
  followedEntities: [],
  followedSources: [],
  blockedSources: [],
};

const TETTO = 60;   // oltre, non e' piu un profilo: e' un archivio

function listaCanonica(x) {
  const visti = new Set();
  const fuori = [];
  for (const v of (Array.isArray(x) ? x : [])) {
    const id = canonico(v);
    if (!id || visti.has(id)) continue;
    visti.add(id);
    fuori.push(id);
    if (fuori.length >= TETTO) break;
  }
  return fuori;
}

function listaTesto(x) {
  const visti = new Set();
  const fuori = [];
  for (const v of (Array.isArray(x) ? x : [])) {
    const s = String(v || '').trim().toLowerCase();
    if (!s || visti.has(s)) continue;
    visti.add(s);
    fuori.push(s);
    if (fuori.length >= TETTO) break;
  }
  return fuori;
}

/** Un profilo sano e completo, da qualunque cosa arrivi. */
export function normalizzaProfile(x) {
  const d = (x && typeof x === 'object') ? x : {};
  return {
    interests: listaCanonica(d.interests),
    followedTopics: listaCanonica(d.followedTopics),
    followedEntities: listaTesto(d.followedEntities),
    followedSources: listaTesto(d.followedSources),
    blockedSources: listaTesto(d.blockedSources),
  };
}

/**
 * DALLE PREFERENZE VECCHIE (capitolo 41).
 * `interessi` (parole italiane) → `interests` (ID canonici).
 * Chi aveva scelto «economia» ritrova `economy` e non se ne accorge.
 */
export function profileDaPrefs(prefs) {
  const p = (prefs && typeof prefs === 'object') ? prefs : {};
  if (p.mondoProfile && typeof p.mondoProfile === 'object') return normalizzaProfile(p.mondoProfile);
  return normalizzaProfile({
    interests: p.interessi,
    followedTopics: (Array.isArray(p.ricerchePreferite) ? p.ricerchePreferite : []).map((r) => r?.q),
    followedSources: p.fontiSeguite,
    blockedSources: p.fontiBloccate,
  });
}

/** Segui / non seguire, senza doppioni e senza nomi inventati. */
export function seguiTopic(profile, topic) {
  const id = canonico(topic);
  const p = normalizzaProfile(profile);
  if (!id || p.followedTopics.includes(id)) return p;
  return { ...p, followedTopics: [id, ...p.followedTopics].slice(0, TETTO) };
}

// b.596 — qui c'era nonSeguireTopic, il simmetrico di seguiTopic (sopra)
// per togliere un topic seguito. Non la chiamava nessuno: seguiTopic e'
// cablato in UI, il suo contrario no — verifica se "smetti di seguire"
// esiste davvero in interfaccia prima di dare per scontato che serva.

export function bloccaFonte(profile, dominio) {
  const d = String(dominio || '').trim().toLowerCase();
  const p = normalizzaProfile(profile);
  if (!d || p.blockedSources.includes(d)) return p;
  return {
    ...p,
    blockedSources: [d, ...p.blockedSources].slice(0, TETTO),
    followedSources: p.followedSources.filter((s) => s !== d),   // non si segue cio che si blocca
  };
}

/** Tutto cio che questa persona ha DICHIARATO di voler vedere. */
export function topicDichiarati(profile) {
  const p = normalizzaProfile(profile);
  const visti = new Set();
  const fuori = [];
  for (const t of [...p.followedTopics, ...p.interests]) {
    if (!esiste(t) || visti.has(t)) continue;
    visti.add(t); fuori.push(t);
  }
  return fuori;
}

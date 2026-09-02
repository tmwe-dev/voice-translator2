// ═══════════════════════════════════════════════════════════════
// MEMORY — COSA HAI FATTO (b.575, FASE 1)
//
// Documento di Luca, capitoli 7, 8, 9. La memoria e' cio che ABBIAMO
// NOTATO, e sta separata dal profilo che e' cio che HAI DETTO. Sono due
// cose diverse e la differenza conta: le tue parole non scadono mai, le
// nostre osservazioni si.
//
// IL DECADIMENTO (capitolo 9) e' la parte che fa la differenza fra un
// sistema che ti conosce e uno che ti incastra:
//   «Hai guardato Formula 1 a maggio quindi a dicembre sei ancora un
//    fanatico di Formula 1» — no.
// Dopo 30 giorni un segnale vale il 75%, dopo 90 il 50%, dopo 180 il
// 25%. Le preferenze DICHIARATE non decadono: quelle le hai dette tu.
//
// E c'e' una scelta che vale la pena spiegare: il decadimento non e' un
// lavoro periodico che passa a limare i numeri (non esiste un momento
// in cui girerebbe: il telefono e' spento, la pagina e' chiusa). Si
// calcola AL MOMENTO DELLA LETTURA, dall'ora dell'ultimo tocco. Cosi la
// memoria e' giusta anche dopo sei mesi di silenzio, e non c'e' niente
// da tenere acceso.
//
// Unico import: i pesi degli eventi, che sono puri.
// ═══════════════════════════════════════════════════════════════
import { pesoDi, evento as fabbricaEvento } from './events.js';

export const MEMORY_VUOTA = {
  topicAffinity: {},
  sourceAffinity: {},
  entityAffinity: {},
  formatAffinity: {},
  recentViews: [],
  recentSearches: [],
};

export const GIORNO = 24 * 3600 * 1000;
export const TETTO_VISTI = 400;
const TETTO_RICERCHE = 20;

/**
 * Quanto vale oggi un segnale toccato l'ultima volta `quando`.
 * I tre punti del documento (30gg → 75%, 90gg → 50%, 180gg → 25%) sono
 * quasi esattamente un dimezzamento ogni 90 giorni: si usa quello, che
 * e' una curva sola invece di tre gradini, e non fa saltare il valore
 * il giorno del compleanno del segnale.
 */
export function fattoreDecadimento(quando, adesso = Date.now()) {
  const giorni = Math.max(0, (adesso - (Number(quando) || 0)) / GIORNO);
  return 0.5 ** (giorni / 90);
}

function voce(x) {
  if (typeof x === 'number') return { peso: x, at: 0 };       // formato vecchio: nessuna data
  return { peso: Number(x?.peso) || 0, at: Number(x?.at) || 0 };
}

/** La memoria in forma sana, da qualunque cosa arrivi. */
function normalizzaMemory(x) {
  const d = (x && typeof x === 'object') ? x : {};
  const mappa = (m) => {
    const fuori = {};
    for (const [k, v] of Object.entries(m && typeof m === 'object' ? m : {})) {
      const s = String(k || '').trim();
      if (!s) continue;
      fuori[s] = voce(v);
    }
    return fuori;
  };
  return {
    topicAffinity: mappa(d.topicAffinity),
    sourceAffinity: mappa(d.sourceAffinity),
    entityAffinity: mappa(d.entityAffinity),
    formatAffinity: mappa(d.formatAffinity),
    recentViews: (Array.isArray(d.recentViews) ? d.recentViews : []).slice(0, TETTO_VISTI),
    recentSearches: (Array.isArray(d.recentSearches) ? d.recentSearches : []).slice(0, TETTO_RICERCHE),
  };
}

/**
 * Il peso di un topic OGGI, decadimento applicato.
 * Si legge da qui e da nessun'altra parte: e' l'unica fonte di verita
 * (regola 3 delle Regole Fondamentali).
 */
export function affinitaTopic(memory, topic, adesso = Date.now()) {
  const m = normalizzaMemory(memory);
  const v = m.topicAffinity[String(topic || '')];
  if (!v) return 0;
  if (!v.at) return v.peso;               // segnale senza data: non lo si punisce
  return v.peso * fattoreDecadimento(v.at, adesso);
}

export function affinitaFonte(memory, dominio, adesso = Date.now()) {
  const m = normalizzaMemory(memory);
  const v = m.sourceAffinity[String(dominio || '').toLowerCase()];
  if (!v) return 0;
  if (!v.at) return v.peso;
  return v.peso * fattoreDecadimento(v.at, adesso);
}

function somma(mappa, chiave, peso, at) {
  const k = String(chiave || '');
  if (!k) return mappa;
  const prima = mappa[k] || { peso: 0, at: 0 };
  // il peso vecchio invecchia PRIMA di ricevere il nuovo: sommare un
  // punto di oggi a dieci di sei mesi fa darebbe undici punti freschi,
  // che e' esattamente la bolla che il capitolo 23 vuole evitare
  const vecchio = prima.at ? prima.peso * fattoreDecadimento(prima.at, at) : prima.peso;
  return { ...mappa, [k]: { peso: Math.max(-100, Math.min(100, vecchio + peso)), at } };
}

/**
 * Registra un evento. Torna una memoria NUOVA (non tocca quella data):
 * chi chiama decide se e dove salvarla.
 */
export function registra(memory, ev) {
  const e = ev && ev.type ? ev : null;
  if (!e) return normalizzaMemory(memory);
  const peso = pesoDi(e.type);
  const at = Number(e.at) || Date.now();
  let m = normalizzaMemory(memory);

  for (const t of (e.topics || [])) m = { ...m, topicAffinity: somma(m.topicAffinity, t, peso, at) };
  if (e.source) m = { ...m, sourceAffinity: somma(m.sourceAffinity, e.source, peso, at) };
  if (e.format) m = { ...m, formatAffinity: somma(m.formatAffinity, e.format, peso, at) };

  if (e.type === 'VIEW' || e.type === 'COMPLETE_VIEW' || e.type === 'OPEN') {
    if (e.contentId) {
      m = { ...m, recentViews: [{ id: e.contentId, at }, ...m.recentViews.filter((v) => v?.id !== e.contentId)].slice(0, TETTO_VISTI) };
    }
  }
  if (e.type === 'SEARCH' && e.query) {
    m = { ...m, recentSearches: [{ q: e.query, at }, ...m.recentSearches.filter((r) => r?.q !== e.query)].slice(0, TETTO_RICERCHE) };
  }
  return m;
}

/** Scorciatoia: registra(memory, evento(tipo, dati)). */
export function registraEvento(memory, tipo, dati) {
  return registra(memory, fabbricaEvento(tipo, dati));
}

// b.596 — qui c'era topicPiuForti, che ordinava i topic per affinita.
// Non la chiamava nessuno.

/**
 * DALLE PREFERENZE VECCHIE (capitolo 41): `argomentiVisti` e `gusti`
 * diventano `topicAffinity`, `ricercheRecenti` diventa `recentSearches`.
 */
export function memoryDaPrefs(prefs) {
  const p = (prefs && typeof prefs === 'object') ? prefs : {};
  if (p.mondoMemory && typeof p.mondoMemory === 'object') return normalizzaMemory(p.mondoMemory);
  const topicAffinity = {};
  for (const [k, v] of Object.entries(p.argomentiVisti && typeof p.argomentiVisti === 'object' ? p.argomentiVisti : {})) {
    topicAffinity[k] = { peso: Number(v) || 0, at: 0 };
  }
  for (const [k, v] of Object.entries(p.gusti && typeof p.gusti === 'object' ? p.gusti : {})) {
    const prima = topicAffinity[k]?.peso || 0;
    topicAffinity[k] = { peso: prima + (Number(v) || 0), at: 0 };
  }
  return normalizzaMemory({
    topicAffinity,
    recentSearches: (Array.isArray(p.ricercheRecenti) ? p.ricercheRecenti : []).map((r) => ({ q: r?.q, at: 0 })),
  });
}

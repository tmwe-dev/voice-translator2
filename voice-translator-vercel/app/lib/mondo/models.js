// ═══════════════════════════════════════════════════════════════
// UN SOLO MODELLO DI CONTENUTO (b.575, FASI 1-2)
//
// Documento di Luca, capitolo 15: «articoli, video, discussioni e
// breaking devono essere normalizzati».
//
// Oggi un articolo e un video sono due animali diversi che vivono in
// due elenchi diversi, e ogni regola va scritta due volte — quando va
// bene. Quando va male, come in b.568, la regia lavorava solo sugli
// articoli e meta del carosello restava senza regole, senza «perche'»,
// senza quota di mondo. Nessuno l'aveva deciso: era successo, perche'
// con due forme diverse e' piu facile dimenticarne una.
//
// `ContentCandidate` e' l'unica forma che entra nel motore. Chi la
// costruisce si prende la briga di riempirla; da li in poi il Ranker,
// la Regia e la schermata vedono una cosa sola.
//
// Unico import: la tassonomia, pura.
// ═══════════════════════════════════════════════════════════════
import { canonico } from './taxonomy.js';

export const TIPI = ['article', 'video', 'discussion', 'breaking'];

/** Il dominio nudo di un indirizzo, senza www e senza protocollo. */
export function dominioDi(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const senza = s.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '');
  return senza.split(/[/?#]/)[0].toLowerCase();
}

function testo(x, tetto = 400) {
  return String(x ?? '').trim().slice(0, tetto);
}

function quando(x) {
  if (!x) return 0;
  if (typeof x === 'number') return x;
  const t = Date.parse(x);
  return Number.isNaN(t) ? 0 : t;
}

function topicsCanonici(x) {
  const visti = new Set();
  const fuori = [];
  for (const t of (Array.isArray(x) ? x : [])) {
    const id = canonico(t);
    if (!id || visti.has(id)) continue;
    visti.add(id); fuori.push(id);
  }
  return fuori;
}

/**
 * Un candidato in forma piena. Tutti i campi esistono SEMPRE, anche
 * vuoti: e' la lezione che b.570 e b.572 mi hanno fatto pagare due
 * volte in un giorno. Un campo assente e un campo vuoto sembrano la
 * stessa cosa finche' qualcuno non ci legge dentro, e allora la
 * differenza e' fra una scheda povera e una schermata rossa.
 */
export function candidato(x = {}) {
  const url = testo(x.url, 2000);
  const type = TIPI.includes(x.type) ? x.type : (x.canale || x.videoId ? 'video' : 'article');
  return {
    id: testo(x.id || url || x.titolo || x.title, 200),
    type,
    title: testo(x.title ?? x.titolo, 300),
    summary: testo(x.summary ?? x.sintesi, 1200),
    url,
    image: testo(x.image ?? x.immagine ?? x.miniatura, 2000),
    source: testo(x.source ?? x.fonte ?? x.canale ?? x.fonti?.[0]?.fonte, 120),
    sourceId: testo(x.sourceId ?? x.dominio ?? dominioDi(url) ?? x.fonti?.[0]?.dominio, 120).toLowerCase(),
    country: testo(x.country ?? x.paese, 2).toUpperCase(),
    language: testo(x.language ?? x.lingua ?? x.lang, 5).toLowerCase().split('-')[0],
    publishedAt: quando(x.publishedAt ?? x.pubblicato),
    topics: topicsCanonici(x.topics ?? x.argomenti),
    entities: (Array.isArray(x.entities) ? x.entities : []).map((e) => testo(e, 80)).filter(Boolean),
    sources: Array.isArray(x.fonti) ? x.fonti.slice(0, 8) : (Array.isArray(x.sources) ? x.sources.slice(0, 8) : []),
    qualityScore: Number(x.qualityScore) || 0,
    collectiveScore: Number(x.collectiveScore ?? x.punteggio) || 0,
    searchIntent: testo(x.searchIntent ?? x.seme, 200),
    discoveryReason: testo(x.discoveryReason ?? x.motivo, 60),
  };
}

/** Un mazzo di candidati, senza vuoti. */
export function candidati(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((x) => candidato(x))
    .filter((c) => c.id && (c.title || c.url));
}

/**
 * PRIORITA ASSOLUTE (capitolo 18): prima del ranking si TOGLIE.
 * Nascosto, fonte bloccata, contenuto invalido, doppione.
 * Il doppione si riconosce dall'indirizzo, non dal titolo: due testate
 * scrivono lo stesso titolo di continuo e sono due notizie vere (per
 * quelle c'e' il raggruppamento per evento, capitolo 27).
 */
export function ammessi(lista, { hidden = [], blockedSources = [] } = {}) {
  const nascosti = new Set((Array.isArray(hidden) ? hidden : []).map((x) => String(x || '')));
  const bloccate = new Set((Array.isArray(blockedSources) ? blockedSources : []).map((x) => String(x || '').toLowerCase()));
  const visti = new Set();
  const fuori = [];
  for (const c of candidati(lista)) {
    const chiave = c.url || c.id;
    if (visti.has(chiave)) continue;
    if (nascosti.has(c.id) || nascosti.has(c.url)) continue;
    if (c.sourceId && bloccate.has(c.sourceId)) continue;
    visti.add(chiave);
    fuori.push(c);
  }
  return fuori;
}

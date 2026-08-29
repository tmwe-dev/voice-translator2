// ═══════════════════════════════════════════════════════════════
// MONDO LIVE — EVENTI, NON ARTICOLI (b.580)
//
// Un articolo e' una fonte. Un evento e' cio che sta succedendo.
// Questo file prende i candidati gia normalizzati di Mondo e costruisce
// cluster stabili, assegna stato/conferma e calcola un solo punteggio
// breaking. E' puro: lo usano sia il server sia il browser.
// ═══════════════════════════════════════════════════════════════

export const BREAKING_WEIGHTS = Object.freeze({
  importance: 0.25,
  novelty: 0.20,
  confidence: 0.15,
  freshness: 0.15,
  quality: 0.10,
  interest: 0.10,
  geography: 0.05,
});

const PAROLE_VUOTE = new Set([
  'the','and','for','with','from','this','that','today','live','news','breaking',
  'il','lo','la','i','gli','le','un','una','uno','di','del','della','delle','dei','da','in','con','su','per','oggi','ultim','ora',
  'el','la','los','las','de','del','una','un','en','con','por','para','hoy',
  'le','les','des','du','de','la','un','une','dans','avec','pour','aujourd',
  'der','die','das','den','von','mit','und','fur','heute',
  'o','a','os','as','um','uma','de','do','da','em','com','para','hoje',
]);

const URGENTE_RE = /\b(earthquake|terremot|tsunami|eruption|eruzion|explosion|esplosion|attack|attacco|war|guerra|invasion|invasione|emergency|emergenza|evacuat|evacua|hostage|ostaggi|mass shooting|sparatoria|crash|disastro|disaster|coup|golpe|default|bank run|rate cut|rate hike|tassi|ceasefire|tregua|missile|drone strike|incendio|wildfire|alluvion|flood|hurricane|uragano|tornado|blackout|outage|dimission|resign|election result|risultati elettor|central bank|banca centrale)\b/i;
const MOLTO_GRAVE_RE = /\b(tsunami|magnitude [7-9]|magnitudo [7-9]|invasion|invasione|nuclear|nucleare|mass casualty|stato d'emergenza|state of emergency|coup|golpe|assassinat|major earthquake|forte terremoto)\b/i;

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));

function testoPulito(x) {
  return String(x || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function token(x) {
  return testoPulito(x).split(/\s+/).filter((p) => p.length > 2 && !PAROLE_VUOTE.has(p));
}

function hash32(x) {
  let h = 2166136261;
  for (const c of String(x || '')) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function improntaTitolo(title) {
  const t = [...new Set(token(title))].slice(0, 10).sort();
  return t.join(' ');
}

function similarita(a, b) {
  const A = new Set(token(a));
  const B = new Set(token(b));
  if (!A.size || !B.size) return 0;
  let comuni = 0;
  for (const x of A) if (B.has(x)) comuni += 1;
  const unione = A.size + B.size - comuni;
  return unione ? comuni / unione : 0;
}

function tempoMs(x) {
  const t = new Date(x || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function freschezza(publishedAt, now = Date.now()) {
  const t = tempoMs(publishedAt);
  if (!t) return 0.35;
  const ore = Math.max(0, (now - t) / 3600000);
  if (ore <= 0.25) return 1;
  if (ore <= 1) return 0.92;
  if (ore <= 3) return 0.78;
  if (ore <= 6) return 0.62;
  if (ore <= 12) return 0.42;
  if (ore <= 24) return 0.24;
  return 0.08;
}

function qualitaDaFonti(sources) {
  const s = Array.isArray(sources) ? sources : [];
  if (!s.length) return 0.25;
  const domini = new Set(s.map((f) => String(f?.dominio || f?.fonte || '').toLowerCase()).filter(Boolean));
  const diversita = clamp01(domini.size / 4);
  const complete = s.filter((f) => f?.url && (f?.dominio || f?.fonte)).length / s.length;
  return clamp01(0.45 + diversita * 0.35 + complete * 0.20);
}

function confidenzaDaFonti(sourceCount) {
  if (sourceCount >= 5) return 1;
  if (sourceCount >= 3) return 0.9;
  if (sourceCount === 2) return 0.68;
  return 0.32;
}

function importanzaTestuale(evento) {
  const testo = `${evento?.title || ''} ${evento?.summary || ''}`;
  if (MOLTO_GRAVE_RE.test(testo)) return 1;
  if (URGENTE_RE.test(testo)) return 0.78;
  return 0.38;
}

function interesseEvento(evento, followedTopics = []) {
  const seguiti = new Set((Array.isArray(followedTopics) ? followedTopics : []).filter(Boolean));
  if (!seguiti.size) return 0;
  const topics = Array.isArray(evento?.topics) ? evento.topics : [];
  return topics.some((t) => seguiti.has(t)) ? 1 : 0;
}

function geografiaEvento(evento, countries = []) {
  const voluti = new Set((Array.isArray(countries) ? countries : []).map((x) => String(x).toUpperCase()));
  if (!voluti.size) return 0;
  const suoi = Array.isArray(evento?.countries) ? evento.countries : [];
  return suoi.some((c) => voluti.has(String(c).toUpperCase())) ? 1 : 0;
}

export function breakingScore(evento, { now = Date.now(), followedTopics = [], countries = [], isNew = true } = {}) {
  const sourceCount = Number(evento?.sourceCount) || 0;
  const segnali = {
    importance: importanzaTestuale(evento),
    novelty: isNew ? 1 : 0.35,
    confidence: confidenzaDaFonti(sourceCount),
    freshness: freschezza(evento?.publishedAt || evento?.updatedAt, now),
    quality: qualitaDaFonti(evento?.sources),
    interest: interesseEvento(evento, followedTopics),
    geography: geografiaEvento(evento, countries),
  };
  let score = 0;
  for (const [k, w] of Object.entries(BREAKING_WEIGHTS)) score += segnali[k] * w;
  return { score: clamp01(score), segnali };
}

function statoDaFonti(n) {
  if (n >= 3) return 'confirmed';
  if (n === 2) return 'developing';
  return 'emerging';
}

function fontiUniche(fonti) {
  const out = [];
  const seen = new Set();
  for (const f of (Array.isArray(fonti) ? fonti : [])) {
    const k = String(f?.url || f?.dominio || f?.fonte || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.slice(0, 20);
}

function unisciCluster(a, b) {
  const sources = fontiUniche([...(a.sources || []), ...(b.sources || [])]);
  const countries = [...new Set([...(a.countries || []), ...(b.countries || [])].filter(Boolean))];
  const topics = [...new Set([...(a.topics || []), ...(b.topics || [])].filter(Boolean))];
  const publishedAt = [a.publishedAt, b.publishedAt].filter(Boolean).sort()[0] || a.publishedAt || b.publishedAt;
  return {
    ...a,
    title: (b.title || '').length > (a.title || '').length ? b.title : a.title,
    summary: (b.summary || '').length > (a.summary || '').length ? b.summary : a.summary,
    image: a.image || b.image || '',
    url: a.url || b.url || '',
    countries,
    country: countries[0] || a.country || b.country || '',
    topics,
    sources,
    sourceCount: sources.length || Math.max(a.sourceCount || 0, b.sourceCount || 0),
    publishedAt,
    updatedAt: Math.max(Number(a.updatedAt) || 0, Number(b.updatedAt) || 0, Date.now()),
    queryHits: (a.queryHits || 1) + (b.queryHits || 1),
  };
}

/**
 * `entries`: [{ candidate, country, topic, raw }]. `raw.fonti` mantiene
 * le fonti reali prodotte dal raggruppatore. Due ricerche che ritrovano
 * lo stesso fatto diventano un solo evento.
 */
export function clusterBreakingCandidates(entries, { now = Date.now(), followedTopics = [], countries = [] } = {}) {
  const cluster = [];
  for (const e of (Array.isArray(entries) ? entries : [])) {
    const c = e?.candidate || e;
    if (!c?.title) continue;
    const rawSources = e?.raw?.fonti || c?.sources || [];
    const sources = fontiUniche(rawSources);
    const paese = String(e?.country || c?.country || '').toUpperCase();
    const topics = [...new Set([...(c?.topics || []), e?.topic].filter(Boolean))];
    const base = {
      id: '',
      fingerprint: improntaTitolo(c.title),
      title: c.title,
      summary: c.summary || '',
      url: c.url || sources[0]?.url || '',
      image: c.image || '',
      country: paese,
      countries: paese ? [paese] : [],
      topics,
      entities: Array.isArray(c.entities) ? c.entities : [],
      firstSeenAt: now,
      updatedAt: now,
      publishedAt: c.publishedAt || e?.raw?.pubblicato || new Date(now).toISOString(),
      sources,
      sourceCount: sources.length || (c.source ? 1 : 0),
      queryHits: 1,
      status: 'emerging',
      score: 0,
      important: false,
      signals: {},
    };
    const stesso = cluster.findIndex((x) =>
      (base.url && x.url && base.url === x.url)
      || (base.fingerprint && x.fingerprint === base.fingerprint)
      || similarita(base.title, x.title) >= 0.56
    );
    if (stesso >= 0) cluster[stesso] = unisciCluster(cluster[stesso], base);
    else cluster.push(base);
  }

  return cluster.map((e) => {
    // queryHits misura quante ricerche hanno ritrovato il fatto, NON quante
    // fonti indipendenti lo confermano. La conferma usa soltanto sources.
    const sourceCount = e.sourceCount || 0;
    const status = statoDaFonti(sourceCount);
    const scored = breakingScore({ ...e, sourceCount }, { now, followedTopics, countries, isNew: true });
    const urgente = importanzaTestuale(e) >= 0.78;
    // Una sola fonte non puo diventare «importante» soltanto per una
    // parola forte: serve conferma, salvo i casi eccezionali molto gravi.
    const important = (sourceCount >= 2 && scored.score >= 0.64)
      || (sourceCount >= 3 && urgente)
      || (sourceCount >= 2 && importanzaTestuale(e) >= 1 && scored.segnali.freshness >= 0.6);
    const id = `evt_${hash32(`${e.fingerprint}|${e.countries.join(',')}|${Math.floor(tempoMs(e.publishedAt) / 21600000)}`)}`;
    return { ...e, id, sourceCount, status, score: scored.score, important, signals: scored.segnali };
  }).sort((a, b) => b.score - a.score || tempoMs(b.publishedAt) - tempoMs(a.publishedAt));
}

export function matchesFollowed(evento, profile) {
  const topics = new Set([...(profile?.followedTopics || []), ...(profile?.interests || [])]);
  const sources = new Set((profile?.followedSources || []).map((x) => String(x).toLowerCase()));
  const entities = new Set((profile?.followedEntities || []).map((x) => String(x).toLowerCase()));
  if ((evento?.topics || []).some((t) => topics.has(t))) return true;
  if ((evento?.sources || []).some((s) => sources.has(String(s?.dominio || s?.fonte || '').toLowerCase()))) return true;
  if ((evento?.entities || []).some((e) => entities.has(String(e).toLowerCase()))) return true;
  return false;
}

export function trafficFromEvents(events) {
  const counts = {};
  for (const e of (Array.isArray(events) ? events : [])) {
    const paesi = Array.isArray(e?.countries) && e.countries.length ? e.countries : (e?.country ? [e.country] : []);
    for (const c0 of paesi) {
      const c = String(c0 || '').toUpperCase();
      if (!c) continue;
      const peso = 0.25 + clamp01(e.score) * 0.55 + (e.important ? 0.35 : 0);
      counts[c] = (counts[c] || 0) + peso;
    }
  }
  const max = Math.max(0, ...Object.values(counts));
  if (!max) return {};
  const out = {};
  for (const [c, n] of Object.entries(counts)) out[c] = clamp01(n / max);
  return out;
}

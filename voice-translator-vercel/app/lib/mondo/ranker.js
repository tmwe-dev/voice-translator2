// ═══════════════════════════════════════════════════════════════
// IL RANKER — QUANTO VALE OGNI CONTENUTO (b.576, FASE 3)
//
// Documento di Luca, capitoli 16-19. Un solo Ranker, e una sola cosa da
// fare: dire QUANTO E' RILEVANTE ogni contenuto. In quale ordine
// mostrarlo non e' affar suo — quella e' la Regia.
//
// b.578 — la pertinenza non puo essere ASCII in un prodotto mondiale.
// Prima il tokenizer accettava solo a-z/0-9: cinese, giapponese, arabo,
// coreano, cirillico e molte altre scritture diventavano silenziosamente
// zero. Ora la normalizzazione e' Unicode, usa Intl.Segmenter quando il
// runtime lo offre e conserva un fallback Unicode puro.
// ═══════════════════════════════════════════════════════════════
import { PESI_RANKING, FRESCHEZZA } from './rankingConfig.js';
import { ammessi } from './models.js';
import { discende } from './taxonomy.js';
import { affinitaTopic, affinitaFonte } from './memory.js';
import { topicDichiarati, normalizzaProfile } from './profile.js';
import { motivo, ordinaMotivi } from './reasons.js';

const ORA = 3600 * 1000;

/** Da 0 a 1: quanto e' fresco. Ogni tipo invecchia col suo passo. */
export function freschezza(c, adesso = Date.now()) {
  if (!c?.publishedAt) return FRESCHEZZA.senzaDataPunteggio;
  const ore = Math.max(0, (adesso - c.publishedAt) / ORA);
  const mezza = FRESCHEZZA.mezzaVitaOre[c.type] || FRESCHEZZA.mezzaVitaOre.article;
  return 0.5 ** (ore / mezza);
}

/** Forma confrontabile senza perdere lettere non latine. */
function testoNormalizzato(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .trim();
}

/**
 * Le parole di una domanda in QUALUNQUE scrittura.
 * Intl.Segmenter gestisce anche lingue senza spazi fra le parole; il
 * fallback conserva almeno ogni sequenza di lettere/numeri Unicode.
 */
function parole(q) {
  const testo = testoNormalizzato(q);
  if (!testo) return [];

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
      const fuori = [];
      for (const pezzo of segmenter.segment(testo)) {
        if (!pezzo.isWordLike) continue;
        const w = String(pezzo.segment || '').trim();
        if (!w || !/[\p{L}\p{N}]/u.test(w)) continue;
        // Le parole latine molto corte restano rumore come prima; per
        // ideogrammi e altre scritture due caratteri possono gia essere
        // una parola intera e non vanno buttati.
        if (w.length >= 3 || /[^\x00-\x7F]/.test(w)) fuori.push(w);
      }
      if (fuori.length) return fuori;
    }
  } catch { /* runtime senza Segmenter completo: usa il fallback sotto */ }

  return testo
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && (w.length >= 3 || /[^\x00-\x7F]/.test(w)));
}

/**
 * Da 0 a 1: quanto questo contenuto risponde alla domanda scritta.
 * Prima prova la frase intera normalizzata (fondamentale per CJK), poi
 * confronta le parole segmentate. La domanda esplicita resta la priorita.
 */
export function pertinenza(c, query) {
  const domanda = testoNormalizzato(query);
  if (!domanda) return 0;
  const corpo = testoNormalizzato(`${c?.title || ''} ${c?.summary || ''}`);
  if (domanda.length >= 2 && corpo.includes(domanda)) return 1;

  const cerca = parole(domanda);
  if (!cerca.length) return 0;
  const dentro = new Set(parole(corpo));
  let presi = 0;
  for (const w of cerca) if (dentro.has(w)) presi += 1;
  return presi / cerca.length;
}

/** Da 0 a 1: qualita, che NON e' popolarita (capitolo 28). */
export function qualita(c) {
  if (!c) return 0;
  let punti = 0;
  const fonti = Array.isArray(c.sources) ? c.sources.length : 0;
  punti += Math.min(0.35, fonti * 0.12);
  if (c.summary && c.summary.length > 80) punti += 0.2;
  if (c.image) punti += 0.1;
  if (c.publishedAt) punti += 0.15;
  if (c.sourceId) punti += 0.1;
  if (Number(c.qualityScore) > 0) punti += Math.min(0.1, c.qualityScore / 100);
  return Math.min(1, punti);
}

/** Da 0 a 1: quanto tocca cio che hai DICHIARATO. */
function daiTuoiInteressi(c, profile) {
  const miei = topicDichiarati(profile);
  if (!miei.length || !c?.topics?.length) return { punteggio: 0, motivi: [] };
  const p = normalizzaProfile(profile);
  for (const mio of miei) {
    for (const suo of c.topics) {
      if (!discende(suo, mio)) continue;
      const tipo = p.followedTopics.includes(mio) ? 'followed_topic' : 'declared_interest';
      return { punteggio: suo === mio ? 1 : 0.7, motivi: [motivo(tipo, mio)] };
    }
  }
  return { punteggio: 0, motivi: [] };
}

/** Da 0 a 1: quanto assomiglia a cio che apri di solito. */
function daCiòCheFai(c, memory, adesso) {
  let migliore = 0;
  let quale = '';
  for (const t of (c?.topics || [])) {
    const a = affinitaTopic(memory, t, adesso);
    if (a > migliore) { migliore = a; quale = t; }
  }
  const fonte = c?.sourceId ? affinitaFonte(memory, c.sourceId, adesso) : 0;
  const punteggio = Math.max(0, Math.min(1, (migliore + Math.max(0, fonte)) / 20));
  const motivi = [];
  if (migliore >= 4 && quale) motivi.push(motivo('learned_affinity', quale));
  else if (fonte >= 6 && c.sourceId) motivi.push(motivo('followed_source', c.sourceId));
  return { punteggio, motivi };
}

/**
 * IL RANKER. Riceve tutto e torna [{ content, score, reasons }].
 * Prima elimina cio che non puo essere mostrato; poi assegna il valore.
 */
export function rankMondoCandidates({
  candidates = [],
  profile = null,
  memory = null,
  settings = null,
  session = null,
  now = Date.now(),
} = {}) {
  const p = normalizzaProfile(profile);
  const query = session?.currentQuery || '';
  const personalizza = settings?.personalization !== false;

  const puliti = ammessi(candidates, {
    hidden: session?.hidden || [],
    blockedSources: p.blockedSources,
  });

  const fuori = puliti.map((c) => {
    const motivi = [];
    const fresco = freschezza(c, now);
    const q = qualita(c);
    const rilevanza = query ? pertinenza(c, query) : 0;

    const int = personalizza ? daiTuoiInteressi(c, p) : { punteggio: 0, motivi: [] };
    const aff = personalizza ? daCiòCheFai(c, memory, now) : { punteggio: 0, motivi: [] };
    motivi.push(...int.motivi, ...aff.motivi);

    const collettivo = Math.max(0, Math.min(1, (Number(c.collectiveScore) || 0) / 50));
    const esplora = int.punteggio > 0 ? 0 : 1;
    if (esplora && !motivi.length && c.topics?.length) motivi.push(motivo('discovery', c.topics[0]));

    let punteggio =
      PESI_RANKING.intent * rilevanza +
      PESI_RANKING.freshness * fresco +
      PESI_RANKING.interests * int.punteggio +
      PESI_RANKING.affinity * aff.punteggio +
      PESI_RANKING.quality * q +
      PESI_RANKING.collective * collettivo +
      PESI_RANKING.exploration * esplora;

    // La domanda scritta comanda: non e' solo un peso, e' un gradino.
    if (query) {
      if (rilevanza > 0) punteggio += 1;
      else punteggio *= 0.35;
    }
    if (query && rilevanza > 0) motivi.unshift(motivo('explicit_query', query));

    if (c.type === 'breaking') motivi.push(motivo('breaking', c.country || ''));
    if (!motivi.length) motivi.push(motivo('fresh', ''));

    return { content: c, score: Number(punteggio.toFixed(6)), reasons: ordinaMotivi(motivi) };
  });

  return fuori.sort((a, b) => b.score - a.score || (b.content.publishedAt || 0) - (a.content.publishedAt || 0));
}

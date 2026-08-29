// CANTIERE — collegato alla FASE 5 del documento di Mondo (b.576).
// Finche' quella fase non arriva questo file esiste e non lo chiama
// ancora nessuno: e' voluto, il documento dice «nessun cambio UI».
// Quando verra collegato, questa riga se ne va con la fase.
// ═══════════════════════════════════════════════════════════════
// IL RANKER — QUANTO VALE OGNI CONTENUTO (b.576, FASE 3)
//
// Documento di Luca, capitoli 16-19. Un solo Ranker, e una sola cosa da
// fare: dire QUANTO E' RILEVANTE ogni contenuto. In quale ordine
// mostrarlo non e' affar suo — quella e' la Regia (capitolo 20), e
// tenerli separati e' la regola 10.
//
// Perche' e' importante che siano due: rilevanza e sequenza rispondono
// a domande diverse. «Questo pezzo vale» e «questo pezzo va bene QUI,
// dopo altri due della stessa fonte» non si possono decidere insieme
// senza che una delle due vinca sempre. Oggi sono mischiate, ed e' il
// motivo per cui aggiustare la varieta significa sempre rovinare la
// pertinenza.
//
// TRE COSE CHE QUESTO FILE FA E CHE VANNO LETTE COME PROMESSE:
//   · se hai scritto una domanda, quella comanda (capitolo 19). La
//     personalizzazione non cambia la domanda dell'utente. Mai.
//   · ogni contenuto esce con almeno un MOTIVO (capitolo 24): se non
//     sappiamo dire perche' lo mostriamo, non lo mostriamo.
//   · qualita e popolarita sono due numeri diversi (capitolo 28). Una
//     cosa molto cliccata non e' automaticamente migliore.
//
// Import: solo file puri di questa cartella.
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

/** Le parole di una domanda, senza le corte che non distinguono niente. */
function parole(q) {
  return String(q || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
}

/**
 * Da 0 a 1: quanto questo contenuto risponde alla domanda scritta.
 * Titolo e sintesi, niente di piu: se una notizia parla di Tom Cruise
 * lo dice nel titolo.
 */
export function pertinenza(c, query) {
  const cerca = parole(query);
  if (!cerca.length) return 0;
  const dentro = new Set(parole(`${c?.title || ''} ${c?.summary || ''}`));
  let presi = 0;
  for (const w of cerca) if (dentro.has(w)) presi += 1;
  return presi / cerca.length;
}

/** Da 0 a 1: qualita, che NON e' popolarita (capitolo 28). */
export function qualita(c) {
  if (!c) return 0;
  let punti = 0;
  // piu testate raccontano la stessa cosa = piu e' verificata
  const fonti = Array.isArray(c.sources) ? c.sources.length : 0;
  punti += Math.min(0.35, fonti * 0.12);
  if (c.summary && c.summary.length > 80) punti += 0.2;   // ha davvero qualcosa da dire
  if (c.image) punti += 0.1;
  if (c.publishedAt) punti += 0.15;                        // una data valida
  if (c.sourceId) punti += 0.1;                            // si sa da dove viene
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
      // esatto vale piu di «discende da»: chi segue formula1 e' piu
      // contento di un pezzo di formula1 che di uno di sport generico
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
 *
 * `exploration` non e' rumore: e' il posto, dentro il punteggio, dove
 * abita cio che non hai chiesto. Senza una voce sua verrebbe sempre
 * schiacciato da cio che gia ti piace — ed e' esattamente come nasce
 * una bolla (capitolo 23).
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

  // capitolo 18: prima si TOGLIE, poi si ordina
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
    // esplorazione: vale per cio che NON tocca i tuoi interessi
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

    // ═══ CAPITOLO 19 — LA DOMANDA SCRITTA COMANDA ═══
    // «Se l'utente cerca Tom Cruise, i primi risultati devono parlare di
    // Tom Cruise. La personalizzazione non deve cambiare la domanda
    // dell'utente. Sempre.»
    // Non e' un peso piu alto: e' un GRADINO. Con un peso, dieci punti
    // di affinita su un altro argomento potrebbero comunque scavalcare
    // la risposta giusta — ed e' esattamente il modo in cui i motori
    // «intelligenti» diventano irritanti.
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

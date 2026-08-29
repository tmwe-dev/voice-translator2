// CANTIERE — collegato alla FASE 5 del documento di Mondo (b.576).
// Finche' quella fase non arriva questo file esiste e non lo chiama
// ancora nessuno: e' voluto, il documento dice «nessun cambio UI».
// Quando verra collegato, questa riga se ne va con la fase.
// ═══════════════════════════════════════════════════════════════
// FASE 2 — TUTTO DIVENTA UN CANDIDATO (b.576)
//
// Documento di Luca, capitolo 15: «articoli, video, discussioni e
// breaking devono essere normalizzati».
//
// Qui c'e' l'unico posto del programma che sa come sono fatte le cose
// che arrivano da fuori: il gruppo di articoli che esce da
// `raggruppa.js`, il video che esce dall'API di YouTube, la riga di
// discussione che esce da Supabase. Da qui in poi nessuno deve piu
// sapere che esistono tre forme diverse.
//
// UNA SCELTA CHE VALE LA PENA DICHIARARE: i `topics` di un contenuto
// non si INDOVINANO dal titolo. Il segnale onesto ce l'abbiamo gia ed
// e' molto piu forte: sappiamo QUALE DOMANDA ha prodotto quel
// contenuto. Se il giro nasce dal topic `formula1`, cio che torna e'
// formula1 — e per parentela anche motorsport e sport (taxonomy.js).
// Un riconoscitore di argomenti scritto a occhio su parole chiave
// sbaglierebbe in silenzio e costruirebbe un profilo falso, che e' il
// danno peggiore: un profilo sbagliato non si vede, si subisce.
// Quando servira un classificatore vero sara' un lavoro suo, non una
// riga nascosta qui dentro.
//
// Import: solo modelli puri di questa cartella.
// ═══════════════════════════════════════════════════════════════
import { candidato, dominioDi } from './models.js';
import { catena } from './taxonomy.js';

/** I topic di un contenuto nato da un giro su `topic`, per parentela. */
export function topicsDelGiro(topic) {
  return topic ? catena(topic) : [];
}

/**
 * Un gruppo di articoli (uscita di `raggruppa.js`) → candidato.
 * `fonti` resta dentro: quante testate raccontano la stessa cosa e' un
 * segnale di qualita, ed e' quello che la scheda mostra («4 fonti»).
 */
export function daArgomento(t, { topic = '', query = '' } = {}) {
  if (!t) return null;
  const prima = Array.isArray(t.fonti) ? t.fonti[0] : null;
  return candidato({
    id: t.id || t.url || t.titolo,
    type: 'article',
    title: t.titolo,
    summary: t.sintesi,
    url: t.url,
    image: t.immagine,
    source: prima?.fonte || prima?.dominio || '',
    sourceId: prima?.dominio || dominioDi(t.url),
    language: t.lingua,
    country: t.paese,
    publishedAt: t.pubblicato,
    topics: topicsDelGiro(topic),
    sources: Array.isArray(t.fonti) ? t.fonti : [],
    collectiveScore: t.punteggio,
    searchIntent: t.seme || query,
    discoveryReason: t.motivo,
  });
}

/** Un video di YouTube (forma di `videoUfficiale.daApi`) → candidato. */
export function daVideo(v, { topic = '', query = '' } = {}) {
  if (!v?.id) return null;
  return candidato({
    id: v.id,
    type: 'video',
    title: v.titolo,
    summary: v.descrizione || '',
    url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
    image: v.miniatura,
    // la FONTE di un video e' il canale, non YouTube: YouTube e' il
    // luogo dove sta, come l'edicola non e' il giornale
    source: v.canale || '',
    sourceId: (v.canaleId || v.canale || '').toLowerCase(),
    language: v.lingua,
    publishedAt: v.pubblicato,
    topics: topicsDelGiro(topic),
    searchIntent: v.seme || query,
    discoveryReason: v.motivo,
  });
}

/** Una discussione (riga di `mondo_discussions`) → candidato. */
export function daDiscussione(d, { topic = '' } = {}) {
  if (!d) return null;
  return candidato({
    id: d.id ? `d-${d.id}` : (d.url || d.titolo),
    type: 'discussion',
    title: d.titolo || d.title,
    summary: d.testo || d.sintesi || '',
    url: d.url || '',
    image: d.immagine || '',
    source: d.autore || d.creatore || '',
    sourceId: 'bartalk',
    language: d.lingua,
    publishedAt: d.creata_il || d.createdAt || d.creata,
    topics: topicsDelGiro(topic),
    collectiveScore: (Number(d.commenti) || 0) + (Number(d.reazioni) || 0),
  });
}

/**
 * Un contenuto di ultim'ora. Non e' una fonte diversa: e' lo STESSO
 * articolo con un'altra urgenza, e va detto nel tipo perche' la Regia
 * (capitolo 21) lo tratta diversamente.
 */
export function daBreaking(t, opzioni = {}) {
  const c = daArgomento(t, opzioni);
  return c ? { ...c, type: 'breaking' } : null;
}

/**
 * Tutto insieme: la forma unica di un giro di ricerca.
 * Serve a chiamare una volta sola invece di ricordarsi tre funzioni —
 * ed e' il punto in cui, in FASE 5, si attacchera il vecchio mondo.
 */
export function normalizza({ argomenti = [], video = [], discussioni = [], breaking = [] } = {}, contesto = {}) {
  const fuori = [];
  for (const t of (Array.isArray(argomenti) ? argomenti : [])) { const c = daArgomento(t, contesto); if (c) fuori.push(c); }
  for (const v of (Array.isArray(video) ? video : [])) { const c = daVideo(v, contesto); if (c) fuori.push(c); }
  for (const d of (Array.isArray(discussioni) ? discussioni : [])) { const c = daDiscussione(d, contesto); if (c) fuori.push(c); }
  for (const b of (Array.isArray(breaking) ? breaking : [])) { const c = daBreaking(b, contesto); if (c) fuori.push(c); }
  return fuori.filter((c) => c.id && (c.title || c.url));
}

// ═══════════════════════════════════════════════════════════════
// IL FONTIERE — l'elenco delle testate smette di essere scritto a mano.
//
// b.543, ordine di Luca: «vicino al selettore paese o lingua della
// sidebar aggiungi un tasto, con questo attiveremo una procedura di
// miglioramento delle fonti con un deep search per creare liste sempre
// aggiornate di potenziali informazioni da quel paese. anche i settori
// devono riaccendere la icona perche ai deve approfondire a livello
// mondiale le specifiche fonti potenziali (se mi informo di medicina
// devo cercare altre nuove fonti specifiche)».
//
// COSA C'ERA PRIMA, verificato: la ricerca faceva UNA query su Bing News
// RSS e, se tornava vuota, ripiegava su Google News RSS. Due aggregatori.
// Esisteva un direttorio scritto a mano (riordino.js) con 5 verticali e
// una trentina di domini, ma serviva solo a RIORDINARE cio che Bing
// aveva gia dato: non aggiungeva mai una fonte. Medicina non c'era,
// politica non c'era, cultura non c'era. La pluralita dipendeva per
// intero da cosa Bing decideva per quella query in quel mercato — e il
// direttorio premiava pure le stesse testate: un circolo chiuso.
//
// QUI c'e la logica pura del Fontiere: come si tiene una lista, quando
// e' vecchia, come si fondono le liste con il direttorio scritto a mano,
// e come una lista diventa ricerche vere. La ricerca delle testate (che
// richiede un modello) sta in /api/topics/fonti.
// ═══════════════════════════════════════════════════════════════

/** Trenta giorni: una testata autorevole non cambia in una settimana,
 *  ma in un mese nascono e muoiono siti abbastanza da rifare il giro. */
const VITA_LISTA_MS = 30 * 24 * 3600 * 1000;

export function dominioNudo(d) {
  if (!d) return '';
  return String(d).toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '').replace(/^m\./, '')
    .split('/')[0].split('?')[0].trim();
}

/** La chiave di una lista: un Paese («paese:IT») o un settore («settore:medicina»). */
export function chiaveLista({ paese = '', settore = '' } = {}) {
  const s = String(settore || '').toLowerCase().trim();
  if (s) return `settore:${s}`;
  const p = String(paese || '').toUpperCase().trim();
  return p ? `paese:${p}` : '';
}

/**
 * Una lista e' VECCHIA quando ha passato i trenta giorni — ed e' il
 * momento in cui l'icona si riaccende («anche i settori devono
 * riaccendere la icona», ordine di Luca). Una lista che non c'e e'
 * vecchia per definizione: non si e' mai fatta.
 */
export function listaVecchia(lista, adessoMs = 0) {
  if (!lista || !Array.isArray(lista.fonti) || !lista.fonti.length) return true;
  const quando = Number(lista.quando) || 0;
  if (!quando) return true;
  return (adessoMs - quando) > VITA_LISTA_MS;
}

/** Quanti giorni ha una lista: serve a dirlo in faccia, non a indovinarlo. */
export function giorniDiVita(lista, adessoMs = 0) {
  const quando = Number(lista?.quando) || 0;
  if (!quando) return null;
  return Math.max(0, Math.floor((adessoMs - quando) / (24 * 3600 * 1000)));
}

/**
 * Ripulisce cio che torna dal deep search: domini veri, niente doppioni,
 * niente aggregatori (che sono gia la porta da cui entriamo: metterli in
 * lista sarebbe chiedere due volte alla stessa persona), niente social.
 */
const NON_SONO_TESTATE = [
  'google.com', 'news.google.com', 'bing.com', 'yahoo.com', 'msn.com',
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'reddit.com', 'wikipedia.org', 'linkedin.com', 'pinterest.com',
];

export function sanaFonti(grezze, { massimo = 24 } = {}) {
  const visti = new Set();
  const fuori = [];
  for (const g of (Array.isArray(grezze) ? grezze : [])) {
    const dominio = dominioNudo(typeof g === 'string' ? g : g?.dominio);
    if (!dominio || !dominio.includes('.') || dominio.length > 60) continue;
    if (/\s/.test(dominio)) continue;
    if (NON_SONO_TESTATE.some((x) => dominio === x || dominio.endsWith(`.${x}`))) continue;
    if (visti.has(dominio)) continue;
    visti.add(dominio);
    fuori.push({
      dominio,
      nome: String((typeof g === 'object' && g?.nome) || dominio).slice(0, 60),
      viva: typeof g === 'object' && g?.viva === true,
    });
    if (fuori.length >= massimo) break;
  }
  return fuori;
}

/**
 * LE VOCI DELLA RICERCA A PIU VOCI. Dato un elenco di fonti, prepara le
 * query mirate da affiancare a quella generale: `query site:dominio`.
 * Cosi i risultati vengono da posti diversi PER COSTRUZIONE, non per
 * fortuna — che e' il punto dell'ordine di Luca sulla pluralita.
 * Si prendono le prime `quante` (le liste sono ordinate per merito) e si
 * preferiscono quelle verificate vive.
 */
export function vociDiRicerca(query, fonti, { quante = 4 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const ordinate = [...(Array.isArray(fonti) ? fonti : [])]
    .filter((f) => f?.dominio)
    .sort((a, b) => (b.viva ? 1 : 0) - (a.viva ? 1 : 0));
  return ordinate.slice(0, quante).map((f) => `${q} site:${f.dominio}`);
}

/**
 * Il direttorio scritto a mano (riordino.js) non si butta: diventa il
 * fondo su cui si appoggiano le liste vive. Le fonti trovate dal deep
 * search vengono PRIMA — sono di oggi e di quel Paese — poi quelle
 * storiche che non erano gia dentro.
 */
export function fondiConDirettorio(fontiVive, dominiStorici) {
  const uscita = sanaFonti(fontiVive);
  const gia = new Set(uscita.map((f) => f.dominio));
  for (const d of (Array.isArray(dominiStorici) ? dominiStorici : [])) {
    const dominio = dominioNudo(d);
    if (!dominio || gia.has(dominio)) continue;
    gia.add(dominio);
    uscita.push({ dominio, nome: dominio, viva: false, storica: true });
  }
  return uscita;
}

/**
 * ═══ b.553 — CHI SI E' FATTO NOTARE, SI COMINCIA A SEGUIRLO ═══
 *
 * Il principio deciso da Luca: SEARCH → DISCOVER → FOLLOW → CACHE →
 * PERSONALIZE, non SEARCH → SEARCH → SEARCH. Ogni ricerca che va a buon
 * fine ci dice qualcosa che vale piu dei suoi risultati: DA CHI esce la
 * roba buona su questo argomento. Quella testata, da domani, non la
 * cerchiamo piu: la leggiamo.
 *
 * `apparse` sono i risultati appena arrivati. Si contano i domini, e
 * quelli che tornano piu di una volta entrano in coda alla lista —
 * comparire due volte separa il giornale dal blog capitato per caso.
 * Le fonti gia dentro non si toccano e non cambiano posto: la lista e'
 * ordinata per merito e una scoperta non scavalca chi ha gia dato prova.
 *
 * Ritorna la lista NUOVA, oppure null se non c'e' niente da aggiungere:
 * chi chiama scrive solo quando c'e' davvero un cambiamento.
 */
export function imparaFonti(lista, apparse, { massimo = 24, almeno = 2 } = {}) {
  const dentro = sanaFonti(lista, { massimo });
  const gia = new Set(dentro.map((f) => f.dominio));
  const conti = new Map();
  for (const a of (Array.isArray(apparse) ? apparse : [])) {
    const d = dominioNudo(a?.dominio || a?.url || '');
    if (!d || gia.has(d)) continue;
    conti.set(d, (conti.get(d) || 0) + 1);
  }
  const nuove = [...conti.entries()]
    .filter(([, n]) => n >= almeno)
    .sort((a, b) => b[1] - a[1])
    .map(([dominio]) => ({ dominio, nome: dominio, viva: false, scoperta: Date.now() }));
  if (!nuove.length) return null;
  const fuori = sanaFonti([...dentro, ...nuove], { massimo });
  return fuori.length === dentro.length ? null : fuori;
}

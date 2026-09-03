// ═══════════════════════════════════════════════════════════════
// IL REGISTRO DELLE FONTI — si SEGUE, non si cerca (b.553)
//
// Decisione di Luca, presa prima che il sistema crescesse:
//
//   «Il feed Mondo nasce dalle FONTI, non dai motori di ricerca.
//    SEARCH → DISCOVER → FOLLOW → CACHE → PERSONALIZE,
//    non SEARCH → SEARCH → SEARCH.»
//
// PERCHE' CAMBIA TUTTO. Una ricerca si paga ogni volta e domani non
// vale piu niente; una fonte si scopre una volta e rende per anni. E il
// flusso RSS di una testata e' pubblicato APPOSTA perche' qualcuno lo
// legga: nessuna quota, nessun contratto forzato, nessun indirizzo da
// nascondere. E' l'uso previsto, non una zona grigia.
//
// COSA FA QUESTO FILE, in tre mosse:
//   1. dal DOMINIO trova il suo flusso (`feedDaHtml`, `indirizziDaProvare`)
//   2. legge il flusso e ne fa articoli come tutti gli altri (`leggiVoci`)
//   3. tiene solo cio che risponde alla domanda (`parlaDi`)
//
// Il grosso sono funzioni PURE, che si provano senza rete. La rete sta
// in fondo, in due funzioni sole.
//
// COSA NON FA: non cerca. Una fonte ti da le sue ultime uscite, non
// risponde a «valanga d'acqua in Nepal». Per quello resta il motore —
// ma come eccezione, dietro, quando le fonti non bastano.
// ═══════════════════════════════════════════════════════════════
import { leggiRss, immagineSicura } from './ricerca.js';
import { isSSRFSafe } from './ssrf.js';
import { feedRicordato, ricordaFeed, fonteLetta } from './deposito.js'; // b.553 — il flusso si ricorda per sempre, non per trenta giorni

const UA = 'BarTalk/1.0 (+https://voice-translator2.vercel.app) lettore di feed';


/** Il dominio nudo: niente protocollo, niente www, niente coda. */
export function dominioNudo(d) {
  return String(d || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

/**
 * IL FLUSSO DICHIARATO DALLA PAGINA.
 * Ogni sito che ha un RSS lo dichiara nella testa della sua home:
 *   <link rel="alternate" type="application/rss+xml" href="/feed">
 * E' la strada giusta: chiedere al sito dov'e', invece di indovinare.
 */
export function feedDaHtml(html, base) {
  const testo = String(html || '');
  const tag = testo.match(/<link[^>]+>/gi) || [];
  const trovati = [];
  for (const t of tag) {
    if (!/rel=["']?alternate/i.test(t)) continue;
    if (!/type=["']application\/(rss|atom)\+xml/i.test(t)) continue;
    const href = t.match(/href=["']([^"']+)["']/i);
    if (!href) continue;
    try {
      trovati.push(new URL(href[1].replace(/&amp;/g, '&'), base).toString());
    } catch { /* href storto: si guarda il prossimo */ }
  }
  // se ne dichiara piu d'uno si preferisce quello che sembra il
  // principale: spesso gli altri sono i commenti o una sola rubrica.
  const principale = trovati.find((u) => !/comment|commenti|podcast/i.test(u));
  return principale || trovati[0] || '';
}

/**
 * Se la home non lo dichiara, gli indirizzi che quasi tutti usano.
 *
 * b.566 — E POI LE SITEMAP DELLE NOTIZIE, che sono la seconda porta.
 * Molte testate hanno spento l'RSS ma pubblicano una «news sitemap»:
 * e' uno standard nato per i motori di ricerca, con dentro esattamente
 * quello che serve a noi — titolo, indirizzo e data delle ultime
 * quarantott'ore. Sono le ultime della fila perche' l'RSS resta piu
 * ricco (descrizione e immagine), ma senza questa porta perderemmo
 * tutte le testate che l'RSS non ce l'hanno piu — e sono tante.
 */
export function indirizziDaProvare(dominio) {
  const d = dominioNudo(dominio);
  if (!d) return [];
  return [
    `https://${d}/feed`,
    `https://${d}/rss`,
    `https://${d}/rss.xml`,
    `https://${d}/feed.xml`,
    `https://${d}/index.xml`,
    `https://${d}/sitemap-news.xml`,
    `https://${d}/news-sitemap.xml`,
    `https://${d}/sitemap_news.xml`,
  ];
}

/**
 * LE VOCI DI UNA SITEMAP DELLE NOTIZIE.
 * Formato diverso, stessa sostanza: <url> invece di <item>, il titolo
 * dentro <news:title>, la data in <news:publication_date>. Non c'e'
 * descrizione ne immagine — si mostra il titolo e basta, che e' meglio
 * di non avere quella testata.
 */
export function leggiSitemap(xml) {
  const testo = String(xml || '');
  const fuori = [];
  for (const blocco of (testo.match(/<url>[\s\S]*?<\/url>/gi) || [])) {
    const url = (blocco.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1];
    const titolo = (blocco.match(/<news:title>([\s\S]*?)<\/news:title>/i) || [])[1]
      || (blocco.match(/<(?:\w+:)?title>([\s\S]*?)<\/(?:\w+:)?title>/i) || [])[1];
    if (!url || !titolo) continue;   // una sitemap normale (senza titoli) non ci serve
    const quando = (blocco.match(/<news:publication_date>([\s\S]*?)<\/news:publication_date>/i) || [])[1]
      || (blocco.match(/<lastmod>([\s\S]*?)<\/lastmod>/i) || [])[1] || '';
    fuori.push({ titolo: pulisci(titolo), url: pulisci(url), immagine: '', fonte: '', dataPub: quando.trim(), descrizione: '' });
  }
  return fuori;
}

/**
 * LE VOCI DI UN FLUSSO, RSS o Atom.
 * `leggiRss` (b.147) legge gli <item> dell'RSS; qui si aggiungono gli
 * <entry> di Atom, che tanti siti moderni usano — e senza i quali il
 * registro perderebbe per strada meta delle fonti buone.
 */
export function leggiVoci(xml) {
  const testo = String(xml || '');
  // b.566 — il formato si riconosce dal contenuto, non dall'indirizzo:
  // ci sono testate che servono una sitemap da un percorso che sembra
  // un feed e viceversa. Guardare cosa c'e' dentro non sbaglia mai.
  if (/<urlset[\s>]/i.test(testo) && /<news:/i.test(testo)) return leggiSitemap(testo);
  const voci = leggiRss(testo);
  const entry = testo.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const e of entry) {
    const titolo = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const link = (e.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || '';
    if (!titolo.trim() || !link) continue;
    const quando = (e.match(/<(?:published|updated)>([\s\S]*?)<\/(?:published|updated)>/i) || [])[1] || '';
    const img = (e.match(/<media:(?:thumbnail|content)[^>]*url=["']([^"']+)["']/i) || [])[1] || '';
    const desc = (e.match(/<(?:summary|content|media:description)[^>]*>([\s\S]*?)<\/(?:summary|content|media:description)>/i) || [])[1] || '';
    voci.push({
      titolo: pulisci(titolo), url: link, immagine: img, fonte: '',
      dataPub: quando, descrizione: pulisci(desc),
    });
  }
  return voci;
}

// L'ORDINE CONTA, e non e' pignoleria: molti flussi mandano il testo
// con i marcatori SCRITTI in entita (&lt;b&gt;). Se si togliessero i
// marcatori prima di sciogliere le entita, quelli tornerebbero fuori
// dopo — e finirebbero a schermo come <b> in mezzo alla frase. Quindi:
// prima si sciolgono le entita, poi si tolgono i marcatori, e la e
// commerciale per ultima (se no rifabbrica entita gia sciolte).
// b.617 — QUESTA E' LA PULIZIA BUONA, E ORA SI ESPORTA. Ce n'erano
// quattro copie divergenti nel repo (registro, videoUfficiale,
// interpreteVideo, e le due di estrai/ricerca che fino alla b.615 non
// conoscevano nemmeno `&nbsp;`). Il debito era gia' dichiarato in b.615;
// qui almeno il testo che ARRIVA A SCHERMO passa da una sola.
export function pulisciTesto(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
const pulisci = pulisciTesto;

/** Senza accenti e senza maiuscole: «però» e «pero» sono la stessa parola. */
export function nuda(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const VUOTE = new Set(['di','della','del','dello','delle','dei','degli','la','il','lo','le','gli','un','una','uno','che','per','con','sul','sulla','nel','nella','the','of','a','an','and','in','on','to','el','los','las','der','die','das','und']);

/** Le parole che contano di una domanda. */
export function paroleVere(q) {
  return nuda(q).split(/[^a-z0-9À-ɏ]+/).filter((p) => p.length > 2 && !VUOTE.has(p));
}

/**
 * QUESTA VOCE RISPONDE ALLA DOMANDA?
 * Una fonte pubblica tutto quello che ha; noi teniamo cio che c'entra.
 * Basta UNA parola vera in comune: alzare l'asticella qui vuol dire
 * buttare via l'articolo giusto perche' il titolo era scritto in un
 * altro modo — e nel dubbio SI ORDINA, NON SI FILTRA (regola di casa).
 */
export function parlaDi(voce, q) {
  const parole = paroleVere(q);
  if (!parole.length) return true;
  const dove = nuda(`${voce?.titolo || ''} ${voce?.descrizione || ''}`);
  return parole.some((p) => dove.includes(p));
}

/** Le voci del flusso nella forma degli articoli, uguale a ricerca.js. */
export function daFonte(voci, dominio, nome = '') {
  const d = dominioNudo(dominio);
  return (Array.isArray(voci) ? voci : []).map((v) => ({
    titolo: v.titolo,
    url: v.url,
    dominio: d,
    fonte: v.fonte || nome || d,
    immagine: immagineSicura(v.immagine || ''),
    descrizione: v.descrizione || '',
    pubblicato: v.dataPub ? (Date.parse(v.dataPub) || null) : null,
  })).filter((a) => a.titolo && a.url);
}

// ═══════════════════════ la parte con la rete ═══════════════════════

async function scarica(url, { timeout = 7000 } = {}) {
  if (!isSSRFSafe(url)) throw new Error('indirizzo non consentito');
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

/**
 * DAL DOMINIO AL SUO FLUSSO — una volta sola nella vita.
 * Prima si chiede alla home dove sta (e' scritto li); se non lo dice,
 * si provano i cinque indirizzi che usano quasi tutti. Il risultato,
 * buono o vuoto, finisce in cache: il registro non deve rifare questa
 * fatica ad ogni giro.
 */
export async function feedDelDominio(dominio) {
  const d = dominioNudo(dominio);
  if (!d) return '';
  // b.553 — la memoria sta nel DEPOSITO, non in una cache che scade:
  // trovare un flusso costa una visita alla home e fino a cinque
  // tentativi, ed e' una fatica da fare una volta nella vita. Anche il
  // «non ce l'ha» si ricorda, se no lo ricercheremmo ogni giorno per
  // tutti i siti che l'RSS non ce l'hanno.
  try {
    const gia = await feedRicordato(d);
    if (gia !== null) return gia;
  } catch { /* senza deposito si cerca, e basta */ }

  let trovato = '';
  try {
    const html = await scarica(`https://${d}/`);
    trovato = feedDaHtml(html, `https://${d}/`);
  } catch { /* la home non risponde: si tenta a indovinare */ }

  if (!trovato) {
    for (const u of indirizziDaProvare(d)) {
      try {
        const xml = await scarica(u, { timeout: 5000 });
        if (leggiVoci(xml).length) { trovato = u; break; }
      } catch { /* non e questo: il prossimo */ }
    }
  }

  try { await ricordaFeed(d, trovato); } catch { /* senza deposito si rifa la fatica domani */ }
  return trovato;
}

/**
 * LEGGE LE FONTI CHE SEGUIAMO, tutte insieme.
 * Una fonte lenta non deve far aspettare le altre: si va in parallelo e
 * chi non risponde in tempo resta indietro senza rovinare il giro.
 */
export async function leggiFonti(domini, { q = '', quante = 8, perFonte = 6, ambito = {} } = {}) {
  const lista = (Array.isArray(domini) ? domini : []).slice(0, quante);
  if (!lista.length) return [];
  const gruppi = await Promise.all(lista.map(async (voce) => {
    const dominio = typeof voce === 'string' ? voce : (voce?.dominio || voce?.url || '');
    const nome = typeof voce === 'string' ? '' : (voce?.fonte || '');
    try {
      const feed = await feedDelDominio(dominio);
      if (!feed) return [];
      const xml = await scarica(feed);
      const tutte = daFonte(leggiVoci(xml), dominio, nome);
      // b.553 — quanto ha reso, non quanto e' famosa: e' questo che
      // ordina il registro domani.
      try { await fonteLetta(dominio, tutte.length, ambito); } catch { /* la storia e un di piu */ }
      return (q ? tutte.filter((v) => parlaDi(v, q)) : tutte).slice(0, perFonte);
    } catch { return []; }
  }));
  const visti = new Set();
  const fuori = [];
  for (const gruppo of gruppi) {
    for (const a of gruppo) {
      if (visti.has(a.url)) continue;
      visti.add(a.url);
      fuori.push(a);
    }
  }
  return fuori;
}

// ═══════════════════════════════════════════════════════════════
// RICERCA NOTIZIE — senza chiavi, senza abbonamenti
//
// La logica di ricerca viene dal disegno di COBRA (ricerca/indagine),
// ma il trasporto e diverso: COBRA guida un Chrome vero, qui siamo in
// una funzione Vercel senza browser. Si usano i flussi RSS pubblici
// dei motori di notizie, che danno titolo, URL DIRETTO dell'articolo,
// fonte, data e spesso una miniatura — gratis e senza credenziali.
//
// Primo Bing News (URL diretti e immagini nel flusso), Google News in
// riserva (i suoi link passano da un rimbalzo, si tengono solo se
// Bing non da nulla). Un parser XML a espressioni: gli item RSS sono
// piatti, non serve una dipendenza per leggerli.
// ═══════════════════════════════════════════════════════════════

import { pulisciTestoWeb } from './iniezione.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Mercato RSS per lingua interfaccia: serve a Bing/Google per rispondere
// nella lingua giusta. Chi parla una lingua fuori elenco riceve l'inglese.
const MERCATI = {
  it: 'it-IT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
  pt: 'pt-BR', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', th: 'th-TH',
  ar: 'ar-SA', hi: 'hi-IN', ru: 'ru-RU', tr: 'tr-TR', vi: 'vi-VN',
};

function decodificaEntita(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function campo(item, tag) {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodificaEntita(m[1]) : '';
}

/** Legge gli <item> di un RSS in oggetti piatti. Esportata per i test. */
export function leggiRss(xml) {
  const items = [];
  const blocchi = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocchi) {
    const titolo = campo(b, 'title');
    let url = campo(b, 'link');
    if (!titolo || !url) continue;
    // Immagine: Bing la mette in News:Image, altri in media:content/enclosure
    let immagine = campo(b, 'News:Image') || '';
    if (!immagine) {
      const media = b.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i);
      if (media) immagine = decodificaEntita(media[1]);
    }
    const fonte = campo(b, 'News:Source') || campo(b, 'source') || '';
    const dataPub = campo(b, 'pubDate');
    const descrizione = campo(b, 'description');
    items.push({ titolo, url, immagine, fonte, dataPub, descrizione });
  }
  return items;
}

/**
 * b.147-bis — LA FACCIA SGRANATA. Le miniature del flusso Bing sono
 * francobolli (w=234): gonfiate a tutta card diventavano una foto
 * sfocata, visto dal vivo in produzione. Il loro server pero accetta
 * misure diverse nella query: si chiede la stessa immagine in grande.
 * Resta comunque un'immagine di riserva: la scheda dell'articolo
 * (og:image) ha la priorita, vedi arricchisci() in estrai.js.
 */
export function eMiniaturaBing(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'th.bing.com' || h.endsWith('.bing.com') || h === 'bing.com';
  } catch { return false; }
}

export function ingrandisciMiniaturaBing(url) {
  try {
    const u = new URL(url);
    if (!eMiniaturaBing(url)) return url;
    u.searchParams.set('w', '1200');
    u.searchParams.set('h', '675');
    u.searchParams.set('qlt', '90');
    u.searchParams.delete('c');
    return u.href;
  } catch { return url; }
}

/** Bing incapsula gli URL in un rimbalzo apiclick: l'originale sta in ?url= */
export function sbucciaUrlBing(url) {
  try {
    const u = new URL(url);
    if (/bing\.com$/.test(u.hostname) || u.hostname.endsWith('.bing.com')) {
      const vero = u.searchParams.get('url');
      if (vero) return decodeURIComponent(vero);
    }
  } catch { /* si tiene com'e */ }
  return url;
}

async function scaricaRss(url) {
  const risposta = await fetch(url, {
    // Solo lo User-Agent: con l'header Accept Bing ogni tanto risponde
    // con una pagina di cortesia vuota invece del flusso (visto provando).
    headers: { 'User-Agent': UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  if (!risposta.ok) throw new Error(`RSS ${risposta.status}`);
  return await risposta.text();
}

function normalizzaItem(grezzi) {
  const visti = new Set();
  const puliti = [];
  for (const it of grezzi) {
    const url = sbucciaUrlBing(it.url);
    let dominio = '';
    try { dominio = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (visti.has(url)) continue;
    visti.add(url);
    // Il testo che arriva dal web si pulisce PRIMA che tocchi cache o UI.
    const titolo = pulisciTestoWeb(it.titolo).testo;
    const descrizione = pulisciTestoWeb(it.descrizione).testo;
    puliti.push({
      titolo,
      url,
      dominio,
      fonte: it.fonte || dominio,
      immagine: it.immagine ? ingrandisciMiniaturaBing(it.immagine) : '',
      descrizione,
      pubblicato: it.dataPub ? Date.parse(it.dataPub) || null : null,
    });
  }
  return puliti;
}

/**
 * Cerca notizie per una query nella lingua data.
 * @returns {Promise<Array<{titolo,url,dominio,fonte,immagine,descrizione,pubblicato}>>}
 */
export async function cercaNotizie(query, lingua = 'en', { massimo = 20 } = {}) {
  const mercato = MERCATI[lingua] || 'en-US';
  const q = encodeURIComponent(query);

  // 1) Bing News RSS — URL diretti, spesso con miniatura.
  // Due tentativi: provando dal vivo, ogni tanto il primo torna vuoto.
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    try {
      const xml = await scaricaRss(`https://www.bing.com/news/search?q=${q}&format=rss&setmkt=${mercato}`);
      const items = normalizzaItem(leggiRss(xml));
      if (items.length > 0) return items.slice(0, massimo);
    } catch { /* si riprova, poi si passa alla riserva */ }
  }

  // 2) Google News RSS — riserva: link con rimbalzo, ma meglio di niente
  const [hl, gl] = mercato.split('-');
  const xml = await scaricaRss(`https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`);
  return normalizzaItem(leggiRss(xml)).slice(0, massimo);
}

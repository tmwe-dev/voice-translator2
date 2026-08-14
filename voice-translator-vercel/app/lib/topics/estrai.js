// ═══════════════════════════════════════════════════════════════
// ESTRAZIONE DALLA PAGINA — adattata da COBRA (browser/scrape.js)
//
// COBRA ha due strade: Puppeteer (smartScrape) e un fetch semplice
// (simpleScrape). In una funzione Vercel un browser non ci sta, quindi
// qui vive SOLO la seconda strada, potenziata per il mestiere che ci
// serve: non l'articolo intero, ma la sua carta d'identita — miniatura
// buona (og:image), descrizione, data. L'articolo intero resta sul
// sito d'origine, per scelta (diritto d'autore) prima che per limite.
//
// L'ordine delle immagini e quello del piano: og:image, poi twitter,
// poi la prima <img> grande dell'articolo, poi niente. Mai inventate.
// ═══════════════════════════════════════════════════════════════

import { assertSSRFSafe } from './ssrf.js';
import { pulisciTestoWeb } from './iniezione.js';
import { eMiniaturaBing } from './ricerca.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function meta(html, nome) {
  const m = html.match(new RegExp(
    `<meta[^>]+(?:property|name)=["']${nome}["'][^>]+content=["']([^"']+)["']`, 'i'))
    || html.match(new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nome}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function decodifica(s) {
  return (s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').trim();
}

function assolutizza(url, base) {
  try { return new URL(url, base).href; } catch { return ''; }
}

/** Miniature palesemente inutili: traccianti, loghi minuscoli, spaziatori. */
function immagineDecente(url) {
  if (!url || !/^https?:/i.test(url)) return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  if (/(pixel|spacer|blank|1x1|logo-|favicon|sprite)/i.test(url)) return false;
  return true;
}

/**
 * Legge la carta d'identita di un articolo: miniatura, descrizione, data.
 * Passa dal controllo SSRF di COBRA prima di aprire qualsiasi cosa.
 * Non lancia mai: il piano prevede il ripiego (titolo+fonte+URL bastano).
 */
export async function estraiScheda(url, { timeoutMs = 6000 } = {}) {
  const vuota = { titolo: '', immagine: '', descrizione: '', pubblicato: null, ok: false };
  try {
    const verdetto = await assertSSRFSafe(url);
    if (!verdetto.safe) return { ...vuota, motivo: verdetto.reason };

    const risposta = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!risposta.ok) return { ...vuota, motivo: `HTTP ${risposta.status}` };

    // Bastano i primi ~120KB: i meta stanno nell'<head>.
    const lettore = risposta.body.getReader();
    let html = '';
    const decoder = new TextDecoder();
    while (html.length < 120000) {
      const { done, value } = await lettore.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    lettore.cancel().catch(() => {});

    // b.154 — il titolo serve al link condiviso in chat (ContenutiChat):
    // senza, la card mostra solo il nome del dominio. Stesso schema
    // og→twitter→<title> gia usato per l'immagine.
    const titoloRaw = meta(html, 'og:title') || meta(html, 'twitter:title')
      || (html.match(/<title[^>]*>([^<]{1,200})<\/title>/i) || [])[1] || '';
    const titolo = pulisciTestoWeb(decodifica(titoloRaw)).testo.slice(0, 160);

    let immagine = decodifica(meta(html, 'og:image')
      || meta(html, 'og:image:url')
      || meta(html, 'twitter:image')
      || meta(html, 'twitter:image:src'));
    immagine = assolutizza(immagine, risposta.url || url);
    if (!immagineDecente(immagine)) {
      // Ripiego: la prima <img> grande nel corpo, se dichiara le misure.
      const m = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*(?:width=["'](\d+)["'])?/i);
      const candidata = m ? assolutizza(decodifica(m[1]), risposta.url || url) : '';
      immagine = immagineDecente(candidata) && (!m[2] || Number(m[2]) >= 300) ? candidata : '';
    }

    const descrizione = pulisciTestoWeb(decodifica(
      meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description')
    )).testo.slice(0, 300);

    const dataRaw = meta(html, 'article:published_time') || meta(html, 'og:updated_time');
    const pubblicato = dataRaw ? (Date.parse(dataRaw) || null) : null;

    return { titolo, immagine, descrizione, pubblicato, ok: true };
  } catch (e) {
    return { ...vuota, motivo: e.message };
  }
}

/**
 * b.149 — L'IMMAGINE SI VERIFICA PRIMA DI PROMETTERLA.
 * Dal vivo (schermate di Luca): card con un riquadro vuoto enorme al
 * posto della foto. Un og:image dichiarato nella pagina puo essere
 * morto, spostato o vietato all'hotlink: se finisce cosi nella cache
 * CONDIVISA, il buco lo vedono tutti per 15 minuti. Quindi: una HEAD
 * con 4 secondi di tempo. Si scarta solo su verdetto CERTO (404/410,
 * 5xx, rete): un 403 o un 405 possono essere solo antipatia per HEAD,
 * e nel dubbio l'immagine si tiene — il ripiego grafico ora esiste.
 */
// b.151 — LA VERIFICA MENTIVA SOTTO CARICO. Dal vivo (schermate di
// Luca): tante card col fondale. Rifatta la prova da sola, la stessa
// immagine risultava VIVA. Il motivo: durante la raffica (4 operai,
// fino a 12 richieste in volo) qualche HEAD o qualche DNS sfora i
// timeout, e il catch diceva "morta" a immagini sane. Tre cure:
//   · i thumbnailer noti (Bing) non si verificano: e un CDN Microsoft,
//     se e giu lui la foto e l'ultimo dei problemi;
//   · per gli altri, un secondo tentativo prima del verdetto;
//   · il verdetto "morta" solo su risposta CERTA, mai su timeout.
const HOST_FIDATI = /(^|\.)bing\.com$|(^|\.)gstatic\.com$/;

export async function immagineRaggiungibile(url, { timeoutMs = 4000 } = {}) {
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { return false; }
  if (HOST_FIDATI.test(hostname)) return true;

  // La SSRF resta fail-closed anche qui: se il DNS non risponde non si
  // apre — e la regola di COBRA e non si ammorbidisce per una foto.
  try {
    const verdetto = await assertSSRFSafe(url);
    if (!verdetto.safe) return false;
  } catch { return false; }

  for (let tentativo = 0; tentativo < 2; tentativo++) {
    try {
      const r = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (r.status === 404 || r.status === 410 || r.status >= 500) return false;
      const tipo = r.headers.get('content-type') || '';
      if (r.ok && tipo && !tipo.startsWith('image/')) return false;
      return true;
    } catch { /* timeout o rete: si riprova una volta, poi si tiene */ }
  }
  // Due timeout di fila non sono una prova di morte: nel dubbio la
  // foto si tiene — il fondale sotto l'immagine (b.149) copre il resto.
  return true;
}

/**
 * Arricchisce i primi N articoli con le schede, a piccoli gruppi
 * concorrenti. Chi fallisce resta con titolo+fonte+URL: il piano dice
 * di non bloccare la ricerca per una fonte che non si fa leggere.
 * @param {Function} [suProgresso] chiamata con il dominio appena letto
 */
export async function arricchisci(articoli, { quanti = 10, concorrenza = 4, suProgresso } = {}) {
  const daFare = articoli.slice(0, quanti);
  let indice = 0;
  async function operaio() {
    while (indice < daFare.length) {
      const mio = indice++;
      const art = daFare[mio];
      // b.147-bis — la miniatura Bing e un ripiego, non un traguardo:
      // anche ingrandita resta peggiore dell'og:image dell'articolo.
      // Quindi "completa" significa: descrizione E un'immagine che NON
      // venga dal thumbnailer di Bing.
      const immagineBuona = art.immagine && !eMiniaturaBing(art.immagine);
      // La miniatura Bing si mette da parte: se l'og:image si rivela
      // finto, e comunque meglio del fondale (MSN dichiara come
      // og:image una pagina HTML — visto dal vivo, b.149).
      const riservaBing = eMiniaturaBing(art.immagine) ? art.immagine : '';
      if (!immagineBuona || !art.descrizione) {
        const scheda = await estraiScheda(art.url);
        if (scheda.immagine && !immagineBuona) art.immagine = scheda.immagine;
        if (scheda.descrizione && !art.descrizione) art.descrizione = scheda.descrizione;
        if (scheda.pubblicato && !art.pubblicato) art.pubblicato = scheda.pubblicato;
      }
      // b.149 — la promessa si controlla: o l'immagine risponde, o
      // non si dichiara. Meglio il fondale elegante del buco nero.
      if (art.immagine && !(await immagineRaggiungibile(art.immagine))) {
        art.immagine = (riservaBing && riservaBing !== art.immagine
          && await immagineRaggiungibile(riservaBing)) ? riservaBing : '';
      }
      if (suProgresso) { try { suProgresso(art.dominio); } catch { /* il progresso non ferma il lavoro */ } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concorrenza, daFare.length) }, operaio));
  return articoli;
}

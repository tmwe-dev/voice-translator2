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
  const vuota = { immagine: '', descrizione: '', pubblicato: null, ok: false };
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

    return { immagine, descrizione, pubblicato, ok: true };
  } catch (e) {
    return { ...vuota, motivo: e.message };
  }
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
      if (immagineBuona && art.descrizione) continue;
      const scheda = await estraiScheda(art.url);
      if (scheda.immagine && !immagineBuona) art.immagine = scheda.immagine;
      if (scheda.descrizione && !art.descrizione) art.descrizione = scheda.descrizione;
      if (scheda.pubblicato && !art.pubblicato) art.pubblicato = scheda.pubblicato;
      if (suProgresso) { try { suProgresso(art.dominio); } catch { /* il progresso non ferma il lavoro */ } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concorrenza, daFare.length) }, operaio));
  return articoli;
}

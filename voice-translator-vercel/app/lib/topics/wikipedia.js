// ═══════════════════════════════════════════════════════════════
// RICERCA WIKIPEDIA — fatti, non notizie (b.185)
//
// La ricerca veloce (Bing/Google News) e fatta per le NOTIZIE: cosa e
// successo oggi. Ma tante ricerche sono di tipo diverso — "chi era
// Napoleone", "cos'e lo yacht", "storia della nautica" — dove la
// notizia del giorno non serve e conta il FATTO. Li Wikipedia batte
// Google: e enciclopedica, curata, senza SEO ne pubblicita.
//
// Una sola chiamata all'API di Wikipedia (generator=search) da: titolo,
// estratto introduttivo, miniatura e URL canonico della voce. Nessuna
// chiave, nessun costo. Restituisce gli stessi campi normalizzati delle
// altre fonti, cosi entra nel merge senza casi speciali.
//
// Etichettata come fonte 'enciclopedia' (tipo/attendibilita alta): serve
// alla corroborazione e al riordino per precisione.
// ═══════════════════════════════════════════════════════════════

import { pulisciTestoWeb } from './iniezione.js';
import { immagineSicura } from './ricerca.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Le lingue che hanno una Wikipedia solida fra quelle dell'app.
const WIKI_LINGUE = new Set(['it','en','es','fr','de','pt','zh','ja','ko','ar','hi','ru','tr','vi','th']);

function sottodominio(lingua) {
  return WIKI_LINGUE.has(lingua) ? lingua : 'en';
}

/**
 * Cerca voci di Wikipedia per una query.
 * @returns {Promise<Array<{titolo,url,dominio,fonte,immagine,descrizione,pubblicato,tipo,attendibilita}>>}
 */
export async function cercaWikipedia(query, lingua = 'en', { massimo = 5 } = {}) {
  const q = (query || '').trim();
  if (!q) return [];
  const wl = sottodominio(lingua);
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search',
    gsrsearch: q, gsrlimit: String(Math.min(massimo, 10)),
    prop: 'extracts|pageimages|info',
    exintro: '1', explaintext: '1', exsentences: '3',
    piprop: 'thumbnail', pithumbsize: '480',
    inprop: 'url', redirects: '1', origin: '*',
  });
  const url = `https://${wl}.wikipedia.org/w/api.php?${params.toString()}`;

  let dati;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    dati = await r.json();
  } catch { return []; }

  const pagine = dati?.query?.pages;
  if (!pagine) return [];

  const voci = Object.values(pagine)
    // l'API mette 'index' = l'ordine di rilevanza della ricerca
    .sort((a, b) => (a.index || 999) - (b.index || 999))
    .map(p => {
      const titolo = pulisciTestoWeb(p.title || '').testo;
      const descrizione = pulisciTestoWeb(p.extract || '').testo;
      const link = p.fullurl || `https://${wl}.wikipedia.org/wiki/${encodeURIComponent((p.title || '').replace(/\s/g, '_'))}`;
      let dominio = `${wl}.wikipedia.org`;
      try { dominio = new URL(link).hostname.replace(/^www\./, ''); } catch { /* link malformato: si tiene il dominio wiki predefinito */ }
      return {
        titolo, url: link, dominio,
        fonte: 'Wikipedia',
        immagine: immagineSicura(p.thumbnail?.source || ''),
        descrizione,
        pubblicato: null,           // una voce enciclopedica non ha "data del giorno"
        tipo: 'enciclopedia',       // per il riordino/corroborazione
        attendibilita: 'alta',
      };
    })
    .filter(v => v.titolo);

  return voci;
}

// ═══════════════════════════════════════════════════════════════
// RICERCA VIDEO — YouTube SENZA API (b.153, rivisto su ordine di Luca)
//
// L'architettura decisa: la SCOPERTA legge la pagina dei risultati di
// YouTube — che contiene gia gli ID in chiaro dentro ytInitialData —
// e la RIPRODUZIONE passa dal player incorporato ufficiale (IFrame),
// che non consuma niente e lascia visualizzazioni e monetizzazione al
// creatore. Una ricerca trova N id; la cache condivisa li conserva;
// milioni di riproduzioni non costano una chiamata.
//
// Niente chiave, niente quota, niente Data API. Le miniature
// sono deterministiche: i.ytimg.com/vi/<id>/hqdefault.jpg.
//
// Fragilita dichiarata: si legge l'HTML di YouTube, che puo cambiare
// forma. Se il formato cambia, la funzione torna zero video e la UI
// nasconde la sezione: si degrada, non si rompe. Il controllo in
// __tests__ usa un campione fisso, la prova vera e dal vivo.
// ═══════════════════════════════════════════════════════════════

import { pulisciTestoWeb } from './iniezione.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const REGIONI = {
  it: 'IT', en: 'US', es: 'ES', fr: 'FR', de: 'DE', pt: 'BR', zh: 'TW',
  ja: 'JP', ko: 'KR', th: 'TH', ar: 'SA', hi: 'IN', ru: 'RU', tr: 'TR', vi: 'VN',
};

/** La riproduzione e in embed: la scoperta qui e sempre disponibile. */
export function videoDisponibili() {
  return true;
}

/**
 * Estrae id, titolo e canale dai videoRenderer di una pagina risultati.
 * Esportata per i test (campione fisso, senza rete).
 */
export function estraiVideoDaHtml(html, { massimo = 8 } = {}) {
  const trovati = [];
  const visti = new Set();
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,1500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)+)"/g;
  let m;
  while ((m = re.exec(html)) && trovati.length < massimo) {
    const id = m[1];
    if (visti.has(id)) continue;
    visti.add(id);
    let titolo = '';
    try { titolo = JSON.parse('"' + m[2] + '"'); } catch { titolo = m[2]; }
    // Il canale sta poco dopo il titolo, nello stesso blocco del renderer.
    const dopo = html.slice(m.index, m.index + 4000);
    const canaleMatch = dopo.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)+)"/);
    let canale = '';
    if (canaleMatch) { try { canale = JSON.parse('"' + canaleMatch[1] + '"'); } catch { canale = canaleMatch[1]; } }
    // b.552 — QUANDO E' STATO PUBBLICATO. Ordine di Luca: «data
    // pubblicazione bene evidente». YouTube non ci da una data vera nella
    // pagina dei risultati: da l'eta scritta a parole («2 giorni fa»,
    // «3 settimane fa»), gia nella lingua in cui abbiamo chiesto. Quella
    // e' l'informazione che esiste davvero, e quella si mostra — meglio
    // una verita approssimata che una data inventata.
    const quandoMatch = dopo.match(/"publishedTimeText":\{"simpleText":"((?:[^"\\]|\\.)+)"/);
    let quandoTesto = '';
    if (quandoMatch) { try { quandoTesto = JSON.parse('"' + quandoMatch[1] + '"'); } catch { quandoTesto = quandoMatch[1]; } }
    trovati.push({
      id,
      titolo: pulisciTestoWeb(titolo).testo,
      canale: pulisciTestoWeb(canale).testo,
      miniatura: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      pubblicato: null,
      quandoTesto: pulisciTestoWeb(quandoTesto).testo,
    });
  }
  return trovati;
}

/**
 * @returns {Promise<{disponibile: boolean, video: Array<{id,titolo,canale,miniatura,pubblicato}>}>}
 */
export async function cercaVideo(query, lingua = 'en', { massimo = 8 } = {}) {
  try {
    const u = new URL('https://www.youtube.com/results');
    u.searchParams.set('search_query', String(query).slice(0, 120));
    u.searchParams.set('hl', lingua);
    u.searchParams.set('gl', REGIONI[lingua] || 'US');
    const r = await fetch(u.href, {
      headers: { 'User-Agent': UA, 'Accept-Language': lingua },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { disponibile: true, video: [] };
    const html = await r.text();
    return { disponibile: true, video: estraiVideoDaHtml(html, { massimo }) };
  } catch {
    // Rete o formato cambiato: zero video, zero drammi.
    return { disponibile: true, video: [] };
  }
}

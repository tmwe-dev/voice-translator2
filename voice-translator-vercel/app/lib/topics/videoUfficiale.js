// ═══════════════════════════════════════════════════════════════
// YOUTUBE, DALLA PORTA PRINCIPALE (b.553)
//
// Decisione di Luca, netta: «Per YouTube: niente scraping della pagina
// /results. Userei esclusivamente la YouTube Data API in produzione.»
// E ha aggiunto la regola che conta: niente ripiego sullo scraper
// quando la quota finisce — «API ufficiale → cache → fonti gia
// indicizzate → degradazione controllata».
//
// I DUE NUMERI CHE COMANDANO TUTTO (documentazione ufficiale):
//   · cercare        → `search.list`        = 100 unita, E un tetto a
//                                             parte di 100 chiamate al giorno
//   · seguire un canale → `playlistItems.list` = 1 unita
//
// Cento volte meno. Percio' qui dentro la strada normale e' SEGUIRE —
// di un canale che conosciamo si guardano le ultime uscite — e cercare
// resta l'eccezione, per scoprire qualcosa che non abbiamo.
//
// Ogni canale ha una playlist «caricamenti» il cui identificativo si
// ricava dal suo: UC... diventa UU... E' una regola di YouTube, non un
// trucco: ci risparmia una chiamata a `channels.list` per ogni canale.
// ═══════════════════════════════════════════════════════════════

const BASE = 'https://www.googleapis.com/youtube/v3';

/** La chiave c'e'? Senza, questa strada non esiste e chi chiama lo sa. */
export function chiaveYouTube() {
  return process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY || '';
}

/** Da un canale (UC...) alla sua playlist dei caricamenti (UU...). */
export function playlistCaricamenti(canale) {
  const c = String(canale || '').trim();
  return /^UC[\w-]{20,24}$/.test(c) ? `UU${c.slice(2)}` : '';
}

/** Le voci dell'API nella forma che il feed conosce gia. */
export function daApi(voci) {
  const fuori = [];
  for (const v of (Array.isArray(voci) ? voci : [])) {
    const dati = v?.snippet || {};
    const id = dati?.resourceId?.videoId || v?.id?.videoId || v?.id || '';
    if (!id || typeof id !== 'string' || id.length !== 11) continue;
    const mini = dati.thumbnails || {};
    fuori.push({
      id,
      titolo: String(dati.title || '').trim(),
      canale: String(dati.videoOwnerChannelTitle || dati.channelTitle || '').trim(),
      canaleId: dati.videoOwnerChannelId || dati.channelId || '',
      miniatura: (mini.high || mini.medium || mini.default || {}).url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      pubblicato: dati.publishedAt ? (Date.parse(dati.publishedAt) || null) : null,
      quandoTesto: '',
    });
  }
  return fuori.filter((v) => v.titolo);
}

async function chiedi(percorso, parametri) {
  const chiave = chiaveYouTube();
  if (!chiave) throw new Error('senza chiave');
  const u = new URL(`${BASE}/${percorso}`);
  for (const [k, v] of Object.entries(parametri)) u.searchParams.set(k, String(v));
  u.searchParams.set('key', chiave);
  const r = await fetch(u.toString(), { signal: AbortSignal.timeout(8000) });
  if (!r.ok) {
    // 403 con motivo «quotaExceeded» e il caso che Luca ha previsto: non
    // si ripiega su niente, si dice che oggi non c'e' e si mostra cio
    // che abbiamo gia. Degradazione controllata, non arrampicata.
    const e = new Error(`YouTube ${r.status}`);
    e.quotaFinita = r.status === 403;
    throw e;
  }
  return await r.json();
}

/** SEGUIRE un canale: 1 unita. E' la strada normale. */
export async function ultimiDelCanale(canale, { massimo = 6 } = {}) {
  const playlist = playlistCaricamenti(canale);
  if (!playlist) return [];
  const d = await chiedi('playlistItems', {
    part: 'snippet', playlistId: playlist, maxResults: Math.min(massimo, 50),
  });
  return daApi(d?.items).slice(0, massimo);
}

/** CERCARE: 100 unita e un tetto di 100 al giorno. Solo se serve davvero. */
export async function cercaSuYouTube(query, lingua = 'it', { massimo = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const d = await chiedi('search', {
    part: 'snippet', q, type: 'video', maxResults: Math.min(massimo, 50),
    relevanceLanguage: String(lingua || 'it').slice(0, 2), safeSearch: 'moderate',
  });
  return daApi(d?.items).slice(0, massimo);
}

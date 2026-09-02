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

// ═══ b.560 — LE ENTITA' HTML, VISTE COL COLLAUDO DAL VIVO ═══
// A schermo, in produzione: «Garlasco, l&#39;intercettazione fra
// Stefania ed Ermanno Cappa». L'API di YouTube consegna i titoli con le
// entita HTML dentro, e finche' i video li leggevamo dalla pagina
// passavano da `pulisciTestoWeb`, che le scioglieva. Passando alla
// porta ufficiale (b.553) quel passaggio e' rimasto indietro: nessuna
// prova se ne poteva accorgere, perche' le prove usano titoli scritti
// da noi, che le entita non ce l'hanno. L'ho visto con gli occhi
// aprendo l'applicazione.
const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function sciogli(testo) {
  return String(testo || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, k) => ENTITA[k])
    .trim();
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
      titolo: sciogli(dati.title),
      canale: sciogli(dati.videoOwnerChannelTitle || dati.channelTitle),
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

// b.587 — una voce nella playlist non significa che il video si possa
// davvero mostrare dentro BarTalk: puo essere diventato privato oppure
// l'autore puo aver vietato l'incorporamento. Prima lo scoprivamo solo
// quando il player mostrava «Video non disponibile» in mezzo al feed.
// `videos.list` costa una sola unita per tutto il mazzetto: la spendiamo
// per non consegnare una diapositiva che sappiamo gia non poter suonare.
// b.600 — DEBITO DICHIARATO: l'unica chiamante era `ultimiDelCanale`, che
// nessuno importava. Quindi questo filtro (b.587) non e' MAI stato sul
// percorso vivo: la funzione che lo dovrebbe usare e' quella sotto
// (`daApi(d?.items).slice(...)` a fine file). Collegarlo costa un'unita
// YouTube per mazzetto: e' una scelta, non una pulizia — non fatta qui.
async function soloIncorporabili(video) {
  const lista = Array.isArray(video) ? video.filter((v) => v?.id) : [];
  if (!lista.length) return [];
  try {
    const d = await chiedi('videos', { part: 'status', id: lista.map((v) => v.id).join(',') });
    const buoni = new Set((d?.items || [])
      .filter((v) => v?.status?.embeddable !== false && v?.status?.privacyStatus === 'public')
      .map((v) => v.id));
    return lista.filter((v) => buoni.has(v.id));
  } catch {
    // Se YouTube non concede la verifica non buttiamo via un mazzetto gia
    // ottenuto. Le ricerche hanno comunque i filtri embeddable/syndicated;
    // sulle playlist il player resta l'ultima difesa.
    return lista;
  }
}

// b.600 — qui c'era `ultimiDelCanale` (SEGUIRE un canale): esportata,
// mai importata da nessuno (audit di architettura b.598, knip + grep).

/** CERCARE: 100 unita e un tetto di 100 al giorno. Solo se serve davvero. */
export async function cercaSuYouTube(query, lingua = 'it', { massimo = 8, dallOra = 0, recenti = false } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  // ═══ b.557 — LE NOTIZIE SONO DI OGGI, NON DI MAGGIO ═══
  // Collaudo di Luca, con due fotografie in mano: video del 2 maggio e
  // del 24 maggio presentati come attualita. «Quando si parla di news
  // devi lavorare sulle 48 ore».
  // YouTube ordina per pertinenza, e per lui un servizio di tre mesi fa
  // resta pertinente per sempre. Per le domande di cronaca si mette una
  // finestra vera (`publishedAfter`) e si ordina per DATA: cosi il
  // giornale e' un giornale. Per una ricerca senza tempo — «tom cruise»,
  // «come si fa il pane» — la finestra non si mette: li il video di tre
  // anni fa puo essere il migliore che esista.
  const parametri = {
    part: 'snippet', q, type: 'video', maxResults: Math.min(massimo, 50),
    relevanceLanguage: String(lingua || 'it').slice(0, 2), safeSearch: 'moderate',
    // b.587 — il feed usa un iframe: un risultato che YouTube non permette
    // di incorporare o distribuire fuori da youtube.com non e' un risultato
    // per noi. Filtrarlo a monte evita player neri/«non disponibile».
    videoEmbeddable: 'true', videoSyndicated: 'true',
  };
  if (recenti) {
    const da = dallOra || (Date.now() - 48 * 3600 * 1000);
    parametri.publishedAfter = new Date(da).toISOString();
    parametri.order = 'date';
  }
  const d = await chiedi('search', parametri);
  return daApi(d?.items).slice(0, massimo);
}

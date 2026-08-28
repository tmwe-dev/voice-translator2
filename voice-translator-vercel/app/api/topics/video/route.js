// GET /api/topics/video?q=...&lang=... — ricerca video YouTube (b.153)
//
// b.553 — Cache condivisa DODICI ORE, e non e' avarizia: una ricerca
// costa 100 unita E una delle sole 100 chiamate al giorno che YouTube
// concede. La stessa domanda la fa piu di una persona, e una notizia di
// stamattina va bene anche stasera. La ricerca qui e' l'eccezione: la
// strada normale e' seguire i canali (videoUfficiale.js, 1 unita).

import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { withApiGuard } from '../../../lib/apiGuard.js';
import { chiaveYouTube, cercaSuYouTube } from '../../../lib/topics/videoUfficiale.js'; // b.553-bis — l'unica porta
import { eDiCronaca } from '../../../lib/topics/enciclopediaUtile.js'; // b.557 — le notizie hanno una data di scadenza
import { normalizzaQuery } from '../../../lib/topics/servizio.js';

const LINGUE = new Set(['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi']);
const TTL = 12 * 3600;   // b.553 — dodici ore: le fonti si seguono, non si rincorrono (e ogni chiamata in meno e una quota risparmiata)

async function handleGet(req) {
  const url = new URL(req.url);
  const q = normalizzaQuery(url.searchParams.get('q') || '');
  const lang = LINGUE.has(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en';
  if (!q) return NextResponse.json({ disponibile: !!chiaveYouTube(), video: [] });

  // b.557 — se la domanda e' di cronaca, i video valgono 48 ore. La
  // stessa funzione che decide se aprire l'enciclopedia (b.541) sa gia
  // distinguere «ultime notizie dal Congo» da «tom cruise»: si riusa
  // quella, invece di inventare un secondo giudice che dira il contrario.
  // b.557 — quanto indietro andare lo decide chi guarda, dalla barra:
  // 0 = nessun limite, e allora la cronaca si comporta come tutto il
  // resto. Il tetto e' un mese: oltre, «notizia» non vuol dire piu niente.
  const ore = Math.max(0, Math.min(Number(url.searchParams.get('ore')) || 48, 720));
  const cronaca = ore > 0 && eDiCronaca(q);
  // e la cache si divide: il mazzo «di oggi» non deve finire nella
  // stessa casella di quello senza tempo.
  // b.568 — «v2» nella chiave. Collaudo dal vivo: a schermo comparivano
  // ancora titoli col codice HTML dentro («Thailand&#39;s»), anche se il
  // rimedio (b.560) era gia in produzione — perche' i mazzi vecchi
  // restano in cache dodici ore. Quando si corregge un DATO che finisce
  // in cache non basta correggere il codice: bisogna cambiare la chiave,
  // se no il vecchio continua a uscire fino a scadenza.
  const k = `topics:video:v2:${lang}:${cronaca ? `ore${ore}:` : ''}${q}`;
  try {
    const salvato = await redis('GET', k);
    if (salvato) return NextResponse.json({ ...JSON.parse(salvato), daCache: true });
  } catch { /* la cache non risponde: si cerca da capo, nessun dramma */ }

  // ═══ b.553-bis — L'UNICA PORTA ═══
  // La chiave c'e' (Luca l'ha creata e messa su Vercel il 28/08), e con
  // lei se ne va l'ultima riga di scraping: la pagina /results non la
  // leggiamo piu, ne qui ne altrove. Era un ponte dichiarato, e i ponti
  // si tolgono.
  // Se la quota finisce NON si ripiega su niente: si dice che oggi non
  // c'e' niente di nuovo e restano i video gia in cache e le fonti che
  // seguiamo. Sono le parole di Luca: «degradazione controllata».
  let esito;
  try {
    esito = { disponibile: true, video: await cercaSuYouTube(q, lang, { massimo: 8, recenti: cronaca, dallOra: Date.now() - ore * 3600 * 1000 }) };
    // b.557 — se in 48 ore non c'e' niente non si resta a mani vuote: si
    // riapre la finestra a una settimana. Meglio una notizia di tre
    // giorni fa che un video di maggio spacciato per attualita.
    if (cronaca && !esito.video.length) {
      esito.video = await cercaSuYouTube(q, lang, { massimo: 8, recenti: true, dallOra: Date.now() - 7 * 24 * 3600 * 1000 });
    }
  } catch (e) {
    if (e?.quotaFinita) return NextResponse.json({ disponibile: true, video: [], quotaFinita: true });
    esito = { disponibile: !!chiaveYouTube(), video: [] };
  }
  // Si mette in cache solo un esito PIENO: una risposta vuota non deve
  // spegnere i video per dodici ore a tutti.
  if (esito.video.length > 0) {
    // b.557 — un mazzo di cronaca invecchia in fretta: mezz'ora, non
    // dodici ore. Le domande senza tempo restano a dodici ore, che e'
    // dove si risparmiano davvero le cento ricerche al giorno.
    try { await redis('SET', k, JSON.stringify(esito), 'EX', cronaca ? 1800 : TTL); } catch { /* senza cache si vive */ }
  }
  return NextResponse.json(esito);
}

export const GET = withApiGuard(handleGet, { maxRequests: 15, prefix: 'topics-video', skipBodyCheck: true });

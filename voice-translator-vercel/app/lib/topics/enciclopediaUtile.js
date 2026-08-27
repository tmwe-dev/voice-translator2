// ═══════════════════════════════════════════════════════════════
// QUANDO L'ENCICLOPEDIA C'ENTRA, E QUANDO E' SOLO RUMORE.
//
// b.541 — collaudo di Luca, con lo schermo davanti: «il sistema
// interpreta erroneamente i contenuti da cercare e mettere in elenco».
// Aveva ragione, e il guasto era clamoroso: cercando «ultime notizie»
// il giornale apriva con
//     · «Ultime notizie dall'America» — romanzo di J.G. Ballard, 1981
//     · «Ultime notizie» — film di Tim Whelan, 1935
//     · «Ultime notizie dalla famiglia» — romanzo di Pennac
// Tre OMONIMI enciclopedici al posto delle notizie del giorno. E in
// testa, per giunta (b.185: «il fatto verificato prima della notizia»).
//
// La causa: in modalita approfondita si interroga Wikipedia con la
// query TALE E QUALE. Wikipedia risponde per TITOLO, e «ultime notizie»
// e' il titolo di un mucchio di opere. Con una ricerca di attualita
// l'enciclopedia non ha niente da dire — e questo difetto e' diventato
// la norma proprio adesso, perche' «approfondita» e' il nuovo
// predefinito (ordine di Luca, stesso giorno).
//
// La regola e' semplice e si spiega in una riga: l'enciclopedia serve
// quando cerchi un SOGGETTO (una persona, un luogo, un'opera, una
// materia), non quando chiedi COSA E' SUCCESSO. Qui si riconosce la
// seconda famiglia e le si chiude la porta.
// ═══════════════════════════════════════════════════════════════

// Le parole con cui, in tutte le lingue dell'applicazione, si chiede
// l'attualita invece di un soggetto. Non serve la lingua: si guarda se
// UNA di queste compare, e i pacchetti lingua non c'entrano perche una
// query puo essere scritta in qualunque lingua da chiunque.
const PAROLE_DI_CRONACA = [
  // it
  'ultime notizie', 'notizie di oggi', 'notizie oggi', 'ultimissime', 'in tempo reale', 'aggiornamenti',
  // en
  'breaking news', 'latest news', 'news today', 'top news', 'headlines', 'live updates', 'today news',
  // es / pt
  'ultimas noticias', 'últimas noticias', 'noticias de hoy', 'noticias hoje', 'notícias de hoje',
  // fr / de / nl
  'dernieres nouvelles', 'dernières nouvelles', 'actualites', 'actualités',
  'nachrichten heute', 'aktuelle nachrichten', 'laatste nieuws',
  // altre
  'son dakika', 'ostatnie wiadomości', 'senaste nytt', 'siste nytt', 'seneste nyt',
  'последние новости', 'أخبار عاجلة', '最新ニュース', '今日のニュース', '최신 뉴스', '最新新闻', '今日新闻',
];

/** Toglie accenti e doppi spazi: «Últimas Noticias» e «ultimas noticias» sono la stessa cosa. */
function piatta(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Vero quando la domanda chiede ATTUALITA, non un soggetto.
 * Esportata perche' la si prova da sola.
 */
export function eDiCronaca(query) {
  const q = piatta(query);
  if (!q) return true;                       // vuota: meglio niente enciclopedia
  for (const p of PAROLE_DI_CRONACA) {
    if (q.includes(piatta(p))) return true;
  }
  return false;
}

/**
 * Vero quando ha senso interrogare l'enciclopedia per questa domanda.
 * Due porte chiuse:
 *   1. le domande di cronaca (sopra): l'enciclopedia risponde per
 *      titolo, e i titoli omonimi sono rumore;
 *   2. le domande che sono SOLO un Paese o una parola comune legata
 *      alla cronaca: «italia» da la voce «Italia», che in un giornale
 *      non e' una notizia.
 */
export function meritaEnciclopedia(query, { paese = '' } = {}) {
  const q = piatta(query);
  if (!q || q.length < 3) return false;
  if (eDiCronaca(q)) return false;
  // una parola sola che coincide col Paese di chi guarda: e' il
  // contenitore, non il contenuto.
  if (paese && q === piatta(paese)) return false;
  return true;
}

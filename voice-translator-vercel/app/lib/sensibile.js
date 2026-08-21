// ═══════════════════════════════════════════════════════════════
// COSA VA COPERTO — un posto solo, e una regola sola.
//
// b.364, ordine di Luca: «l'anteprima coperta, che si scopre con un
// tocco: perfetto per tutti i contenuti sensibili».
//
// E il suo avvertimento, che vale piu della funzione: «evitando censure
// stupide e inappropriate».
//
// PERCHE' QUI NON SI GUARDANO LE PAROLE. Sullo schermo di Luca, mentre
// ne parlavamo, la prima notizia in cima era:
//
//     "Revenge porn, per la Cassazione e tale anche inviare video
//      presi da OnlyFans — Wired Italia"
//
// E una sentenza della Cassazione, su una rivista seria. Qualunque
// filtro che cerca parole nei titoli la copre — e copre anche il medico
// che spiega l'anatomia, la storica che parla di stupri di guerra, il
// giornalista che racconta la tratta. Mentre l'insulto detto con
// eleganza passa liscio. Un filtro a parole sbaglia in tutti e due i
// versi contemporaneamente: e la censura scema che Luca non vuole.
//
// Quindi qui si guardano solo PROVE, non indizi:
//   1. da DOVE viene (il dominio della fonte),
//   2. cosa dichiara chi ce l'ha data.
// Nient'altro. Il giudizio sul contenuto e un lavoro da AI, e quando
// ci sara si attacca qui dentro senza toccare nessuna schermata.
//
// E la copertura NON E' UNA CENSURA: il contenuto c'e, si vede con un
// dito. E' la forma esatta della frase di Luca — «io non distribuisco a
// nessuno cio che non sceglie di osservare».
// ═══════════════════════════════════════════════════════════════

/**
 * Domini che dichiarano loro stessi cosa sono. Non e una lista di
 * cattivi da tenere aggiornata all'infinito: e la manciata di posti
 * dove l'anteprima e esplicita per definizione, non per interpretazione.
 */
const DOMINI_ESPLICITI = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'onlyfans.com', 'fansly.com', 'chaturbate.com',
  'stripchat.com', 'xnxx.com', 'spankbang.com', 'erome.com',
];

function dominioDi(qualcosa) {
  const s = String(qualcosa || '').trim().toLowerCase();
  if (!s) return '';
  try {
    // funziona sia con un indirizzo intero sia col solo dominio
    return new URL(s.includes('://') ? s : `https://${s}`).hostname.replace(/^www\./, '');
  } catch { return s.replace(/^www\./, ''); }
}

/**
 * Va coperta l'anteprima di questo contenuto?
 *
 * @param {{url?:string, source?:string, fonte?:string, dominio?:string,
 *          sensibile?:boolean, adult?:boolean}} contenuto
 */
export function eSensibile(contenuto) {
  if (!contenuto) return false;
  // 1. chi ce l'ha dato lo dichiara: ci si fida, e la prova piu forte.
  if (contenuto.sensibile === true || contenuto.adult === true) return true;
  // 2. da dove viene.
  const d = dominioDi(contenuto.dominio || contenuto.source || contenuto.fonte || contenuto.url);
  if (!d) return false;
  return DOMINI_ESPLICITI.some((x) => d === x || d.endsWith(`.${x}`));
}

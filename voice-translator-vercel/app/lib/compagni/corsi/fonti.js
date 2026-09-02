// ═══════════════════════════════════════════════════════════════
// LE FONTI DELLE MATERIE CERTIFICATE — non basta che esistano.
//
// b.380, collaudo di Luca. Corso di farmacologia, livello Ricercatore,
// lezione sulle controindicazioni. Le fonti consegnate: un sito di
// fitness per consumatori, piu il foglietto illustrativo di un farmaco
// che c'entrava poco. Mancava tutto quello che conta davvero su quel
// tema. E sotto la lezione c'era scritto "Fonti:".
//
// Il difetto non era la ricerca: era il CANCELLO. Controllava che le
// fonti ESISTESSERO, non che valessero — `esito.risultati.slice(0, 5)`,
// qualunque cosa fosse tornata. E la riga "Fonti:" dava una garanzia che
// nessuno aveva dato: chi legge, davanti a quella riga, smette di
// dubitare. Su medicina e farmacologia questo non e un difetto di
// qualita, e un rischio.
//
// Qui il cancello impara a dire di no. Due mosse, in quest'ordine:
//
//  1. SI BUTTA VIA quello che non puo essere una fonte per una materia
//     certificata: siti di consumo, aggregatori, forum, contenuti
//     scritti per il motore di ricerca. Non sono cattivi in se — sono
//     inadatti a fondare una lezione di farmacologia.
//
//  2. QUELLO CHE RESTA VIENE DICHIARATO per quello che e. Se dopo il
//     filtro non resta abbastanza, la lezione NON finge: parte senza
//     fonti, e il Maestro ha gia l'ordine di non citare niente.
//
// Quello che questo NON risolve, e va detto: una fonte autorevole ma
// SBAGLIATA (il foglietto del farmaco che non c'entra) passa il filtro.
// La copertura del tema e un giudizio sul contenuto, e per quello serve
// che sia il Maestro a dichiarare cosa le fonti NON coprono — ordine che
// gli viene dato in promptLezione.
// ═══════════════════════════════════════════════════════════════

/**
 * Domini che NON possono fondare una lezione di materia certificata.
 * Non e una lista di siti "brutti": e la distinzione fra divulgazione
 * per il pubblico e documentazione. Un sito di fitness puo essere utile
 * a una persona e inadatto a insegnare controindicazioni.
 */
const NON_FONDANTI = [
  'my-personaltrainer.it', 'personaltrainer.it',
  'wikihow.com', 'wikihow.it',
  'quora.com', 'reddit.com', 'pinterest.com', 'facebook.com', 'x.com', 'twitter.com',
  'answers.yahoo.com', 'medium.com', 'blogspot.com', 'wordpress.com',
  'tuttogreen.it', 'greenme.it', 'donnamoderna.it', 'alfemminile.com',
  'benessere.com', 'pazienti.it', 'inran.it', 'vivereinsalute.it',
];

/**
 * Domini che valgono SEMPRE per una materia certificata. Chi c'e dentro
 * passa senza discussione; chi non c'e non viene bocciato per questo —
 * si guarda solo che non sia nella lista di sopra.
 */
const FONDANTI = [
  'who.int', 'ema.europa.eu', 'aifa.gov.it', 'salute.gov.it', 'iss.it',
  'nih.gov', 'ncbi.nlm.nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'cochrane.org',
  'cdc.gov', 'fda.gov', 'nice.org.uk', 'bmj.com', 'thelancet.com',
  'nejm.org', 'jamanetwork.com', 'nature.com', 'sciencedirect.com',
  'springer.com', 'wiley.com', 'oup.com', 'cambridge.org',
  'europa.eu', 'efsa.europa.eu', 'ecdc.europa.eu',
];

function dominio(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

function ricade(d, elenco) {
  return elenco.some((x) => d === x || d.endsWith(`.${x}`));
}

/** Vero se questo dominio non puo fondare una lezione certificata. */
function nonFondante(url) {
  const d = dominio(url);
  return !!d && ricade(d, NON_FONDANTI);
}

/** Vero se e una fonte di quelle che valgono sempre. */
export function fondante(url) {
  const d = dominio(url);
  return !!d && ricade(d, FONDANTI);
}

/**
 * Il filtro. Restituisce cosa si tiene e cosa si e buttato — le
 * scartate servono al registro: se una materia certificata riceve solo
 * blog, e un fatto che vogliamo vedere, non una cosa da nascondere.
 *
 * b.382 — `abbastanza` DICE, non decide. Nella prima versione le fonti
 * venivano buttate tutte se erano meno di due: cioe una lezione con UNA
 * fonte autorevole finiva senza nessuna fonte. Sbagliato — una fonte
 * autorevole vale piu di zero, e a raccontare quello che non copre ci
 * pensa gia l'ordine dato al Maestro. L'ha trovato una prova che
 * esisteva da prima.
 *
 * @returns {{tenute: Array, scartate: Array, abbastanza: boolean}}
 */
export function filtraFontiCertificate(fonti = [], { minimo = 1 } = {}) {
  const tenute = [];
  const scartate = [];
  for (const f of fonti) {
    if (!f?.url || nonFondante(f.url)) scartate.push(f);
    else tenute.push(f);
  }
  // le fonti che valgono sempre vanno per prime: se il Maestro ne legge
  // solo alcune, che legga le migliori.
  tenute.sort((a, b) => (fondante(b.url) ? 1 : 0) - (fondante(a.url) ? 1 : 0));
  return { tenute, scartate, abbastanza: tenute.length >= minimo };
}

// ═══════════════════════════════════════════════════════════════
// LE REAZIONI — sei faccine dove prima c'era un cuore solo.
//
// b.545, ordine di Luca: «😊 Reazione (tienilo premuto: si apre il
// ventaglio di emoticon come Instagram)». Il mi piace di b.544
// (lib/gradimento.js) sapeva dire una cosa sola: mi piace. Ma una
// notizia puo far ridere, far arrabbiare o lasciare a bocca aperta, e
// chi legge vuole rispondere con la faccia giusta, non con l'unica che
// gli abbiamo dato.
//
// Lo schema e' lo stesso del cuore, e non per pigrizia: il conteggio e'
// DI TUTTI (vive su Redis, per indirizzo di contenuto), la memoria di
// quale faccina ho messo IO e' mia (vive nel telefono). Cosi il tasto si
// accende subito, senza aspettare la rete, e il numero accanto e' quello
// vero di tutti.
//
// L'unica differenza col cuore sta qui: li c'era acceso o spento, qui
// c'e una scelta fra sei. Per questo `giraReazione` non torna un passo
// +1/-1 ma la coppia prima/dopo — il server deve sapere COSA scalare e
// COSA aggiungere, perche cambiare faccina e' un togliere e un mettere
// nello stesso gesto.
//
// `chiaveContenuto` arriva da gradimento.js, importata e non ricopiata:
// se un giorno cambia il modo di ripulire gli indirizzi, cuori e faccine
// devono cambiare INSIEME, altrimenti lo stesso articolo finisce contato
// su due chiavi diverse.
// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';
import { chiaveContenuto } from './gradimento.js';

export { chiaveContenuto };

const CHIAVE = 'vt-mie-reazioni';
const QUANTI_RICORDO = 400;

/** Le sei facce. Sei e non venti: il ventaglio deve stare in una riga
 *  sola sul telefono, e a scegliere fra venti non si sceglie piu. */
export const REAZIONI = [
  { id: 'cuore', emoji: '❤️', chiaveTesto: 'reazione.cuore' },
  { id: 'forte', emoji: '🔥', chiaveTesto: 'reazione.forte' },
  { id: 'ridere', emoji: '😂', chiaveTesto: 'reazione.ridere' },
  { id: 'stupore', emoji: '😮', chiaveTesto: 'reazione.stupore' },
  { id: 'triste', emoji: '😢', chiaveTesto: 'reazione.triste' },
  { id: 'arrabbiato', emoji: '😡', chiaveTesto: 'reazione.arrabbiato' },
];

const IDS = REAZIONI.map((r) => r.id);

/** Un id che non e' fra i sei non esiste: arriva da un telefono con la
 *  memoria vecchia o da una chiamata storta, e va buttato in silenzio. */
function reazioneValida(id) {
  return typeof id === 'string' && IDS.includes(id);
}

/** L'emoji da disegnare per un id, se l'id ha senso. */
export function emojiDi(id) {
  return REAZIONI.find((r) => r.id === id)?.emoji || null;
}

// Nel telefono tengo coppie [chiave, id] in ordine di freschezza: le
// ultime quattrocento. Un elenco e non un oggetto perche cosi so quali
// sono le piu recenti e posso tagliare la coda senza pensarci.
function leggiMie() {
  try {
    const v = JSON.parse(memGet(CHIAVE, '[]'));
    if (!Array.isArray(v)) return [];
    return v.filter((c) => Array.isArray(c) && typeof c[0] === 'string' && c[0] && reazioneValida(c[1]));
  } catch { return []; }
}

/** Tutte le mie faccine, per chiave di contenuto. */
export function mieReazioni() {
  const mappa = {};
  for (const [k, id] of leggiMie()) if (!(k in mappa)) mappa[k] = id;
  return mappa;
}

/** Che faccia ho messo io qui? `null` se non ho messo niente. */
export function miaReazione(url) {
  const k = chiaveContenuto(url);
  if (!k) return null;
  const trovata = leggiMie().find((c) => c[0] === k);
  return trovata ? trovata[1] : null;
}

/**
 * Metti, cambia o togli — un gesto solo. Se ripeti la faccia che avevi
 * gia, la togli: e' il modo naturale di disdire senza cercare un secondo
 * tasto «annulla» che nessuno troverebbe.
 *
 * Torna { chiave, prima, dopo } con gli id (o null): al server serve
 * proprio questa coppia per sapere quale conteggio scalare e quale
 * alzare. Se l'indirizzo non e' valido, o la faccia non e' fra le sei,
 * non succede niente e prima resta uguale a dopo — cosi chi riceve la
 * risposta capisce da solo che non c'e nulla da scrivere.
 */
export function giraReazione(url, idReazione) {
  const k = chiaveContenuto(url);
  if (!k) return { chiave: '', prima: null, dopo: null };
  const mie = leggiMie();
  const prima = mie.find((c) => c[0] === k)?.[1] ?? null;
  if (!reazioneValida(idReazione)) return { chiave: k, prima, dopo: prima };
  const dopo = prima === idReazione ? null : idReazione;
  const senzaQuesta = mie.filter((c) => c[0] !== k);
  const nuove = dopo ? [[k, dopo], ...senzaQuesta].slice(0, QUANTI_RICORDO) : senzaQuesta;
  try { memSet(CHIAVE, JSON.stringify(nuove)); } catch { /* senza memoria la faccina vale per questa volta sola */ }
  return { chiave: k, prima, dopo };
}

/**
 * I numeri di tutti per un contenuto: quanti per ciascuna faccia e
 * quanti in tutto. Regge conteggi assenti, mezzi rotti o pieni di id che
 * non conosciamo — dal server puo arrivare di tutto, e un feed non si
 * spegne per una riga sballata.
 */
export function contaReazioni(conteggi, url) {
  const k = chiaveContenuto(url);
  const grezzi = (k && conteggi && typeof conteggi === 'object') ? conteggi[k] : null;
  const perId = {};
  let totale = 0;
  if (grezzi && typeof grezzi === 'object') {
    for (const id of IDS) {
      const n = Math.max(0, Math.trunc(Number(grezzi[id]) || 0));
      if (n > 0) { perId[id] = n; totale += n; }
    }
  }
  return { perId, totale };
}

/**
 * La faccia piu votata: sul tasto chiuso ne mostriamo UNA, non sei —
 * il ventaglio si apre solo se lo chiedi, altrimenti la colonnina del
 * feed diventa una tastiera. A parita di voti vince chi viene prima
 * nell'elenco, cosi l'ordine non balla ad ogni ricarica.
 */
export function reazionePiuUsata(conteggi, url) {
  const { perId } = contaReazioni(conteggi, url);
  let vincitrice = null;
  let massimo = 0;
  for (const id of IDS) {
    const n = perId[id] || 0;
    if (n > massimo) { massimo = n; vincitrice = id; }
  }
  return vincitrice;
}

// ═══════════════════════════════════════════════════════════════
// IL PUNTEGGIO CONDIVISO — cosa proporre quando i materiali finiscono.
//
// b.545, ordine di Luca: «possiamo misurare il tempo che passano gli
// utenti a vedere un video di un argomento, se commentano, oppure
// cliccano mi piace per determinare piu velocemente cosa proporre nelle
// sezioni mondo quando i materiali selezionati terminano».
//
// COSA CAMBIA RISPETTO A PRIMA. lib/ordineFeed.js ordina con cio che si
// SA di un contenuto (ha la foto? ha la data? quanti commenti?). Qui si
// ordina con cio che le persone hanno FATTO davanti a quel contenuto:
// quanto ci sono rimaste, se hanno commentato, se hanno messo il cuore,
// se sono passate oltre in mezzo secondo. Sono due domande diverse e
// restano due file diversi: uno guarda la scheda, l'altro guarda la
// sala. E il secondo serve proprio nel momento che dice Luca — quando i
// materiali scelti a mano finiscono e bisogna decidere da soli.
//
// CINQUE SEGNALI, E UNO E' NEGATIVO. Il tempo di visione, il cuore, il
// commento, l'apertura, e il SALTO: chi passa oltre in meno di due
// secondi sta dicendo qualcosa di preciso, ed e' l'unica cosa che una
// misura di solo gradimento non sente mai. Senza il salto si finisce a
// premiare cio che viene MOSTRATO tanto invece di cio che viene
// GUARDATO — e' il difetto classico di queste macchine.
//
// LA FRESCHEZZA MOLTIPLICA, NON SI SOMMA. E' la scelta piu importante di
// questo file. Se i segnali si sommassero alla freschezza, un articolo
// di ieri con tre cuori scavalcherebbe la notizia di adesso, e un
// giornale in cui le notizie invecchiano verso l'alto non e' un giornale
// (la stessa regola gia' scritta in ordineFeed.js). Moltiplicando, i
// segnali decidono DENTRO la stessa eta', e per battere una notizia
// fresca a mani nude non bastano tre cuori: ci vuole una discussione
// vera. Mezza vita dodici ore: a un giorno un contenuto vale un quarto.
//
// I NUMERI SI SATURANO. Ogni segnale passa da `satura`: i primi cuori
// pesano quasi per intero, il cinquantesimo quasi niente. Cosi chi e' in
// cima non ci resta soltanto perche' e' in cima — il tetto basso sui
// commenti di ordineFeed.js nasceva dalla stessa preoccupazione.
//
// E LA REGOLA CHE VALE SOPRA TUTTE, la stessa di sempre: SI ORDINA, NON
// SI FILTRA. Per questo il punteggio ha un pavimento e non scende mai
// sotto zero: il contenuto che tutti saltano scende in fondo, non
// sparisce.
// ═══════════════════════════════════════════════════════════════
import { chiaveContenuto } from './gradimento.js';

const ORA_MS = 3600000;

/**
 * I PESI. Per ogni segnale: quanto vale un'unita' (`peso`), oltre quale
 * quantita' smette quasi di crescere (`tetto`), e quanto se ne puo'
 * dichiarare in UN SOLO invio (`massimo`).
 *
 * Le proporzioni non sono a caso: un commento (5) vale piu' di un cuore
 * (3) perche' costa piu' fatica; venti secondi guardati valgono come
 * un'apertura, perche' aprire e restare sono due cose diverse; e il
 * salto pesa poco per volta (-0.6) ma si accumula — un salto solo non
 * condanna nessuno, cinquanta salti si'.
 */
export const SEGNALI = {
  visione:  { peso: 0.05, tetto: 3600, massimo: 600 },  // secondi guardati
  cuore:    { peso: 3,    tetto: 50,   massimo: 1 },
  commento: { peso: 5,    tetto: 30,   massimo: 1 },
  apertura: { peso: 1,    tetto: 200,  massimo: 1 },
  salto:    { peso: -0.6, tetto: 200,  massimo: 1 },    // passato oltre subito
};

/** Come si chiama, nei conteggi, cio che ogni segnale accumula. Sta qui
 *  e non nella rotta: server e feed devono chiamare le stesse cose allo
 *  stesso modo, o si contano due volte. */
export const CONTEGGIO = {
  visione: 'secondiVisti',
  cuore: 'cuori',
  commento: 'commenti',
  apertura: 'aperture',
  salto: 'salti',
};

/** Sotto i due secondi non si e' guardato niente: si e' saltato. */
export const SOGLIA_SALTO_MS = 2000;

/** A dodici ore un contenuto vale meta', a un giorno un quarto. */
export const MEZZA_VITA_MS = 12 * ORA_MS;

/** Quanto vale un contenuto appena uscito che non ha ancora nessun
 *  segnale. Non zero: il nuovo deve poter partire davanti al vecchio. */
export const BASE_NOVITA = 10;

/** Oltre questo multiplo del massimo per invio non e' un errore di
 *  misura, e' una bugia: si butta invece di tagliarla. */
export const FATTORE_BUGIA = 6;

// Sotto questo la freschezza non scende: passati tre giorni tutti i
// contenuti sono "vecchi" allo stesso modo e a decidere tornano i
// segnali. E' voluto: e' esattamente il caso di Luca, quando i materiali
// scelti a mano sono finiti e restano solo cose non recentissime.
const PAVIMENTO_FRESCHEZZA = 0.02;

// Il punteggio non scende mai sotto: si ordina, non si filtra.
const MINIMO = 0.5;

// Due terzi di tutti, un terzo mio. Vedi `mescolaConInteresse`.
const PESO_COLLETTIVO = 2 / 3;
const PESO_PERSONALE = 1 / 3;

// b.545 — i due dizionari qui sopra si leggono SOLO cosi. Con
// `SEGNALI[tipo]` un tipo che si chiama `__proto__` trova qualcosa
// (l'oggetto radice di JavaScript, che c'e sempre) e passa per un
// segnale vero: una prova l'ha beccato, e sarebbe finito in Redis.
const descrizione = (tipo) => (Object.prototype.hasOwnProperty.call(SEGNALI, tipo) ? SEGNALI[tipo] : null);
const nomeConteggio = (tipo) => (Object.prototype.hasOwnProperty.call(CONTEGGIO, tipo) ? CONTEGGIO[tipo] : '');

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Rendimenti decrescenti: cresce sempre (piu' cuori restano piu' cuori)
 * ma non oltre il tetto. Il primo cuore vale quasi 1, il centesimo no.
 */
export function satura(quanti, tetto) {
  const n = numero(quanti);
  const t = numero(tetto);
  if (!n) return 0;
  if (!t) return n;
  return (t * n) / (n + t);
}

/** Vero se questa vista e' stata un salto e non una visione. */
export function eSalto(msVisti) {
  const n = Number(msVisti);
  if (!Number.isFinite(n) || n < 0) return false;   // non sappiamo: non accusiamo
  return n < SOGLIA_SALTO_MS;
}

/**
 * Quanto e' fresco: 1 adesso, 0.5 a dodici ore, 0.25 a un giorno.
 * Senza data si sta col pavimento — come in ordineFeed.js, chi non dice
 * quando e' nato sta in fondo, non davanti.
 */
export function freschezza(quandoMs, adessoMs = Date.now()) {
  const t = Number(quandoMs);
  if (!Number.isFinite(t) || t <= 0) return PAVIMENTO_FRESCHEZZA;
  const eta = Math.max(0, Number(adessoMs) - t);   // dal futuro = adesso
  return Math.max(PAVIMENTO_FRESCHEZZA, Math.pow(2, -eta / MEZZA_VITA_MS));
}

/**
 * IL PUNTEGGIO DI UN CONTENUTO. Segnali di tutti per la freschezza.
 *
 * @param {Object} c {cuori, commenti, secondiVisti, aperture, salti, quandoMs}
 * @param {number} adessoMs
 * @returns {number} sempre > 0
 */
export function punteggioContenuto(c, adessoMs = Date.now()) {
  const s = c || {};
  const parte = (tipo, valore) => {
    const d = descrizione(tipo);
    return d ? d.peso * satura(valore, d.tetto) : 0;
  };
  const positivi =
    parte('cuore', s.cuori) +
    parte('commento', s.commenti) +
    parte('visione', s.secondiVisti) +
    parte('apertura', s.aperture);
  // il peso del salto e' gia' negativo: qui si somma come gli altri, ed
  // e' il pavimento a impedire che un contenuto molto saltato diventi
  // un numero negativo e sprofondi sotto la terra.
  const penalita = parte('salto', s.salti);
  const grezzo = Math.max(MINIMO, BASE_NOVITA + positivi + penalita);
  return grezzo * freschezza(s.quandoMs, adessoMs);
}

/** L'indirizzo di un contenuto, dovunque lo tenga: scheda di Mondo,
 *  slide del feed, video di YouTube. Da qui esce la chiave con cui i
 *  segnali sono stati contati. */
export function indirizzoDi(x) {
  if (!x) return '';
  const d = x.dati || {};
  if (x.url) return String(x.url);
  if (d.url) return String(d.url);
  if (d.id) return `youtube.com/watch?v=${d.id}`;
  if (x.media?.url) return String(x.media.url);
  return '';
}

/** Quando e' nato, in millisecondi. I nomi sono quelli gia' in uso nel
 *  progetto (`pubblicato` dalle schede, le date ISO dalle stanze). */
export function quandoDi(x) {
  if (!x) return 0;
  const d = x.dati || {};
  const diretti = [x.quandoMs, x.quando, x.pubblicato, d.pubblicato, d.quando];
  for (const v of diretti) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  for (const v of [x.last_activity_at, x.created_at, x.publishedAt, d.publishedAt]) {
    const n = v ? Date.parse(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** La chiave con cui questo contenuto e' contato: la stessa dei cuori
 *  (gradimento.js), importata e non ricopiata. */
export function chiaveDi(x) {
  if (x?.chiave) return String(x.chiave);
  return chiaveContenuto(indirizzoDi(x));
}

/** I segnali di un contenuto, presi dai conteggi del server e uniti
 *  alla sua data. */
export function segnaliDi(x, conteggi) {
  const c = conteggi?.[chiaveDi(x)] || {};
  return {
    cuori: numero(c.cuori),
    commenti: numero(c.commenti ?? x?.comment_count),
    secondiVisti: numero(c.secondiVisti ?? c.secondi),
    aperture: numero(c.aperture),
    salti: numero(c.salti),
    quandoMs: quandoDi(x),
  };
}

/** Il punteggio di un contenuto gia' pescato dai conteggi. */
export function punteggioDi(x, conteggi, adessoMs = Date.now()) {
  return punteggioContenuto(segnaliDi(x, conteggi), adessoMs);
}

/**
 * L'ORDINE DI TUTTI. Non tocca l'elenco che riceve: ne restituisce uno
 * nuovo. A parita' di punteggio vince chi arrivava prima (ordine
 * stabile), cosi due contenuti identici non si scambiano di posto a ogni
 * ridisegno — che dal vivo si vede, e sembra un difetto.
 */
export function ordinaPerPunteggio(contenuti, conteggi, adessoMs = Date.now()) {
  if (!Array.isArray(contenuti) || contenuti.length < 2) {
    return Array.isArray(contenuti) ? contenuti.slice() : [];
  }
  return contenuti
    .map((x, i) => ({ x, i, punti: punteggioDi(x, conteggi, adessoMs) }))
    .sort((a, b) => (b.punti - a.punti) || (a.i - b.i))
    .map((v) => v.x);
}

/** I miei semi: le ricerche che ho salvato, gli argomenti che ho
 *  dichiarato, quelli che apro di piu'. Tutte cose che ho fatto IO —
 *  mai dedotte da eta', sesso o paese (la regola di interessi.js). */
function semiDi(interessiUtente) {
  const fuori = [];
  const metti = (t) => {
    const s = String(t || '').trim().toLowerCase();
    if (s) fuori.push(s);
  };
  if (Array.isArray(interessiUtente)) {
    for (const v of interessiUtente) metti(typeof v === 'string' ? v : (v?.q || v?.etichetta || v?.termine));
  } else if (interessiUtente && typeof interessiUtente === 'object') {
    for (const v of (interessiUtente.interessi || [])) metti(v);
    for (const r of (interessiUtente.ricerchePreferite || [])) metti(r?.q);
    for (const k of Object.keys(interessiUtente.argomentiVisti || {})) metti(k);
  } else {
    metti(interessiUtente);
  }
  return [...new Set(fuori)];
}

/** Quanto un contenuto mi riguarda (0..1) e per quali semi. Il seme
 *  DICHIARATO (la ricerca da cui il contenuto e' nato) vale pieno; il
 *  titolo meno; la sintesi ancora meno — perche' una parola nel
 *  riassunto puo' esserci per caso. */
function pertinenzaPersonale(x, semi) {
  const d = x?.dati || {};
  const dichiarato = String(x?.seme || x?.q || x?.query || x?.topic || x?.argomento || d.seme || '').trim().toLowerCase();
  const titolo = String(x?.titolo || x?.title || d.titolo || '').toLowerCase();
  const sintesi = String(x?.sintesi || d.sintesi || '').toLowerCase();
  const trovati = [];
  let voto = 0;
  for (const s of semi) {
    let forza = 0;
    if (dichiarato && (dichiarato === s || dichiarato.includes(s) || s.includes(dichiarato))) forza = 1;
    else if (titolo && titolo.includes(s)) forza = 0.7;
    else if (sintesi && sintesi.includes(s)) forza = 0.4;
    if (forza > 0) { trovati.push(s); voto = Math.max(voto, forza); }
  }
  return { voto, trovati };
}

// LA PROMESSA: nessun seme mio finisce nella meta' di sotto. Il peso di
// un terzo, da solo, farebbe risalire un mio contenuto solo fino a meta'
// classifica; se pero' il collettivo e' molto forte su tutto il resto,
// un argomento che seguo potrebbe non comparire affatto prima che io
// smetta di scorrere. Qui il MIGLIORE di ogni seme ha un posto tenuto
// in fondo alla prima meta': non gli si regala il primo posto (quello
// resta di tutti), gli si garantisce soltanto di esserci.
function garantisciSemi(ordine, voti) {
  const meta = Math.max(1, Math.ceil(ordine.length / 2));
  const primoDelSeme = new Map();
  voti.forEach((v, pos) => {
    for (const s of v.trovati) if (!primoDelSeme.has(s)) primoDelSeme.set(s, pos);
  });
  if (!primoDelSeme.size) return ordine;

  // I posti si RISERVANO, non si scambiano. Il primo tentativo spostava
  // il contenuto ripescato all'ultimo posto utile della prima meta', e
  // con due semi il secondo spostamento buttava fuori il primo (una
  // prova l'ha beccato: undici contenuti, due semi, il mio finiva al
  // sesto posto di dodici). Qui invece si scorre la classifica una
  // volta sola tenendo da parte tanti posti in fondo alla prima meta'
  // quanti sono i semi ancora da piazzare: chi e' gia' in cima resta in
  // cima, e nessuno dei miei resta fuori.
  const protette = new Set(primoDelSeme.values());
  let daPiazzare = protette.size;
  const presi = new Array(ordine.length).fill(false);
  const davanti = [];
  for (let i = 0; i < ordine.length && davanti.length < meta; i++) {
    const mio = protette.has(i);
    if (!mio && (meta - davanti.length) <= daPiazzare) continue;   // posto riservato
    davanti.push(ordine[i]);
    presi[i] = true;
    if (mio) daPiazzare--;
  }
  return [...davanti, ...ordine.filter((_, i) => !presi[i])];
}

/**
 * IL PUNTEGGIO DI TUTTI, MESCOLATO CON QUELLO CHE PIACE A ME.
 *
 * Due terzi collettivo, un terzo personale: sono le proporzioni che
 * tengono in piedi tutte e due le cose. Con meta' e meta' il feed
 * diventa la mia bolla e non scopro piu' niente (interessi.js: «in un
 * posto che vive di curiosita' da altri paesi, sarebbe un suicidio»);
 * con un decimo, avere dei preferiti non servirebbe a niente.
 *
 * Si mescolano le POSIZIONI e non i numeri: il punteggio collettivo di
 * un contenuto molto discusso puo' valere cento volte quello di un
 * altro, e sommandolo a un interesse che vale 1 l'interesse sparirebbe.
 * Contano il primo, il secondo, il terzo — non di quanto hanno vinto.
 *
 * Non toglie e non aggiunge niente: escono gli stessi contenuti entrati.
 */
export function mescolaConInteresse(ordinati, interessiUtente) {
  const lista = Array.isArray(ordinati) ? ordinati.slice() : [];
  const semi = semiDi(interessiUtente);
  if (lista.length < 2 || !semi.length) return lista;
  const n = lista.length;
  const voti = lista
    .map((x, i) => {
      const p = pertinenzaPersonale(x, semi);
      const collettivo = 1 - i / (n - 1);       // 1 in cima, 0 in fondo
      return { x, i, trovati: p.trovati, voto: PESO_COLLETTIVO * collettivo + PESO_PERSONALE * p.voto };
    })
    .sort((a, b) => (b.voto - a.voto) || (a.i - b.i));
  return garantisciSemi(voti.map((v) => v.x), voti);
}

/**
 * UN SEGNALE ALLA VOLTA, E CREDIBILE.
 *
 * Chi dichiara i segnali e' il telefono di chi guarda, e un telefono
 * puo' sbagliare (una scheda lasciata aperta tutta la notte) o mentire
 * (dieci ore di visione per spingere il proprio articolo). La differenza
 * fra le due si vede dalla misura: un po' oltre il massimo si taglia,
 * molto oltre si butta — perche' non e' piu' una misura sbagliata, e'
 * un'altra storia.
 *
 * @returns {{tipo:string, valore:number}|null} null = non si accumula
 */
export function sanaSegnale(tipo, valore) {
  const t = String(tipo || '').trim().toLowerCase();
  const d = descrizione(t);
  if (!d) return null;                                  // segnale inventato
  const n = Number(valore);
  if (!Number.isFinite(n) || n <= 0) return null;       // niente, negativi, parole
  if (n > d.massimo * FATTORE_BUGIA) return null;       // dieci ore di visione
  const intero = Math.floor(n);
  if (intero < 1) return null;                          // mezzo secondo non e' un secondo
  return { tipo: t, valore: Math.min(intero, d.massimo) };
}

/**
 * I conteggi come li tiene Redis (un hash per contenuto) tradotti nei
 * nomi che usa `punteggioContenuto`. Upstash risponde ora con un
 * oggetto ora con la lista piatta campo/valore: si accettano tutte e
 * due, perche' scoprirlo in produzione costa un feed non ordinato.
 */
export function conteggiDaSegnali(grezzo) {
  const fuori = { cuori: 0, commenti: 0, secondiVisti: 0, aperture: 0, salti: 0 };
  const metti = (campo, v) => {
    const n = Number(v);
    if (campo && Number.isFinite(n) && n > 0) fuori[campo] = n;
  };
  if (Array.isArray(grezzo)) {
    for (let i = 0; i + 1 < grezzo.length; i += 2) metti(nomeConteggio(String(grezzo[i])), grezzo[i + 1]);
  } else if (grezzo && typeof grezzo === 'object') {
    for (const [tipo, v] of Object.entries(grezzo)) metti(nomeConteggio(tipo), v);
  }
  return fuori;
}

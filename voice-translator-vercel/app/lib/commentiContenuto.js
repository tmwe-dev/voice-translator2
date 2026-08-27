// ═══════════════════════════════════════════════════════════════
// I COMMENTI SUL CONTENUTO — e la stanza che nasce da sola.
//
// b.545, ordine di Luca: «possiamo permettere di commentare e inserire
// automaticamente una possibile discussione dal commento, che da solo
// apre una "stanza" aperta ad altri che vogliono commentare, e inserirla
// nell'elenco chat quando uno la commenta. quindi parlane e' un atto
// volontario che apre una discussione, ma anche il commento apre una
// "stanza" di commenti che possono susseguirsi».
//
// Sono DUE porte, non una, ed e' la differenza che conta:
//   · «Parlane» e' un atto volontario: chi lo tocca sa che sta aprendo
//     una discussione, e la discussione nasce subito;
//   · il commento no. Parte come un filo sotto l'articolo — una voce
//     sola, che puo restare sola. Diventa stanza da se' quando qualcuno
//     RISPONDE: «inserirla nell'elenco chat quando uno la commenta».
// Percio la soglia e' due, non uno. Un commento e' un'opinione; due
// commenti sono gia una conversazione, e una conversazione merita un
// posto nell'elenco chat. Sotto la soglia non si disturba nessuno.
//
// L'indirizzo del contenuto e' LA STESSA chiave dei cuori
// (chiaveContenuto, lib/gradimento.js — non riscritta qui apposta): lo
// stesso articolo condiviso in due modi ha un filo solo, non due.
// ═══════════════════════════════════════════════════════════════
import { chiaveContenuto } from './gradimento.js';

/** Un commento non e' un articolo: cinquecento caratteri sono il tetto.
 *  Oltre non si taglia la conversazione, si taglia lo sproloquio. */
export const MAX_COMMENTO = 500;

/** Quanti commenti servono perche il filo diventi stanza — vedi sopra:
 *  «quando uno la commenta», cioe quando qualcuno risponde al primo. */
export const SOGLIA_STANZA = 2;

/**
 * Il testo di un commento, ripulito. Torna '' quando non c'e' niente da
 * salvare: vuoto, solo spazi, o non e' nemmeno una stringa. Un commento
 * vuoto non deve poter aprire una stanza — e' lo stesso difetto che
 * b.232 aveva corretto per i titoli delle discussioni, che si potevano
 * creare vuoti e comparivano in piazza come un trattino.
 */
export function sanaCommento(testo) {
  if (typeof testo !== 'string') return '';
  // gli a capo restano — anche un commento si scrive a righe — ma i
  // caratteri di controllo no: non si vedono, non si scrivono a mano, e
  // finirebbero dritti dentro il salvataggio.
  const ripulito = Array.from(testo.replace(/\r\n?/g, '\n'))
    .map((ch) => {
      const cod = ch.charCodeAt(0);
      const eControllo = (cod < 32 || cod === 127) && ch !== '\n';
      return eControllo ? ' ' : ch;
    })
    .join('');
  const stretto = ripulito.trim();
  if (!stretto) return '';
  return stretto.slice(0, MAX_COMMENTO).trim();
}

/**
 * I commenti in ordine, dal piu recente. Chi arriva ora deve leggere per
 * primo l'ultima cosa detta, non quella di tre settimane fa.
 *
 * Quel che e' malformato viene scartato in silenzio: una riga illeggibile
 * (JSON rotto, testo mancante) non deve far sparire tutto il filo.
 */
export function ordinaCommenti(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((c) => c && typeof c === 'object' && !Array.isArray(c)
      && typeof c.testo === 'string' && c.testo.trim() !== '')
    .map((c) => ({ ...c, quando: Number(c.quando) > 0 ? Number(c.quando) : 0 }))
    .sort((a, b) => b.quando - a.quando);
}

/**
 * Il numero da mostrare sulla card. Mai NaN, mai negativo: il conteggio
 * arriva dal server e puo mancare (contenuto mai commentato, oppure
 * lettura fallita) — in tutti e due i casi si mostra zero, non un buco.
 */
export function quantiCommenti(conteggi, url) {
  const k = chiaveContenuto(url);
  if (!k) return 0;
  const n = Number(conteggi?.[k]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * E' il momento di aprire la stanza vera? Si', da due commenti in su.
 *
 * Accetta sia l'elenco dei commenti sia il solo numero: il server ha in
 * mano il conteggio, la schermata ha in mano la lista, e la regola deve
 * restare UNA per tutti e due — se no la card e il filo si mettono a
 * raccontare due storie diverse.
 */
export function serveStanza(commenti) {
  const quanti = Array.isArray(commenti)
    ? ordinaCommenti(commenti).length
    : Math.max(0, Math.floor(Number(commenti) || 0));
  return quanti >= SOGLIA_STANZA;
}

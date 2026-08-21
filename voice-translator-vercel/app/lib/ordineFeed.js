import { punteggioArgomento } from './interessi.js';

// ═══════════════════════════════════════════════════════════════
// L'ORDINE DEL MONDO — un posto solo dove si decide cosa viene prima.
//
// b.366, ordine di Luca: mettere davanti chi ha foto E commenti, senza
// nascondere gli altri.
//
// PERCHE' ADESSO E NON PRIMA. Finche la foto era un francobollo da 62
// pixel, una scheda senza foto era uguale alle altre. Da quando
// l'immagine prende tutta la larghezza, a una scheda senza foto SI VEDE
// che manca qualcosa: l'ordine deve tenerne conto, o le prime cose che
// si incontrano aprendo Mondo sono le piu spoglie.
//
// TRE REGOLE, IN QUEST'ORDINE. E l'ordine fra le regole conta piu delle
// regole stesse:
//
//   1. QUELLO CHE TI INTERESSA. Sempre per primo. Una notizia bella e
//      completa di una cosa che non ti riguarda resta una cosa che non
//      ti riguarda.
//
//   2. QUANTO E' FRESCA, a fasce larghe (oggi / questa settimana / piu
//      in la). E' la protezione che serve: SENZA, un articolo di tre
//      settimane con trenta commenti scavalcherebbe la notizia di
//      stamattina, e un giornale in cui le notizie invecchiano verso
//      l'alto non e un giornale. La completezza decide DENTRO la fascia,
//      non attraverso.
//
//   3. QUANTO E' COMPLETA. La foto pesa il doppio dei commenti, ed e
//      voluto: la foto e cio che si vede, i commenti sono cio che si
//      scopre. E il peso dei commenti ha un TETTO BASSO apposta — se
//      contassero senza limite si costruirebbe la macchina che gia
//      conosciamo, dove chi e in cima ci resta perche e in cima. Qui
//      chi pubblica poco non deve sparire.
//
// E la regola che vale sopra tutte: SI ORDINA, NON SI FILTRA. Quello
// che e incompleto scende, non sparisce.
// ═══════════════════════════════════════════════════════════════

const GIORNO = 86400000;

/** Fascia di freschezza: 0 = oggi, 1 = questa settimana, 2 = piu in la. */
export function fascia(quando, adesso = Date.now()) {
  const t = quando ? new Date(quando).getTime() : NaN;
  if (!Number.isFinite(t)) return 2;      // senza data si sta in fondo, non davanti
  const eta = adesso - t;
  if (eta < GIORNO) return 0;
  if (eta < 7 * GIORNO) return 1;
  return 2;
}

/**
 * Quanto e completa una scheda: 0 (nuda) .. 7 (tutto).
 * Non e un giudizio sul contenuto — solo su cosa abbiamo da mostrare.
 */
export function completezza(x) {
  if (!x) return 0;
  let p = 0;
  // b.366 — quattro contro due: la foto pesa ESATTAMENTE il doppio dei
  // commenti. Una prova ha beccato che l'avevo scritto nel commento
  // senza farlo nel conto (erano due contro due, cioe pari). Il doppio
  // e voluto: la foto e cio che si VEDE aprendo Mondo, i commenti sono
  // cio che si SCOPRE entrando.
  if (x.media?.thumb) p += 4;             // la foto: e quello che si vede
  if (x.media?.url) p += 1;               // c'e un articolo da leggere
  const commenti = Number(x.comment_count) || 0;
  if (commenti >= 3) p += 2;              // una conversazione viva
  else if (commenti > 0) p += 1;          // qualcuno ha cominciato
  return p;
}

/**
 * L'ordine finale. L'elenco che arriva e gia in ordine di freschezza:
 * quello resta l'ultimo giudice, cosi a parita di tutto il resto vince
 * il piu recente.
 *
 * La differenza con l'ordine di prima: l'interesse si applica solo se
 * di quella persona sappiamo qualcosa, ma la COMPLETEZZA si applica
 * SEMPRE — anche a chi si e iscritto cinque minuti fa e non ha ancora
 * detto niente di se. Anzi: soprattutto a quello, perche e l'unico che
 * sta vedendo Mondo per la prima volta.
 */
export function ordinaFeed(elenco, prefs, adesso = Date.now()) {
  if (!Array.isArray(elenco) || elenco.length < 2) return elenco || [];
  const sappiamo = !!(prefs?.interessi?.length || Object.keys(prefs?.argomentiVisti || {}).length);

  return elenco
    .map((x, i) => ({
      x, i,
      interesse: sappiamo ? punteggioArgomento(prefs, x.topic) : 0,
      fascia: fascia(x.last_activity_at || x.created_at, adesso),
      completa: completezza(x),
    }))
    .sort((a, b) =>
      (b.interesse - a.interesse) ||
      (a.fascia - b.fascia) ||
      (b.completa - a.completa) ||
      (a.i - b.i))
    .map((v) => v.x);
}

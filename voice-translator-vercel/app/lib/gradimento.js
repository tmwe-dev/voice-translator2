// ═══════════════════════════════════════════════════════════════
// IL MI PIACE — e il punteggio che ne nasce.
//
// b.544, collaudo di Luca: «i tasti non funzionano bene e non si puo
// dare un mi piace a nessuno». Vero: il mi piace non c'era proprio. Lo
// avevo promesso («il motore», b.536) e poi b.536 e' finito su altro.
//
// Come funziona, in due parole: il conteggio e' DI TUTTI (vive su Redis,
// per indirizzo del contenuto), la memoria di cosa ho gia messo IO e'
// mia (vive nel telefono). Cosi il tasto sa accendersi subito, senza
// aspettare la rete, e il numero accanto e' quello vero di tutti.
//
// Il punteggio serve poi a ordinare il feed — «per determinare piu
// velocemente cosa proporre nelle sezioni mondo» (Luca): i contenuti che
// piacciono salgono, indipendentemente dal fatto che esista una chat.
// ═══════════════════════════════════════════════════════════════
import { memGet, memSet } from './memoria.js';

const CHIAVE = 'vt-miei-cuori';
const QUANTI_RICORDO = 400;

/** L'indirizzo di un contenuto, ridotto a chiave: senza parametri di
 *  tracciamento, cosi lo stesso articolo condiviso in due modi conta una
 *  volta sola. */
export function chiaveContenuto(url) {
  const grezzo = String(url || '').trim();
  if (!grezzo) return '';
  try {
    const u = new URL(grezzo);
    const via = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    for (const p of via) u.searchParams.delete(p);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const percorso = u.pathname.replace(/\/+$/, '');
    const coda = u.searchParams.toString();
    return `${host}${percorso}${coda ? `?${coda}` : ''}`.slice(0, 200);
  } catch {
    return grezzo.toLowerCase().slice(0, 200);
  }
}

function leggiMiei() {
  try {
    const v = JSON.parse(memGet(CHIAVE, '[]'));
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/** I contenuti a cui ho gia messo il cuore. */
export function mieiCuori() { return new Set(leggiMiei()); }

/** Ho gia messo il cuore qui? */
export function hoMessoCuore(url) {
  const k = chiaveContenuto(url);
  return !!k && leggiMiei().includes(k);
}

/**
 * Metti o togli: torna { chiave, acceso, passo } dove `passo` e +1 o -1,
 * cioe quanto va detto al server. Se l'indirizzo non e valido non
 * succede niente — un cuore senza contenuto non esiste.
 */
export function giraCuore(url) {
  const k = chiaveContenuto(url);
  if (!k) return { chiave: '', acceso: false, passo: 0 };
  const miei = leggiMiei();
  const gia = miei.includes(k);
  const nuovi = gia ? miei.filter((x) => x !== k) : [k, ...miei].slice(0, QUANTI_RICORDO);
  try { memSet(CHIAVE, JSON.stringify(nuovi)); } catch { /* senza memoria il cuore vale per questa volta */ }
  return { chiave: k, acceso: !gia, passo: gia ? -1 : 1 };
}

/**
 * Il numero da mostrare: quello di tutti, piu il mio se l'ho appena
 * messo e il server non lo sa ancora. Mai negativo, mai NaN.
 */
export function quantiCuori(conteggi, url, accesoQui) {
  const k = chiaveContenuto(url);
  const dalServer = Math.max(0, Number(conteggi?.[k]) || 0);
  if (accesoQui == null) return dalServer;
  const serverMiSa = !!conteggi?.[`${k}:io`];
  if (accesoQui && !serverMiSa) return dalServer + 1;
  if (!accesoQui && serverMiSa) return Math.max(0, dalServer - 1);
  return dalServer;
}

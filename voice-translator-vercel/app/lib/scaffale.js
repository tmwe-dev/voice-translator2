// ═══════════════════════════════════════════════════════════════
// LO SCAFFALE — la memoria del telefono, con dentro CHI SEI (b.410)
//
// P0.7 dell'audit, e non e teoria. Le chiavi erano queste:
//
//     vt-chat-<idCompagno>        la conversazione con l'Amico
//     vt-obiettivi                gli obiettivi di vita
//
// Nessuna delle due contiene chi sei. Quindi sullo stesso telefono:
// parli con Omar, esci, entra un altro account, apre Omar e legge la
// tua conversazione. Gli Obiettivi hanno per DISEGNO le categorie
// salute, relazioni, lavoro, finanza — c'e scritto nel loro catalogo.
//
// Da qui in avanti ogni cosa personale sta su uno scaffale con un nome:
//
//     vt:<impronta>:chat:<idCompagno>
//     vt:<impronta>:obiettivi
//
// L'impronta NON e l'email in chiaro (l'audit lo vieta, ed e giusto:
// una chiave di memoria si legge da qualunque strumento del browser).
// E' un numero ricavato dall'email, che non si puo rileggere al
// contrario. Chi non ha fatto l'accesso ha la sua impronta di ospite,
// nata a caso su questo telefono e mai piu cambiata.
//
// COSA SUCCEDE AI DATI DI PRIMA — la parte che va spiegata, non nascosta.
// Le vecchie chiavi non dicono di chi sono. L'audit e chiaro: non si
// attribuisce cio che non si sa attribuire. Ma NON migrare niente
// vorrebbe dire far sparire la cronologia a chi ce l'ha, e non e
// nemmeno gratis in termini di fiducia.
//
// La scelta: si migrano UNA VOLTA SOLA, alla prima identita che compare
// dopo l'aggiornamento, e si segna che e stato fatto. Il ragionamento,
// perche possa essere contestato: prima di oggi quei dati erano
// leggibili da OGNI account di questo telefono. Darli al primo che
// entra non espone niente che non fosse gia esposto a lui — e da quel
// momento in poi li chiude a tutti gli altri, che oggi li vedono. Il
// costo possibile e che finiscano nello scaffale sbagliato fra due
// persone che comunque se li vedevano gia entrambe. Meno esposizione di
// prima in ogni caso, mai di piu.
// ═══════════════════════════════════════════════════════════════

import { memGet, memSet, memDel } from './memoria.js';

const CHIAVE_OSPITE = 'vt-ospite';        // l'impronta di chi non ha fatto l'accesso
const CHIAVE_TRASLOCO = 'vt-trasloco';    // il segno che la migrazione e gia avvenuta

/**
 * Un numero ricavato dal testo, che non si puo rileggere al contrario.
 * Non e un segreto — e un NOME DI SCAFFALE: serve solo perche due
 * persone diverse non finiscano sullo stesso ripiano. Sincrono di
 * proposito: `crypto.subtle` e asincrono, e una chiave di memoria si
 * costruisce mille volte, anche dentro un render.
 */
export function impronta(testo) {
  const s = String(testo || '').trim().toLowerCase();
  if (!s) return '';
  // FNV-1a, due giri con semi diversi: 64 bit di spazio invece di 32.
  const giro = (seme) => {
    let h = seme;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  };
  return `${giro(2166136261)}${giro(0x811c9dc5 ^ 0x5bf03635)}`;
}

/** L'impronta di questo telefono per chi non ha fatto l'accesso. */
function ospite() {
  let id = memGet(CHIAVE_OSPITE);
  if (!id) {
    // b.410 — nasce a caso e resta: se cambiasse, l'ospite perderebbe le
    // sue cose a ogni ricarica della pagina.
    const casuale = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    id = `ospite-${impronta(casuale)}`;
    memSet(CHIAVE_OSPITE, id);
  }
  return id;
}

// Chi sta usando il telefono adesso. Prima che qualcuno faccia
// l'accesso siamo ospiti — che e il valore prudente: i dati di un
// account non si vedono per sbaglio, si vedono solo dopo essere entrati.
let quiSono = null;

/** Dichiara chi sta usando l'app. Va richiamata a ogni cambio di accesso. */
export function entra(email) {
  const nuova = email ? impronta(email) : ospite();
  if (nuova === quiSono) return quiSono;
  quiSono = nuova;
  trasloca();
  return quiSono;
}

function chiSono() {
  if (!quiSono) quiSono = ospite();
  return quiSono;
}

/** Il nome completo di uno scaffale. */
export function chiave(nome) {
  return `vt:${chiSono()}:${nome}`;
}

export function leggi(nome, base = null) { return memGet(chiave(nome), base); }
export function scrivi(nome, valore) { memSet(chiave(nome), valore); }
export function dimentica(nome) { memDel(chiave(nome)); }

// ── IL TRASLOCO, una volta sola ──
//
// Le vecchie chiavi da portare dentro lo scaffale. `da` e il vecchio
// nome piatto, `a` il nome sullo scaffale. Le chat hanno un pezzo
// variabile, quindi si cercano per prefisso.
const VECCHIE = [{ da: 'vt-obiettivi', a: 'obiettivi' }];
const PREFISSO_CHAT = 'vt-chat-';

function trasloca() {
  if (typeof window === 'undefined') return;
  if (memGet(CHIAVE_TRASLOCO)) return;          // gia fatto, per sempre
  try {
    for (const v of VECCHIE) {
      const valore = memGet(v.da);
      if (valore !== null && leggi(v.a) === null) scrivi(v.a, valore);
    }
    // le conversazioni: una per Compagno, il nome non si sa in anticipo
    const deposito = window.localStorage;
    const daPortare = [];
    for (let i = 0; i < deposito.length; i++) {
      const k = deposito.key(i);
      if (k && k.startsWith(PREFISSO_CHAT)) daPortare.push(k);
    }
    for (const k of daPortare) {
      const nome = `chat:${k.slice(PREFISSO_CHAT.length)}`;
      const valore = memGet(k);
      if (valore !== null && leggi(nome) === null) scrivi(nome, valore);
    }
    // b.410 — le vecchie chiavi si CANCELLANO: lasciarle li vorrebbe dire
    // lasciare aperta esattamente la porta che stiamo chiudendo. Sono
    // gia state copiate sullo scaffale di chi e entrato per primo.
    for (const v of VECCHIE) memDel(v.da);
    for (const k of daPortare) memDel(k);
    memSet(CHIAVE_TRASLOCO, '1');
  } catch { /* memoria vietata dal browser: non c'e niente da traslocare */ }
}

/**
 * Per le prove: azzera l'identita corrente. Non tocca i dati.
 * Non serve all'applicazione — serve a poter provare due account di
 * fila dentro lo stesso processo.
 */
export function azzeraPerProva() { quiSono = null; }

// ═══════════════════════════════════════════════════════════════
// AVVISI — la coda dei messaggini che appaiono in basso (b.111)
//
// Stava dentro Toast.js, insieme al componente che la disegna. Sembra
// un dettaglio e non lo e: Toast.js contiene JSX, e chiunque volesse
// AVVISARE l'utente da un hook o da una libreria doveva importare un
// componente. Il primo che ci ha provato ha rotto la suite di test —
// il nostro esecutore non sa leggere JSX dentro un file .js, e ha
// smesso di caricare l'intero file che lo importava.
//
// Il difetto vero non era il test: era la dipendenza al contrario. Un
// hook non deve dipendere da come le cose sono disegnate. Qui c'e solo
// la coda e chi la ascolta — nessun JSX, nessun React. Toast.js resta
// quello che disegna, e legge da qui.
// ═══════════════════════════════════════════════════════════════

import { tFuori } from './i18n.js';
const DURATA = 4000;
const MASSIMO = 3;

let ascoltatori = new Set();
let coda = [];
let prossimoId = 1;

function annuncia() {
  const copia = [...coda];
  ascoltatori.forEach((fn) => fn(copia));
}

export function addToast(avviso) {
  const id = prossimoId++;
  const intero = {
    id,
    type: avviso.type || 'info', // 'info' | 'error' | 'success' | 'warning'
    message: avviso.message,
    action: avviso.action || null, // { label, onClick }
    duration: avviso.duration || DURATA,
    ts: Date.now(),
  };
  coda = [...coda, intero].slice(-MASSIMO);
  annuncia();

  setTimeout(() => {
    coda = coda.filter((t) => t.id !== id);
    annuncia();
  }, intero.duration);

  return id;
}

export function dismissToast(id) {
  coda = coda.filter((t) => t.id !== id);
  annuncia();
}

/** Il componente si iscrive; la funzione restituita lo disiscrive. */
export function ascoltaAvvisi(fn) {
  ascoltatori.add(fn);
  fn([...coda]);
  return () => ascoltatori.delete(fn);
}

export const toast = {
  info: (msg, opts) => addToast({ type: 'info', message: msg, ...opts }),
  error: (msg, opts) => addToast({ type: 'error', message: msg, duration: 6000, ...opts }),
  success: (msg, opts) => addToast({ type: 'success', message: msg, ...opts }),
  warning: (msg, opts) => addToast({ type: 'warning', message: msg, duration: 5000, ...opts }),
  errorRetry: (msg, onRetry) => addToast({
    type: 'error', message: msg, duration: 8000,
    action: { label: tFuori('retryWord'), onClick: onRetry },
  }),
  offline: () => addToast({
    type: 'warning',
    // b.139 — questa frase era scritta due volte: qui in italiano fisso e
    // nei pacchetti lingua come 'offlineBanner', con parole leggermente
    // diverse. Due copie della stessa frase divergono sempre: ora e una.
    message: tFuori('offlineBanner'),
    duration: 10000,
  }),
};

// b.363 — qui c'era COSTANTI_AVVISI, una scatola che rimetteva in mostra
// durata e numero massimo degli avvisi. Non la apriva nessuno: ne il
// componente che disegna gli avvisi ne i collaudi. Era una porta aperta
// su due numeri che questo file usa gia da solo, e faceva credere che
// qualcuno da fuori potesse regolarli. Tolta.

// ═══════════════════════════════════════════════════════════════
// LA SESSIONE E' CADUTA — e l'app deve smettere di dire il contrario.
//
// b.387, secondo collaudo di Luca. Il gettone di sessione scade durante
// l'uso e da quel momento il server rifiuta tutto con 401: il Podcast non
// genera, l'Amico non risponde, la traduzione del taxi fallisce.
//
// Il difetto non e che la sessione scada — quello e normale. Il difetto e
// che L'APP CONTINUA A DIRE CHE SEI DENTRO: il Profilo mostra ancora nome
// ed email, il credito segna centosessantatre ore, e intanto niente
// funziona. Chi usa non ha modo di capire che deve rientrare, e legge
// «Qualcosa e andato storto» su ogni cosa che tocca.
//
// E il motivo esisteva: il server manda «Sessione non valida», il client
// se lo portava dietro fino in superficie, e li veniva buttato.
//
// Qui c'e un interruttore solo. Chiunque riceva un 401 lo tira; chi
// disegna lo ascolta e lo dice UNA volta, in un posto fisso, invece di
// far comparire un errore diverso in ogni angolo.
// ═══════════════════════════════════════════════════════════════

let caduta = false;
const ascoltatori = new Set();

/** Qualcuno ha ricevuto un 401: da adesso la sessione e da rifare. */
export function segnalaSessioneCaduta() {
  if (caduta) return;          // si dice una volta, non a ogni chiamata
  caduta = true;
  for (const fn of ascoltatori) {
    try { fn(true); } catch { /* un ascoltatore rotto non ferma gli altri */ }
  }
}

/** Si e rientrati: si riparte pulito. */
export function sessioneRipresa() {
  if (!caduta) return;
  caduta = false;
  for (const fn of ascoltatori) {
    try { fn(false); } catch { /* un ascoltatore rotto non impedisce agli altri di sapere che si e rientrati */ }
  }
}

export function sessioneECaduta() { return caduta; }

/** Si iscrive; restituisce come disiscriversi. */
export function ascoltaSessione(fn) {
  ascoltatori.add(fn);
  try { fn(caduta); } catch { /* primo giro a vuoto: non e un guasto */ }
  return () => ascoltatori.delete(fn);
}

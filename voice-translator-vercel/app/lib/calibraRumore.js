// ═══════════════════════════════════════════════════════════════
// CALIBRAZIONE DEL RUMORE — recuperata dalla soffitta (b.109)
//
// Stava in app/attic/useVAD.js, in un file che nessuno importava piu.
// L'audit l'ha trovata ed e migliore di quello che l'ha sostituita: al
// suo posto oggi ci sono quattro preset manuali (silenzioso / normale /
// rumoroso / strada) che chiedono all'utente di descrivere il proprio
// ambiente. Ma l'utente non sa quanti decibel ha intorno, e nemmeno
// dovrebbe: lo sa il microfono.
//
// COME FUNZIONA. Nel primo secondo di ascolto raccoglie sessanta
// misure e ne prende la MEDIANA — non la media, perche un solo colpo di
// tosse sposterebbe la media e non la mediana. Quello e il "pavimento"
// del rumore. La soglia della voce sta due volte e mezza sopra.
//
// I limiti (0,03 e 0,25) servono ai due casi che rovinerebbero tutto:
// una stanza cosi silenziosa che il pavimento e zero — e allora ogni
// respiro sarebbe voce — e una cosi rumorosa che nessuno riuscirebbe a
// superare la soglia.
//
// La sensibilita manuale resta: chi vuole decidere continua a decidere.
// ═══════════════════════════════════════════════════════════════

const MISURE = 60;          // ~1 secondo a 60 fotogrammi al secondo
const MARGINE = 2.5;        // la voce sta due volte e mezza sopra il rumore
const MINIMA = 0.03;        // sotto, ogni respiro diventerebbe voce
const MASSIMA = 0.25;       // sopra, non parlerebbe piu nessuno

export function creaCalibratore() {
  const misure = [];
  let pavimento = 0.02;     // stima prudente finche non si sa
  let pronto = false;

  return {
    /** Da chiamare a ogni fotogramma con il livello 0-1 del microfono. */
    aggiungi(livello) {
      if (pronto || typeof livello !== 'number' || Number.isNaN(livello)) return;
      misure.push(livello);
      if (misure.length < MISURE) return;
      const ordinate = [...misure].sort((a, b) => a - b);
      pavimento = ordinate[Math.floor(ordinate.length / 2)];
      pronto = true;
    },

    /** La soglia sopra cui si considera che qualcuno stia parlando. */
    soglia() {
      return Math.max(MINIMA, Math.min(MASSIMA, pavimento * MARGINE));
    },

    /** Falso finche non ha raccolto abbastanza misure. */
    pronto() { return pronto; },

    /** Quanto rumore c'e nell'ambiente, per chi vuole mostrarlo. */
    pavimento() { return pavimento; },

    /** Si ricomincia da capo: cambio di stanza, cambio di microfono. */
    azzera() { misure.length = 0; pavimento = 0.02; pronto = false; },
  };
}

// I preset manuali lavorano su una scala 0-255 (quella di
// getByteFrequencyData), il calibratore su 0-1. Questa converte.
export function sogliaInScala255(soglia01) {
  return Math.round(Math.max(0, Math.min(1, soglia01)) * 255);
}

export const COSTANTI_CALIBRAZIONE = { MISURE, MARGINE, MINIMA, MASSIMA };

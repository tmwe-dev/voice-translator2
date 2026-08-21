// ═══════════════════════════════════════════════════════════════
// L'ACCIAIO — come si stacca dal fondo un'icona d'argento.
//
// b.363, secondo giro. Il primo tentativo aveva DUE cose: un alone caldo
// dietro l'icona (il "faro") e un'ombra nera sfumata. Luca le ha bocciate
// tutte e due: «il faro fa cagare eliminalo, e l'ombreggiatura non si
// vede». Aveva ragione su entrambe, e la seconda ha una spiegazione
// precisa che vale la pena scrivere qui perche non si ripeta:
//
//   IL FONDO DELL'APP E #05070f, cioe quasi nero. Un'ombra nera sfumata
//   appoggiata li sopra e NERO SU NERO: non c'e niente da vedere. Piu la
//   si sfuma e meno si vede, perche si spalma su un fondo che ha gia quel
//   colore. Era invisibile per forza, non per sbaglio.
//
// Quindi l'ombra non si butta sul fondo: si appoggia SUL METALLO. Un
// bordo scuro netto, senza sfumatura, spostato a sinistra e in basso:
// dove tocca l'argento si vede benissimo, perche li il contrasto e fra
// nero e metallo chiaro, non fra nero e nero. E' l'ombra che l'oggetto
// getta su se stesso — quella che nelle monete fa leggere il rilievo.
//
// Sotto, una seconda ombra piu larga e morbida: da sola non si vedrebbe,
// ma sotto la prima da il peso e impedisce che il bordo netto sembri un
// contorno disegnato.
//
// Un posto solo: se la luce va cambiata, si cambia qui e cambia
// dappertutto — menu in alto, menu in basso, home.
// ═══════════════════════════════════════════════════════════════

/**
 * L'ombra dell'acciaio: netta sul metallo, morbida sul fondo, sempre a
 * sinistra e in basso. `scala` segue la misura dell'icona — un'icona
 * grande vuole uno stacco piu lungo, altrimenti sparisce sotto la sagoma.
 */
export function ombraAcciaio(scala = 1) {
  const r = (n) => Math.round(n * 10) / 10;   // niente code decimali nel foglio di stile
  return [
    // 1. lo stacco NETTO, senza sfumatura: e questo che si vede, perche
    //    cade sull'argento e non sul fondo nero.
    `drop-shadow(${r(-2 * scala)}px ${r(2.5 * scala)}px 0 rgba(0,0,0,0.92))`,
    // 2. il peso: larga e morbida, tiene insieme il resto.
    `drop-shadow(${r(-5 * scala)}px ${r(6 * scala)}px ${r(7 * scala)}px rgba(0,0,0,0.7))`,
    // 3. il metallo un filo piu inciso, cosi lo stacco non sembra un
    //    contorno appiccicato ma un rilievo.
    'contrast(1.08)',
    'brightness(1.03)',
  ].join(' ');
}

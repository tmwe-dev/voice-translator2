// ═══════════════════════════════════════════════════════════════
// IL RIGHELLO — le misure comuni di tutto quello che galleggia sopra
// una pagina: linguette sui bordi, pila del credito, comando del cielo.
//
// b.363, ordine di Luca: «niente e allineato, niente rispetta uno
// standard, hai fatto due linguette diverse con icone di diversa
// dimensione, una staccata e l'altra no».
//
// Aveva ragione, e il motivo e che ho aggiunto quei pezzi uno alla volta,
// ognuno con i suoi numeri scritti a mano dove serviva in quel momento.
// Due linguette sullo stesso bordo con due larghezze, due distanze e due
// forme diverse; la pila e la luna a destra su due colonne diverse.
//
// Da qui in avanti le misure stanno in UN posto solo. Chi galleggia le
// prende da qui, e se una va cambiata si cambia una riga e si muovono
// tutti insieme.
// ═══════════════════════════════════════════════════════════════

/** Il margine di respiro dai bordi dello schermo, uguale per tutti. */
export const MARGINE = 14;

/**
 * LE LINGUETTE sul bordo sinistro. Sono attaccate al bordo — e cosi che
 * si capisce da che parte si aprono — e hanno tutte la stessa misura e
 * la stessa forma: spigoli vivi verso il bordo, arrotondati verso dentro.
 */
export const LINGUETTA = {
  larghezza: 46,
  altezza: 58,
  raggio: '0 16px 16px 0',
  icona: 22,
};

/**
 * LA COLONNA DI DESTRA: pila del credito e comando del cielo stanno
 * incolonnati, stesso centro, stessa distanza dal bordo. Prima erano a
 * dieci e a quattordici, e si vedeva.
 */
export const COLONNA_DESTRA = {
  bordo: MARGINE,
  larghezza: 44,          // la colonna: tutto dentro si centra qui
  primo: 'max(14px, calc(env(safe-area-inset-top) + 8px))',
  passo: 62,              // quanto scende ogni elemento sotto il precedente
};

/** Il posto di un elemento nella colonna di destra (0 = il piu in alto). */
export function postoADestra(indice = 0) {
  return {
    position: 'fixed',
    right: COLONNA_DESTRA.bordo,
    top: `calc(${COLONNA_DESTRA.primo} + ${indice * COLONNA_DESTRA.passo}px)`,
    width: COLONNA_DESTRA.larghezza,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/** La forma di una linguetta sul bordo sinistro, alla quota indicata. */
export function formaLinguetta(C, posizione) {
  return {
    position: 'fixed',
    left: 0,
    ...posizione,
    width: LINGUETTA.larghezza,
    height: LINGUETTA.altezza,
    padding: 0,
    cursor: 'pointer',
    background: C.card || 'rgba(14,18,32,0.85)',
    border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.10)'}`,
    borderLeft: 'none',
    borderRadius: LINGUETTA.raggio,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '3px 3px 14px rgba(0,0,0,0.4)',
    WebkitTapHighlightColor: 'transparent',
  };
}

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
 * b.370 — LA COLONNA DEI CONTENUTI. Una misura sola per TUTTE le liste
 * del sistema (ordine di Luca: «tutte le card devono rimanere piu
 * strette, per non coprire mai la linguetta a sinistra, centrata.
 * applica a tutto il sistema»).
 *
 * IL CONTO NON E' A OCCHIO. La linguetta sta appoggiata al bordo
 * sinistro ed e larga LINGUETTA.larghezza; il MARGINE e il respiro che
 * le serve intorno. Una card che arrivi anche solo un pixel piu a
 * sinistra di quel punto le finisce sopra — e quando ci finisce sopra
 * non e piu una maniglia, e un pezzo di sporco.
 *
 * E dev'essere CENTRATA, non spostata a destra: una colonna spinta di
 * lato per far posto a qualcosa si vede che e stata spinta. Una
 * colonna stretta e in mezzo sembra una scelta.
 *
 * Il conto: al massimo LARGA pixel, ma mai piu di quanto ci sta
 * lasciando SPAZIO_LINGUETTA libero DA TUTTI E DUE i lati — che e
 * esattamente cio che tiene la colonna in mezzo.
 */
export const SPAZIO_LINGUETTA = LINGUETTA.larghezza + MARGINE + 6;   // 66
export const LARGA = 440;

export const COLONNA = {
  width: '100%',
  maxWidth: `min(${LARGA}px, calc(100vw - ${SPAZIO_LINGUETTA * 2}px))`,
  marginLeft: 'auto',
  marginRight: 'auto',
};

/**
 * b.370 — LA FILA IN ALTO A DESTRA: pila del credito e comando del
 * cielo stanno UNO ACCANTO ALL'ALTRO, non uno sotto l'altro.
 *
 * Ordine di Luca, ripetuto: «la luna deve stare di fianco a sinistra
 * della pila, non sotto». Era gia stato chiesto e non l'avevo fatto:
 * erano incolonnati, e una luna appesa sotto la batteria sembra caduta
 * li, non messa.
 *
 * Stesso bordo alto per tutti, e ognuno si sposta A SINISTRA del
 * precedente di un passo. L'indice 0 e il piu a destra.
 */
export const COLONNA_DESTRA = {
  bordo: MARGINE,
  larghezza: 44,          // la casella: tutto dentro si centra qui
  primo: 'max(14px, calc(env(safe-area-inset-top) + 8px))',
  passo: 52,              // quanto si sposta a SINISTRA ogni elemento
};

/** Il posto di un elemento nella fila in alto a destra (0 = il piu a destra). */
export function postoADestra(indice = 0) {
  return {
    position: 'fixed',
    right: `calc(${COLONNA_DESTRA.bordo}px + ${indice * COLONNA_DESTRA.passo}px)`,
    top: COLONNA_DESTRA.primo,
    width: COLONNA_DESTRA.larghezza,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  };
}


// ═══ INIZIO b.400 — LA COLONNA DI SINISTRA (collaudo di Luca: «le
// linguette si sovrappongono e vanno disposte con un po' di margine»).
// Erano vere: la linguetta dei comandi stava a 132 ed e alta 58 (finisce
// a 190), quella della lingua partiva a 168 — ventidue pixel dentro
// l'altra. La quota della seconda era calcolata per allinearsi al
// microfono della Home, che in Mondo non c'e: cosi in Mondo le due si
// accavallavano. Ora la fila la decide il righello, come gia a destra:
// una quota di partenza, un passo, e nessuno sceglie piu numeri suoi.
export const COLONNA_SINISTRA = {
  primo: 'max(132px, calc(env(safe-area-inset-top) + 124px))',
  passo: LINGUETTA.altezza + 12,   // 58 di linguetta + 12 di respiro
};

/** La quota di una linguetta nella fila a sinistra (0 = la piu in alto). */
export function postoASinistra(indice = 0) {
  return indice === 0
    ? { top: COLONNA_SINISTRA.primo }
    : { top: `calc(${COLONNA_SINISTRA.primo} + ${indice * COLONNA_SINISTRA.passo}px)` };
}

/**
 * Quanto spazio si deve tenere libero a destra perche `quanti` elementi
 * fissi non finiscano sotto a cio che sta in testata. Serve alla testata
 * di Mondo, dove il selettore del Paese arrivava fin sotto la luna.
 */
export function riservaADestra(quanti = 1) {
  return COLONNA_DESTRA.bordo + (quanti - 1) * COLONNA_DESTRA.passo + COLONNA_DESTRA.larghezza + 8;
}
// ═══ FINE b.400 ═══

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

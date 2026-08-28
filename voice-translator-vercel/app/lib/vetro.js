// ═══════════════════════════════════════════════════════════════
// IL VETRO — una sola ricetta per tutti i badge e i tasti (b.552)
//
// Ordine di Luca, con la fotografia del feed sotto gli occhi: «tutti i
// badge e pulsanti devono essere semi trasparenti con tonalita brown o
// blu e superficie vetrata».
//
// In b.551 avevo fatto il contrario — fondi pieni e opachi — per non far
// pagare al telefono una sfocatura ripetuta a ogni diapositiva. Il suo
// occhio ha ragione e la mia paura era mal riposta: nel feed si vedono
// una o due diapositive per volta, non trenta righe di elenco, e la
// sfocatura resta leggera (12 punti) proprio perche' non si senta
// mentre si scorre.
//
// Sta QUI e non dentro un componente perche' la ricetta e' una sola: il
// giorno che Luca dira «piu scuro», si cambia in un posto e cambia
// ovunque — invece di rincorrere venti file e lasciarne indietro tre.
// ═══════════════════════════════════════════════════════════════

/** Vetro a riposo: blu notte, mezzo trasparente. */
export const VETRO = {
  background: 'rgba(26,40,74,0.42)',
  border: '1px solid rgba(150,178,255,0.26)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

/** Vetro ACCESO (la scelta fatta): piu blu, non piu opaco. */
export const VETRO_ACCESO = {
  background: 'rgba(74,110,220,0.46)',
  border: '1px solid rgba(170,196,255,0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

/** Vetro CALDO — il «brown» di Luca: il cuore quando l'hai messo tu. */
export const VETRO_CUORE = {
  background: 'rgba(122,58,44,0.52)',
  border: '1px solid rgba(255,150,120,0.5)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

/** Vetro per una fascia larga (non una targa): senza spigoli ai lati. */
export const VETRO_FASCIA = {
  ...VETRO,
  border: 'none',
  borderBottom: '1px solid rgba(150,178,255,0.18)',
};

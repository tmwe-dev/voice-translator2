// ═══════════════════════════════════════════════════════════════
// TELECOMANDO AUDIO DI LIFE — un posto solo per governare la voce.
//
// Chiesto da Luca: in ogni chat/lezione deve poter mettere in PAUSA,
// RIPRENDERE o INTERROMPERE l'audio, e trovare un tasto anche quando
// naviga altre schede. Ogni sezione (lezione, podcast, ...) quando fa
// suonare qualcosa lo REGISTRA qui; un pulsante fluttuante unico legge
// questo stato e comanda.
// ═══════════════════════════════════════════════════════════════

let corrente = null;          // l'HTMLAudioElement che sta suonando ora
let etichetta = '';           // cosa sta suonando (per il pulsante)
const ascoltatori = new Set();

function avvisa() { for (const fn of ascoltatori) { try { fn(stato()); } catch { /* un ascoltatore rotto non ferma gli altri */ } } }

/** Registra l'audio che parte adesso. Ferma il precedente (una voce alla volta). */
export function suona(audioEl, nome = '') {
  if (!audioEl) return;
  if (corrente && corrente !== audioEl) { try { corrente.pause(); } catch { /* l'audio era gia in pausa o concluso: nulla da fare */ } }
  corrente = audioEl;
  etichetta = nome || '';
  const suEventi = () => avvisa();
  audioEl.addEventListener('play', suEventi);
  audioEl.addEventListener('pause', suEventi);
  audioEl.addEventListener('ended', () => { if (corrente === audioEl) { corrente = null; etichetta = ''; } avvisa(); });
  avvisa();
}

export function pausa() { try { corrente?.pause(); } catch { /* non c'e audio in corso da mettere in pausa */ } }
export function riprendi() { try { corrente?.play?.(); } catch { /* non c'e audio in pausa da riprendere */ } }
export function ferma() {
  try { if (corrente) { corrente.pause(); corrente.currentTime = 0; } } catch { /* l'audio era gia in pausa o concluso: nulla da fare */ }
  corrente = null; etichetta = '';
  avvisa();
}

export function stato() {
  return {
    attivo: !!corrente,
    inPausa: !!corrente && corrente.paused,
    etichetta,
  };
}

/** Il pulsante si iscrive: viene richiamato a ogni cambio. Ritorna la disiscrizione. */
export function ascolta(fn) { ascoltatori.add(fn); fn(stato()); return () => ascoltatori.delete(fn); }

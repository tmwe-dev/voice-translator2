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
// b.363 — chi genera i turni (podcast, lezione) si iscrive qui: lo Stop
// del telecomando deve fermare anche la FABBRICA, non solo la voce che
// sta suonando. Prima il ciclo proseguiva a generare (e a spendere) e la
// voce ripartiva da sola col turno successivo.
const interrompibili = new Set();

/** Registra un ciclo da fermare quando si preme Interrompi. Restituisce come disiscriversi. */
export function suInterruzione(fn) {
  interrompibili.add(fn);
  return () => interrompibili.delete(fn);
}

// b.363 — un audio FERMATO va marchiato: chi lo sta suonando deve poter
// distinguere una pausa (si riprende) da un'interruzione (si chiude e si
// libera la memoria). Senza questo segno, la pausa veniva scambiata per
// una fine e il turno saltava avanti senza poter tornare indietro.
function marcaFermato(el) { try { el.dataset.fermato = '1'; } catch { /* non e un elemento del documento: il segno non serve */ } }

/** Il segno lasciato da chi ha interrotto davvero (non da chi ha messo in pausa). */
export function fermatoDavvero(el) { return el?.dataset?.fermato === '1'; }

/** Interrompe un audio che non passa dal telecomando (lezione, ripasso). */
export function fermaElemento(el) {
  if (!el) return;
  marcaFermato(el);
  try { el.pause(); } catch { /* era gia fermo: nulla da interrompere */ }
}

function avvisa() { for (const fn of ascoltatori) { try { fn(stato()); } catch { /* un ascoltatore rotto non ferma gli altri */ } } }

/** Registra l'audio che parte adesso. Ferma il precedente (una voce alla volta). */
export function suona(audioEl, nome = '') {
  if (!audioEl) return;
  if (corrente && corrente !== audioEl) { marcaFermato(corrente); try { corrente.pause(); } catch { /* l'audio era gia in pausa o concluso: nulla da fare */ } }
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
  for (const fn of interrompibili) { try { fn(); } catch { /* un ciclo rotto non impedisce di fermare gli altri */ } }
  try { if (corrente) { marcaFermato(corrente); corrente.pause(); corrente.currentTime = 0; } } catch { /* l'audio era gia in pausa o concluso: nulla da fare */ }
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

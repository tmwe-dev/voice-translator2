// ═══════════════════════════════════════════════════════════════
// LA VOCE — un posto solo per governare tutto cio che suona.
//
// Chiesto da Luca: in ogni chat/lezione deve poter mettere in PAUSA,
// RIPRENDERE o INTERROMPERE l'audio, e trovare un tasto anche quando
// naviga altre schede. Chi fa suonare qualcosa lo REGISTRA qui; un
// telecomando unico legge questo stato e comanda.
//
// b.404 — PRIMA VALEVA SOLO PER LIFE, e si chiamava audioLife. Il
// censimento di tutta la piattaforma ha trovato SEDICI punti che fanno
// suonare e QUATTRO che passavano di qui. Gli altri dodici — la stanza,
// il taxi, l'archivio, la prova voce e i cinque hook della voce —
// suonavano per conto loro. Due conseguenze, tutte e due viste dal
// vivo: lo Stop del telecomando non li fermava, e due voci potevano
// partire insieme senza sapere l'una dell'altra.
//
// Da qui in avanti chi suona passa da `suona()`. Non e una regola di
// stile: e l'unico modo perche esista un solo Stop.
// ═══════════════════════════════════════════════════════════════

let corrente = null;          // l'HTMLAudioElement che sta suonando ora
let etichetta = '';           // cosa sta suonando (per il pulsante)
const ascoltatori = new Set();
// b.363 — chi genera i turni (podcast, lezione) si iscrive qui: lo Stop
// del telecomando deve fermare anche la FABBRICA, non solo la voce che
// sta suonando. Prima il ciclo proseguiva a generare (e a spendere) e la
// voce ripartiva da sola col turno successivo.
const interrompibili = new Set();

// b.394 — DUE COSE DIVERSE CHE ERANO DIVENTATE UNA SOLA.
//
// Collaudo di Luca: «la pillola dell'audio copre i comandi di Vita». Ed
// era vero, ma non per il motivo che sembrava. In b.376 il telecomando
// aveva smesso di sparire fra una battuta e l'altra guardando CHI SI ERA
// ISCRITTO allo Stop. Sensato — solo che le schede si iscrivono quando
// si APRONO, non quando cominciano a parlare. Risultato: appena si
// apriva Podcast, Tavola rotonda o Impara la pillola era gia li, con il
// silenzio totale, e restava a coprire i comandi per tutto il tempo.
//
// Provato importando questo file e simulando la sola apertura di una
// scheda: lo stato passava da spento ad acceso senza che suonasse nulla.
//
// Adesso sono due cose separate: l'iscrizione allo Stop (chi va fermato)
// resta com'era, e accanto c'e il conto dei giri DAVVERO in corso (chi
// sta parlando o sta preparando la battuta dopo). La pillola guarda il
// secondo. In silenzio non c'e, e non copre niente per definizione.
let cicliVivi = 0;

/** Registra un ciclo da fermare quando si preme Interrompi. Restituisce come disiscriversi. */
export function suInterruzione(fn) {
  interrompibili.add(fn);
  return () => { interrompibili.delete(fn); };
}

/**
 * Dichiara che un giro di voce COMINCIA ORA. Va chiuso sempre, anche
 * quando finisce male: la chiusura si mette nel `finally` di chi lo apre.
 */
export function apriCiclo() {
  cicliVivi += 1;
  avvisa();
  let chiuso = false;
  return () => {
    if (chiuso) return;           // chiudere due volte non deve contare due volte
    chiuso = true;
    cicliVivi = Math.max(0, cicliVivi - 1);
    avvisa();
  };
}

// b.363 — un audio FERMATO va marchiato: chi lo sta suonando deve poter
// distinguere una pausa (si riprende) da un'interruzione (si chiude e si
// libera la memoria). Senza questo segno, la pausa veniva scambiata per
// una fine e il turno saltava avanti senza poter tornare indietro.
function marcaFermato(el) { try { el.dataset.fermato = '1'; } catch { /* non e un elemento del documento: il segno non serve */ } }

/**
 * INTERROMPE SUL SERIO, anche se era gia in pausa (b.405).
 *
 * Difetto trovato dalla prova di comportamento del Batch B, e non era
 * nell'audit: chi aspetta la fine di un turno (`parlaTurno`) si sveglia
 * sull'evento `pause`, e guarda il segno per capire se era una pausa o
 * un'interruzione. Ma `pause()` su un audio GIA in pausa non emette
 * niente. Quindi la sequenza «metto in pausa dal telecomando, poi premo
 * Interrompi» marchiava l'audio e non svegliava nessuno: la promessa del
 * turno restava pendente per sempre, il ciclo non si chiudeva, e la
 * pillola restava accesa sul silenzio finche non si cambiava pagina.
 *
 * Il segno da solo non basta: bisogna anche bussare.
 */
function interrompi(el) {
  if (!el) return;
  marcaFermato(el);
  const eraGiaFermo = !!el.paused;
  try { el.pause(); } catch { /* era gia fermo: nulla da interrompere */ }
  if (!eraGiaFermo) return;               // il `pause()` ha gia avvisato tutti
  try { el.dispatchEvent(new Event('pause')); return; } catch { /* non e un elemento vero: si bussa a mano */ }
  try { el.onpause?.(); } catch { /* nessuno in ascolto: nulla da svegliare */ }
}

/** Il segno lasciato da chi ha interrotto davvero (non da chi ha messo in pausa). */
export function fermatoDavvero(el) { return el?.dataset?.fermato === '1'; }

/** Interrompe un audio che non passa dal telecomando (lezione, ripasso). */
export function fermaElemento(el) { interrompi(el); }

function avvisa() { for (const fn of ascoltatori) { try { fn(stato()); } catch { /* un ascoltatore rotto non ferma gli altri */ } } }

/** Registra l'audio che parte adesso. Ferma il precedente (una voce alla volta). */
export function suona(audioEl, nome = '') {
  if (!audioEl) return;
  // b.405 — REGISTRARE DUE VOLTE LO STESSO AUDIO NON DEVE COSTARE NULLA.
  // Da quando registra `parlaTurno` (vedi cliente.js), un chiamante che
  // registrava gia per conto suo passerebbe di qui due volte per lo stesso
  // elemento: senza questa uscita si accumulerebbero ascoltatori doppi su
  // play/pause e ogni evento avviserebbe il telecomando due volte.
  if (corrente === audioEl) { etichetta = nome || etichetta; avvisa(); return; }
  if (corrente) interrompi(corrente);   // b.405 — e se era gia in pausa, lo si sveglia lo stesso
  corrente = audioEl;
  etichetta = nome || '';
  const suEventi = () => avvisa();
  audioEl.addEventListener('play', suEventi);
  audioEl.addEventListener('pause', suEventi);
  // b.376 — L'ETICHETTA NON SI CANCELLA QUANDO LA VOCE FINISCE. Serve a
  // tenere scritto CHI ha parlato per ultimo mentre si prepara la voce
  // dopo: se no il telecomando resterebbe li muto e anonimo.
  audioEl.addEventListener('ended', () => { if (corrente === audioEl) corrente = null; avvisa(); });
  avvisa();
}

export function pausa() { try { corrente?.pause(); } catch { /* non c'e audio in corso da mettere in pausa */ } }
export function riprendi() { try { corrente?.play?.(); } catch { /* non c'e audio in pausa da riprendere */ } }
export function ferma() {
  for (const fn of interrompibili) { try { fn(); } catch { /* un ciclo rotto non impedisce di fermare gli altri */ } }
  try { if (corrente) { interrompi(corrente); corrente.currentTime = 0; } } catch { /* l'audio era gia in pausa o concluso: nulla da fare */ }
  corrente = null; etichetta = '';
  // Interrompi chiude anche i giri: chi li ha aperti ha gia ricevuto il
  // segnale qui sopra e uscira dal proprio ciclo, ma la pillola deve
  // spegnersi subito, non al giro dopo.
  cicliVivi = 0;
  avvisa();
}

/**
 * FA SILENZIO, E ASPETTA CHE SIA VERO (b.405).
 *
 * Serve prima di aprire un microfono. `pausa()` da sola non basta per due
 * motivi visti dal vivo nel Pannello Pronuncia: non dice QUANDO la voce ha
 * smesso davvero, e chi la chiamava apriva il microfono nella stessa riga —
 * cosi il registratore poteva prendere la coda della voce di riferimento e
 * Whisper trascriveva il modello insieme allo studente, falsando il voto.
 *
 * E una PAUSA, non un'interruzione: l'audio non viene marchiato come fermato,
 * quindi il turno di chi parlava non salta e si puo riprendere.
 *
 * Il limite, dichiarato: questo zittisce cio che STA suonando. Una voce la
 * cui richiesta e ancora in volo partira lo stesso — ma quando parte passa da
 * `suona()`, che mette in pausa quella precedente, e il microfono e gia
 * aperto: e un caso diverso, da chiudere col gate del ciclo, non qui.
 */
export function zittisci() {
  const el = corrente;
  if (!el) return Promise.resolve();
  try { el.pause(); } catch { return Promise.resolve(); }
  if (el.paused) { avvisa(); return Promise.resolve(); }
  return new Promise((risolvi) => {
    let fatto = false;
    const chiudi = () => {
      if (fatto) return;
      fatto = true;
      clearTimeout(scadenza);
      try { el.removeEventListener('pause', chiudi); } catch { /* elemento gia sparito: nulla da togliere */ }
      avvisa();
      risolvi();
    };
    el.addEventListener('pause', chiudi);
    // nessuno resta appeso: se l'evento non arriva si prosegue comunque.
    const scadenza = setTimeout(chiudi, 300);
  });
}

export function stato() {
  // b.376 — IL TELECOMANDO NON SPARISCE PIU FRA UNA VOCE E L'ALTRA.
  //
  // Collaudo di Luca: «il player appare e scompare continuamente quando
  // si alternano le voci». Succedeva perche era acceso dall'AUDIO CHE
  // SUONA, e in una lezione a due voci fra una battuta e l'altra c'e il
  // tempo di GENERARE la successiva — secondi, non millisecondi. Quindi
  // spariva e tornava a ogni turno.
  //
  // Luca ha proposto due telecomandi, uno per maestro. La risposta e no,
  // e per un motivo che vale la pena scrivere: due comandi per la stessa
  // cosa si contendono lo stesso posto, e quando parla il primo il
  // secondo che fa? Il difetto non e che sono pochi, e che quello che
  // c'e si SMONTA. Uno solo, che resta fermo e dice chi sta parlando.
  //
  // E non e una stima a occhio: chi genera i turni si iscrive gia qui
  // (quello serviva allo Stop). Se c'e un ciclo iscritto, qualcosa STA
  // per parlare — quindi il telecomando deve restare.
  // b.394 — si contano i giri in corso, non gli iscritti allo Stop.
  const cicloVivo = cicliVivi > 0;
  return {
    attivo: !!corrente || cicloVivo,
    inPausa: !!corrente && corrente.paused,
    // niente voce ma il ciclo c'e: si sta preparando la battuta dopo.
    preparando: !corrente && cicloVivo,
    etichetta,
  };
}

/** Il pulsante si iscrive: viene richiamato a ogni cambio. Ritorna la disiscrizione. */
export function ascolta(fn) { ascoltatori.add(fn); fn(stato()); return () => ascoltatori.delete(fn); }

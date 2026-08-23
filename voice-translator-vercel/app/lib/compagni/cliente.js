// ═══════════════════════════════════════════════════════════════
// COMPAGNI — cliente (Luca)
//
// Piccoli aiutanti lato client per l'area Life: chiamano le rotte
// (/api/compagni/*) e riproducono la voce con /api/tts-elevenlabs, come
// già fa il resto dell'app (new Audio). Nessuna logica di business qui:
// solo il ponte HTTP fra la UI e il backend già costruito e testato.
// ═══════════════════════════════════════════════════════════════

import { segmentiPerVoce } from './corsi/lingua.js';
import { fermatoDavvero, suona } from '../voce.js';
import { segnalaSessioneCaduta } from '../sessioneCaduta.js';
import { cercaTopics } from '../topics/cliente.js';

async function postJSON(url, corpo) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  let dati = null;
  try { dati = await r.json(); } catch { /* risposta senza corpo JSON leggibile */ }
  if (!r.ok) {
    const err = new Error((dati && dati.error) || 'errore');
    err.status = r.status;
    err.creditoEsaurito = !!(dati && dati.creditoEsaurito);
    // b.358 — il MOTIVO tecnico arrivava dal server e veniva buttato qui:
    // in superficie restava solo "Qualcosa e andato storto". Ora viaggia.
    err.motivo = (dati && dati.motivo) || '';
    // b.387 — un 401 non e un errore come gli altri: vuol dire che da
    // adesso NIENTE funzionera piu, finche non si rientra. Si tira
    // l'interruttore una volta sola, e chi disegna lo dice in un posto
    // fisso invece di far comparire "Qualcosa e andato storto" in ogni
    // angolo diverso dell'app.
    if (r.status === 401) segnalaSessioneCaduta();
    throw err;
  }
  return dati;
}


/**
 * b.244 — UN TURNO del podcast. Il client li incatena: cosi nessuna richiesta
 * puo scadere, e il numero di round non e piu limitato dal timeout.
 * Ritorna { turno } oppure { fine:true } quando il podcast e finito.
 */
export function generaTurnoPodcast({ argomento, compagni, round, lingua, userToken, indice, precedenti }) {
  return postJSON('/api/compagni/podcast', { azione: 'turno', argomento, compagni, round, lingua, userToken, indice, precedenti });
}

/** Costruisce un Compagno completo da una descrizione/nome (o a sorpresa). */
export async function generaAgente({ descrizione, sorpresa, lingua, userToken }) {
  const d = await postJSON('/api/compagni/genera', { descrizione, sorpresa: !!sorpresa, lingua, userToken });
  return d.agente;
}

/** b.221 — genera l'IMMAGINE dell'avatar (gpt-image-1). Ritorna un data URL. */
export async function generaAvatar({ nome, ruolo, genere, descrizione, riferimentoDataUrl, userToken }) {
  const d = await postJSON('/api/compagni/avatar', { nome, ruolo, genere, descrizione, riferimentoDataUrl, userToken });
  return d.dataUrl;
}

/** b.229 — genera l'ILLUSTRAZIONE di una lezione (stessa rotta, tipo:'lezione'). */
export async function generaIllustrazione({ titolo, argomento, livello, userToken }) {
  const d = await postJSON('/api/compagni/avatar', { tipo: 'lezione', nome: titolo, descrizione: argomento, livello, userToken });
  // b.350 — dal cassetto condiviso arriva un URL: stessa immagine per tutti.
  return d.url || d.dataUrl;
}

// b.348 — LA TAVOLA DEL LIBRO (corsi di lingua): la scena dichiarata dalla
// lezione diventa un disegno coerente col livello, con dentro gli oggetti
// che si imparano a nominare. E l'ICONA che accompagna il corso.
export async function generaTavola({ titolo, argomento, livello, ambienteId, elementi = [], userToken }) {
  const d = await postJSON('/api/compagni/avatar', { tipo: 'scena', nome: titolo, descrizione: argomento, livello, ambienteId, elementi, userToken });
  return d.url || d.dataUrl;
}

// b.363 — qui c'era generaIconaCorso, che chiedeva al server un'icona
// disegnata per il corso. Nessuna schermata la chiamava: l'icona del
// corso arriva gia dal catalogo. Era una spesa (una chiamata al
// generatore di immagini) che nessuno faceva partire.

// b.299 — l'arricchimento della lezione dalla COMMUNITY (il seminatore,
// "Cobra"): link di approfondimento, video, o foto reali. Non e un
// secondo sistema: sono le stesse rotte /api/topics gia collaudate in
// Mondo, chiamate qui con la query fatta di argomento + titolo lezione.
export async function arricchisciLezione({ modalita, titolo, argomento, lingua = 'it' }) {
  const q = `${argomento} ${titolo || ''}`.trim().slice(0, 120);
  try {
    if (modalita === 'video') {
      const r = await fetch(`/api/topics/video?q=${encodeURIComponent(q)}&lang=${lingua}`);
      if (!r.ok) return null;
      const d = await r.json();
      return { modalita, video: (d.video || d.risultati || []).slice(0, 3) };
    }
    if (modalita === 'link' || modalita === 'foto') {
      // b.409 — QUI NON HA MAI FUNZIONATO NIENTE, e in silenzio.
      //
      // C'era `await r.json()` su una rotta che risponde A RIGHE (una
      // per stadio: cerco, ho tre fonti, fine). Un corpo di piu righe
      // non e JSON valido: la lettura lanciava, il catch qui sotto
      // restituiva null, e in Impara i contenuti «link» e «foto» non
      // producevano MAI un risultato. Non ogni tanto: mai, da sempre.
      //
      // Ora si passa dal lettore comune, lo stesso che usa Mondo.
      const fine = await cercaTopics({ q, lingua, cat: 'notizie', fonti: 4 });
      const fonti = (fine?.argomenti || []).slice(0, 4);
      return { modalita, link: fonti };
    }
  } catch { /* la community non risponde: la lezione resta senza arricchimento, non e un guasto */ }
  return null;
}

/** Genera l'elenco lezioni di un corso. */
export function generaSyllabus({ argomento, categoria, livello, docenteId, direzione, lingua, userToken, linguaStudiata, profilo }) {
  return postJSON('/api/compagni/corso', { azione: 'syllabus', argomento, categoria, livello, docenteId, direzione, lingua, linguaStudiata, profilo, userToken });
}

/** Genera il contenuto di una lezione. */
export function generaLezione({ argomento, categoria, livello, lezione, docenteId, lingua, userToken, materialeId, ripasso, linguaStudiata, profilo }) {
  // b.333 — con materialeId la lezione si fonda SOLO sul materiale dello studente (Compiti).
  return postJSON('/api/compagni/corso', { azione: 'lezione', argomento, categoria, livello, lezione, docenteId, lingua, linguaStudiata, profilo, userToken, materialeId, ripasso });
}

/** Genera il quiz di una lezione. b.231 — passa il contenuto reale. */
export function generaQuiz({ lezione, lingua, userToken, livello, contenuto, argomento }) {
  return postJSON('/api/compagni/corso', { azione: 'quiz', lezione, lingua, userToken, livello, contenuto, argomento });
}

/**
 * b.313 — ALZO LA MANO: durante la lezione lo studente interrompe e chiede.
 * Il Maestro risponde nel personaggio, ancorato alla sezione in corso.
 */
export async function chiediAlMaestro({ argomento, lezione, sezione, prossime, domanda, storia, modo, docenteId, livello, lingua, userToken }) {
  const d = await postJSON('/api/compagni/corso', { azione: 'domanda', argomento, lezione, sezione, prossime, domanda, storia, modo, docenteId, livello, lingua, userToken });
  return { risposta: d.risposta || '', salta: d.salta || 0 };
}

/**
 * b.242 — REGISTRA com'è andata una prova: è ciò che permette al Maestro di
 * ricordare. `daRivedere` sono le cose sbagliate (per il ripasso),
 * `osservazioni` cosa ha imparato su questa persona. Senza account non salva
 * nulla e non è un errore.
 */
export function registraEsito({ argomento, lezioneIndice, punteggio, daRivedere, osservazioni, userToken, tipo, linguaStudiata }) {
  return postJSON('/api/compagni/corso', {
    azione: 'esito', argomento, lezioneIndice, punteggio, daRivedere, osservazioni, userToken,
    // b.330 — un esito di PRONUNCIA alimenta anche il profilo persistente
    // (errori ricorrenti + trend) per i drill futuri.
    tipo, linguaStudiata,
  });
}



// ── b.327 · Ondata A — LA BIBLIOTECA DEI MIEI CORSI ──
/** Salva il corso appena generato (syllabus stabile). Fallisce in silenzio. */
export function salvaCorsoMio({ argomento, titolo, categoria, livello, lingua, linguaStudiata, lezioni, docenteId, obiettivoId, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'salvaCorsoMio', argomento, titolo, categoria, livello, lingua, linguaStudiata, lezioni, docenteId, obiettivoId, userToken });
}
/** I miei corsi, con progresso unito (superate/viste/saltate/percento/esiti). */
export async function mieiCorsiUtente(userToken) {
  const d = await postJSON('/api/compagni/corso', { azione: 'mieiCorsi', userToken });
  return d.corsi || [];
}
/** Segnalibro: l'ultima lezione aperta di un corso. */
export function segnaLibroCorso({ argomento, indice, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'segnalibro', argomento, indice, userToken });
}
/** b.335 — I 5 ASSI della conversazione libera (dagli scritti in L2). */
export async function valutaCinqueAssi({ turni, linguaStudiata, lingua, userToken }) {
  const d = await postJSON('/api/compagni/corso', { azione: 'cinqueAssi', turni, linguaStudiata, lingua, userToken });
  return d.assi || null;
}

/** b.331 — DRILL coppie minime per una parola andata male. */
export async function drillPronuncia({ parola, linguaStudiata, lingua, userToken }) {
  const d = await postJSON('/api/compagni/corso', { azione: 'drill', parola, linguaStudiata, lingua, userToken });
  return { suono: d.suono || '', coppie: d.coppie || [] };
}

/** Il progresso di UN corso (per le spunte in lista). */
export async function progressoCorso({ argomento, userToken }) {
  const d = await postJSON('/api/compagni/corso', { azione: 'progresso', argomento, userToken });
  return d.progresso || [];
}
/** Profilo studente (Learner Profile + preferenze esperienza). */
export async function profiloStudente(userToken) {
  const d = await postJSON('/api/compagni/corso', { azione: 'profiloStudente', userToken });
  return d.dati || null;
}
export function salvaProfiloStudente({ profilo, comunicazione, preferenze, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'salvaProfiloStudente', profilo, comunicazione, preferenze, userToken });
}

/** b.228 — libreria condivisa: elenco corsi disponibili (sfoglia). */
export async function corsiDisponibili({ soloBambini, linguaFiltro, categoriaFiltro } = {}) {
  const d = await postJSON('/api/compagni/corso', { azione: 'disponibili', soloBambini, linguaFiltro, categoriaFiltro });
  return d.corsi || [];
}

/** b.228 — pubblica un corso nella libreria (richiede account). */
export async function pubblicaCorso({ titolo, argomento, categoria, livello, lingua, lezioni, docenteId, userToken }) {
  const d = await postJSON('/api/compagni/corso', { azione: 'pubblica', titolo, argomento, categoria, livello, lingua, lezioni, docenteId, userToken });
  return d.corso;
}

// ── I miei Compagni (creazione/gestione) ──
export async function elencoMiei(userToken) {
  const d = await postJSON('/api/compagni/mie', { azione: 'elenco', userToken });
  return d.compagni || [];
}
export function salvaMio(compagno, userToken) {
  return postJSON('/api/compagni/mie', { azione: 'salva', compagno, userToken });
}
export function cancellaMio(id, userToken) {
  return postJSON('/api/compagni/mie', { azione: 'cancella', id, userToken });
}
/**
 * b.411 · P1.17 — «Dimentica»: cancella i ricordi che un Compagno ha di
 * te, lasciando il Compagno. Vale anche per quelli del catalogo, che non
 * si possono cancellare ma possono ricordare.
 */
export function dimenticaMio(id, userToken) {
  return postJSON('/api/compagni/mie', { azione: 'dimentica', id, userToken });
}

/** Parla con un Compagno (Amico/Coach). Ritorna { risposta, voceId, memoria }.
 *  b.224 — `obiettivi` (attivi, dal dispositivo) rende il Compagno consapevole
 *  degli obiettivi di vita della persona. */
export function parlaAmico({ compagnoId, messaggi, lingua, userToken, obiettivi, superficie }) {
  // b.244-bis — `totale` e la lunghezza VERA della conversazione: la rotta
  // taglia i messaggi a 20 e senza questo il throttle della memoria si
  // rompeva dopo il ventesimo scambio (estraeva a ogni turno).
  return postJSON('/api/compagni/amico', { compagnoId, messaggi, lingua, userToken, obiettivi, superficie, totale: Array.isArray(messaggi) ? messaggi.length : 0 });
}

/** Tavolo/Debate: tu + più Compagni verso un obiettivo comune.
 *  Ritorna { risposte: [{compagnoId,nome,voceId,testo}] }. */
export function parlaTavolo({ compagni, messaggi, lingua, userToken, obiettivi, obiettivo, briefing }) {
  return postJSON('/api/compagni/tavolo', { compagni, messaggi, lingua, userToken, obiettivi, obiettivo, briefing });
}

/** Sintesi del Debate: la conclusione condivisa verso l'obiettivo. */
export async function sintesiTavolo({ compagni, messaggi, lingua, userToken, obiettivo }) {
  const d = await postJSON('/api/compagni/tavolo', { azione: 'sintesi', compagni, messaggi, lingua, userToken, obiettivo });
  return d.sintesi;
}

// ── Dossier: argomento → articolo → (discussione) → report ──
export function preparaBriefing({ argomento, lingua, userToken }) {
  return postJSON('/api/compagni/dossier', { azione: 'briefing', argomento, lingua, userToken });
}
export function reportFinale({ argomento, briefing, discussione, lingua, userToken }) {
  return postJSON('/api/compagni/dossier', { azione: 'report', argomento, briefing, discussione, lingua, userToken });
}

/**
 * Riproduce un turno con la voce ElevenLabs del Compagno. Ritorna una
 * Promise che si risolve quando l'audio è finito (o subito se il TTS non è
 * disponibile — la voce è un di più, non deve bloccare il podcast).
 * Passa l'elemento Audio a `onAudio` così il chiamante può fermarlo.
 */
/**
 * b.241 — VOCE DOPPIA per i corsi di lingua (ripreso da RadioChat).
 *
 * Il Maestro parla nella lingua della persona ma marca con [L2:...] ciò che
 * è nella lingua studiata. Qui il testo si spezza e ogni pezzo va alla sua
 * voce: la parte in italiano con la voce del Maestro, la frase inglese con
 * una voce MADRELINGUA (basta non passare `voceId`: la rotta sceglie da sé
 * la voce giusta per quella lingua).
 *
 * Senza tag [L2:] si comporta esattamente come parlaTurno — una chiamata sola.
 * I pezzi vicini nella stessa lingua sono già uniti da segmentiPerVoce, così
 * non si paga una chiamata per ogni parola.
 */
export async function parlaBilingue({ voceId, voceAssistente, testo, linguaParlata, linguaStudiata, userToken, modoVoce, onVoce, chi }, onAudio) {
  const pezzi = segmentiPerVoce(testo, { linguaParlata, linguaStudiata });
  // b.363 — CHI INTERROMPE DEVE FAR TACERE ANCHE IL PEZZO DOPO. Una frase con
  // parti in lingua straniera non si dice in un fiato: si dice in due, tre,
  // quattro turni di voce. Chi usciva dalla lezione (o premeva Interrompi)
  // zittiva soltanto il turno in corso, e un istante dopo partiva il
  // successivo: la voce continuava a parlare addosso a chi se n'era gia
  // andato, e il fornitore veniva pagato per una frase che nessuno voleva
  // piu sentire. Il segno lasciato da chi ha interrotto davvero (non da chi
  // ha messo in pausa) ora ferma anche questo giro.
  let ultimo = null;
  for (const p of pezzi) {
    const suaLingua = p.lingua === linguaStudiata;
    await parlaTurno({
      // b.342 — la voce effettiva del MAESTRO (non dell'assistente) risale
      // al chiamante, che la blocca per le risposte alle interruzioni.
      onVoce: suaLingua ? undefined : onVoce,
      // La lingua studiata NON usa la voce del Compagno: serve un madrelingua.
      // b.323 — il DUETTO: se c'e l'Assistente madrelingua (personaggio con
      // nome e volto), le parti L2 le dice LUI, sempre la stessa voce —
      // cosi lo studente riconosce chi parla. Senza, sceglie la rotta.
      voceId: suaLingua ? (voceAssistente || null) : voceId,
      testo: p.testo,
      lingua: p.lingua,
      userToken,
      chi,
      // Una citazione in lingua straniera si legge piana: è un modello di
      // pronuncia, non un'interpretazione.
      modoVoce: suaLingua ? 'neutro' : modoVoce,
    }, (a) => { ultimo = a; if (onAudio) onAudio(a); });
    if (fermatoDavvero(ultimo)) break;
  }
}

/**
 * b.405 — QUI PASSA OGNI VOCE DI LIFE, E DA QUI SI REGISTRA.
 *
 * L'audit di Luca ha trovato cinque punti che facevano parlare senza dirlo
 * al telecomando: la frase di riferimento della Pronuncia, la lettura,
 * il testo in lingua, il Compagno di sventura e la prova voce in Gestione
 * Compagni. Conseguenze reali: lo Stop non li fermava, potevano parlarsi
 * sopra, e — la peggiore — il microfono della Pronuncia poteva registrare
 * la voce modello perche `pausa()` non sapeva che stesse suonando.
 *
 * Correggerli uno per uno avrebbe lasciato l'architettura fragile: il sesto
 * punto che nasce domani sarebbe di nuovo fuori. Registra `parlaTurno`, che
 * e la strada obbligata di tutti: chi arriva dopo e dentro senza saperlo.
 * `chi` e il nome che il telecomando mostra; `onAudio` resta per chi deve
 * tenere il riferimento o cambiare la velocita.
 */
export async function parlaTurno({ voceId, testo, lingua, userToken, modoVoce, onVoce, chi }, onAudio) {
  try {
    const r = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // b.238 — `modoVoce` è l'intento dichiarato da chi parla (pensoso,
      // caldo, serio…): la voce smette di leggere tutto allo stesso modo.
      body: JSON.stringify({ text: testo, voiceId: voceId, langCode: lingua, userToken, speechMode: modoVoce }),
    });
    if (!r.ok) return; // niente voce: si legge soltanto
    // b.342 — la rotta dichiara la voce EFFETTIVA: chi chiama puo bloccarla
    // e ripassarla ai turni successivi (stessa voce per lettura e risposte).
    try { const v = r.headers.get('X-Voce'); if (v && onVoce) onVoce(v); } catch { /* solo un extra */ }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((risolvi) => {
      const audio = new Audio(url);
      // b.405 — prima di tutto il resto: il telecomando deve sapere che
      // questa voce esiste, e la precedente deve tacere.
      suona(audio, chi || '');
      if (onAudio) onAudio(audio);
      // b.232 — anche l'INTERRUZIONE (Stop del podcast) risolve la promise:
      // audio.pause() non emette onended/onerror e il ciclo di `vai` restava
      // appeso su questo await. `fatto` evita la doppia risoluzione.
      //
      // b.363 — ma una PAUSA non e un'interruzione. Prima ogni pausa chiudeva
      // il turno E liberava il file audio: chi metteva in pausa dal telecomando
      // di Life si ritrovava il turno saltato e il tasto Riprendi su un audio
      // che non esisteva piu. Ora si chiude solo su interruzione vera.
      let fatto = false;
      const chiudi = () => { if (fatto) return; fatto = true; URL.revokeObjectURL(url); risolvi(); };
      audio.onended = chiudi;
      audio.onerror = chiudi;
      audio.onpause = () => { if (fermatoDavvero(audio) || audio.ended) chiudi(); };
      audio.play().catch(() => chiudi());
    });
  } catch { /* la voce è un di più: se fallisce, si prosegue in silenzio */ }
}

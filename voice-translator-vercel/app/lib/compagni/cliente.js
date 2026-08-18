// ═══════════════════════════════════════════════════════════════
// COMPAGNI — cliente (Luca)
//
// Piccoli aiutanti lato client per l'area Life: chiamano le rotte
// (/api/compagni/*) e riproducono la voce con /api/tts-elevenlabs, come
// già fa il resto dell'app (new Audio). Nessuna logica di business qui:
// solo il ponte HTTP fra la UI e il backend già costruito e testato.
// ═══════════════════════════════════════════════════════════════

import { segmentiPerVoce } from './corsi/lingua.js';

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
    throw err;
  }
  return dati;
}

/** Genera il copione del podcast: [{ordine, round, compagnoId, nome, voceId, testo}]. */
export function generaPodcast({ argomento, compagni, round, lingua, userToken }) {
  return postJSON('/api/compagni/podcast', { argomento, compagni, round, lingua, userToken });
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
  return d.dataUrl;
}

/** Genera l'elenco lezioni di un corso. */
export function generaSyllabus({ argomento, categoria, livello, docenteId, direzione, lingua, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'syllabus', argomento, categoria, livello, docenteId, direzione, lingua, userToken });
}

/** Genera il contenuto di una lezione. */
export function generaLezione({ argomento, categoria, livello, lezione, docenteId, lingua, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'lezione', argomento, categoria, livello, lezione, docenteId, lingua, userToken });
}

/** Genera il quiz di una lezione. b.231 — passa il contenuto reale. */
export function generaQuiz({ lezione, lingua, userToken, livello, contenuto, argomento }) {
  return postJSON('/api/compagni/corso', { azione: 'quiz', lezione, lingua, userToken, livello, contenuto, argomento });
}

/**
 * b.242 — REGISTRA com'è andata una prova: è ciò che permette al Maestro di
 * ricordare. `daRivedere` sono le cose sbagliate (per il ripasso),
 * `osservazioni` cosa ha imparato su questa persona. Senza account non salva
 * nulla e non è un errore.
 */
export function registraEsito({ argomento, lezioneIndice, punteggio, daRivedere, osservazioni, userToken }) {
  return postJSON('/api/compagni/corso', {
    azione: 'esito', argomento, lezioneIndice, punteggio, daRivedere, osservazioni, userToken,
  });
}

/**
 * b.244 — SEGNALA un contenuto della piazza o della libreria. Chiunque abbia
 * un account, una volta sola: a 3 segnalazioni sparisce da solo.
 * `tipo`: 'discussione' | 'commento' | 'corso'.
 */
export function segnalaContenuto({ tipo, contenuto, motivo, userToken }) {
  return postJSON('/api/mondo/discussioni', { azione: 'segnala', tipo, contenuto, motivo, userToken });
}

/** b.244 — nascondi/riapri a mano: solo admin o chi ha aperto la discussione. */
export function moderaContenuto({ tipo, contenuto, nascondi = true, userToken }) {
  return postJSON('/api/mondo/discussioni', { azione: 'modera', tipo, contenuto, nascondi, userToken });
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

/** Parla con un Compagno (Amico/Coach). Ritorna { risposta, voceId, memoria }.
 *  b.224 — `obiettivi` (attivi, dal dispositivo) rende il Compagno consapevole
 *  degli obiettivi di vita della persona. */
export function parlaAmico({ compagnoId, messaggi, lingua, userToken, obiettivi }) {
  // b.244-bis — `totale` e la lunghezza VERA della conversazione: la rotta
  // taglia i messaggi a 20 e senza questo il throttle della memoria si
  // rompeva dopo il ventesimo scambio (estraeva a ogni turno).
  return postJSON('/api/compagni/amico', { compagnoId, messaggi, lingua, userToken, obiettivi, totale: Array.isArray(messaggi) ? messaggi.length : 0 });
}

/** Tavolo/Debate: tu + più Compagni verso un obiettivo comune.
 *  Ritorna { risposte: [{compagnoId,nome,voceId,testo}] }. */
export function parlaTavolo({ compagni, messaggi, lingua, userToken, obiettivi, obiettivo }) {
  return postJSON('/api/compagni/tavolo', { compagni, messaggi, lingua, userToken, obiettivi, obiettivo });
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
export async function parlaBilingue({ voceId, testo, linguaParlata, linguaStudiata, userToken, modoVoce }, onAudio) {
  const pezzi = segmentiPerVoce(testo, { linguaParlata, linguaStudiata });
  for (const p of pezzi) {
    const suaLingua = p.lingua === linguaStudiata;
    await parlaTurno({
      // La lingua studiata NON usa la voce del Compagno: serve un madrelingua.
      voceId: suaLingua ? null : voceId,
      testo: p.testo,
      lingua: p.lingua,
      userToken,
      // Una citazione in lingua straniera si legge piana: è un modello di
      // pronuncia, non un'interpretazione.
      modoVoce: suaLingua ? 'neutro' : modoVoce,
    }, onAudio);
  }
}

export async function parlaTurno({ voceId, testo, lingua, userToken, modoVoce }, onAudio) {
  try {
    const r = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // b.238 — `modoVoce` è l'intento dichiarato da chi parla (pensoso,
      // caldo, serio…): la voce smette di leggere tutto allo stesso modo.
      body: JSON.stringify({ text: testo, voiceId: voceId, langCode: lingua, userToken, speechMode: modoVoce }),
    });
    if (!r.ok) return; // niente voce: si legge soltanto
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((risolvi) => {
      const audio = new Audio(url);
      if (onAudio) onAudio(audio);
      // b.232 — anche la PAUSA (Stop del podcast) risolve la promise: prima
      // audio.pause() non emetteva onended/onerror e il ciclo di `vai` restava
      // appeso su questo await. `fatto` evita la doppia risoluzione.
      let fatto = false;
      const chiudi = () => { if (fatto) return; fatto = true; URL.revokeObjectURL(url); risolvi(); };
      audio.onended = chiudi;
      audio.onerror = chiudi;
      audio.onpause = chiudi;
      audio.play().catch(() => chiudi());
    });
  } catch { /* la voce è un di più: se fallisce, si prosegue in silenzio */ }
}

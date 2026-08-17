// ═══════════════════════════════════════════════════════════════
// COMPAGNI — cliente (Luca)
//
// Piccoli aiutanti lato client per l'area Life: chiamano le rotte
// (/api/compagni/*) e riproducono la voce con /api/tts-elevenlabs, come
// già fa il resto dell'app (new Audio). Nessuna logica di business qui:
// solo il ponte HTTP fra la UI e il backend già costruito e testato.
// ═══════════════════════════════════════════════════════════════

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

/** Costruisce un Compagno completo da una descrizione/nome (o a sorpresa). */
export async function generaAgente({ descrizione, sorpresa, lingua, userToken }) {
  const d = await postJSON('/api/compagni/genera', { descrizione, sorpresa: !!sorpresa, lingua, userToken });
  return d.agente;
}

/** Genera l'elenco lezioni di un corso. */
export function generaSyllabus({ argomento, categoria, livello, docenteId, direzione, lingua, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'syllabus', argomento, categoria, livello, docenteId, direzione, lingua, userToken });
}

/** Genera il contenuto di una lezione. */
export function generaLezione({ argomento, categoria, livello, lezione, docenteId, lingua, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'lezione', argomento, categoria, livello, lezione, docenteId, lingua, userToken });
}

/** Genera il quiz di una lezione. */
export function generaQuiz({ lezione, lingua, userToken }) {
  return postJSON('/api/compagni/corso', { azione: 'quiz', lezione, lingua, userToken });
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

/** Parla con un Compagno (Amico/Coach). Ritorna { risposta, voceId, memoria }. */
export function parlaAmico({ compagnoId, messaggi, lingua, userToken }) {
  return postJSON('/api/compagni/amico', { compagnoId, messaggi, lingua, userToken });
}

/** Tavolo: tu + più Compagni. Ritorna { risposte: [{compagnoId,nome,voceId,testo}] }. */
export function parlaTavolo({ compagni, messaggi, lingua, userToken }) {
  return postJSON('/api/compagni/tavolo', { compagni, messaggi, lingua, userToken });
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
export async function parlaTurno({ voceId, testo, lingua, userToken }, onAudio) {
  try {
    const r = await fetch('/api/tts-elevenlabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testo, voiceId: voceId, langCode: lingua, userToken }),
    });
    if (!r.ok) return; // niente voce: si legge soltanto
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    await new Promise((risolvi) => {
      const audio = new Audio(url);
      if (onAudio) onAudio(audio);
      audio.onended = () => { URL.revokeObjectURL(url); risolvi(); };
      audio.onerror = () => { URL.revokeObjectURL(url); risolvi(); };
      audio.play().catch(() => risolvi());
    });
  } catch { /* la voce è un di più: se fallisce, si prosegue in silenzio */ }
}

// b.599 — LA VOCE TRADOTTA: UN MODULO, NON DUE COPIE.
//
// L'audit di architettura b.598 ha contato che le due pipeline
// dell'interprete (useStreamingInterpreter, Deepgram; useInterpreterMode,
// ripiego a blocchi con Whisper) condividevano ZERO righe e riscrivevano
// ognuna per conto suo: la richiesta della voce ai due motori TTS, la
// conversione blob→base64, l'invio a pezzi da 10 KB sul DataChannel, il
// riassemblaggio dei pezzi in ricezione e la riproduzione con
// l'attenuazione del partner. Le copie erano DIVERGENTI, e tre difetti
// vivevano solo in una delle due (campo `lang` invece di `langCode`, i
// fix b.381/b.404 assenti nel ripiego, la voce mancata detta in un modo
// che nessuno ascoltava — tutti corretti in b.598, uno per uno, a mano).
//
// Qui sta la versione unica. Nessun React: funzioni pure che ricevono
// tutto quello che serve come argomento, cosi' si provano senza montare
// niente e si usano da qualunque hook o componente.

import { apiCircuitBreaker } from '../circuitBreaker.js';
import { getVoceChiamata, getVolumeTTS } from '../audioPrefs.js';
import { MSG, avvisaTTS } from '../eventi.js';

/** Un messaggio DataChannel pesa al massimo ~16 KB nel browser: 10 KB di
 *  base64 + JSON + cifratura E2E restano sotto con margine. */
export const MAX_PEZZO_DC = 10000;
/** Quanti tentativi per motore prima di passare all'altro. */
export const TENTATIVI_PER_MOTORE = 2;
/** Scadenza di ogni richiesta vocale (b.363: prima era senza scadenza). */
export const SCADENZA_VOCE_MS = 30000;

/**
 * Chiede la voce sintetica ai due motori, nell'ordine giusto.
 *
 * - premium (ElevenLabs) prima se l'utente ha scelto una voce con nome o
 *   se chi ha aperto la stanza preferisce la premium; altrimenti Edge.
 * - ogni motore ha TENTATIVI_PER_MOTORE possibilita'; un 402 (credito
 *   finito) sulla premium salta subito all'altro motore.
 * - 204 = niente da pronunciare (sole emoji o punteggiatura, b.552): non
 *   e' un guasto, si torna null SENZA provare l'altro motore.
 * - ogni motore passa dal circuit breaker (`interpreter-tts:<rotta>`):
 *   dopo 3 guasti di fila quel motore si salta per 30 s invece di far
 *   aspettare 30 s di scadenza a ogni frase.
 *
 * @returns {Promise<Blob|null>} l'audio, o null se nessuno ha risposto
 *   (o non c'era niente da dire: distinguere con `esito.motivo`).
 */
export async function chiediVoce(testo, {
  langCode, roomId, roomSessionToken, userToken, preferisciEleven = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  const esito = { blob: null, motivo: 'nessun-motore' };
  if (!testo || String(testo).trim().length < 2) { esito.motivo = 'testo-vuoto'; return esito; }
  const voceScelta = getVoceChiamata();
  const corpo = {
    text: testo,
    // b.598 — `langCode` per TUTTI e due i motori: e' l'unico campo che
    // /api/tts-elevenlabs e /api/tts-edge leggono.
    langCode,
    voiceId: voceScelta || undefined,
    roomId,
    roomSessionToken: roomId ? (roomSessionToken || undefined) : undefined,
    userToken: userToken || undefined,
  };
  const motori = (voceScelta || preferisciEleven)
    ? ['/api/tts-elevenlabs', '/api/tts-edge']
    : ['/api/tts-edge', '/api/tts-elevenlabs'];
  for (const rotta of motori) {
    for (let tentativo = 0; tentativo < TENTATIVI_PER_MOTORE; tentativo++) {
      try {
        const r = await apiCircuitBreaker.execute(`interpreter-tts:${rotta}`, () =>
          fetchImpl(rotta, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(SCADENZA_VOCE_MS),
          })
        );
        if (r.status === 204) { esito.motivo = 'niente-da-dire'; return esito; }
        if (r.ok) { esito.blob = await r.blob(); esito.motivo = rotta; return esito; }
        if (r.status === 402) break;   // credito finito: inutile insistere su questo motore
      } catch { /* rete inciampata o circuito aperto: il prossimo giro riprova */ }
    }
  }
  return esito;
}

/** Blob → base64, a pezzi da 8 KB: `String.fromCharCode(...spread)`
 *  scoppia sopra ~64K elementi. */
export async function blobABase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  const passo = 8192;
  for (let i = 0; i < bytes.length; i += passo) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  }
  return btoa(binario);
}

/** Manda l'audio base64 al partner sul DataChannel, in un pezzo solo se
 *  ci sta, altrimenti a pezzi numerati. Ritorna quanti messaggi ha mandato
 *  (0 se il canale non c'e'). */
export function inviaAudioDC(webrtc, base64) {
  if (!webrtc?.sendDirectMessage || !base64) return 0;
  if (base64.length <= MAX_PEZZO_DC) {
    webrtc.sendDirectMessage({ type: MSG.AUDIO, data: base64 });
    return 1;
  }
  const totale = Math.ceil(base64.length / MAX_PEZZO_DC);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  for (let i = 0; i < totale; i++) {
    webrtc.sendDirectMessage({
      type: MSG.AUDIO_PARTE, id, part: i, total: totale,
      data: base64.slice(i * MAX_PEZZO_DC, (i + 1) * MAX_PEZZO_DC),
    });
  }
  return totale;
}

/**
 * Riassembla i pezzi `interpreter-audio-part` che arrivano dal partner.
 * `aggiungi(msg)` ritorna il base64 completo quando l'ultimo pezzo
 * arriva, altrimenti null. `pulisci(maxEtaMs)` butta i pezzi orfani
 * (un partner caduto a meta' invio non deve occupare memoria per sempre).
 */
export function creaRiassemblatore() {
  const pezzi = {};
  return {
    aggiungi(msg) {
      if (!msg?.id || msg.data == null) return null;
      if (!pezzi[msg.id]) pezzi[msg.id] = { parti: {}, totale: msg.total, ts: Date.now() };
      const voce = pezzi[msg.id];
      voce.parti[msg.part] = msg.data;
      if (Object.keys(voce.parti).length !== voce.totale) return null;
      let intero = '';
      for (let i = 0; i < voce.totale; i++) intero += voce.parti[i] || '';
      delete pezzi[msg.id];
      return intero;
    },
    pulisci(maxEtaMs = 30000) {
      const ora = Date.now();
      let tolti = 0;
      for (const id of Object.keys(pezzi)) {
        if (ora - (pezzi[id].ts || 0) > maxEtaMs) { delete pezzi[id]; tolti++; }
      }
      return tolti;
    },
    inSospeso() { return Object.keys(pezzi).length; },
  };
}

/**
 * Riproduce l'audio base64 della voce tradotta.
 *
 * - legge il volume dalle preferenze (b.276): a zero non suona affatto;
 * - accende l'attenuazione del partner (`startDucking` + evento
 *   bartalk:tts) e la spegne da UN'USCITA SOLA, `finito()`, chiamata da
 *   onended, onerror e dal rifiuto di play() (b.381/b.404: due copie di
 *   questa funzione avevano dimenticato una delle tre uscite, e la voce
 *   del partner restava attenuata per sempre);
 * - `onAudio(audio|null)` riceve l'elemento in corsa, per chi vuole
 *   fermarlo allo stop o regolarne il volume in corsa.
 *
 * @returns {HTMLAudioElement|null} l'audio avviato, o null se non suona.
 */
export function riproduciBase64(base64, { startDucking, stopDucking, onAudio } = {}) {
  let url = null;
  try {
    const byte = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    url = URL.createObjectURL(new Blob([byte], { type: 'audio/mpeg' }));
    const audio = new Audio(url);
    const volume = getVolumeTTS();
    if (volume <= 0) { URL.revokeObjectURL(url); return null; }
    audio.volume = volume;
    onAudio?.(audio);
    startDucking?.();
    avvisaTTS(true);
    let chiuso = false;
    const finito = () => {
      if (chiuso) return;
      chiuso = true;
      avvisaTTS(false);
      stopDucking?.();
      try { URL.revokeObjectURL(url); } catch { /* url gia liberato: nulla da fare */ }
      onAudio?.(null);
    };
    audio.play().catch(finito);
    audio.onended = finito;
    audio.onerror = finito;
    return audio;
  } catch {
    avvisaTTS(false);
    stopDucking?.();
    try { if (url) URL.revokeObjectURL(url); } catch { /* url gia liberato: nulla da fare */ }
    onAudio?.(null);
    return null;
  }
}

/** Il cursore del volume comanda ANCHE la frase in corsa (b.352/b.381):
 *  a zero si mette in pausa, rialzandolo riparte se era stata la pausa
 *  del volume a fermarla. */
export function regolaVolumeInCorsa(audio, volume = getVolumeTTS()) {
  if (!audio) return false;
  try {
    audio.volume = volume;
    if (volume <= 0) audio.pause();
    else if (audio.paused && !audio.ended) audio.play().catch(() => { /* il browser puo' rifiutare: non e' un guasto */ });
    return true;
  } catch {
    return false;
  }
}

/** Ferma la frase in corsa (allo stop dell'interprete, b.381). */
export function fermaAudio(audio) {
  if (!audio) return;
  try { audio.pause(); audio.currentTime = 0; } catch { /* l'audio era gia finito: nulla da fermare */ }
}

// b.602 — UN SOLO CLIENT DEEPGRAM.
//
// L'audit di architettura b.598: tre client WebSocket verso Deepgram
// scritti a mano in tre file (useDeepgramSTT, useStreamingInterpreter,
// SpeakerView), ognuno con la sua URL, i suoi parametri, il suo parser
// dei messaggi, la sua chiusura — e sei punti che chiedevano la chiave
// temporanea a /api/stt-token con sei corpi diversi (uno senza corpo:
// b.157, «il ramo Deepgram non si attivava mai»).
//
// Qui: la chiave si chiede in un modo solo; la connessione si apre in
// un modo solo, con UNA porta d'uscita (b.247: prima l'esito negativo si
// dava in due punti scollegati e il temporizzatore non si annullava mai);
// i messaggi si leggono in un modo solo e chi ascolta riceve gia'
// `transcript`/`isFinal`/`fineFrase`. Le differenze VOLUTE fra gli usi
// (pausa di fine frase, endpointing) restano parametri.

import { avviaCatturaPCM16 } from './catturaPCM16.js';

export const SCADENZA_CHIAVE_MS = 10000;
export const SCADENZA_APERTURA_MS = 4000;
export const ATTESA_CHIUSURA_MS = 400;

/**
 * Chiede a /api/stt-token la chiave temporanea. Torna la chiave o null:
 * mai un'eccezione (una pagina d'errore al posto del JSON faceva
 * esplodere la catena, b.363).
 */
export async function chiediChiaveDeepgram({ userToken, roomId, roomSessionToken, fetchImpl = globalThis.fetch } = {}) {
  try {
    const r = await fetchImpl('/api/stt-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userToken: userToken || '',
        roomId: roomId || undefined,
        roomSessionToken: roomId ? (roomSessionToken || undefined) : undefined,
      }),
      signal: AbortSignal.timeout(SCADENZA_CHIAVE_MS),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d?.key || null;
  } catch {
    return null;
  }
}

/** L'URL di ascolto, coi parametri che Deepgram capisce. Esportata per le prove. */
export function urlDeepgram({ lingua, utteranceEndMs = 1500, endpointing, sampleRate = 16000 }) {
  const params = new URLSearchParams({
    model: 'nova-2',
    language: String(lingua || 'en').split('-')[0],
    smart_format: 'true',
    interim_results: 'true',
    utterance_end_ms: String(utteranceEndMs),
    encoding: 'linear16',
    sample_rate: String(sampleRate),
    channels: '1',
  });
  if (endpointing != null) params.set('endpointing', String(endpointing));
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

/** Legge un messaggio di Deepgram e lo riduce a cio' che serve. Esportata per le prove. */
export function leggiMessaggioDeepgram(grezzo) {
  let data;
  try { data = JSON.parse(grezzo); } catch { return null; }
  if (data?.type === 'Results') {
    const transcript = data.channel?.alternatives?.[0]?.transcript || '';
    if (!transcript) return null;
    return { tipo: 'testo', transcript, isFinal: !!data.is_final };
  }
  if (data?.type === 'UtteranceEnd') return { tipo: 'fineFrase' };
  return null;
}

/**
 * Apre la connessione, avvia la cattura e consegna i risultati.
 *
 * Risolve con `{ chiudi }` quando il socket e' aperto e la cattura
 * parte; risolve con null se non si apre entro SCADENZA_APERTURA_MS o
 * se il socket cade prima di aprirsi — e in quel caso ha gia' spento
 * tutto quello che aveva acceso. Dopo l'apertura, `onChiuso` avvisa se
 * il socket cade.
 *
 * @param {object} opz
 * @param {string} opz.chiave — dal server (chiediChiaveDeepgram)
 * @param {MediaStream} opz.stream — la voce da mandare
 * @param {string} opz.lingua — es. 'it' o 'it-IT'
 * @param {number} [opz.utteranceEndMs]
 * @param {number} [opz.endpointing]
 * @param {(transcript: string, isFinal: boolean) => void} [opz.onTesto]
 * @param {() => void} [opz.onFineFrase]
 * @param {() => void} [opz.onChiuso]
 * @param {typeof WebSocket} [opz.WebSocketImpl]
 */
export function apriDeepgram({
  chiave, stream, lingua, utteranceEndMs, endpointing,
  onTesto, onFineFrase, onChiuso,
  WebSocketImpl = globalThis.WebSocket,
  scadenzaAperturaMs = SCADENZA_APERTURA_MS,
} = {}) {
  return new Promise((resolve) => {
    let ws = null;
    let cattura = null;
    let risolto = false;
    let chiuso = false;
    let timerApertura = null;

    const chiudi = async () => {
      if (chiuso) return;
      chiuso = true;
      clearTimeout(timerApertura);
      try { cattura?.ferma(); } catch { /* la cattura era gia ferma: fermarla due volte non e un guasto */ }
      cattura = null;
      if (ws) {
        const s = ws; ws = null;
        try {
          s.onopen = null; s.onmessage = null; s.onerror = null; s.onclose = null;
          if (s.readyState === 1 /* OPEN */) {
            // CloseStream: Deepgram consegna gli ultimi risultati prima di chiudere
            try { s.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* il socket stava gia cadendo: non c'e piu niente da salutare */ }
            await new Promise(r => setTimeout(r, ATTESA_CHIUSURA_MS));
          }
          s.close();
        } catch { /* il socket era gia chiuso: chiuderlo due volte non e un guasto */ }
      }
    };

    const concludi = (esito) => {
      if (risolto) return;
      risolto = true;
      clearTimeout(timerApertura);
      if (!esito) { chiudi(); resolve(null); }
      else resolve({ chiudi, get aperta() { return !chiuso; } });
    };

    try {
      ws = new WebSocketImpl(urlDeepgram({ lingua, utteranceEndMs, endpointing }), ['token', chiave]);
    } catch {
      concludi(false);
      return;
    }

    ws.onopen = () => {
      // un'apertura arrivata DOPO la scadenza non deve accendere niente
      if (risolto) return;
      try {
        const socket = ws;
        cattura = avviaCatturaPCM16(stream, {
          attiva: () => !!socket && socket.readyState === 1,
          onPezzo: (buf) => { try { socket.send(buf); } catch { /* il socket e caduto fra un blocco e l'altro: onclose lo dira */ } },
        });
      } catch {
        concludi(false);
        return;
      }
      concludi(true);
    };
    ws.onmessage = (ev) => {
      const m = leggiMessaggioDeepgram(ev.data);
      if (!m) return;
      try {
        if (m.tipo === 'testo') onTesto?.(m.transcript, m.isFinal);
        else if (m.tipo === 'fineFrase') onFineFrase?.();
      } catch { /* chi ascolta non deve mai fermare il socket: si perde un messaggio e si prosegue */ }
    };
    ws.onerror = () => { if (!risolto) concludi(false); };
    ws.onclose = () => {
      if (!risolto) { concludi(false); return; }
      if (!chiuso) { chiudi(); try { onChiuso?.(); } catch { /* chi ascolta la chiusura non deve far cadere chi la segnala */ } }
    };
    timerApertura = setTimeout(() => concludi(false), scadenzaAperturaMs);
  });
}

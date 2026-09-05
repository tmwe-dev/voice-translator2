// b.602 — UN SOLO CLIENT PER LA TRASCRIZIONE DAL VIVO.
//
// b.637 — e adesso non e piu «di Deepgram»: il fornitore preferito e
// ElevenLabs (Scribe v2 Realtime), lo stesso che gia fa la voce. Il file
// si chiamava `deepgramLive.js` e le funzioni `*Deepgram`: con due
// fornitori quel nome sarebbe una bugia, e un nome che mente e peggio di
// un nome brutto. Rinominato insieme al cambiamento, non dopo.
//
// Cio che cambia fra i due sta in TRE punti soli — l'indirizzo, come si
// mandano i campioni, come si legge la risposta — ed e tutto qui dentro.
// Chi chiama non sa nemmeno chi sta trascrivendo, e non deve saperlo.
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

/** b.637 — PCM16 grezzo → base64, a pezzi: `fromCharCode(...spread)`
 *  scoppia sopra ~64K elementi, e qui passa un blocco ogni 256 ms. */
function aBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return btoa(s);
}

export const SCADENZA_CHIAVE_MS = 10000;
export const SCADENZA_APERTURA_MS = 4000;
export const ATTESA_CHIUSURA_MS = 400;

/**
 * Chiede a /api/stt-token il gettone temporaneo. Torna
 * `{ chiave, fornitore }` o null: mai un'eccezione (una pagina d'errore
 * al posto del JSON faceva esplodere la catena, b.363).
 *
 * b.637 — il server dice anche CHI trascrive: 'elevenlabs' (Scribe v2
 * Realtime, la prima scelta) o 'deepgram' (il ripiego). Una risposta
 * vecchia senza quel campo vale 'deepgram', come prima.
 */
export async function chiediChiaveSTT({ userToken, roomId, roomSessionToken, fetchImpl = globalThis.fetch } = {}) {
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
    if (!d?.key) return null;
    return { chiave: d.key, fornitore: d.fornitore === 'elevenlabs' ? 'elevenlabs' : 'deepgram' };
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

/**
 * b.637 — L'URL di ascolto di ElevenLabs Scribe v2 Realtime.
 *
 * `commit_strategy: 'vad'` e la ragione per cui questo fornitore sta
 * bene qui: il taglio delle frasi lo fa LUI, sul parlato, e ogni
 * `committed_transcript` E una frase finita. Non serve inseguire pause
 * e soglie da questa parte.
 *
 * Il gettone viaggia nella query perche e monouso e dura 15 minuti: la
 * chiave vera non esce mai dal server (vedi /api/stt-token).
 * Esportata per le prove.
 */
export function urlElevenLabs({ lingua, chiave, sampleRate = 16000 }) {
  const params = new URLSearchParams({
    model_id: 'scribe_v2_realtime',
    audio_format: `pcm_${sampleRate}`,
    commit_strategy: 'vad',
  });
  const base = String(lingua || '').trim().split(/[-_]/)[0];
  if (base) params.set('language_code', base);
  if (chiave) params.set('token', chiave);
  return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
}

/**
 * b.637 — Legge un messaggio di ElevenLabs e lo riduce a cio' che serve,
 * nello stesso identico contratto di Deepgram: chi chiama non deve
 * accorgersi di niente.
 *
 * `partial_transcript` = testo in corsa; `committed_transcript` = frase
 * chiusa dal loro rilevatore di voce, quindi vale ANCHE come fine frase.
 * Esportata per le prove.
 */
export function leggiMessaggioElevenLabs(grezzo) {
  let d;
  try { d = JSON.parse(grezzo); } catch { return null; }
  const tipo = d?.message_type;
  // ═══ b.637-bis — IL SOCKET SI APRE ANCHE QUANDO NON SI ENTRA ═══
  // Trovato dal vivo (collaudo 05/09, Chrome di Luca, gettone finto di
  // proposito): ElevenLabs ACCETTA la connessione e solo DOPO manda
  // `{"message_type":"auth_error"}` e chiude. Deepgram invece rifiuta la
  // stretta di mano e il socket non si apre proprio.
  // Differenza decisiva: se si prende `onopen` per «sono dentro», con un
  // gettone scaduto o consumato l'interprete si dichiara PARTITO, poi
  // muore in silenzio — niente sottotitoli, niente voce, e nessun
  // ripiego sui blocchi, perche chi chiama crede che vada tutto bene.
  // E' esattamente la classe di guasto che stiamo chiudendo.
  if (tipo === 'session_started') return { tipo: 'pronto' };
  if (typeof tipo === 'string' && tipo.endsWith('error')) {
    return { tipo: 'guasto', motivo: tipo };
  }
  if (tipo === 'partial_transcript') {
    const t = d.text || '';
    return t ? { tipo: 'testo', transcript: t, isFinal: false } : null;
  }
  if (tipo === 'committed_transcript') {
    const t = d.text || '';
    // Anche una frase vuota chiude il turno: e' silenzio finito, e chi
    // aspetta la fine frase deve saperlo.
    return { tipo: 'testo', transcript: t, isFinal: true, fineFrase: true };
  }
  return null;
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
 * Risolve con `{ chiudi }` quando si e' DENTRO davvero: per Deepgram
 * all'apertura del socket, per ElevenLabs al suo `session_started` (o
 * alla prima trascrizione). Risolve con null se non si entra entro
 * SCADENZA_APERTURA_MS, se il socket cade prima, o se il fornitore
 * risponde con un errore — e in quel caso ha gia' spento tutto quello
 * che aveva acceso, cosi chi chiama puo' ripiegare. Dopo l'ingresso,
 * `onChiuso` avvisa se il socket cade.
 *
 * b.637-bis: la distinzione fra «aperto» e «dentro» esiste perche
 * ElevenLabs accetta la connessione e SOLO DOPO manda `auth_error`
 * (verificato dal vivo il 05/09). Prendere `onopen` per buono voleva
 * dire un interprete che si dichiara partito e poi muore in silenzio.
 *
 * @param {object} opz
 * @param {string} opz.chiave — dal server (chiediChiaveSTT)
 * @param {'elevenlabs'|'deepgram'} [opz.fornitore] — chi trascrive (b.637)
 * @param {MediaStream} opz.stream — la voce da mandare
 * @param {string} opz.lingua — es. 'it' o 'it-IT'
 * @param {number} [opz.utteranceEndMs]
 * @param {number} [opz.endpointing]
 * @param {(transcript: string, isFinal: boolean) => void} [opz.onTesto]
 * @param {() => void} [opz.onFineFrase]
 * @param {() => void} [opz.onChiuso]
 * @param {typeof WebSocket} [opz.WebSocketImpl]
 */
export function apriAscolto({
  chiave, fornitore = 'deepgram', stream, lingua, utteranceEndMs, endpointing,
  onTesto, onFineFrase, onChiuso,
  WebSocketImpl = globalThis.WebSocket,
  scadenzaAperturaMs = SCADENZA_APERTURA_MS,
} = {}) {
  // b.637 — le tre sole differenze fra i due fornitori, tutte qui.
  const eleven = fornitore === 'elevenlabs';
  return new Promise((resolve) => {
    let ws = null;
    let cattura = null;
    let risolto = false;
    let entrato = false;   // b.637-bis — risolto CON successo, non solo risolto
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
          // b.637-bis — il commiato ha senso solo se si era entrati: se
          // il fornitore ci ha respinti non c'e nessun ultimo risultato
          // da aspettare, e chi chiama deve poter ripiegare SUBITO.
          if (entrato && s.readyState === 1 /* OPEN */) {
            // Il saluto: Deepgram consegna gli ultimi risultati prima di
            // chiudere se glielo si chiede. b.637 — ElevenLabs chiude la
            // frase in corso da solo quando il socket si chiude, quindi
            // non ha un messaggio di congedo: si aspetta lo stesso un
            // attimo, per lasciargli consegnare l'ultimo committed.
            if (!eleven) {
              try { s.send(JSON.stringify({ type: 'CloseStream' })); } catch { /* il socket stava gia cadendo: non c'e piu niente da salutare */ }
            }
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
      else { entrato = true; resolve({ chiudi, get aperta() { return !chiuso; } }); }
    };

    try {
      // 1a differenza: l'indirizzo, e come viaggia il gettone.
      // ElevenLabs lo vuole nella query (monouso, 15 minuti); Deepgram
      // in un sottoprotocollo.
      ws = eleven
        ? new WebSocketImpl(urlElevenLabs({ lingua, chiave }))
        : new WebSocketImpl(urlDeepgram({ lingua, utteranceEndMs, endpointing }), ['token', chiave]);
    } catch {
      concludi(false);
      return;
    }

    // b.637-bis — «aperto» e «dentro» non sono la stessa cosa.
    // Deepgram: la stretta di mano riuscita E l'ingresso, quindi
    // `onopen` basta. ElevenLabs: il socket si apre sempre, e solo dopo
    // dice se ti fa entrare (`session_started`) o no (`auth_error`).
    // Quindi la cattura parte all'apertura per tutti e due — l'audio
    // serve perche una risposta arrivi — ma la PROMESSA si risolve solo
    // su un segnale positivo: chi chiama deve poter ripiegare sui
    // blocchi se qui non si entra davvero.
    const avviaCattura = () => {
      try {
        const socket = ws;
        cattura = avviaCatturaPCM16(stream, {
          attiva: () => !!socket && socket.readyState === 1,
          // 2a differenza: come si mandano i campioni. Gli stessi PCM16
          // a 16 kHz per tutti e due — Deepgram li prende grezzi,
          // ElevenLabs dentro un messaggio JSON.
          onPezzo: (buf) => {
            try { socket.send(eleven ? JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: aBase64(buf) }) : buf); }
            catch { /* il socket e caduto fra un blocco e l'altro: onclose lo dira */ }
          },
        });
        return true;
      } catch {
        concludi(false);
        return false;
      }
    };

    ws.onopen = () => {
      // un'apertura arrivata DOPO la scadenza non deve accendere niente
      if (risolto) return;
      if (!avviaCattura()) return;
      // Con Deepgram si e dentro: si risolve subito, come sempre.
      // Con ElevenLabs si aspetta `session_started` (o la prima
      // trascrizione, se quel messaggio non arrivasse): se invece
      // arriva un errore, si fallisce SUBITO invece di aspettare la
      // scadenza; e se non arriva niente, la scadenza chiude tutto.
      if (!eleven) concludi(true);
    };
    ws.onmessage = (ev) => {
      // 3a differenza: come si legge la risposta. Da qui in poi il
      // contratto e identico per tutti e due.
      const m = eleven ? leggiMessaggioElevenLabs(ev.data) : leggiMessaggioDeepgram(ev.data);
      if (!m) return;
      // b.637-bis — i due segnali che dicono se si e davvero dentro.
      if (m.tipo === 'pronto') { concludi(true); return; }
      if (m.tipo === 'guasto') {
        if (!risolto) { concludi(false); return; }       // non si e mai entrati: chi chiama ripiega
        if (!chiuso) { chiudi(); try { onChiuso?.(); } catch { /* chi ascolta la chiusura non deve far cadere chi la segnala */ } }
        return;
      }
      try {
        if (m.tipo === 'testo') {
          // Se il messaggio di ingresso non e mai arrivato ma il testo
          // si', si e dentro lo stesso: si prende atto e si prosegue.
          if (!risolto) concludi(true);
          onTesto?.(m.transcript, m.isFinal);
          // b.637 — con Scribe la frase chiusa E la fine frase: il loro
          // rilevatore di voce ha gia deciso dove finisce. Deepgram
          // manda invece un messaggio a parte (UtteranceEnd).
          if (m.fineFrase) onFineFrase?.();
        } else if (m.tipo === 'fineFrase') onFineFrase?.();
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

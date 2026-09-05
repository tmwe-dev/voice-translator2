'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createNoiseGate } from '../lib/noiseGate.js';
import { apiCircuitBreaker } from '../lib/circuitBreaker.js';
import useStreamingInterpreter from './useStreamingInterpreter.js';
import { createLogger } from '../lib/logger.js';
import { prendiVoce, rendiVoce } from '../lib/microfonoMaster.js';
// b.599 — la voce tradotta (richiesta ai motori, base64, invio DC,
// riproduzione, riassemblaggio) vive in UN modulo condiviso con lo
// streaming: qui ne restano solo le chiamate. Vedi lib/audio/voceTradotta.js.
import {
  chiediVoce, blobABase64, inviaAudioDC, creaRiassemblatore, riproduciBase64,
} from '../lib/audio/voceTradotta.js';
// b.598 — LA VOCE, ANTICIPATA. Prima l'attenuazione della voce del
// partner partiva SOLO quando la voce TRADOTTA era pronta a suonare
// (secondi dopo che l'utente aveva gia iniziato a parlare — l'intero
// giro STT -> traduzione -> sintesi). Richiesta di Luca: "quando rilevi
// la voce dell'utente... lo riduci per permettere al microfono di
// ascoltare l'utente". Il cancello del rumore (noiseGate.js) sa gia,
// in tempo reale, quando l'utente ha COMINCIATO a parlare — lo usa gia
// per se stesso. Qui lo si ascolta anche da fuori: stesso segnale,
// nessun secondo rilevatore. b.599: il nome dell'evento e l'aiutante
// stanno in lib/eventi.js.
import { EVENTO, MSG, avvisaVoceLocale, lancia } from '../lib/eventi.js';
const log = createLogger('interpreter');

// ═══════════════════════════════════════
// useInterpreterMode — Bidirectional real-time STT → Translate → TTS
//
// TWO MODES:
// A) STREAMING (Deepgram available): subtitle-first pipeline
//    - Real-time STT via WebSocket
//    - Incremental translation with conversation context
//    - Subtitles appear instantly, TTS per completed sentence
//
// B) LEGACY (Deepgram unavailable): 3-second chunk pipeline
//    - Capture 3s audio chunks via MediaRecorder
//    - STT → Translate → TTS per chunk (sequenziale)
//
// Works on both voice and video calls.
// ═══════════════════════════════════════

// ═══ b.634 — IL TAGLIO LO DECIDE LA VOCE, NON L'OROLOGIO ═══
//
// Ordine di Luca: «noi non abbiamo bisogno di nessun servizio esterno.
// Dobbiamo semplicemente consegnare al traduttore e a ElevenLabs il
// testo da tradurre il piu velocemente possibile».
//
// Fino a qui il registratore tagliava OGNI 3 SECONDI, a orologio, senza
// guardare se qualcuno stesse parlando (`CHUNK_DURATION`, tolta qui).
// Tre conseguenze, tutte misurate in produzione il 05/09:
//
//  1. Il taglio cadeva a meta parola. Le due meta finivano in due
//     chiamate Whisper che non sanno l'una dell'altra: 770 blocchi
//     mandati a trascrivere, 388 traduzioni uscite. META DEL PARLATO
//     NON PRODUCEVA NIENTE.
//  2. Il buco fra lo stop di un registratore e l'avvio del successivo
//     cadeva anch'esso dove capita — spesso in mezzo a una frase.
//  3. Si spendeva un giro intero (Whisper + traduzione + voce, ~4 s) per
//     finestre di tre secondi contenenti mezza parola, o niente.
//
// Il rilevatore c'era gia e non lo usava nessuno per questo:
// `noiseGate.js` sa in tempo reale quando si comincia e si smette di
// parlare (serviva solo ad attenuare la voce del partner, b.598).
// Adesso e lui a decidere quando la frase e finita:
//
//   parla        -> il registratore gira, e ogni pausa breve non conta
//   tace 700 ms  -> la frase e finita: si consegna il blocco
//   tace e basta -> non si consegna NIENTE (prima era un giro pagato)
//
// Il buco fra un registratore e l'altro adesso cade NEL SILENZIO, che e
// il solo posto dove non si perde niente. Nessun servizio nuovo, nessun
// costo nuovo: lo stesso Whisper, chiamato quando ha senso chiamarlo.

/** Quanto silenzio chiude una frase. Sotto i ~500 ms si taglierebbe fra
 *  due parole della stessa frase; sopra il secondo si aspetta per niente. */
const CODA_SILENZIO_MS = 700;
/** Nessun blocco piu corto di cosi: una tosse o un «si» isolato non
 *  meritano un giro intero di trascrizione, traduzione e voce. */
const MIN_FRASE_MS = 1200;
/** Il tetto: chi parla senza mai fermarsi viene spezzato lo stesso, ma
 *  a nove secondi invece che a tre — un pezzo di frase lungo si traduce
 *  molto meglio di uno corto. */
const MAX_FRASE_MS = 9000;
/** Se il cancello del rumore non parte (browser senza Web Audio), non si
 *  sa quando si parla: si torna a tagliare a orologio, ma piu largo. */
const TETTO_SENZA_CANCELLO_MS = 4000;
// b.615 — IL SILENZIO PESA 996 BYTE. Misurato dal vivo (collaudo 03/09, b.613):
// un giro di 3 s di solo silenzio, dopo il filtro del rumore, e' un WebM da
// 996 byte; una frase corta ne fa 8.000 e passa. La soglia era 1000 —
// scritta due volte, a 4 byte dal silenzio: un soffio di rumore e Whisper
// riceveva (e faceva pagare) un blocco vuoto. Ora una costante sola, con
// un margine vero: sotto questa misura non c'e' voce.
const BYTE_MINIMI_BLOCCO_CON_VOCE = 1500;

// b.247 — tetto della coda dei blocchi audio in attesa di essere tradotti.
// Dodici blocchi da 3 secondi sono 36 secondi di parlato accumulato: oltre
// quella soglia non si e piu in ritardo, si e in un'altra conversazione, e
// consegnare quella roba serve solo a confondere. Vedi `accodaChunk`.
const MAX_CODA_CHUNK = 12;

export default function useInterpreterMode({
  webrtc, myLang, partnerLang, roomId, roomSessionTokenRef, userToken, useOwnKeys,
  startDucking, stopDucking,
  conversationContext,  // NEW: { getContext, addMessage } from useConversationContext
  preferisciEleven = false, // b.352 — la voce premium in chiamata
}) {
  const [active, setActive] = useState(false);
  // b.527 — IL SILENZIO SPIEGATO ANCHE ALL'AVVIO. Se l'interprete non
  // parte (microfono negato, registratore rotto), prima l'errore finiva
  // solo in console e a schermo restava il segnaposto muto: l'utente
  // vedeva «le traduzioni appariranno...» e non apparivano mai, senza
  // un perche. Ora il guasto d'avvio e uno stato che la UI legge.
  const [erroreAvvio, setErroreAvvio] = useState(null);
  // b.598 — IL SILENZIO SPIEGATO ANCHE A META CHIAMATA. Un blocco audio
  // su tre puo fallire la trascrizione (Whisper: "audio corrotto o non
  // supportato" — 400) senza che nulla in `processChunk` lo dicesse:
  // il blocco spariva e la frase non veniva mai tradotta, senza un
  // motivo visibile. Tre fallimenti CONSECUTIVI (non isolati: un blocco
  // storto ogni tanto e normale, tre di fila e un problema vero) accende
  // questo stato; il primo blocco che passa lo rispegne.
  const [problemaAudio, setProblemaAudio] = useState(false);
  const audioFallitiRef = useRef(0);
  // b.598 — LA VOCE MANCATA, ANCHE NEL RIPIEGO. Lo streaming (b.352) ha
  // due stati «la mia voce non e' partita» / «quella del partner non
  // arrivera» e un messaggio DataChannel `interpreter-voce-mancata` per
  // dirselo. Il ripiego a blocchi invece lanciava un evento finestra
  // `bartalk:voce-non-disponibile` che NESSUNO ascolta (0 listener in
  // tutta l'app) e ignorava `interpreter-voce-mancata` in ricezione:
  // due contratti per lo stesso caso, uno dei due muto. Ora il ripiego
  // usa lo stesso contratto dello streaming. Trovato dall'audit di
  // architettura b.598 (sovrapposizione 4.8).
  const [voceGuastaLegacy, setVoceGuastaLegacy] = useState(false);
  const [partnerVoceMancataLegacy, setPartnerVoceMancataLegacy] = useState(false);
  const voceMancataTimerRef = useRef(null);
  const [mySubtitles, setMySubtitles] = useState([]);
  const [partnerSubtitles, setPartnerSubtitles] = useState([]);
  const [lastSubtitle, setLastSubtitle] = useState(null);
  const daRendereRef = useRef(null);        // b.277 — la copia del microfono unico da rendere

  const recorderRef = useRef(null);
  const giroTimerRef = useRef(null);   // b.610 — il temporizzatore del giro di registrazione
  // b.634 — il taglio a voce: quando ha cominciato questo giro, se ci ha
  // parlato qualcuno, il temporizzatore della pausa, e se il blocco va
  // buttato invece che consegnato.
  const inizioGiroRef = useRef(0);
  const haParlatoRef = useRef(false);
  const silenzioTimerRef = useRef(null);
  const scartaGiroRef = useRef(false);
  const armaChiusuraRef = useRef(null);
  const streamRef = useRef(null);
  const noiseGateRef = useRef(null);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const processChunkRef = useRef(null);
  // b.247 — coda FIFO dei blocchi audio (vedi `accodaChunk`)
  const codaChunkRef = useRef([]);
  const accodaChunkRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { activeRef.current = active; }, [active]);

  // Dedup: track recently processed message fingerprints to prevent duplicate audio/subtitles
  const seenMsgsRef = useRef(new Set());
  // Track subtitle timeout IDs for cleanup on unmount
  const subtitleTimersRef = useRef([]);

  // b.599 — riassemblaggio dei pezzi audio: modulo unico.
  const riassemblatoreRef = useRef(creaRiassemblatore());

  // Cleanup stale incomplete audio buffers every 30s (prevents memory leaks)
  useEffect(() => {
    const interval = setInterval(() => {
      const tolti = riassemblatoreRef.current.pulisci(30000);
      if (tolti) log.warn('pezzi audio orfani buttati', { tolti });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Play base64 audio helper — activates ducking while playing
  // b.599 — era una COPIA divergente di quella dello streaming (i fix
  // b.381/b.404 mancavano qui, rimessi a mano in b.598). Ora e' la stessa
  // funzione per tutti e due: lib/audio/voceTradotta.js.
  const playBase64Audio = useCallback((base64Data) => {
    riproduciBase64(base64Data, { startDucking, stopDucking });
  }, [startDucking, stopDucking]);

  // Process incoming interpreter data from partner
  const handleInterpreterMessage = useCallback((msg) => {
    if (!msg) return;

    // b.598 — stesso contratto dello streaming (vedi sopra).
    if (msg.type === MSG.VOCE_MANCATA) {
      setPartnerVoceMancataLegacy(true);
      clearTimeout(voceMancataTimerRef.current);
      voceMancataTimerRef.current = setTimeout(() => setPartnerVoceMancataLegacy(false), 8000);
      return;
    }

    if (msg.type === MSG.SOTTOTITOLO) {
      // Dedup: skip if we already showed this exact subtitle recently
      const fingerprint = `sub:${msg.text}:${msg.lang}`;
      if (seenMsgsRef.current.has(fingerprint)) return;
      seenMsgsRef.current.add(fingerprint);
      // LRU: cap at 50 entries
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }

      const sub = { text: msg.text, original: msg.originalText || '', lang: msg.lang, ts: Date.now() };
      setPartnerSubtitles(prev => [...prev.slice(-20), sub]);
      // b.276 — P0: UN SOLO CONTRATTO PER IL SOTTOTITOLO.
      // Qui prima finiva una STRINGA, e la schermata della videochiamata
      // le chiedeva "originale" e "tradotto" — due campi che una stringa
      // non ha. Risultato: la traduzione era giusta e il sottotitolo
      // restava vuoto. Ora esce sempre una scheda con gli stessi campi,
      // da tutti e due i percorsi.
      setLastSubtitle(sub);
      // Auto-clear after 8s — track timer for cleanup on unmount
      const timerId = setTimeout(() => {
        setLastSubtitle(prev => (prev && prev.text === msg.text) ? null : prev);
        subtitleTimersRef.current = subtitleTimersRef.current.filter(id => id !== timerId);
      }, 8000);
      subtitleTimersRef.current.push(timerId);
    }

    // Single audio message (fits in one DC frame)
    if (msg.type === MSG.AUDIO && msg.data) {
      // Dedup: skip if we already played this audio (first 40 chars as fingerprint)
      const audioFp = `audio:${msg.data.substring(0, 40)}`;
      if (seenMsgsRef.current.has(audioFp)) return;
      seenMsgsRef.current.add(audioFp);
      if (seenMsgsRef.current.size > 50) {
        seenMsgsRef.current.delete(seenMsgsRef.current.values().next().value);
      }
      playBase64Audio(msg.data);
    }

    // Chunked audio message (split across multiple DC frames)
    if (msg.type === MSG.AUDIO_PARTE) {
      // b.599 — riassemblaggio: modulo unico.
      const intero = riassemblatoreRef.current.aggiungi(msg);
      if (intero) playBase64Audio(intero);
    }
  }, [playBase64Audio]);

  // Process a single audio chunk: STT → Translate → TTS → Send
  //
  // b.247 — qui c'era `if (!activeRef.current || processingRef.current) return;`
  // e quel `processingRef.current` BUTTAVA VIA il blocco. Il MediaRecorder ne
  // consegna uno ogni 3 secondi (CHUNK_DURATION), ma la catena
  // STT → traduzione → TTS → base64 → DataChannel spesso ci mette di piu: il
  // blocco successivo arrivava mentre il precedente era ancora in viaggio e
  // spariva senza un rigo di registro. Su rete lenta si perdevano frasi
  // intere, in silenzio — in un interprete e il difetto peggiore possibile,
  // perche chi parla non ha modo di accorgersene.
  // Ora chi decide l'ordine e la coda (`accodaChunk` / `elaboraCoda`) e
  // `processingRef` serve solo a garantire che si elabori uno per volta.
  const processChunk = useCallback(async (blob) => {
    if (!activeRef.current) return;
    if (!blob || blob.size < BYTE_MINIMI_BLOCCO_CON_VOCE) return; // blocchi vuoti o di solo silenzio (b.615)

    try {
      // 1. STT — Transcribe audio
      // /api/transcribe reads userToken + sourceLang from formData (NOT headers)
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');
      formData.append('sourceLang', myLang);
      if (userToken) formData.append('userToken', userToken);
      if (roomId) formData.append('roomId', roomId);
      // b.161 — senza questo, resolveAuth rifiuta con 401 il percorso
      // roomId (vedi apiAuth.js, punto 2 quarto audit).
      if (roomId && roomSessionTokenRef?.current) formData.append('roomSessionToken', roomSessionTokenRef.current);

      // b.598 — IL SILENZIO SPIEGATO ANCHE QUI. Un fallimento della
      // trascrizione (network, circuito aperto, o "audio corrotto"
      // risposto da Whisper) usciva da qui con un `return` muto: il
      // blocco spariva, nessun log visibile all'utente, nessun retry.
      // Ora si conta: tre fallimenti DI FILA (non uno isolato — un
      // blocco storto ogni tanto e normale) accendono problemaAudio,
      // che la UI legge (vedi VideoCallOverlay). Il primo blocco che
      // passa lo rispegne.
      let sttRes;
      try {
        sttRes = await apiCircuitBreaker.execute('interpreter-stt', () =>
          // b.363 — nessuna scadenza: un pezzo di audio appeso teneva
          // occupata la coda dell'interprete e la voce non ripartiva piu.
          fetch('/api/transcribe', { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) })
        );
      } catch (e) {
        log.warn('[Interpreter] STT fetch fallita:', e?.message || e);
        audioFallitiRef.current++;
        if (audioFallitiRef.current >= 3) setProblemaAudio(true);
        return;
      }

      if (!sttRes.ok) {
        audioFallitiRef.current++;
        if (audioFallitiRef.current >= 3) setProblemaAudio(true);
        return;
      }
      audioFallitiRef.current = 0;
      setProblemaAudio(false);
      // b.363 — corpo non-JSON (il 429 del guardiano risponde in HTML):
      // la lettura esplodeva dentro il try e il pezzo di conversazione
      // spariva senza lasciare traccia.
      const { original: transcript } = await sttRes.json().catch(() => ({}));
      if (!transcript || transcript.trim().length < 2) { return; }

      // Add to my subtitles
      const mySub = { text: transcript, lang: myLang, ts: Date.now() };
      setMySubtitles(prev => [...prev.slice(-20), mySub]);

      // 2. Translate — /api/translate expects sourceLang/targetLang/userToken in JSON body
      const translateRes = await apiCircuitBreaker.execute('interpreter-translate', () =>
        fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            sourceLang: myLang,
            targetLang: partnerLang,
            userToken: userToken || '',
            roomId,
            roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
          }),
          // b.363 — traduzione senza scadenza: restava appesa e la
          // conversazione si fermava a meta frase.
          signal: AbortSignal.timeout(30000),
        })
      );

      if (!translateRes.ok) { return; }
      // b.363 — vedi la trascrizione: corpo non-JSON non deve far
      // esplodere il giro, deve solo saltare il pezzo.
      const risposta = await translateRes.json().catch(() => ({}));
      // b.363 — LA TRAPPOLA DEL "200 CHE MENTE": traduzione respinta dal
      // controllo qualita = 200 col testo ORIGINALE. Qui il testo va sia nel
      // sottotitolo dell'interlocutore sia in bocca alla voce sintetica: si
      // sarebbe sentito parlare nella lingua di partenza credendo di
      // ascoltare una traduzione. Meglio niente che una bugia.
      if (risposta?.validationFailed) { return; }
      const { translated } = risposta;
      if (!translated) { return; }

      // b.277 — P1: IL TESTO NON ASPETTA LA VOCE.
      // Il sottotitolo era pronto qui, ma partiva solo DOPO la sintesi
      // vocale e la conversione dell'audio: chi leggeva aspettava
      // secondi per un testo che esisteva gia. Ora il sottotitolo parte
      // subito; la voce lo raggiunge quando e pronta.
      if (webrtc?.sendDirectMessage) {
        webrtc.sendDirectMessage({
          type: MSG.SOTTOTITOLO,
          text: translated,
          lang: partnerLang,
          originalText: transcript,
          originalLang: myLang,
        });
      }

      // 3. TTS — Generate audio of translation
      //
      // b.381 — IL RIPIEGO TORNAVA ALLA VECCHIA ARCHITETTURA: un solo
      // motore e un `return` muto. b.598: campo `lang` che ElevenLabs
      // non leggeva. b.599 — la richiesta ai due motori (ordine, due
      // tentativi, 402, 204, circuit breaker) e' la STESSA funzione dello
      // streaming: lib/audio/voceTradotta.js. Le divergenze fra le due
      // copie sono finite.
      const { blob: ttsBlob, motivo } = await chiediVoce(translated, {
        langCode: partnerLang, roomId,
        roomSessionToken: roomSessionTokenRef?.current,
        userToken, preferisciEleven,
      });
      if (motivo === 'niente-da-dire') return;   // b.552 — sole emoji/punteggiatura
      if (!ttsBlob) {
        // b.381 — il silenzio era la cosa peggiore: chi parla continuava a
        // parlare credendo che dall'altra parte si sentisse.
        log.warn('[interprete] nessun motore vocale disponibile: la traduzione resta scritta');
        lancia(EVENTO.VOCE_NON_DISPONIBILE);
        // b.598 — l'evento sopra non lo ascolta nessuno: si dice anche
        // nel modo che la UI e il partner capiscono davvero (b.352).
        try { webrtc?.sendDirectMessage?.({ type: MSG.VOCE_MANCATA }); } catch { /* canale chiuso: il sottotitolo e' gia partito */ }
        setVoceGuastaLegacy(true);
        setTimeout(() => setVoceGuastaLegacy(false), 8000);
        return;
      }
      // 4. Send via DataChannel to partner — b.277 il sottotitolo e gia
      // partito, qui viaggia solo la voce. b.599: base64 e pezzi da 10 KB
      // nel modulo unico.
      inviaAudioDC(webrtc, await blobABase64(ttsBlob));
    } catch (e) {
      log.warn('[Interpreter] Process chunk error:', e);
    }
  }, [myLang, partnerLang, roomId, roomSessionTokenRef, userToken, webrtc, preferisciEleven]);

  // Keep processChunkRef in sync so recorder.ondataavailable always calls latest version
  // (avoids stale closure if myLang/partnerLang/userToken change mid-recording)
  useEffect(() => { processChunkRef.current = processChunk; }, [processChunk]);

  // ═══ CODA FIFO DEI BLOCCHI AUDIO (b.247) ═══
  // Elabora la coda un blocco alla volta, in ordine di arrivo. Non salta
  // niente: se e in corso un'elaborazione questa chiamata torna subito e il
  // ciclo gia avviato prendera in carico anche i blocchi appena accodati.
  const elaboraCoda = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (codaChunkRef.current.length > 0 && activeRef.current) {
        const blob = codaChunkRef.current.shift();
        await processChunkRef.current?.(blob);
      }
    } finally {
      processingRef.current = false;
      // Se nel frattempo l'interprete e stato spento, quello che resta in
      // coda e roba di una conversazione finita: non si consegna.
      if (!activeRef.current) codaChunkRef.current = [];
    }
  }, []);

  // Accoda un blocco e fa ripartire l'elaborazione.
  // Il tetto MAX_CODA_CHUNK esiste perche una coda che cresce all'infinito
  // e un altro modo di rompersi: si finisce a tradurre, con un minuto di
  // ritardo, frasi a cui nessuno risponde piu. Quando si supera si butta il
  // PIU VECCHIO (la conversazione recente conta piu di quella vecchia) e lo
  // si DICHIARA in console: il difetto originale non era lo scarto, era lo
  // scarto in SILENZIO.
  const accodaChunk = useCallback((blob) => {
    if (!activeRef.current) return;
    if (!blob || blob.size < BYTE_MINIMI_BLOCCO_CON_VOCE) return; // blocchi vuoti o di solo silenzio (b.615)
    codaChunkRef.current.push(blob);
    if (codaChunkRef.current.length > MAX_CODA_CHUNK) {
      const scartati = codaChunkRef.current.length - MAX_CODA_CHUNK;
      codaChunkRef.current.splice(0, scartati);
      log.warn(`[Interpreter] b.247 — coda STT piena (max ${MAX_CODA_CHUNK}): scartati ${scartati} blocchi audio, i piu vecchi. La catena STT/traduzione/TTS non tiene il passo del microfono.`);
    }
    elaboraCoda();
  }, [elaboraCoda]);

  useEffect(() => { accodaChunkRef.current = accodaChunk; }, [accodaChunk]);

  // Start recording + processing loop
  const startInterpreter = useCallback(async () => {
    try {
      // b.277 — copia dal microfono unico, ripiego sull'apertura diretta.
      let rawStream;
      try { rawStream = await prendiVoce(); daRendereRef.current = rawStream; }
      catch { rawStream = await navigator.mediaDevices.getUserMedia({ audio: true }); daRendereRef.current = null; }
      streamRef.current = rawStream;

      // Apply noise gate for cleaner STT in noisy environments
      // b.598 — onCambio avvisa la stanza appena l'utente COMINCIA a
      // parlare (non quando la traduzione e pronta, secondi dopo):
      // vedi avvisaVoceLocale in cima al file.
      let recordStream = rawStream;
      // b.634 — il cancello del rumore ha adesso DUE mestieri con lo
      // stesso segnale: dire alla stanza che sto parlando (b.598, per
      // l'attenuazione) e dire al registratore quando la frase e finita.
      // Un rilevatore solo, due ascoltatori: non se ne aggiunge un altro.
      const suVoce = (parlando) => {
        try { avvisaVoceLocale(parlando); } catch { /* nessun ascoltatore: il taglio prosegue */ }
        if (!activeRef.current) return;
        if (parlando) {
          haParlatoRef.current = true;
          // ha ripreso a parlare: la pausa non era la fine della frase
          if (silenzioTimerRef.current) { clearTimeout(silenzioTimerRef.current); silenzioTimerRef.current = null; }
          return;
        }
        armaChiusuraRef.current?.();
      };
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45, onCambio: suVoce });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch (e) {
        log.warn('[Interpreter] Noise gate unavailable, using raw stream:', e);
      }
      // Senza cancello non si sa quando si parla: si torna al taglio a
      // orologio, e si assume che ogni giro contenga voce (altrimenti si
      // butterebbe tutto).
      const senzaCancello = !noiseGateRef.current;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // ═══ b.610 — IL REGISTRATORE VA A GIRI, NON A FETTE. ═══
      // Trovato dal vivo (collaudo 03/09, registri Vercel alla mano): con
      // `recorder.start(3000)` il MediaRecorder consegna FETTE di un unico
      // file WebM — e solo la PRIMA porta l'intestazione (EBML, tracce).
      // Le fette dopo sono cluster nudi: Whisper le rifiuta tutte con
      // «400 Audio file might be corrupted or unsupported» (durata
      // dichiarata 0). Nei registri: primo blocco 200, poi 500 a
      // ripetizione ogni 3 secondi — i ~205 errori/7gg di b.597 e il
      // «poi non traduce» di Luca. Con la chiave Deepgram assente in
      // produzione (stt-token 503) QUESTO era l'unico percorso vivo, quindi
      // l'interprete in videochiamata traduceva al massimo i primi 3
      // secondi. Ora ogni giro e' un registratore nuovo: start() senza
      // fetta, stop() dopo CHUNK_DURATION, e il blocco consegnato e' un
      // file WebM intero, con la sua intestazione. Il flusso resta lo
      // stesso, il giro dopo parte da onstop: nessun buco udibile.
      codaChunkRef.current = [];

      // b.634 — CHIUDE IL GIRO. `scarta` vero (o nessuna voce in questo
      // giro) vuol dire: fermati e NON consegnare niente. Il registratore
      // successivo parte comunque da onstop, quindi non resta mai un
      // momento in cui il microfono non e registrato.
      const chiudiGiro = (scarta = false) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state !== 'recording') return;
        scartaGiroRef.current = scarta || !haParlatoRef.current;
        try { recorder.stop(); } catch { /* era gia fermo: il giro dopo parte da onstop */ }
      };

      // b.634 — ARMA LA CHIUSURA quando cala il silenzio. Se la frase e
      // ancora troppo corta non si chiude: si aspetta il tempo che
      // manca, cosi un «si» isolato non si porta via un giro intero.
      // Ogni ripresa di voce disarma (vedi `suVoce`).
      const armaChiusura = () => {
        if (!activeRef.current || !haParlatoRef.current) return;
        if (silenzioTimerRef.current) return;
        const trascorso = Date.now() - inizioGiroRef.current;
        const attesa = Math.max(CODA_SILENZIO_MS, MIN_FRASE_MS - trascorso);
        silenzioTimerRef.current = setTimeout(() => {
          silenzioTimerRef.current = null;
          chiudiGiro();
        }, attesa);
      };
      armaChiusuraRef.current = armaChiusura;

      const avviaGiro = () => {
        let recorder;
        try { recorder = new MediaRecorder(recordStream, { mimeType }); }
        catch (e) { log.error('[Interpreter] MediaRecorder non parte:', e); return; }
        recorderRef.current = recorder;
        // b.634 — un giro nuovo comincia sempre da zero: nessuna voce
        // ancora sentita, niente da scartare, e l'ora di partenza per
        // sapere quanto e lungo.
        inizioGiroRef.current = Date.now();
        haParlatoRef.current = senzaCancello;
        scartaGiroRef.current = false;
        if (silenzioTimerRef.current) { clearTimeout(silenzioTimerRef.current); silenzioTimerRef.current = null; }
        // b.247 — il blocco non si elabora qui: si ACCODA.
        recorder.ondataavailable = (e) => {
          // b.634 — giro senza voce: si butta qui, prima della coda. E il
          // giro che prima costava una trascrizione, una traduzione e una
          // sintesi per non dire niente.
          if (scartaGiroRef.current) return;
          if (e.data && e.data.size > 0 && activeRef.current) accodaChunkRef.current?.(e.data);
        };
        recorder.onstop = () => {
          if (recorderRef.current !== recorder) return;   // fermato dallo stop vero: niente giro dopo
          if (activeRef.current) avviaGiro();
        };
        try { recorder.start(); } catch (e) { log.error('[Interpreter] start() rifiutato:', e); return; }
        // b.634 — il tetto: chi non si ferma mai viene spezzato lo stesso.
        // Senza cancello del rumore questo tetto E il taglio.
        giroTimerRef.current = setTimeout(() => {
          giroTimerRef.current = null;
          chiudiGiro();
        }, senzaCancello ? TETTO_SENZA_CANCELLO_MS : MAX_FRASE_MS);
      };
      activeRef.current = true;
      avviaGiro();
      setActive(true);
      setErroreAvvio(null);
      audioFallitiRef.current = 0;
      setProblemaAudio(false);
      log.debug('[Interpreter] Started');
    } catch (e) {
      log.error('[Interpreter] Failed to start:', e);
      setErroreAvvio(e?.message || 'avvio non riuscito');
      setActive(false);
      // b.381 — IL MICROFONO RESTAVA APERTO. Qui si prende il microfono
      // per PRIMA cosa, e solo dopo si costruiscono il filtro del rumore
      // e il registratore. Se qualcosa falliva DOPO la presa — e li ci
      // sono due passaggi che possono fallire — questo catch si limitava
      // a scrivere nel registro e a spegnere una spia: il microfono
      // restava acceso, con la spia rossa del telefono accesa e nessuno
      // schermo che dicesse perche.
      //
      // Si chiude tutto quello che potrebbe essere rimasto aperto, nello
      // stesso ordine in cui lo chiude lo stop normale.
      clearTimeout(giroTimerRef.current); giroTimerRef.current = null;
      // b.634 — anche il temporizzatore della pausa: senza questo, una
      // chiusura armata potrebbe fermare un registratore di una
      // conversazione gia chiusa.
      clearTimeout(silenzioTimerRef.current); silenzioTimerRef.current = null;
      armaChiusuraRef.current = null;
      const registratoreAvvio = recorderRef.current;
      recorderRef.current = null;
      try {
        if (registratoreAvvio && registratoreAvvio.state !== 'inactive') registratoreAvvio.stop();
      } catch { /* il registratore non era mai partito: niente da fermare */ }
      if (noiseGateRef.current) {
        try { noiseGateRef.current.destroy(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
        noiseGateRef.current = null;
      }
      if (daRendereRef.current) {
        try { rendiVoce(daRendereRef.current); } catch { /* il microfono condiviso era gia stato reso */ }
        daRendereRef.current = null;
      } else if (streamRef.current) {
        // microfono preso in proprio (non dal condiviso): si spegne qui
        try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* tracce gia ferme */ }
      }
      streamRef.current = null;
    }
  }, []);

  // Stop recording
  const stopInterpreter = useCallback(() => {
    clearTimeout(voceMancataTimerRef.current);
    setActive(false);
    // b.247 — activeRef si allinea solo al render successivo: qui lo si
    // mette a posto subito, altrimenti un blocco consegnato in questo
    // istante dal MediaRecorder finirebbe ancora in coda. Poi la coda si
    // svuota: e parlato di una conversazione chiusa.
    activeRef.current = false;
    codaChunkRef.current = [];
    // b.610 — prima il temporizzatore e il ref, poi lo stop: onstop non
    // deve far ripartire un giro su una sessione chiusa.
    clearTimeout(giroTimerRef.current); giroTimerRef.current = null;
      // b.634 — anche il temporizzatore della pausa: senza questo, una
      // chiusura armata potrebbe fermare un registratore di una
      // conversazione gia chiusa.
      clearTimeout(silenzioTimerRef.current); silenzioTimerRef.current = null;
      armaChiusuraRef.current = null;
    const ultimoRegistratore = recorderRef.current;
    recorderRef.current = null;
    if (ultimoRegistratore && ultimoRegistratore.state !== 'inactive') {
      try { ultimoRegistratore.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
    }
    if (noiseGateRef.current) {
      try { noiseGateRef.current.destroy(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      noiseGateRef.current = null;
    }
    if (streamRef.current) {
      // b.277 — se era una copia del microfono unico si rende al master.
      if (daRendereRef.current === streamRef.current) { rendiVoce(streamRef.current); daRendereRef.current = null; }
      else streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      streamRef.current = null;
    }
    audioFallitiRef.current = 0;
    setProblemaAudio(false);
    log.debug('[Interpreter] Stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // b.247 — vedi stopInterpreter: chi se ne va non deve lasciare blocchi
      // audio in attesa di essere tradotti.
      activeRef.current = false;
      codaChunkRef.current = [];
      clearTimeout(giroTimerRef.current); giroTimerRef.current = null;
      // b.634 — anche il temporizzatore della pausa: senza questo, una
      // chiusura armata potrebbe fermare un registratore di una
      // conversazione gia chiusa.
      clearTimeout(silenzioTimerRef.current); silenzioTimerRef.current = null;
      armaChiusuraRef.current = null;   // b.610
      const registratoreSmontaggio = recorderRef.current;
      recorderRef.current = null;
      if (registratoreSmontaggio && registratoreSmontaggio.state !== 'inactive') {
        try { registratoreSmontaggio.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      }
      if (streamRef.current) {
        // b.277 — se era una copia del microfono unico si rende al master.
      if (daRendereRef.current === streamRef.current) { rendiVoce(streamRef.current); daRendereRef.current = null; }
      else streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      }
      // Clear all pending subtitle timers
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
    };
  }, []);

  // Auto-stop when webrtc disconnects
  useEffect(() => {
    if (webrtc?.webrtcState !== 'connected' && active) {
      stopInterpreter();
    }
  }, [webrtc?.webrtcState, active, stopInterpreter]);

  // ═══ STREAMING INTERPRETER (subtitle-first pipeline) ═══
  const streaming = useStreamingInterpreter({
    webrtc, myLang, partnerLang, roomId, roomSessionTokenRef, userToken,
    conversationContext,
    startDucking, stopDucking,
    preferisciEleven,
  });

  // ═══ UNIFIED API ═══
  // Try streaming first; if Deepgram unavailable, fall back to legacy chunks
  // b.277 — P1: l'avvio dura qualche secondo (permesso microfono, presa
  // di linea con chi trascrive) e in quel tempo `active` e ancora falso:
  // un ridisegno della schermata poteva far ripartire l'avvio SOPRA
  // quello in corso — due microfoni, due trascrizioni, doppio consumo.
  // Ora un avvio in corso chiude la porta al successivo.
  const avvioInCorsoRef = useRef(false);
  const startUnifiedInterno = useCallback(async () => {
    const streamingOk = await streaming.start();
    if (streamingOk) {
      setErroreAvvio(null);
      log.debug('[Interpreter] Using streaming pipeline (subtitle-first)');
      return;
    }
    // Fallback to legacy chunk-based pipeline
    log.debug('[Interpreter] Streaming unavailable, using legacy 3s chunks');
    // b.381 — SI ASPETTA. Questa funzione e asincrona (chiede il
    // microfono, apre il registratore) ma veniva lanciata e lasciata
    // andare: il `finally` di chi chiama riapriva la porta subito, e
    // dentro quella finestra un secondo avvio poteva entrare mentre il
    // microfono del primo non era ancora pronto — due microfoni, due
    // trascrizioni, doppio consumo.
    //
    // E' esattamente la corsa che il commento qui sopra dice di voler
    // evitare: il lucchetto c'era, ma si apriva troppo presto.
    await startInterpreter();
  }, [streaming.start, startInterpreter]);

  const startUnified = useCallback(async () => {
    if (avvioInCorsoRef.current) return;
    avvioInCorsoRef.current = true;
    try { await startUnifiedInterno(); }
    finally { avvioInCorsoRef.current = false; }
  }, [startUnifiedInterno]);

  const stopUnified = useCallback(() => {
    if (streaming.active) streaming.stop();
    else stopInterpreter();
  }, [streaming.active, streaming.stop, stopInterpreter]);

  const unifiedActive = active || streaming.active;
  const isStreaming = streaming.active;

  // Route incoming messages to the right handler
  const handleUnifiedMessage = useCallback((msg) => {
    if (streaming.active) {
      streaming.handleIncomingMessage(msg);
    } else {
      handleInterpreterMessage(msg);
    }
  }, [streaming.active, streaming.handleIncomingMessage, handleInterpreterMessage]);

  return {
    active: unifiedActive,
    isStreaming,
    setActive,
    mySubtitles: isStreaming ? streaming.mySubtitles : mySubtitles,
    partnerSubtitles: isStreaming ? streaming.partnerSubtitles : partnerSubtitles,
    // b.276 — la stessa scheda in tutti e due i percorsi: chi disegna non
    // deve piu indovinare se gli arriva una stringa o un oggetto.
    lastSubtitle: isStreaming
      ? (streaming.partnerLiveSubtitle
        ? { text: streaming.partnerLiveSubtitle, original: streaming.partnerLiveOriginale || '', ts: Date.now() }
        : null)
      : lastSubtitle,
    myLiveText: streaming.myLiveText,
    partnerLiveSubtitle: streaming.partnerLiveSubtitle,
    start: startUnified,
    stop: stopUnified,
    handleInterpreterMessage: handleUnifiedMessage,
    // b.352 — il silenzio spiegato: la voce non partita si dichiara.
    voceGuasta: streaming.voceGuasta || voceGuastaLegacy,
    partnerVoceMancata: streaming.partnerVoceMancata || partnerVoceMancataLegacy,
    // b.527 — il guasto d'avvio, leggibile dalla UI (vedi sopra).
    erroreAvvio,
    // b.598 — vero solo nella pipeline a blocchi (Whisper): la
    // pipeline in streaming usa Deepgram via WebSocket e non passa mai
    // da /api/transcribe, quindi qui semplicemente non si accende mai.
    problemaAudio,
  };
}

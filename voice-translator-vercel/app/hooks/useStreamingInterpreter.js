'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getLang } from '../lib/constants.js';
import { createNoiseGate } from '../lib/noiseGate.js';
import { deepgramAmmesso, USO } from '../lib/sttPolicy.js';
import { createLogger } from '../lib/logger.js';
import { getVoceChiamata, getVolumeTTS } from '../lib/audioPrefs.js';
import { prendiVoce, rendiVoce } from '../lib/microfonoMaster.js';
const dbg = createLogger('streaming');

// ═══════════════════════════════════════════════════════════════
// useStreamingInterpreter — Subtitle-First + TTS a Frase
//
// Pipeline per modalità faccia-a-faccia:
// 1. Deepgram WebSocket STT streaming → trascrizioni interim/final
// 2. Ogni frase final (is_final + pausa) → traduzione con context → subtitle
// 3. Fine frase (utterance_end o pausa >800ms) → TTS sulla traduzione completa
// 4. Il partner vede subtitle in real-time, sente voce per frase completata
//
// Sfrutta la conversation memory per traduzione speculativa:
// - Il LLM sa di cosa si parla (context tags + ultimi 10 messaggi)
// - Frammenti parziali tradotti con alta confidenza grazie al contesto
// ═══════════════════════════════════════════════════════════════

const SENTENCE_PAUSE_MS = 800;       // Pausa che indica fine frase → trigger TTS
const MIN_WORDS_FOR_TRANSLATE = 2;   // Minimo parole per avviare traduzione chunk
const MAX_SUBTITLE_AGE_MS = 10000;   // Auto-clear subtitle dopo 10s
const TRANSLATE_DEBOUNCE_MS = 300;   // Debounce tra traduzioni incrementali

export default function useStreamingInterpreter({
  webrtc,
  myLang,
  partnerLang,
  roomId,
  roomSessionTokenRef,
  userToken,
  conversationContext,  // { getContext, addMessage }
  startDucking,
  stopDucking,
  // b.352 — la voce PREMIUM in chiamata finalmente esiste: quando la
  // preferenza dell'utente e ElevenLabs, l'interprete la usa per primo.
  preferisciEleven = false,
}) {
  const [active, setActive] = useState(false);
  const [myLiveText, setMyLiveText] = useState('');           // Testo STT in tempo reale (mio)
  // b.276 — P0: PRIMA QUESTO CONTENITORE ERA UNO SOLO per due cose
  // diverse: la traduzione di cio che dico IO (da mandare al partner) e
  // la traduzione di cio che dice LUI (da mostrare a me). Il mio testo
  // poteva comparire nello spazio col nome dell'altro, e sparire appena
  // lui parlava davvero. Ora sono due, e la videochiamata mostra il suo.
  const [partnerLiveSubtitle, setPartnerLiveSubtitle] = useState('');   // cio che dice LUI, tradotto per me
  const [miaTraduzione, setMiaTraduzione] = useState('');               // cio che dico IO, tradotto per lui
  // b.276 — P0: l'originale di cio che dice il partner viaggia gia nel
  // messaggio (originalText) ma non veniva tenuto: la videochiamata lo
  // chiedeva e trovava il vuoto.
  const [partnerLiveOriginale, setPartnerLiveOriginale] = useState('');
  const [mySubtitles, setMySubtitles] = useState([]);         // Cronologia subtitle miei
  const [partnerSubtitles, setPartnerSubtitles] = useState([]); // Cronologia subtitle partner

  // Refs
  const activeRef = useRef(false);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const noiseGateRef = useRef(null);
  const convContextRef = useRef(conversationContext);

  // Sentence accumulator
  const currentSentenceRef = useRef('');
  const daRendereRef = useRef(null);        // b.277 — la copia del microfono unico da rendere    // Frase corrente accumulata da final transcripts
  // b.276 — P1: ogni frase ha un numero. Una traduzione parziale che
  // torna dopo che la frase e gia stata chiusa appartiene a un numero
  // vecchio e viene buttata: prima poteva sovrascrivere il testo finale
  // con un pezzo di frase a meta.
  const numeroFraseRef = useRef(0);
  // b.276 — P0: la frase in lavorazione, per non lavorarla due volte
  // (la pausa e il segnale di fine discorso possono arrivare insieme).
  const fraseInLavorazioneRef = useRef(null);
  const interimTextRef = useRef('');         // Ultimo interim (preview)
  const lastFinalTimeRef = useRef(0);        // Timestamp ultimo final transcript
  const sentencePauseTimerRef = useRef(null); // Timer per detect fine frase
  const translateTimerRef = useRef(null);     // Debounce traduzione
  const currentTranslationRef = useRef('');   // Traduzione corrente della frase in corso
  const ttsQueueRef = useRef([]);             // Coda TTS frasi completate
  const processingTTSRef = useRef(false);
  const deepgramKeyRef = useRef(null);

  // Subtitle cleanup timers
  const subtitleTimersRef = useRef([]);

  // Sync refs
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { convContextRef.current = conversationContext; }, [conversationContext]);

  // ═══ FETCH DEEPGRAM KEY ═══
  useEffect(() => {
    // b.247 — la decisione «Deepgram si o no» era scritta in DUE posti che
    // non si parlavano: useDeepgramSTT.js la spegneva (b.172) e questo file
    // chiamava /api/stt-token lo stesso. Ora la risposta e una sola e sta in
    // lib/sttPolicy.js; qui ci si limita a chiederla.
    if (!deepgramAmmesso(USO.INTERPRETE)) return;
    // b.161 — roomSessionToken obbligatorio per il percorso roomId (vedi
    // stt-token/route.js, punto 2 quarto audit).
    // b.363 — chiamata senza scadenza: se restava appesa la chiave
    // Deepgram non arrivava mai e l'interprete non partiva, in silenzio.
    // La lettura del corpo ora e protetta: una pagina d'errore al posto
    // del JSON faceva esplodere la catena invece di ripiegare su null.
    fetch('/api/stt-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, roomId, roomSessionToken: roomSessionTokenRef?.current || undefined }), signal: AbortSignal.timeout(10000) }).then(r => r.ok ? r.json().catch(() => null) : null)
      .then(d => { if (d?.key) deepgramKeyRef.current = d.key; })
      .catch(e => console.warn('[Interpreter] STT token failed:', e.message));
  }, [userToken, roomId, roomSessionTokenRef]);

  // ═══ INCREMENTAL TRANSLATION ═══
  // Traduce un frammento di frase con il conversation context
  const translateChunk = useCallback(async (text, isFinal = false) => {
    if (!text || text.trim().length < 3) return '';
    try {
      const context = convContextRef.current?.getContext?.() || '';
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          sourceLang: myLang,
          targetLang: partnerLang,
          sourceLangName: getLang(myLang)?.name || myLang,
          targetLangName: getLang(partnerLang)?.name || partnerLang,
          userToken: userToken || '',
          roomId,
          // b.161 — obbligatorio per il percorso roomId (vedi apiAuth.js,
          // punto 2 quarto audit).
          roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
          conversationContext: context,
          // Hint per il modello: frammento parziale vs frase completa
          fragmentHint: isFinal ? undefined : 'partial',
        }),
        // b.363 — traduzione senza scadenza: un frammento appeso teneva
        // fermi i sottotitoli in tempo reale senza mai fallire.
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return '';
      // b.363 — corpo non-JSON (il 429 del guardiano risponde in HTML):
      // la lettura esplodeva e il frammento spariva nel catch generico.
      const data = await res.json().catch(() => ({}));
      // b.363 — LA TRAPPOLA DEL "200 CHE MENTE": traduzione respinta dalla
      // validazione = 200 con il testo ORIGINALE. Restituirlo qui faceva
      // comparire nei sottotitoli in tempo reale la frase non tradotta,
      // indistinguibile da una traduzione riuscita.
      if (data.validationFailed) return '';
      return data.translated || '';
    } catch {
      return '';
    }
  }, [myLang, partnerLang, roomId, roomSessionTokenRef, userToken]);

  // ═══ SEND SUBTITLE TO PARTNER ═══
  const sendSubtitleToPartner = useCallback((translatedText, originalText, isFinal) => {
    if (!webrtc?.sendDirectMessage || !translatedText) return;
    webrtc.sendDirectMessage({
      type: 'interpreter-subtitle',
      text: translatedText,
      lang: partnerLang,
      originalText,
      originalLang: myLang,
      isFinal: !!isFinal,  // Partner sa se è parziale o finale
    });
  }, [webrtc, myLang, partnerLang]);

  // ═══ TTS + SEND AUDIO ═══
  // b.352 — RIFATTO (collaudo di Luca: «la voce non parte, non va niente»).
  // Prima: SOLO la voce edge, e a un fallimento (successo oggi, 503) si
  // taceva per sempre — sottotitoli vivi, voce morta, nessun avviso. E la
  // voce premium ElevenLabs in chiamata NON esisteva proprio.
  // Ora: il motore preferito prova per primo (premium se l'utente l'ha
  // scelta), l'altro fa da ripiego, ognuno con una seconda possibilita.
  // Se TUTTO fallisce, il partner riceve l'avviso "voce non disponibile"
  // invece del silenzio inspiegabile.
  const preferisciElevenRef = useRef(false);
  useEffect(() => { preferisciElevenRef.current = !!preferisciEleven; }, [preferisciEleven]);
  const [voceGuasta, setVoceGuasta] = useState(false);
  const [partnerVoceMancata, setPartnerVoceMancata] = useState(false);
  const voceMancataTimerRef = useRef(null);
  const audioCorrenteRef = useRef(null);

  const chiediVoce = useCallback(async (testo) => {
    // b.530 — la voce SCELTA (pannello Volumi della chiamata) si legge
    // a ogni frase: cambiarla a meta chiamata vale dalla frase dopo.
    // Una voce con nome esiste solo sulla premium: se ne hai scelta
    // una, la premium prova per prima.
    const voceScelta = getVoceChiamata();
    const base = {
      text: testo, langCode: partnerLang, roomId,
      voiceId: voceScelta || undefined,
      roomSessionToken: roomId ? (roomSessionTokenRef?.current || undefined) : undefined,
      userToken: userToken || undefined,
    };
    const motori = (voceScelta || preferisciElevenRef.current)
      ? ['/api/tts-elevenlabs', '/api/tts-edge']
      : ['/api/tts-edge', '/api/tts-elevenlabs'];
    for (const rotta of motori) {
      for (let tentativo = 0; tentativo < 2; tentativo++) {
        try {
          const r = await fetch(rotta, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(base),
            // b.363 — la voce dell'interprete non aveva scadenza: una
            // richiesta appesa bloccava il giro dei due motori e chi
            // ascoltava non sentiva niente ne capiva perche.
            signal: AbortSignal.timeout(30000),
          });
          if (r.ok) return await r.blob();
          // credito esaurito sulla premium: inutile riprovarla, si passa oltre
          if (r.status === 402) break;
        } catch { /* rete inciampata: il prossimo giro riprova */ }
      }
    }
    return null;
  }, [partnerLang, roomId, roomSessionTokenRef, userToken]);

  const speakAndSend = useCallback(async (translatedText) => {
    if (!translatedText || translatedText.trim().length < 2) return;
    try {
      const ttsBlob = await chiediVoce(translatedText);
      if (!ttsBlob) {
        // Il silenzio non resta mai muto: chi ascolta vede il perche.
        webrtc?.sendDirectMessage?.({ type: 'interpreter-voce-mancata' });
        setVoceGuasta(true);
        setTimeout(() => setVoceGuasta(false), 8000);
        return;
      }
      const buffer = await ttsBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      // Send audio via DataChannel
      if (webrtc?.sendDirectMessage) {
        const MAX_DC_SIZE = 10000;
        if (base64.length <= MAX_DC_SIZE) {
          webrtc.sendDirectMessage({ type: 'interpreter-audio', data: base64 });
        } else {
          const parts = Math.ceil(base64.length / MAX_DC_SIZE);
          const id = Date.now().toString(36);
          for (let i = 0; i < parts; i++) {
            webrtc.sendDirectMessage({
              type: 'interpreter-audio-part',
              id, part: i, total: parts,
              data: base64.slice(i * MAX_DC_SIZE, (i + 1) * MAX_DC_SIZE),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[StreamInterp] TTS error:', e);
    }
  }, [webrtc, chiediVoce]);

  // ═══ TTS QUEUE PROCESSOR ═══
  // Processa la coda TTS sequenzialmente (una frase alla volta)
  const processTTSQueue = useCallback(async () => {
    if (processingTTSRef.current) return;
    processingTTSRef.current = true;
    try {
      while (ttsQueueRef.current.length > 0) {
        const item = ttsQueueRef.current.shift();
        if (item?.text) {
          // b.352 — niente attenuazione qui: il mittente non riproduce nulla
          // in locale, avvolgeva solo una chiamata di rete.
          await speakAndSend(item.text);
        }
      }
    } finally {
      processingTTSRef.current = false;
    }
  }, [speakAndSend]);

  // ═══ HANDLE SENTENCE COMPLETE ═══
  // Chiamata quando una frase è completa (pausa rilevata)
  const handleSentenceComplete = useCallback(async (sentence) => {
    if (!sentence || sentence.trim().length < 2) return;
    const trimmed = sentence.trim();
    // b.276 — P0: la stessa frase puo arrivare qui da due strade (la
    // pausa e il segnale di fine discorso di chi trascrive). Senza
    // questa guardia si traduceva due volte, si mandavano due
    // sottotitoli, si pronunciavano due voci e si pagava due volte.
    if (fraseInLavorazioneRef.current === trimmed) return;
    fraseInLavorazioneRef.current = trimmed;
    // La frase e chiusa: da qui in poi le parole nuove appartengono alla
    // frase successiva, e il numero cambia. Cosi una traduzione parziale
    // ancora in volo non puo piu sovrascrivere questa.
    numeroFraseRef.current++;

    // Traduzione finale della frase completa
    const translated = await translateChunk(trimmed, true);
    if (!translated) {
      // b.381 — UN ERRORE DI TRADUZIONE ZITTIVA LA FRASE PER SEMPRE.
      // Il segnaposto "questa la sto lavorando" veniva messo prima di
      // tradurre e ripulito molto piu in basso, DOPO tutto il resto: se
      // la traduzione falliva anche una volta sola, si usciva di qui
      // lasciandolo su. Da quel momento chi ripeteva la stessa frase —
      // ed e proprio quello che si fa quando non si e sentiti — veniva
      // scartato dalla difesa contro i doppioni.
      //
      // Il guasto era temporaneo, il silenzio no.
      fraseInLavorazioneRef.current = null;
      return;
    }

    // Update translation display
    currentTranslationRef.current = translated;
    // b.276 — P0-2: questa e la MIA voce tradotta. Va nel mio contenitore,
    // non in quello del partner.
    setMiaTraduzione(translated);

    // Send FINAL subtitle to partner
    sendSubtitleToPartner(translated, trimmed, true);

    // Add to subtitle history
    const sub = { text: translated, original: trimmed, ts: Date.now(), isFinal: true };
    setMySubtitles(prev => [...prev.slice(-20), sub]);

    // Add to conversation context (memory per disambiguation futura)
    convContextRef.current?.addMessage?.({
      sender: 'me',
      original: trimmed,
      translated,
      sourceLang: myLang,
      targetLang: partnerLang,
    });

    // Queue TTS (voce per frase completa)
    ttsQueueRef.current.push({ text: translated });
    processTTSQueue();

    // b.276 — P0-3: la frase NON si svuota piu qui. Veniva svuotata dopo
    // l'attesa della traduzione, e nel frattempo le parole nuove si erano
    // gia accumulate dentro: venivano cancellate insieme al resto, cioe
    // si perdevano pezzi di discorso. Ora chi chiude la frase la stacca
    // PRIMA di chiamare (vedi sotto), e qui non resta niente da azzerare.
    currentTranslationRef.current = '';
    fraseInLavorazioneRef.current = null;
  }, [translateChunk, sendSubtitleToPartner, myLang, partnerLang, processTTSQueue]);

  // ═══ HANDLE TRANSCRIPT FROM DEEPGRAM ═══
  const handleTranscript = useCallback((transcript, isFinal) => {
    if (!activeRef.current || !transcript) return;

    if (isFinal) {
      // Accumula nella frase corrente
      currentSentenceRef.current += (currentSentenceRef.current ? ' ' : '') + transcript;
      lastFinalTimeRef.current = Date.now();
      interimTextRef.current = '';

      // Update live text display
      setMyLiveText(currentSentenceRef.current);

      // Debounced incremental translation (subtitle preview)
      if (currentSentenceRef.current.split(/\s+/).length >= MIN_WORDS_FOR_TRANSLATE) {
        clearTimeout(translateTimerRef.current);
        translateTimerRef.current = setTimeout(async () => {
          if (!activeRef.current) return;
          // b.276 — P1: il numero della frase al momento della partenza.
          const mioNumero = numeroFraseRef.current;
          const testoAlVolo = currentSentenceRef.current;
          const partial = await translateChunk(testoAlVolo, false);
          // Se nel frattempo la frase e stata chiusa, questo parziale e
          // vecchio: si butta, invece di sovrascrivere il testo finale.
          if (mioNumero !== numeroFraseRef.current) return;
          if (partial && activeRef.current) {
            currentTranslationRef.current = partial;
            setMiaTraduzione(partial);
            // Send interim subtitle to partner
            sendSubtitleToPartner(partial, testoAlVolo, false);
          }
        }, TRANSLATE_DEBOUNCE_MS);
      }

      // Reset sentence pause timer — se non arriva nulla per SENTENCE_PAUSE_MS, la frase è finita
      clearTimeout(sentencePauseTimerRef.current);
      sentencePauseTimerRef.current = setTimeout(() => {
        // b.276 — P0-3: si stacca la frase PRIMA di mandarla a tradurre.
        const frase = currentSentenceRef.current;
        if (!frase.trim()) return;
        currentSentenceRef.current = '';
        handleSentenceComplete(frase);
      }, SENTENCE_PAUSE_MS);

    } else {
      // Interim: mostra preview ma non accumula
      interimTextRef.current = transcript;
      const preview = currentSentenceRef.current + (currentSentenceRef.current ? ' ' : '') + transcript;
      setMyLiveText(preview);
    }
  }, [translateChunk, sendSubtitleToPartner, handleSentenceComplete]);

  // ═══ HANDLE UTTERANCE END (Deepgram) ═══
  // Deepgram manda UtteranceEnd quando rileva fine discorso
  const handleUtteranceEnd = useCallback(() => {
    clearTimeout(sentencePauseTimerRef.current);
    // b.276 — P0-3/P0-4: stessa regola. Chi arriva primo stacca la frase;
    // chi arriva secondo trova il contenitore vuoto e non fa niente.
    const frase = currentSentenceRef.current;
    if (!frase.trim()) return;
    currentSentenceRef.current = '';
    handleSentenceComplete(frase);
  }, [handleSentenceComplete]);

  // ═══ ABORT COMPLETO (b.247) ═══
  // Era il difetto peggiore della modalita interprete: `start()` poteva
  // restituire false (errore del WebSocket, o scadenza dei 4 secondi)
  // LASCIANDO APERTO tutto quello che aveva gia acceso — il WebSocket, il
  // microfono di getUserMedia, l'AudioContext e lo ScriptProcessor che
  // continuava a spingere PCM dentro il socket. useInterpreterMode legge
  // quel false come «streaming non disponibile» e avvia subito la pipeline
  // a blocchi da 3 secondi: se il WebSocket Deepgram si apriva un istante
  // dopo, restavano DUE microfoni aperti e DUE trascrizioni in corso sulla
  // stessa voce — doppio consumo a pagamento, sottotitoli duplicati e
  // l'audio del dispositivo mai rilasciato.
  //
  // Qui si spegne tutto in un colpo solo. E IDEMPOTENTE: ogni pezzo viene
  // toccato solo se c'e ancora, e il ref viene azzerato subito dopo, cosi
  // chiamarla due volte (abort + stop, o abort + smontaggio) non e un
  // guasto. Nessuna dipendenza: lavora solo su ref.
  const abortaStreaming = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.onaudioprocess = null; } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      try { processorRef.current.disconnect(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (ctx.state !== 'closed') { try { ctx.close(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } }
    }
    if (noiseGateRef.current) {
      try { noiseGateRef.current.destroy(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      noiseGateRef.current = null;
    }
    if (streamRef.current) {
      const tracce = streamRef.current;
      streamRef.current = null;
      // b.277 — se la voce era una copia del microfono unico, si RENDE:
      // e il contatore del master a decidere se spegnere l'hardware.
      if (daRendereRef.current === tracce) {
        rendiVoce(tracce);
        daRendereRef.current = null;
      } else {
        tracce.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ } });
      }
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      try {
        // Si stacca prima l'ascolto: un socket in chiusura puo ancora
        // consegnare trascrizioni, e finirebbero sui sottotitoli di una
        // sessione che l'utente ha gia abbandonato.
        ws.onmessage = null; ws.onerror = null; ws.onclose = null; ws.onopen = null;
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
        ws.close();
      } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
    }
    activeRef.current = false;
    setActive(false);
  }, []);

  // ═══ START STREAMING ═══
  const start = useCallback(async () => {
    // b.247 — chi decide se Deepgram si puo usare e lib/sttPolicy.js, non
    // questo file (vedi il commento sulla fetch della chiave).
    if (!deepgramAmmesso(USO.INTERPRETE)) {
      dbg.debug('[StreamInterp] Deepgram non ammesso dalla policy: si usa la pipeline a blocchi');
      return false;
    }

    if (!deepgramKeyRef.current) {
      // Try to get key
      try {
        // b.363 — secondo tentativo per la chiave: era anch'esso senza
        // scadenza, e l'avvio dell'interprete lo aspettava.
        const res = await fetch('/api/stt-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userToken, roomId, roomSessionToken: roomSessionTokenRef?.current || undefined }), signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          // b.363 — vedi sopra: corpo non-JSON non deve far esplodere.
          const d = await res.json().catch(() => null);
          if (d?.key) deepgramKeyRef.current = d.key;
        }
      } catch (e) { console.warn('[Interpreter] STT key retry failed:', e.message); }
    }

    if (!deepgramKeyRef.current) {
      console.error('[StreamInterp] No Deepgram key available');
      return false;
    }

    try {
      // b.277 — la voce arriva dal microfono UNICO dell'applicazione,
      // come copia: niente terza apertura dell'hardware (su Android
      // faceva saltare l'eco e poteva farsi revocare il microfono).
      // Se il master non parte, si ripiega sull'apertura diretta di
      // prima: il modulo condiviso non deve mai bloccare la voce.
      let rawStream;
      try {
        rawStream = await prendiVoce();
        daRendereRef.current = rawStream;
      } catch {
        rawStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
        daRendereRef.current = null;
      }
      streamRef.current = rawStream;

      // Noise gate
      let recordStream = rawStream;
      try {
        const ng = createNoiseGate(rawStream, { threshold: -45 });
        if (ng?.cleanStream) {
          noiseGateRef.current = ng;
          recordStream = ng.cleanStream;
        }
      } catch { /* filtro del rumore non applicabile: si registra il flusso cosi com e */ }

      // Deepgram WebSocket
      const speechLang = getLang(myLang)?.speech || 'en-US';
      const dgLang = speechLang.split('-')[0];
      const params = new URLSearchParams({
        model: 'nova-2',
        language: dgLang,
        smart_format: 'true',
        interim_results: 'true',
        utterance_end_ms: String(SENTENCE_PAUSE_MS),
        endpointing: '300',  // Più aggressivo per real-time
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
      });

      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        ['token', deepgramKeyRef.current]
      );
      wsRef.current = ws;

      return new Promise((resolve) => {
        // b.247 — UNA SOLA PORTA D'USCITA da questa promessa.
        // Prima l'esito negativo si dava in due punti scollegati
        // (`ws.onerror` e un `setTimeout(..., 4000)`) e nessuno dei due
        // spegneva niente; per giunta il temporizzatore non veniva mai
        // annullato, quindi continuava a scattare anche dopo una
        // connessione riuscita. Ora: si esce una volta sola, il
        // temporizzatore si annulla, e ogni esito NEGATIVO passa
        // obbligatoriamente dall'abort completo.
        let risolto = false;
        let timerAperturaId = null;
        const concludi = (esito) => {
          if (risolto) return;
          risolto = true;
          clearTimeout(timerAperturaId);
          if (!esito) abortaStreaming();
          resolve(esito);
        };

        ws.onopen = () => {
          dbg.debug('[StreamInterp] Connected to Deepgram');

          // Audio capture → PCM16 → WebSocket
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          audioCtxRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(recordStream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const input = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            ws.send(pcm16.buffer);
          };

          source.connect(processor);
          // Don't connect processor to destination - this causes echo!
          // Processor only needs to capture audio, not output it
          setActive(true);
          concludi(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'Results') {
              const transcript = data.channel?.alternatives?.[0]?.transcript || '';
              if (transcript) {
                handleTranscript(transcript, data.is_final);
              }
            }
            // Deepgram UtteranceEnd = silenzio prolungato → frase finita
            if (data.type === 'UtteranceEnd') {
              handleUtteranceEnd();
            }
          } catch { /* messaggio del riconoscitore in un formato inatteso: si aspetta il prossimo */ }
        };

        ws.onerror = () => { console.warn('[StreamInterp] WS error'); concludi(false); };
        ws.onclose = () => {
          dbg.debug('[StreamInterp] WS closed');
          // Se si chiude PRIMA di essersi aperto (chiave rifiutata, rete
          // caduta) non ha senso aspettare i 4 secondi: si dichiara subito
          // il fallimento, cosi la pipeline di ripiego parte prima. Dopo
          // l'apertura riuscita `risolto` e gia true e questa e una riga
          // che non fa niente.
          concludi(false);
        };
        timerAperturaId = setTimeout(() => concludi(false), 4000);
      });
    } catch (e) {
      console.error('[StreamInterp] Start failed:', e);
      // b.247 — anche qui il microfono poteva essere gia stato aperto da
      // getUserMedia qualche riga sopra: senza abort restava acceso mentre
      // partiva la pipeline a blocchi.
      abortaStreaming();
      return false;
    }
  }, [myLang, handleTranscript, handleUtteranceEnd, userToken, roomId, roomSessionTokenRef, abortaStreaming]);

  // ═══ STOP STREAMING ═══
  const stop = useCallback(() => {
    setActive(false);
    clearTimeout(sentencePauseTimerRef.current);
    clearTimeout(translateTimerRef.current);

    // Flush remaining sentence
    if (currentSentenceRef.current.trim()) {
      handleSentenceComplete(currentSentenceRef.current);
    }

    // b.247 — la chiusura delle risorse era ricopiata qui riga per riga,
    // mentre i rami di fallimento di start() non ne avevano nessuna. Ora e
    // una funzione sola: se un giorno si aggiunge una risorsa da spegnere,
    // la si spegne anche nei rami di fallimento senza doverselo ricordare.
    abortaStreaming();

    // b.381 — LA CODA SI SVUOTA DAVVERO. Allo stop restavano dentro le
    // frasi gia tradotte e non ancora dette: un attimo dopo aver chiuso
    // l'interprete partiva ancora una voce, addosso a chi se n'era gia
    // andato — e la si pagava. E la frase in lavorazione restava
    // marcata, quindi ripartendo la stessa frase veniva scartata come
    // doppione.
    ttsQueueRef.current = [];
    fraseInLavorazioneRef.current = null;
    // e la voce che sta parlando ADESSO si ferma: era l'unica cosa che
    // lo stop non toccava.
    try {
      const a = audioCorrenteRef.current;
      if (a) { a.pause(); a.currentTime = 0; }
      audioCorrenteRef.current = null;
    } catch { /* l'audio era gia finito: nulla da fermare */ }

    // Reset state
    currentSentenceRef.current = '';
    interimTextRef.current = '';
    currentTranslationRef.current = '';
    setMyLiveText('');
    setPartnerLiveSubtitle('');
  }, [handleSentenceComplete, abortaStreaming]);

  // ═══ HANDLE INCOMING FROM PARTNER ═══
  // Il partner che usa lo stesso hook manda subtitle e audio
  const handleIncomingMessage = useCallback((msg) => {
    if (!msg) return;

    if (msg.type === 'interpreter-subtitle') {
      if (msg.isFinal) {
        setPartnerSubtitles(prev => [...prev.slice(-20), {
          text: msg.text, original: msg.originalText, lang: msg.lang, ts: Date.now()
        }]);
      }
      setPartnerLiveSubtitle(msg.text);
      setPartnerLiveOriginale(msg.originalText || '');
      // Clear old timers before adding new one
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
      // Auto-clear
      const timerId = setTimeout(() => {
        setPartnerLiveSubtitle(prev => prev === msg.text ? '' : prev);
      }, MAX_SUBTITLE_AGE_MS);
      subtitleTimersRef.current.push(timerId);

      // Add partner message to conversation context
      if (msg.isFinal && msg.originalText) {
        convContextRef.current?.addMessage?.({
          sender: 'partner',
          original: msg.originalText,
          translated: msg.text,
          sourceLang: msg.originalLang || partnerLang,
          targetLang: myLang,
        });
      }
    }

    // Audio playback (same logic as old interpreter)
    if (msg.type === 'interpreter-voce-mancata') {
      setPartnerVoceMancata(true);
      clearTimeout(voceMancataTimerRef.current);
      voceMancataTimerRef.current = setTimeout(() => setPartnerVoceMancata(false), 8000);
    }
    if (msg.type === 'interpreter-audio' && msg.data) {
      playBase64Audio(msg.data);
    }
    if (msg.type === 'interpreter-audio-part') {
      handleAudioPart(msg);
    }
  }, [myLang, partnerLang]);

  // ═══ AUDIO PLAYBACK HELPERS ═══
  const audioPartsRef = useRef({});

  const playBase64Audio = useCallback((base64Data) => {
    // b.404 — QUESTA FUNZIONE NASCEVA DENTRO IL TRY, e il rimedio
    // d'emergenza in fondo (il `catch`) la chiamava da FUORI: li dentro
    // non esiste. Quindi quando qualcosa andava storto, andava storto
    // anche il rimedio — e l'avviso che dice alla stanza «la voce
    // tradotta ha finito» non partiva mai, lasciando la voce vera del
    // partner attenuata per sempre. Che e esattamente il difetto che
    // b.381 credeva di aver chiuso.
    //
    // E c'e di peggio: e questa riga che da quattro ore faceva fallire
    // OGNI pubblicazione. Il controllo che la trova gira su Vercel ma
    // non nelle compilazioni che facevo io in locale, dove lo saltavo.
    // Otto versioni fatte e nessuna arrivata a Luca.
    const avvisa = (acceso) => {
      try { window.dispatchEvent(new CustomEvent('bartalk:tts', { detail: { attivo: acceso } })); }
      catch { /* fuori dal browser non c'e nessuno da avvisare: si prosegue */ }
    };
    try {
      const audioBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      // b.276 — P1: IL VOLUME ORA LO COMANDI TU.
      // Era fisso a 0,9: spegnere "Ascolta la voce" o abbassare il
      // cursore non aveva alcun effetto sull'interprete, perche questa
      // riga non guardava la preferenza. Ora la legge, e a volume zero
      // non si riproduce affatto.
      const volume = getVolumeTTS();
      if (volume <= 0) { URL.revokeObjectURL(url); return; }
      audio.volume = volume;
      // b.352 — il cursore agisce ANCHE sulla frase in corso: prima il
      // volume si leggeva solo all'avvio e muoverlo durante il parlato
      // non faceva nulla ("i comandi non funzionano", collaudo di Luca).
      audioCorrenteRef.current = audio;
      // b.276 — P1: L'ATTENUAZIONE DELL'ORIGINALE.
      // startDucking abbassa un volume interno che la voce del partner
      // in videochiamata non attraversa: "Solo tradotta / Attenuata /
      // Entrambe" restava senza effetto durante l'interprete. La stanza
      // ascolta un avviso preciso per abbassare la voce vera: ora
      // l'interprete lo manda, come gia fa la voce normale.
      startDucking?.();
      avvisa(true);
      // b.381 — L'AVVISO SI SPEGNEVA MAI. Si accendeva quando partiva la
      // voce tradotta e non veniva PIU rimesso a false: ne alla fine, ne
      // in caso di errore. La stanza ascolta proprio questo per abbassare
      // la voce vera del partner — quindi restava attenuata per sempre,
      // fino al prossimo giro di voce tradotta.
      //
      // Si spegne in UN posto solo, chiamato da tutte e tre le uscite: se
      // lo si scrivesse tre volte, la prossima uscita nuova se lo
      // dimenticherebbe di nuovo. E' esattamente cosi che e nato questo
      // difetto.
      const finito = () => {
        avvisa(false);
        stopDucking?.();
        try { URL.revokeObjectURL(url); } catch { /* gia liberato: nulla da fare */ }
        if (audioCorrenteRef.current === audio) audioCorrenteRef.current = null;
      };
      audio.play().catch(() => { finito(); });
      audio.onended = finito;
      audio.onerror = finito;
    } catch { avvisa(false); stopDucking?.(); }
  }, [startDucking, stopDucking]);

  const handleAudioPart = useCallback((msg) => {
    const buf = audioPartsRef.current;
    if (!buf[msg.id]) buf[msg.id] = { parts: {}, total: msg.total, ts: Date.now() };
    buf[msg.id].parts[msg.part] = msg.data;
    const entry = buf[msg.id];
    if (Object.keys(entry.parts).length === entry.total) {
      let full = '';
      for (let i = 0; i < entry.total; i++) full += entry.parts[i] || '';
      delete buf[msg.id];
      playBase64Audio(full);
    }
  }, [playBase64Audio]);

  // b.352 — il cursore del volume comanda anche l'audio GIA in corsa.
  useEffect(() => {
    const suVolume = () => {
      const a = audioCorrenteRef.current;
      if (!a) return;
      const v = getVolumeTTS();
      // b.381 — RIPORTARE IL VOLUME SU NON FACEVA RIPARTIRE NIENTE.
      // Portandolo a zero si metteva in pausa, ma rialzandolo si
      // rimetteva solo il numero: la frase restava ferma. Il cursore
      // sembrava funzionare e non funzionava — la categoria di difetto
      // che nessuna prova sulla presenza delle funzioni trova, perche
      // tutte le funzioni ci sono.
      try {
        a.volume = v;
        if (v <= 0) a.pause();
        // si riprende solo se e stata la pausa del volume a fermarlo, e
        // se la frase non era gia finita per conto suo.
        else if (a.paused && !a.ended) a.play().catch(() => { /* il browser puo rifiutare: non e un guasto */ });
      } catch { /* l'audio era gia finito: nulla da regolare */ }
    };
    window.addEventListener('bartalk:vol-tts', suVolume);
    return () => window.removeEventListener('bartalk:vol-tts', suVolume);
  }, []);

  // Cleanup stale audio buffers
  useEffect(() => {
    const interval = setInterval(() => {
      const buf = audioPartsRef.current;
      const now = Date.now();
      for (const id of Object.keys(buf)) {
        if (now - (buf[id].ts || 0) > 30000) delete buf[id];
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // b.247 — qui lo smontaggio dimenticava il filtro del rumore (che
      // tiene un suo AudioContext) e non azzerava i ref: stessa cura di
      // stop(), stessa funzione.
      abortaStreaming();
      subtitleTimersRef.current.forEach(id => clearTimeout(id));
      subtitleTimersRef.current = [];
      clearTimeout(sentencePauseTimerRef.current);
      clearTimeout(translateTimerRef.current);
    };
  }, [abortaStreaming]);

  return {
    active,
    start,
    stop,
    myLiveText,                    // Testo STT real-time (quello che sto dicendo)
    partnerLiveSubtitle,           // Cio che dice LUI, tradotto per me
    partnerLiveOriginale,          // ...e le sue parole originali (b.276)
    miaTraduzione,                 // Cio che dico IO, tradotto per lui (b.276)
    mySubtitles,                   // Cronologia frasi tradotte mie
    partnerSubtitles,              // Cronologia frasi tradotte partner
    handleIncomingMessage,         // Handler per messaggi P2P dal partner
    voceGuasta,                    // b.352 — la MIA voce tradotta non e partita (tutti i motori giu)
    partnerVoceMancata,            // b.352 — la voce del partner non arrivera: leggi i sottotitoli
  };
}

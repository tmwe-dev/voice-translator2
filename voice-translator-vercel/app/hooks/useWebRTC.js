'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase.js';
import {
  createPeerConnection, createDataChannel, createOffer,
  createAnswer, acceptAnswer, addIceCandidate,
  sendViaDataChannel, collectIceCandidates,
  addMediaTracks, getLocalMediaStream,
  setVideoEnabled, switchCamera,
  rilevaPiattaforma, serveH264, preferisciH264,
} from '../lib/webrtc.js';
import useE2EEncryption from './useE2EEncryption.js';
import { createLogger } from '../lib/logger.js';
import { creaPostaInUscita } from '../lib/postaInUscita.js';
const dbg = createLogger('webrtc');

// ═══════════════════════════════════════════════
// useWebRTC — P2P video call with accept/decline + Supabase Realtime signaling
//
// Flow:
// 1. User A clicks video → sends "call-request" via Realtime
// 2. User B sees incoming call banner → clicks Accept
// 3. User B sends "call-accepted" → User A receives, sends "offer"
// 4. Normal WebRTC ICE/SDP exchange → P2P connected
// ═══════════════════════════════════════════════

const CONNECTION_TIMEOUT = 30000;

export default function useWebRTC({ roomId, myName, onDirectMessage, roomSessionTokenRef, sessionModeRef }) {
  const [webrtcState, setWebrtcState] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabledState] = useState(false);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const [audioEnabled, setAudioEnabledState] = useState(true);

  // ── Call type: 'voice' | 'video' | null ──
  const [callType, setCallType] = useState(null);
  const callTypeRef = useRef(null);
  // b.245 — il tipo dell'ULTIMA chiamata, che sopravvive al cleanup: serve
  // alla riconnessione per ricostruire un video come video.
  const tipoChiamataPrecedenteRef = useRef(null);

  // ── Incoming call state ──
  const [incomingCall, setIncomingCall] = useState(null); // { from: string, withVideo: boolean } or null
  const incomingCallTimerRef = useRef(null);
  const pendingCallRef = useRef(false); // caller is waiting for accept

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  // ── b.111 · la posta in uscita ──
  // Se il canale non e aperto (o le chiavi non sono ancora state
  // scambiate) il messaggio non parte. Prima si perdeva in silenzio:
  // ora resta qui e riparte da solo quando il canale torna aperto.
  // ── b.116 · "ho chiuso io" ──
  // Chi preme CHIUDI provoca la stessa cosa che provoca una rete che
  // cade: la connessione si interrompe. Il codice non sapeva
  // distinguere le due cose e trattava sempre l'interruzione come un
  // guasto — quindi ricomponeva la chiamata da solo, e per farlo
  // RIACCENDEVA LA TELECAMERA di chi aveva appena chiuso.
  //
  // Difetto di riservatezza, non di comodita: uno chiude, si alza, e la
  // sua telecamera torna accesa senza che nessuno gliel'abbia chiesto.
  const chiusuraVolutaRef = useRef(false);

  const postaRef = useRef(null);
  if (!postaRef.current) postaRef.current = creaPostaInUscita();

  const timeoutRef = useRef(null);
  const disconnectTimerRef = useRef(null);
  const sendersRef = useRef([]);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const channelRef = useRef(null);
  const signalingReadyRef = useRef(false);
  const signalingSubscribePromiseRef = useRef(null);
  const stateRef = useRef('idle');
  const iceCandidateQueueRef = useRef([]);
  const heartbeatIntervalRef = useRef(null);
  const lastPongRef = useRef(0);
  // b.272 — chi sono io e chi e' dall'altra parte: serve a decidere la
  // codifica video (H.264 se c'e di mezzo un Apple).
  const piattaformaRef = useRef(null);
  if (piattaformaRef.current === null) piattaformaRef.current = rilevaPiattaforma();
  const piattaformaPartnerRef = useRef(null);
  // b.272 — l'ascoltatore che aspetta il ritorno della rete: va tenuto
  // per poterlo togliere, vedi cleanup.
  const risveglioRef = useRef(null);

  // ── E2E Encryption (extracted hook) ──
  // b.113 — la stanza entra nel calcolo del numero di sicurezza: due
  // stanze diverse con le stesse chiavi devono dare numeri diversi,
  // cosi un numero visto altrove non si puo riusare qui.
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  const e2e = useE2EEncryption({ sessionModeRef, roomIdRef });

  // ── Callback ref for onDirectMessage (avoids stale closure in DataChannel) ──
  // Without this, dc.onmessage captures the initial handleDCMessage which closes
  // over the initial onDirectMessage. If onDirectMessage changes (e.g. because
  // roomPolling.addIncomingMessage or handleMessageUpdate get recreated),
  // the DataChannel would still use the stale version → messages silently lost.
  const onDirectMessageRef = useRef(onDirectMessage);
  useEffect(() => { onDirectMessageRef.current = onDirectMessage; }, [onDirectMessage]);

  useEffect(() => { stateRef.current = webrtcState; }, [webrtcState]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
    if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
    if (autoReconnectTimerRef.current) { clearTimeout(autoReconnectTimerRef.current); autoReconnectTimerRef.current = null; }
    // b.272 — via anche l'attesa del ritorno della rete (vedi sopra).
    if (risveglioRef.current) { window.removeEventListener('online', risveglioRef.current); risveglioRef.current = null; }
    // Destroy ephemeral E2E keys on disconnect
    e2e.reset();
    pendingCallRef.current = false;
    if (dcRef.current) {
      try { dcRef.current.close(); } catch (e) { console.warn('[WebRTC] dc close:', e.message); }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { console.warn('[WebRTC] pc close:', e.message); }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch (e) { console.warn('[WebRTC] track stop:', e.message); } });
      localStreamRef.current = null;
    }
    sendersRef.current = [];
    remoteStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setVideoEnabledState(false);
    setRemoteVideoActive(false);
    setCallType(null);
    // b.245 — il tipo di chiamata si RICORDA prima di azzerarlo: era il
    // difetto per cui una VIDEOchiamata caduta si riconnetteva come audio.
    // `cleanup()` smonta la connessione (tecnica); il contesto della
    // chiamata (logico) deve sopravvivere alla riconnessione.
    if (callTypeRef.current) tipoChiamataPrecedenteRef.current = callTypeRef.current;
    callTypeRef.current = null;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ── Supabase Realtime signaling ──

  const waitForSignalingReady = useCallback(async (timeoutMs = 5000) => {
    if (signalingReadyRef.current && channelRef.current) return true;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (signalingReadyRef.current && channelRef.current) return true;
      if (signalingSubscribePromiseRef.current) {
        try {
          await Promise.race([
            signalingSubscribePromiseRef.current,
            new Promise((resolve) => setTimeout(resolve, 250)),
          ]);
        } catch (e) { console.warn('[WebRTC] signaling wait:', e.message); }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return signalingReadyRef.current && !!channelRef.current;
  }, []);

  const sendSignal = useCallback(async (type, data) => {
    const ready = await waitForSignalingReady();
    if (!ready || !channelRef.current) {
      console.warn('[WebRTC] Signaling channel not ready, cannot send:', type);
      throw new Error(`Signaling channel not ready for ${type}`);
    }
    const result = await channelRef.current.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: { type, data, from: myName, timestamp: Date.now() },
    });
    if (result !== 'ok') {
      console.warn('[WebRTC] Failed to send signal:', type, result);
      throw new Error(`Failed to send ${type}: ${String(result)}`);
    }
  }, [myName, waitForSignalingReady]);

  // ── Handle incoming remote tracks ──
  const handleRemoteTrack = useCallback((track, stream) => {
    dbg.debug('[WebRTC] Remote track received:', track.kind, 'readyState:', track.readyState);
    // Always update the ref with the latest stream/tracks
    if (stream) {
      // Remove old tracks of same kind to prevent accumulation & leaked handlers
      const existing = stream.getTracks().filter(t => t !== track && t.kind === track.kind);
      existing.forEach(old => {
        old.onended = null; old.onmute = null; old.onunmute = null;
        stream.removeTrack(old);
      });
      remoteStreamRef.current = stream;
    } else {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      // Remove old tracks of same kind before adding new one
      remoteStreamRef.current.getTracks()
        .filter(t => t.kind === track.kind && t !== track)
        .forEach(old => {
          old.onended = null; old.onmute = null; old.onunmute = null;
          remoteStreamRef.current.removeTrack(old);
        });
      remoteStreamRef.current.addTrack(track);
    }
    // CRITICAL: Always create a NEW MediaStream object so React detects the state change
    const updatedStream = new MediaStream(remoteStreamRef.current.getTracks());
    setRemoteStream(updatedStream);
    if (track.kind === 'video') setRemoteVideoActive(true);
    // ── b.248 · anche chi RICEVE il video viene promosso ──
    // Quando l'altro fa "passa a video", qui arriva la sua traccia video
    // dentro una chiamata nata 'voice' (la rinegoziazione si accetta gia
    // da sola, senza banner). Senza promozione il partner restava nella
    // finestra della chiamata vocale e il video, pur ricevuto, non si
    // vedeva da nessuna parte.
    if (track.kind === 'video' && callTypeRef.current === 'voice') {
      setCallType('video');
      callTypeRef.current = 'video';
    }
    track.onended = () => { if (track.kind === 'video') setRemoteVideoActive(false); };
    track.onmute = () => { if (track.kind === 'video') setRemoteVideoActive(false); };
    track.onunmute = () => { if (track.kind === 'video') setRemoteVideoActive(true); };
  }, []);

  const handleDCMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      // CRITICAL: Use ref to always call the LATEST onDirectMessage callback.
      // dc.onmessage is set once in setupDC and never updated — without the ref,
      // it would keep calling the stale version from when the DC was first opened.
      onDirectMessageRef.current?.(msg);
    } catch (e) {
      // Only log non-JSON-parse errors (those indicate bugs in message handlers)
      if (e instanceof SyntaxError) return; // Expected: binary/malformed DC data
      console.warn('[DC] Message handler error:', e);
    }
  }, []); // No deps — reads from ref

  // ── ICE restart: attempt to reconnect without tearing down the peer connection ──
  // MDN recommendation: initiate ICE restart 3-4s after 'disconnected'
  // Media continues flowing on the old path while ICE renegotiates a new one
  const iceRestartAttemptRef = useRef(0);
  const MAX_ICE_RESTARTS = 2;
  const autoReconnectAttemptRef = useRef(0);
  const MAX_AUTO_RECONNECTS = 2;
  const autoReconnectTimerRef = useRef(null);

  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') return false;
    if (iceRestartAttemptRef.current >= MAX_ICE_RESTARTS) {
      console.warn(`[WebRTC] ICE restart limit reached (${MAX_ICE_RESTARTS}), giving up`);
      return false;
    }
    iceRestartAttemptRef.current++;
    dbg.debug(`[WebRTC] ICE restart attempt ${iceRestartAttemptRef.current}/${MAX_ICE_RESTARTS}`);
    try {
      // Modern approach: restartIce() + createOffer
      if (pc.restartIce) pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignal('offer', JSON.stringify(pc.localDescription));
      return true;
    } catch (e) {
      console.error('[WebRTC] ICE restart failed:', e);
      return false;
    }
  }, [sendSignal]);

  // ── Connection state handler ──
  const handleStateChange = useCallback((info) => {
    const { source, state } = typeof info === 'object' ? info : { source: 'unknown', state: info };
    dbg.debug(`[WebRTC] State change: ${source}=${state}`);

    if (state === 'connected' || state === 'completed') {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      iceRestartAttemptRef.current = 0; // Reset ICE restart counter on successful connection
      autoReconnectAttemptRef.current = 0; // Reset auto-reconnect counter
      if (autoReconnectTimerRef.current) { clearTimeout(autoReconnectTimerRef.current); autoReconnectTimerRef.current = null; }
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    } else if (chiusuraVolutaRef.current) {
      // b.116 — si e chiuso di proposito: qualunque cosa dica lo stato
      // della connessione, non si riprova. E la differenza fra "e caduta
      // la linea" e "ho riagganciato".
      return;
    } else if (state === 'disconnected') {
      // ── ICE restart strategy (MDN-recommended: 3-4s after disconnected) ──
      // Don't destroy the connection — try to renegotiate ICE first.
      // Media keeps flowing on the old path while new ICE candidates are gathered.
      if (!disconnectTimerRef.current && stateRef.current === 'connected') {
        disconnectTimerRef.current = setTimeout(async () => {
          disconnectTimerRef.current = null;
          const pc = pcRef.current;
          if (!pc) return;
          const stillDisconnected = pc.connectionState === 'disconnected' || pc.connectionState === 'failed'
            || pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed';
          if (!stillDisconnected) return; // Reconnected on its own

          // Try ICE restart before giving up
          const restarted = await attemptIceRestart();
          if (!restarted) {
            // ICE restart exhausted — try full auto-reconnect
            attemptAutoReconnect();
          }
          // If restarted, wait for 'connected' state — don't cleanup yet
        }, 4000); // 4s — MDN recommended window
      }
    } else if (state === 'failed' || state === 'closed') {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      // On 'failed': try ICE restart first, then auto-reconnect
      if (state === 'failed' && iceRestartAttemptRef.current < MAX_ICE_RESTARTS) {
        attemptIceRestart().then(restarted => {
          if (!restarted) attemptAutoReconnect();
        });
      } else if (state === 'failed') {
        attemptAutoReconnect();
      } else {
        // 'closed' — clean tear down
        setWebrtcState('failed');
        stateRef.current = 'failed';
        cleanup();
      }
    }
  }, [cleanup, attemptIceRestart]);

  // ── Auto-reconnect: rebuild the entire P2P connection from scratch ──
  // Called when ICE restart fails. Tears down current connection and sends a new
  // call-request via signaling. Partner auto-accepts renegotiation offers.
  // Max 2 attempts with exponential backoff (3s, 6s).
  function attemptAutoReconnect() {
    // b.116 — seconda difesa: anche se una chiamata partisse comunque
    // (un temporizzatore gia avviato, per esempio), qui si ferma. La
    // telecamera non si riaccende mai dopo un CHIUDI.
    if (chiusuraVolutaRef.current) return;
    if (autoReconnectAttemptRef.current >= MAX_AUTO_RECONNECTS) {
      console.warn('[WebRTC] Auto-reconnect limit reached — giving up');
      setWebrtcState('failed');
      stateRef.current = 'failed';
      cleanup();
      return;
    }
    autoReconnectAttemptRef.current++;
    const delay = 3000 * autoReconnectAttemptRef.current; // 3s, 6s
    dbg.debug(`[WebRTC] Auto-reconnect attempt ${autoReconnectAttemptRef.current}/${MAX_AUTO_RECONNECTS} in ${delay}ms`);

    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    cleanup(); // Tear down old connection

    autoReconnectTimerRef.current = setTimeout(async () => {
      autoReconnectTimerRef.current = null;
      if (!navigator.onLine) {
        // b.272 — si aspetta il ritorno della rete, ma l'attesa deve
        // poter essere ANNULLATA: prima questo ascoltatore restava
        // appeso per sempre e, se la rete tornava dopo che avevi chiuso
        // e lasciato la stanza, faceva ripartire la chiamata da solo.
        if (risveglioRef.current) window.removeEventListener('online', risveglioRef.current);
        const alRitornoDellaRete = () => {
          window.removeEventListener('online', alRitornoDellaRete);
          risveglioRef.current = null;
          if (chiusuraVolutaRef.current) return;
          attemptAutoReconnect();
        };
        risveglioRef.current = alRitornoDellaRete;
        window.addEventListener('online', alRitornoDellaRete);
        return;
      }
      try {
        // Send a new call-request — partner should auto-accept since we were connected before
        pendingCallRef.current = true;
        // b.245 — si usa il tipo RICORDATO: `callTypeRef` qui e' gia stato
        // azzerato da cleanup(), e una videochiamata tornava audio.
        const tipoDaRipristinare = callTypeRef.current || tipoChiamataPrecedenteRef.current;
        callTypeRef.current = tipoDaRipristinare;
        await sendSignal('call-request', { withVideo: tipoDaRipristinare === 'video', reconnect: true, piattaforma: piattaformaRef.current });
        timeoutRef.current = setTimeout(() => {
          if (pendingCallRef.current) {
            pendingCallRef.current = false;
            // If this attempt also fails, try again or give up
            if (autoReconnectAttemptRef.current < MAX_AUTO_RECONNECTS) {
              attemptAutoReconnect();
            } else {
              setWebrtcState('failed');
              stateRef.current = 'failed';
            }
          }
        }, 15000);
      } catch {
        setWebrtcState('failed');
        stateRef.current = 'failed';
      }
    }, delay);
  }

  function setupDC(dc) {
    dcRef.current = dc;
    dc.onopen = () => {
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      // ── E2E: initiate key exchange immediately after DC opens ──
      e2e.initiateKeyExchange(dc);

      // ── b.111 · si consegna la posta rimasta sullo scrittoio ──
      // Si aspetta un momento: lo scambio delle chiavi appena avviato
      // non e istantaneo, e in Direct un messaggio spedito prima che
      // siano pronte verrebbe rifiutato e rimesso in coda per niente.
      setTimeout(() => {
        postaRef.current?.svuota((busta) => e2e.sendEncrypted(dcRef.current, busta));
      }, 600);

      // ── P2P Heartbeat: detect silent DataChannel death ──
      lastPongRef.current = Date.now();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        if (dcRef.current?.readyState === 'open') {
          try { dcRef.current.send(JSON.stringify({ type: 'ping', ts: Date.now() })); } catch { /* il temporizzatore era gia scaduto */ }
          if (Date.now() - lastPongRef.current > 20000 && stateRef.current === 'connected') {
            // b.272 — prima qui si scriveva solo un avviso nel registro:
            // il collegamento era morto, il sistema se ne accorgeva, e
            // restava a guardare. Ora si reagisce come a una caduta.
            console.warn('[WebRTC] nessuna risposta al battito da 20s: tratto la linea come caduta');
            lastPongRef.current = Date.now();   // un solo tentativo per giro
            if (!chiusuraVolutaRef.current) {
              attemptIceRestart().then(ripartito => { if (!ripartito) attemptAutoReconnect(); });
            }
          }
        }
      }, 8000);
    };
    dc.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        // ── Internal protocol messages ──
        if (msg.type === 'ping') {
          if (dcRef.current?.readyState === 'open') {
            try { dcRef.current.send(JSON.stringify({ type: 'pong', ts: Date.now() })); } catch { /* dato illeggibile: vale come assente */ }
          }
          return;
        }
        if (msg.type === 'pong') { lastPongRef.current = Date.now(); return; }
        if (msg.type === 'e2e-pubkey') { await e2e.handlePartnerKey(msg.key); return; }

        // ── E2E decryption: if message is encrypted, decrypt it ──
        if (msg.type === 'e2e-encrypted') {
          const decrypted = await e2e.decryptMsg(msg.data);
          onDirectMessageRef.current?.(decrypted || msg);
          return;
        }

        // ── Unencrypted message (E2E not yet established or fallback) ──
        onDirectMessageRef.current?.(msg);
      } catch (e) {
        if (!(e instanceof SyntaxError)) console.warn('[DC] setupDC message error:', e);
      }
    };
    dc.onclose = () => {
      dcRef.current = null;
      if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
      // Destroy keys on DC close
      e2e.reset();
    };
  }

  async function getMediaWithFallback(withVideo) {
    try {
      const stream = await getLocalMediaStream({ video: withVideo, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (withVideo) setVideoEnabledState(true);
      return stream;
    } catch (e) {
      if (withVideo) {
        try {
          const stream = await getLocalMediaStream({ video: false, audio: true });
          localStreamRef.current = stream;
          setLocalStream(stream);
          return stream;
        } catch (e) { console.warn('[WebRTC] audio-only fallback failed:', e.message); }
      }
    }
    return null;
  }

  async function flushIceCandidates(pc) {
    const queue = iceCandidateQueueRef.current;
    iceCandidateQueueRef.current = [];
    for (const candidateStr of queue) {
      try { await addIceCandidate(pc, candidateStr); } catch (e) { console.warn('[WebRTC] ICE flush:', e.message); }
    }
  }

  // ── Handle incoming signal from Realtime ──
  const handleIncomingSignal = useCallback(async (payload) => {
    if (!payload || payload.from === myName) return;
    const { type, data } = payload;
    dbg.debug('[WebRTC] Signal received:', type, 'from:', payload.from, 'state:', stateRef.current);

    // ── NEW: Call request/response flow ──
    if (type === 'call-ended') {
      // b.117 — l'altro ha riagganciato di proposito. Non e un guasto:
      // non si tenta nulla, si chiude e basta. Senza questo, chi resta
      // prova a ricomporre e riaccende la telecamera dell'altro.
      if (autoReconnectTimerRef.current) { clearTimeout(autoReconnectTimerRef.current); autoReconnectTimerRef.current = null; }
      if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
      autoReconnectAttemptRef.current = MAX_AUTO_RECONNECTS;   // niente altri tentativi
      pendingCallRef.current = false;
      setIncomingCall(null);
      cleanup();
      setWebrtcState('idle');
      stateRef.current = 'idle';
      return;
    }

    if (type === 'call-request') {
      // ── b.245 · una RICONNESSIONE non e' una chiamata nuova ──
      // Chi cade manda `reconnect: true` — ma qui non veniva letto, e il
      // caso piu probabile dopo una caduta e' proprio questo: A vede la
      // linea giu e richiama, B si crede ancora 'connected' e risponde
      // BUSY. La riconnessione si autosabotava, ed era il motivo per cui
      // l'ospite non si riallacciava piu.
      // Ora: si smonta la vecchia connessione morta e si riaccetta, senza
      // far ricomparire il banner "chiamata in arrivo".
      // b.272 — QUI IL SEGNALE NON ARRIVAVA MAI. `reconnect` viaggia
      // dentro il contenuto del messaggio (`data`), non accanto ad esso:
      // `payload.reconnect` era sempre indefinito, quindi la riconnessione
      // cadeva nel ramo qui sotto e si rispondeva OCCUPATO. E' esattamente
      // il difetto che b.245 credeva di aver chiuso: la correzione era
      // giusta, l'indirizzo da cui leggeva no.
      if (data?.reconnect && (stateRef.current === 'connected' || stateRef.current === 'connecting')) {
        dbg.debug('[WebRTC] riconnessione del partner: smonto la vecchia e riaccetto');
        cleanup();
        const eraVideo = !!data?.withVideo || tipoChiamataPrecedenteRef.current === 'video';
        const tipo = eraVideo ? 'video' : 'voice';
        chiusuraVolutaRef.current = false;
        setCallType(tipo);
        callTypeRef.current = tipo;
        setWebrtcState('connecting');
        stateRef.current = 'connecting';
        // Si riaccetta subito: nessun banner, e' la stessa chiamata di prima.
        sendSignal('call-accepted', { piattaforma: piattaformaRef.current }).catch((e) => console.warn('[WebRTC] riaccetto:', e.message));
        return;
      }
      if (data?.piattaforma) piattaformaPartnerRef.current = data.piattaforma;
      // Someone wants to call us — show incoming call banner
      if (stateRef.current === 'connecting' || stateRef.current === 'connected') {
        // Already busy
        sendSignal('call-declined', JSON.stringify({ reason: 'busy' })).catch(() => {});
        return;
      }
      setIncomingCall({ from: payload.from, withVideo: data?.withVideo !== false });
      // Auto-decline after 30s if no response
      if (incomingCallTimerRef.current) clearTimeout(incomingCallTimerRef.current);
      incomingCallTimerRef.current = setTimeout(() => {
        setIncomingCall(null);
        sendSignal('call-declined', JSON.stringify({ reason: 'timeout' })).catch(() => {});
      }, 30000);
      return;
    }

    if (type === 'call-accepted') {
      if (data?.piattaforma) piattaformaPartnerRef.current = data.piattaforma;
      // Partner accepted our call — now send the actual offer
      if (!pendingCallRef.current) return;
      pendingCallRef.current = false;
      try {
        const pc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
        pcRef.current = pc;
        // CRITICAL: Add transceivers BEFORE creating the offer to guarantee the SDP
        // always has m=audio (and optionally m=video) sections.
        const wantVideo = callTypeRef.current === 'video';
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        if (wantVideo) {
          pc.addTransceiver('video', { direction: 'sendrecv' });
        }
        // b.272 — se in questa chiamata c'e' di mezzo un Apple, H.264 va
        // messo davanti PRIMA di scrivere l'offerta: dopo non conta piu.
        if (wantVideo && serveH264(piattaformaRef.current, piattaformaPartnerRef.current)) {
          preferisciH264(pc);
        }
        const dc = createDataChannel(pc);
        setupDC(dc);
        const stream = await getMediaWithFallback(wantVideo);
        if (stream) sendersRef.current = addMediaTracks(pc, stream);
        collectIceCandidates(pc, (candidateStr) => {
          sendSignal('ice-candidate', candidateStr).catch(() => {});
        });
        const offerStr = await createOffer(pc);
        await sendSignal('offer', offerStr);
        timeoutRef.current = setTimeout(() => {
          if (stateRef.current !== 'connected') {
            setWebrtcState('failed');
            stateRef.current = 'failed';
            cleanup();
          }
        }, CONNECTION_TIMEOUT);
      } catch (e) {
        console.error('[WebRTC] Post-accept offer error:', e);
        setWebrtcState('failed');
        stateRef.current = 'failed';
      }
      return;
    }

    if (type === 'call-declined') {
      // Partner declined our call
      pendingCallRef.current = false;
      setWebrtcState('idle');
      stateRef.current = 'idle';
      cleanup();
      return;
    }

    if (type === 'offer') {
      if (stateRef.current === 'connecting' || stateRef.current === 'connected') {
        // If we're in 'connecting' because we accepted a call-request, proceed
        // If we got an offer without call-request (legacy/direct), auto-accept
      }

      if (stateRef.current === 'connected') {
        dbg.debug('[WebRTC] Already connected, ignoring offer');
        return;
      }

      // Clear incoming call banner if still showing
      setIncomingCall(null);
      if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }

      if (stateRef.current !== 'connecting') {
        // b.117 — terza difesa. Questo ramo accetta un'offerta arrivata
        // senza che nessuno abbia chiesto una chiamata: comodo per
        // compatibilita, ma e la porta da cui rientrava la
        // videochiamata appena chiusa. Dopo un CHIUDI, chi vuole
        // richiamare deve passare dalla porta principale — una
        // chiamata vera, che si vede e si accetta.
        if (chiusuraVolutaRef.current) {
          dbg.debug('[WebRTC] offerta non richiesta ignorata: la chiamata era stata chiusa di proposito');
          return;
        }
        // Direct offer (no call-request) — auto-accept for backward compatibility
        cleanup();
        setWebrtcState('connecting');
        stateRef.current = 'connecting';
      }
      iceCandidateQueueRef.current = [];

      try {
        const newPc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
        pcRef.current = newPc;
        newPc.ondatachannel = (event) => setupDC(event.channel);
        const offerSdp = JSON.parse(data);
        // b.272 — non basta che l'offerta NOMINI il video: se chi chiama
        // non e' riuscito ad accendere la telecamera, il suo canale video
        // e' di sola ricezione. Prima bastava la parola "video" e il
        // ricevente accendeva la propria camera per una chiamata in cui
        // l'altro non si vedeva: si finiva in video da soli.
        const bloccoVideo = (offerSdp.sdp || '').split(/^m=/m).find(b => b.startsWith('video')) || '';
        const callerHasVideo = !!bloccoVideo && /a=(sendrecv|sendonly)/.test(bloccoVideo);
        const stream = await getMediaWithFallback(callerHasVideo);
        if (stream) sendersRef.current = addMediaTracks(newPc, stream);
        collectIceCandidates(newPc, (candidateStr) => {
          sendSignal('ice-candidate', candidateStr).catch(() => {});
        });
        const answerStr = await createAnswer(newPc, data, (pcPronta) => {
          if (callerHasVideo && serveH264(piattaformaRef.current, piattaformaPartnerRef.current)) {
            preferisciH264(pcPronta);
          }
        });
        await sendSignal('answer', answerStr);
        await flushIceCandidates(newPc);
        timeoutRef.current = setTimeout(() => {
          if (stateRef.current !== 'connected') {
            setWebrtcState('failed');
            stateRef.current = 'failed';
            cleanup();
          }
        }, CONNECTION_TIMEOUT);
      } catch (e) {
        console.error('[WebRTC] Accept error:', e);
        setWebrtcState('failed');
        stateRef.current = 'failed';
        cleanup();
      }

    } else if (type === 'answer') {
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.signalingState === 'have-local-offer') {
        try {
          await acceptAnswer(pc, data);
          await flushIceCandidates(pc);
        } catch (e) {
          console.error('[WebRTC] Accept answer error:', e);
        }
      }

    } else if (type === 'ice-candidate') {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        iceCandidateQueueRef.current.push(data);
        return;
      }
      try { await addIceCandidate(pc, data); } catch (e) { console.warn('[WebRTC] ICE add:', e.message); }

    } else if (type === 'renegotiate') {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        // b.272 — DUE PROPOSTE CHE SI INCROCIANO.
        // Se accendiamo la telecamera quasi nello stesso istante, la sua
        // proposta arriva mentre la mia e' ancora in volo. Prima si
        // accettava comunque: il browser rifiutava, l'errore finiva nel
        // registro, e la chiamata restava a meta' — video nero, e
        // nessuno dei due che riprova.
        // La regola e' quella gia' usata nella stanza di gruppo: decide
        // l'ordine dei nomi. Chi ha il nome maggiore tiene la propria
        // proposta e ignora quella che arriva; l'altro ritira la sua,
        // risponde, e subito dopo la ripropone — cosi' la sua telecamera
        // non resta indietro.
        let daRiproporre = false;
        if (pc.signalingState !== 'stable') {
          if (String(myName || '') > String(payload.from || '')) return;
          await pc.setLocalDescription({ type: 'rollback' });
          daRiproporre = true;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
        // b.272 — se e' l'altro ad accendere la telecamera, il canale
        // video compare qui: la preferenza si esprime prima di rispondere.
        if (serveH264(piattaformaRef.current, piattaformaPartnerRef.current)) preferisciH264(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', JSON.stringify(pc.localDescription));
        if (daRiproporre) {
          const offerStr = await createOffer(pc);
          sendSignal('renegotiate', offerStr).catch(() => {});
        }
      } catch (e) {
        console.error('[WebRTC] Renegotiate error:', e);
      }
    }
  }, [myName, cleanup, handleDCMessage, handleStateChange, handleRemoteTrack, sendSignal]);

  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  useEffect(() => { handleIncomingSignalRef.current = handleIncomingSignal; }, [handleIncomingSignal]);

  // ── Subscribe to Realtime signaling channel ──
  useEffect(() => {
    signalingReadyRef.current = false;
    signalingSubscribePromiseRef.current = null;
    if (!roomId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase.channel(`webrtc:${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on('broadcast', { event: 'webrtc-signal' }, (event) => {
      handleIncomingSignalRef.current(event.payload);
    });
    channelRef.current = channel;
    signalingSubscribePromiseRef.current = new Promise((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          signalingReadyRef.current = true;
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          signalingReadyRef.current = false;
        }
      });
    });
    return () => {
      signalingReadyRef.current = false;
      signalingSubscribePromiseRef.current = null;
      try { channel.unsubscribe(); } catch (e) { console.warn('[WebRTC] unsubscribe:', e.message); }
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [roomId]);

  // ── Request call (sends call-request, waits for acceptance) ──
  const initiateConnection = useCallback(async (withVideo = false) => {
    if (stateRef.current === 'connecting' || stateRef.current === 'connected') return;
    // b.245 — da 'failed' si riparte, ma prima si butta via cio che era
    // rimasto in piedi della chiamata caduta: senza questo la nuova
    // chiamata nascerebbe sopra una PeerConnection morta.
    if (stateRef.current === 'failed') {
      cleanup(); // annulla anche il timer di riconnessione
      autoReconnectAttemptRef.current = 0; // e' una chiamata NUOVA: i tentativi ripartono
    }
    // b.116 — una chiamata NUOVA e una scelta nuova: si riapre la porta
    // che CHIUDI aveva sbarrato. Senza questa riga, dopo aver chiuso una
    // volta non si potrebbe piu chiamare per il resto della sessione —
    // si curerebbe un difetto creandone uno peggiore.
    chiusuraVolutaRef.current = false;
    const type = withVideo ? 'video' : 'voice';
    setCallType(type);
    callTypeRef.current = type;
    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    pendingCallRef.current = true;

    try {
      await sendSignal('call-request', { withVideo, piattaforma: piattaformaRef.current });
      // Wait for call-accepted or call-declined (handled by handleIncomingSignal)
      // Timeout after 30s
      timeoutRef.current = setTimeout(() => {
        if (pendingCallRef.current) {
          pendingCallRef.current = false;
          // b.272 — smettere di chiamare va DETTO all'altro: prima chi
          // non aveva risposto restava con la finestra della chiamata
          // accesa fino allo scadere del suo tempo, per una chiamata che
          // dall'altra parte non esisteva piu.
          sendSignal('call-ended', {}).catch(() => {});
          setWebrtcState('idle');
          stateRef.current = 'idle';
        }
      }, 30000);
    } catch (e) {
      console.error('[WebRTC] Call request error:', e);
      setWebrtcState('failed');
      stateRef.current = 'failed';
    }
  }, [sendSignal]);

  // ── Accept incoming call ──
  const acceptIncomingCall = useCallback(async () => {
    // b.116 — una chiamata NUOVA e una scelta nuova: si riapre la porta
    // che CHIUDI aveva sbarrato. Senza questa riga, dopo aver chiuso una
    // volta non si potrebbe piu chiamare per il resto della sessione —
    // si curerebbe un difetto creandone uno peggiore.
    chiusuraVolutaRef.current = false;

    if (!incomingCall) return;
    const type = incomingCall.withVideo ? 'video' : 'voice';
    setCallType(type);
    callTypeRef.current = type;
    if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
    setIncomingCall(null);
    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    try {
      await sendSignal('call-accepted', { piattaforma: piattaformaRef.current });
    } catch (e) {
      console.error('[WebRTC] Accept signal error:', e);
    }
  }, [incomingCall, sendSignal]);

  // ── Decline incoming call ──
  const declineIncomingCall = useCallback(async () => {
    if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
    setIncomingCall(null);
    try {
      await sendSignal('call-declined', JSON.stringify({ reason: 'declined' }));
    } catch (e) { console.warn('[WebRTC] decline signal:', e.message); }
  }, [sendSignal]);

  // ── Toggle video ──
  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    if (videoEnabled && localStreamRef.current) {
      setVideoEnabled(localStreamRef.current, false);
      setVideoEnabledState(false);
      sendDirectMessage({ type: 'video-toggle', enabled: false });
    } else {
      try {
        if (localStreamRef.current?.getVideoTracks().length > 0) {
          setVideoEnabled(localStreamRef.current, true);
          setVideoEnabledState(true);
        } else {
          const stream = await getLocalMediaStream({ video: true, audio: false });
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = pc.addTrack(videoTrack, stream);
            sendersRef.current.push(sender);
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(videoTrack);
            } else {
              localStreamRef.current = stream;
            }
            setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
            setVideoEnabledState(true);
            // b.272 — il canale video nasce ADESSO, quindi la preferenza
            // sul codec va espressa adesso: e' il caso "passa a video"
            // dentro una chiamata gia' aperta.
            if (serveH264(piattaformaRef.current, piattaformaPartnerRef.current)) preferisciH264(pc);
            const offerStr = await createOffer(pc);
            sendSignal('renegotiate', offerStr).catch(() => {});
          }
        }
        sendDirectMessage({ type: 'video-toggle', enabled: true });
        // ── b.248 · accendere il video PROMUOVE la chiamata ──
        // "Passa a video" da una chiamata voce arriva qui: la camera e'
        // accesa e la rinegoziazione e' partita, ma il tipo restava
        // 'voice' — la finestra giusta non si apriva e una riconnessione
        // (b.245) avrebbe ricostruito la chiamata come solo-audio.
        // Si promuove SOLO a video acceso davvero: se l'acquisizione
        // fallisce si finisce nel catch e il tipo non si tocca.
        if (callTypeRef.current === 'voice' && localStreamRef.current?.getVideoTracks().length > 0) {
          setCallType('video');
          callTypeRef.current = 'video';
        }
      } catch (e) {
        console.warn('[WebRTC] Camera failed:', e);
      }
    }
  }, [videoEnabled, sendSignal]);

  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || sendersRef.current.length === 0) return;
    try {
      // ── b.248 · il cambio camera non butta piu il microfono ──
      // switchCamera acquisisce un flusso di SOLO video (il replaceTrack
      // sul sender lo fa gia lei): assegnarlo intero al ref principale
      // perdeva la traccia AUDIO originale — il mute non controllava piu
      // il microfono giusto e il cleanup non lo spegneva. Si ricompone:
      // audio VECCHIO + video NUOVO, senza mai buttare l'audio.
      const tracceAudio = localStreamRef.current.getAudioTracks();
      const soloVideo = await switchCamera(localStreamRef.current, sendersRef.current);
      const ricomposto = new MediaStream([...tracceAudio, ...soloVideo.getVideoTracks()]);
      localStreamRef.current = ricomposto;
      setLocalStream(ricomposto);
    } catch (e) { console.warn('[WebRTC] flipCamera:', e.message); }
  }, []);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newState = !audioEnabled;
    for (const track of audioTracks) { track.enabled = newState; }
    setAudioEnabledState(newState);
    sendDirectMessage({ type: 'audio-toggle', enabled: newState });
  }, [audioEnabled]);

  const sendDirectMessage = useCallback(async (msg) => {
    return e2e.sendEncrypted(dcRef.current, msg);
  }, [e2e.sendEncrypted]);

  /**
   * Come sendDirectMessage, ma se non parte NON lo butta: lo mette da
   * parte e riprova all'apertura del canale. Da usare per il contenuto
   * (i messaggi di chat), non per i comandi tipo "ho acceso la camera",
   * che invecchiano male e vanno persi volentieri.
   */
  const spedisciOAccoda = useCallback(async (chiave, msg) => {
    try {
      const esito = await e2e.sendEncrypted(dcRef.current, msg);
      if (esito !== false) return true;
    } catch {
      // In Direct, sendEncrypted SOLLEVA finche le chiavi non sono
      // pronte. E il caso piu frequente: il primo secondo dopo essersi
      // collegati. Non e un errore, e solo "non ancora".
    }
    postaRef.current.accoda(chiave, msg);
    return false;
  }, [e2e.sendEncrypted]);

  const messaggiInAttesa = useCallback(() => postaRef.current.chiaviInAttesa(), []);

  const disconnect = useCallback(() => {
    // b.116 — da qui in poi ogni interruzione e voluta, non subita.
    chiusuraVolutaRef.current = true;
    // b.117 — E LO SI DICE ALL'ALTRO. Fermare solo la propria
    // riconnessione non bastava: chi restava dentro vedeva cadere la
    // linea, la scambiava per un guasto e mandava una nuova offerta.
    // Chi aveva chiuso la accettava in automatico (vedi il ramo
    // 'offer' piu sopra, "auto-accept for backward compatibility") e la
    // videochiamata si riapriva da sola, telecamera compresa.
    //
    // Una chiusura e un fatto, non un'opinione: va comunicata.
    try { sendSignal('call-ended', JSON.stringify({ voluta: true })); } catch { /* si chiude comunque */ }
    if (autoReconnectTimerRef.current) { clearTimeout(autoReconnectTimerRef.current); autoReconnectTimerRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    cleanup();
    setWebrtcState('idle');
    stateRef.current = 'idle';
    setIncomingCall(null);
  }, [cleanup, sendSignal]);

  return {
    webrtcState,
    webrtcConnected: webrtcState === 'connected',
    callType,              // 'voice' | 'video' | null
    localStream,
    remoteStream,
    videoEnabled,
    audioEnabled,
    remoteVideoActive,
    e2eReadyRef: e2e.readyRef, // Exposes E2E readiness for UI (Direct mode: block send until true)
    incomingCall,          // { from: string, withVideo: boolean } or null
    initiateConnection,    // (withVideo?: boolean) => Promise<void>
    acceptIncomingCall,    // Accept incoming call (voice or video)
    declineIncomingCall,   // Decline incoming call
    toggleVideo,
    toggleAudio,
    flipCamera,
    sendDirectMessage,
    numeroSicurezza: e2e.numeroSicurezza,
    spedisciOAccoda,
    messaggiInAttesa,
    disconnect,
  };
}

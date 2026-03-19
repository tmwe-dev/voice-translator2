'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase.js';
import {
  createPeerConnection, createDataChannel, createOffer,
  createAnswer, acceptAnswer, addIceCandidate,
  sendViaDataChannel, collectIceCandidates,
  addMediaTracks, getLocalMediaStream,
  setVideoEnabled, switchCamera,
} from '../lib/webrtc.js';
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage, isE2EAvailable,
} from '../lib/e2eCrypto.js';

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

export default function useWebRTC({ roomId, myName, onDirectMessage, roomSessionTokenRef }) {
  const [webrtcState, setWebrtcState] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabledState] = useState(false);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const [audioEnabled, setAudioEnabledState] = useState(true);

  // ── Incoming call state ──
  const [incomingCall, setIncomingCall] = useState(null); // { from: string } or null
  const incomingCallTimerRef = useRef(null);
  const pendingCallRef = useRef(false); // caller is waiting for accept

  const pcRef = useRef(null);
  const dcRef = useRef(null);
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

  // ── E2E Encryption refs ──
  const e2eKeyPairRef = useRef(null);   // { publicKey, privateKey }
  const e2eSharedKeyRef = useRef(null); // derived AES-GCM key
  const e2eReadyRef = useRef(false);

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
    // Destroy ephemeral E2E keys on disconnect
    e2eKeyPairRef.current = null;
    e2eSharedKeyRef.current = null;
    e2eReadyRef.current = false;
    pendingCallRef.current = false;
    if (dcRef.current) {
      try { dcRef.current.close(); } catch {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    sendersRef.current = [];
    remoteStreamRef.current = null;
    iceCandidateQueueRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setVideoEnabledState(false);
    setRemoteVideoActive(false);
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
        } catch {}
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
    console.log('[WebRTC] Remote track received:', track.kind, 'readyState:', track.readyState);
    // Always update the ref with the latest stream/tracks
    if (stream) {
      remoteStreamRef.current = stream;
    } else {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(track);
    }
    // CRITICAL: Always create a NEW MediaStream object so React detects the state change
    // (same reference won't trigger re-render even if new tracks were added)
    const updatedStream = new MediaStream(remoteStreamRef.current.getTracks());
    setRemoteStream(updatedStream);
    if (track.kind === 'video') setRemoteVideoActive(true);
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
    } catch {}
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
    console.log(`[WebRTC] ICE restart attempt ${iceRestartAttemptRef.current}/${MAX_ICE_RESTARTS}`);
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
    console.log(`[WebRTC] State change: ${source}=${state}`);

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
    if (autoReconnectAttemptRef.current >= MAX_AUTO_RECONNECTS) {
      console.warn('[WebRTC] Auto-reconnect limit reached — giving up');
      setWebrtcState('failed');
      stateRef.current = 'failed';
      cleanup();
      return;
    }
    autoReconnectAttemptRef.current++;
    const delay = 3000 * autoReconnectAttemptRef.current; // 3s, 6s
    console.log(`[WebRTC] Auto-reconnect attempt ${autoReconnectAttemptRef.current}/${MAX_AUTO_RECONNECTS} in ${delay}ms`);

    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    cleanup(); // Tear down old connection

    autoReconnectTimerRef.current = setTimeout(async () => {
      autoReconnectTimerRef.current = null;
      if (!navigator.onLine) {
        // Wait for network to come back
        const onOnline = () => {
          window.removeEventListener('online', onOnline);
          attemptAutoReconnect();
        };
        window.addEventListener('online', onOnline);
        return;
      }
      try {
        // Send a new call-request — partner should auto-accept since we were connected before
        pendingCallRef.current = true;
        await sendSignal('call-request', { withVideo: true, reconnect: true });
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

  // ── E2E key exchange: send our public key after DC opens ──
  async function initiateE2EKeyExchange() {
    if (!isE2EAvailable()) { e2eReadyRef.current = false; return; }
    try {
      const keyPair = await generateKeyPair();
      e2eKeyPairRef.current = keyPair;
      const pubKeyStr = await exportPublicKey(keyPair.publicKey);
      if (dcRef.current?.readyState === 'open') {
        dcRef.current.send(JSON.stringify({ type: 'e2e-pubkey', key: pubKeyStr }));
      }
    } catch (e) {
      console.warn('[E2E] Key generation failed:', e);
      e2eReadyRef.current = false;
    }
  }

  // ── Handle received partner public key → derive shared secret ──
  async function handleE2EPublicKey(partnerKeyStr) {
    if (!e2eKeyPairRef.current) return;
    try {
      const partnerPubKey = await importPublicKey(partnerKeyStr);
      const sharedKey = await deriveSharedKey(e2eKeyPairRef.current.privateKey, partnerPubKey);
      e2eSharedKeyRef.current = sharedKey;
      e2eReadyRef.current = true;
      console.log('[E2E] Shared key derived — messages are now encrypted');
    } catch (e) {
      console.warn('[E2E] Key derivation failed:', e);
      e2eReadyRef.current = false;
    }
  }

  function setupDC(dc) {
    dcRef.current = dc;
    dc.onopen = () => {
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      // ── E2E: initiate key exchange immediately after DC opens ──
      initiateE2EKeyExchange();

      // ── P2P Heartbeat: detect silent DataChannel death ──
      lastPongRef.current = Date.now();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = setInterval(() => {
        if (dcRef.current?.readyState === 'open') {
          try { dcRef.current.send(JSON.stringify({ type: 'ping', ts: Date.now() })); } catch {}
          if (Date.now() - lastPongRef.current > 20000 && stateRef.current === 'connected') {
            console.warn('[WebRTC] No heartbeat pong for 20s — connection may be dead');
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
            try { dcRef.current.send(JSON.stringify({ type: 'pong', ts: Date.now() })); } catch {}
          }
          return;
        }
        if (msg.type === 'pong') { lastPongRef.current = Date.now(); return; }
        if (msg.type === 'e2e-pubkey') { await handleE2EPublicKey(msg.key); return; }

        // ── E2E decryption: if message is encrypted, decrypt it ──
        if (msg.type === 'e2e-encrypted' && e2eSharedKeyRef.current) {
          try {
            const plaintext = await decryptMessage(e2eSharedKeyRef.current, msg.data);
            const decrypted = JSON.parse(plaintext);
            onDirectMessageRef.current?.(decrypted);
          } catch (e) {
            console.warn('[E2E] Decryption failed, forwarding as-is:', e);
            onDirectMessageRef.current?.(msg);
          }
          return;
        }

        // ── Unencrypted message (E2E not yet established or fallback) ──
        onDirectMessageRef.current?.(msg);
      } catch {}
    };
    dc.onclose = () => {
      dcRef.current = null;
      if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null; }
      // Destroy keys on DC close
      e2eSharedKeyRef.current = null;
      e2eReadyRef.current = false;
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
        } catch {}
      }
    }
    return null;
  }

  async function flushIceCandidates(pc) {
    const queue = iceCandidateQueueRef.current;
    iceCandidateQueueRef.current = [];
    for (const candidateStr of queue) {
      try { await addIceCandidate(pc, candidateStr); } catch {}
    }
  }

  // ── Handle incoming signal from Realtime ──
  const handleIncomingSignal = useCallback(async (payload) => {
    if (!payload || payload.from === myName) return;
    const { type, data } = payload;
    console.log('[WebRTC] Signal received:', type, 'from:', payload.from, 'state:', stateRef.current);

    // ── NEW: Call request/response flow ──
    if (type === 'call-request') {
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
      // Partner accepted our call — now send the actual offer
      if (!pendingCallRef.current) return;
      pendingCallRef.current = false;
      try {
        const pc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
        pcRef.current = pc;
        // CRITICAL: Add transceivers BEFORE creating the offer to guarantee the SDP
        // always has m=audio and m=video sections. Without this, if getUserMedia fails,
        // the offer has no media sections → the callee can't send their media back.
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        const dc = createDataChannel(pc);
        setupDC(dc);
        const stream = await getMediaWithFallback(true);
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
        console.log('[WebRTC] Already connected, ignoring offer');
        return;
      }

      // Clear incoming call banner if still showing
      setIncomingCall(null);
      if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }

      if (stateRef.current !== 'connecting') {
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
        const callerHasVideo = offerSdp.sdp?.includes('m=video');
        const stream = await getMediaWithFallback(callerHasVideo);
        if (stream) sendersRef.current = addMediaTracks(newPc, stream);
        collectIceCandidates(newPc, (candidateStr) => {
          sendSignal('ice-candidate', candidateStr).catch(() => {});
        });
        const answerStr = await createAnswer(newPc, data);
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
      try { await addIceCandidate(pc, data); } catch {}

    } else if (type === 'renegotiate') {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', JSON.stringify(pc.localDescription));
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
      try { channel.unsubscribe(); } catch {}
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [roomId]);

  // ── Request video call (sends call-request, waits for acceptance) ──
  const initiateConnection = useCallback(async (withVideo = false) => {
    if (stateRef.current === 'connecting' || stateRef.current === 'connected') return;
    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    pendingCallRef.current = true;

    try {
      await sendSignal('call-request', { withVideo });
      // Wait for call-accepted or call-declined (handled by handleIncomingSignal)
      // Timeout after 30s
      timeoutRef.current = setTimeout(() => {
        if (pendingCallRef.current) {
          pendingCallRef.current = false;
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
    if (!incomingCall) return;
    if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
    setIncomingCall(null);
    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    try {
      await sendSignal('call-accepted', {});
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
    } catch {}
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
            const offerStr = await createOffer(pc);
            sendSignal('renegotiate', offerStr).catch(() => {});
          }
        }
        sendDirectMessage({ type: 'video-toggle', enabled: true });
      } catch (e) {
        console.warn('[WebRTC] Camera failed:', e);
      }
    }
  }, [videoEnabled, sendSignal]);

  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || sendersRef.current.length === 0) return;
    try {
      const newStream = await switchCamera(localStreamRef.current, sendersRef.current);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
    } catch {}
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
    if (!dcRef.current || dcRef.current.readyState !== 'open') return false;
    // ── E2E encrypt if shared key is established ──
    // Internal protocol messages (ping/pong/e2e-pubkey/video-toggle/audio-toggle) are NOT encrypted
    // because they're not sensitive and encryption would add latency to control messages.
    const isControlMsg = msg?.type === 'ping' || msg?.type === 'pong' || msg?.type === 'e2e-pubkey'
      || msg?.type === 'video-toggle' || msg?.type === 'audio-toggle';
    if (e2eReadyRef.current && e2eSharedKeyRef.current && !isControlMsg) {
      try {
        const plaintext = JSON.stringify(msg);
        const encrypted = await encryptMessage(e2eSharedKeyRef.current, plaintext);
        return sendViaDataChannel(dcRef.current, { type: 'e2e-encrypted', data: encrypted });
      } catch {
        // Encryption failed — send unencrypted as fallback
        return sendViaDataChannel(dcRef.current, msg);
      }
    }
    return sendViaDataChannel(dcRef.current, msg);
  }, []);

  const disconnect = useCallback(() => {
    cleanup();
    setWebrtcState('idle');
    stateRef.current = 'idle';
    setIncomingCall(null);
  }, [cleanup]);

  return {
    webrtcState,
    webrtcConnected: webrtcState === 'connected',
    localStream,
    remoteStream,
    videoEnabled,
    audioEnabled,
    remoteVideoActive,
    incomingCall,          // { from: string } or null
    initiateConnection,
    acceptIncomingCall,    // Accept incoming video call
    declineIncomingCall,   // Decline incoming video call
    toggleVideo,
    toggleAudio,
    flipCamera,
    sendDirectMessage,
    disconnect,
  };
}

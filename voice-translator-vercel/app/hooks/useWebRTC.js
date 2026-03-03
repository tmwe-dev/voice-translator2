'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createPeerConnection, createDataChannel, createOffer,
  createAnswer, acceptAnswer, addIceCandidate,
  sendViaDataChannel, collectIceCandidates,
  addMediaTracks, removeMediaTracks, getLocalMediaStream,
  setVideoEnabled, switchCamera,
} from '../lib/webrtc.js';

// ═══════════════════════════════════════════════
// useWebRTC — React hook for P2P video call + data channel
//
// Manages:
// - WebRTC peer connection lifecycle
// - Video call (local + remote streams)
// - DataChannel for direct messaging (~50ms)
// - Signaling via /api/room
// - Auto-fallback to polling if WebRTC fails
//
// Usage:
//   const webrtc = useWebRTC({ roomId, myName, onDirectMessage });
//   <video ref={el => { if (el) el.srcObject = webrtc.remoteStream; }} />
// ═══════════════════════════════════════════════

const SIGNAL_POLL_INTERVAL = 1000;
const CONNECTION_TIMEOUT = 15000;

export default function useWebRTC({ roomId, myName, onDirectMessage }) {
  const [webrtcState, setWebrtcState] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabledState] = useState(false);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const signalPollRef = useRef(null);
  const timeoutRef = useRef(null);
  const sendersRef = useRef([]);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const processedSignalsRef = useRef(new Set());

  const webrtcConnected = webrtcState === 'connected';

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (signalPollRef.current) clearInterval(signalPollRef.current);
    if (dcRef.current) {
      try { dcRef.current.close(); } catch {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch {} });
      localStreamRef.current = null;
    }
    sendersRef.current = [];
    processedSignalsRef.current.clear();
    setLocalStream(null);
    setRemoteStream(null);
    setVideoEnabledState(false);
    setRemoteVideoActive(false);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ── Signaling ──
  const sendSignal = useCallback(async (type, data) => {
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'webrtc-signal',
          roomId,
          signal: { type, data, from: myName, timestamp: Date.now() },
        }),
      });
    } catch (e) {
      console.error('[WebRTC] Signal send error:', e);
    }
  }, [roomId, myName]);

  const pollSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'webrtc-poll', roomId, name: myName }),
      });
      if (res.ok) {
        const data = await res.json();
        // Dedup: skip signals we've already processed
        const newSignals = (data.signals || []).filter(s => {
          const key = `${s.type}:${s.from}:${s.timestamp}`;
          if (processedSignalsRef.current.has(key)) return false;
          processedSignalsRef.current.add(key);
          // Cap dedup set
          if (processedSignalsRef.current.size > 200) {
            const first = processedSignalsRef.current.values().next().value;
            processedSignalsRef.current.delete(first);
          }
          return true;
        });
        return newSignals;
      }
    } catch {}
    return [];
  }, [roomId, myName]);

  // ── Handle incoming remote tracks ──
  const handleRemoteTrack = useCallback((track, stream) => {
    console.log('[WebRTC] Remote track:', track.kind);
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }
    remoteStreamRef.current.addTrack(track);
    setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    if (track.kind === 'video') setRemoteVideoActive(true);

    track.onended = () => {
      if (track.kind === 'video') setRemoteVideoActive(false);
    };
    track.onmute = () => {
      if (track.kind === 'video') setRemoteVideoActive(false);
    };
    track.onunmute = () => {
      if (track.kind === 'video') setRemoteVideoActive(true);
    };
  }, []);

  const handleDCMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      onDirectMessage?.(msg);
    } catch {}
  }, [onDirectMessage]);

  const handleStateChange = useCallback((state) => {
    console.log('[WebRTC] State:', state);
    if (state === 'connected') {
      setWebrtcState('connected');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      setWebrtcState('failed');
      cleanup();
    }
  }, [cleanup]);

  // ── Setup data channel handlers ──
  function setupDC(dc) {
    dcRef.current = dc;
    dc.onopen = () => {
      setWebrtcState('connected');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    dc.onmessage = handleDCMessage;
    dc.onclose = () => setWebrtcState('failed');
  }

  // ── Initiate connection (caller side) ──
  const initiateConnection = useCallback(async (withVideo = false) => {
    if (webrtcState === 'connecting' || webrtcState === 'connected') return;
    cleanup();
    setWebrtcState('connecting');

    try {
      const pc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
      pcRef.current = pc;

      // Data channel
      const dc = createDataChannel(pc);
      setupDC(dc);

      // Add video if requested
      if (withVideo) {
        try {
          const stream = await getLocalMediaStream({ video: true, audio: false });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoEnabledState(true);
          sendersRef.current = addMediaTracks(pc, stream);
        } catch (e) {
          console.warn('[WebRTC] Camera access failed:', e);
        }
      }

      // ICE candidates
      collectIceCandidates(pc, async (candidateStr) => {
        await sendSignal('ice-candidate', candidateStr);
      });

      // Create and send offer
      const offerStr = await createOffer(pc);
      await sendSignal('offer', offerStr);

      // Poll for answer + ICE candidates
      signalPollRef.current = setInterval(async () => {
        const signals = await pollSignals();
        for (const sig of signals) {
          if (sig.from === myName) continue;
          if (sig.type === 'answer' && pc.signalingState !== 'stable') {
            await acceptAnswer(pc, sig.data);
          } else if (sig.type === 'ice-candidate') {
            await addIceCandidate(pc, sig.data);
          }
        }
      }, SIGNAL_POLL_INTERVAL);

      // Timeout
      timeoutRef.current = setTimeout(() => {
        if (webrtcState !== 'connected') {
          console.log('[WebRTC] Connection timeout');
          setWebrtcState('failed');
          cleanup();
        }
      }, CONNECTION_TIMEOUT);

    } catch (e) {
      console.error('[WebRTC] Init error:', e);
      setWebrtcState('failed');
      cleanup();
    }
  }, [webrtcState, cleanup, handleDCMessage, handleStateChange, handleRemoteTrack, sendSignal, pollSignals, myName]);

  // ── Accept connection (callee side) ──
  const acceptConnectionFromOffer = useCallback(async (offerStr, withVideo = false) => {
    cleanup();
    setWebrtcState('connecting');

    try {
      const pc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
      pcRef.current = pc;

      // Listen for data channel
      pc.ondatachannel = (event) => setupDC(event.channel);

      // Add video if requested
      if (withVideo) {
        try {
          const stream = await getLocalMediaStream({ video: true, audio: false });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoEnabledState(true);
          sendersRef.current = addMediaTracks(pc, stream);
        } catch (e) {
          console.warn('[WebRTC] Camera access failed:', e);
        }
      }

      // ICE candidates
      collectIceCandidates(pc, async (candidateStr) => {
        await sendSignal('ice-candidate', candidateStr);
      });

      // Answer
      const answerStr = await createAnswer(pc, offerStr);
      await sendSignal('answer', answerStr);

      // Poll for ICE
      signalPollRef.current = setInterval(async () => {
        const signals = await pollSignals();
        for (const sig of signals) {
          if (sig.from === myName) continue;
          if (sig.type === 'ice-candidate') {
            await addIceCandidate(pc, sig.data);
          }
        }
      }, SIGNAL_POLL_INTERVAL);

      // Timeout
      timeoutRef.current = setTimeout(() => {
        if (webrtcState !== 'connected') {
          setWebrtcState('failed');
          cleanup();
        }
      }, CONNECTION_TIMEOUT);

    } catch (e) {
      console.error('[WebRTC] Accept error:', e);
      setWebrtcState('failed');
      cleanup();
    }
  }, [cleanup, handleDCMessage, handleStateChange, handleRemoteTrack, sendSignal, pollSignals, myName]);

  // ── Toggle video on/off during call ──
  const toggleVideo = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    if (videoEnabled && localStreamRef.current) {
      // Turn off video
      setVideoEnabled(localStreamRef.current, false);
      setVideoEnabledState(false);
      // Notify partner
      sendDirectMessage({ type: 'video-toggle', enabled: false });
    } else {
      // Turn on video
      try {
        if (localStreamRef.current) {
          // Re-enable existing tracks
          setVideoEnabled(localStreamRef.current, true);
          setVideoEnabledState(true);
        } else {
          // Get new camera stream
          const stream = await getLocalMediaStream({ video: true, audio: false });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setVideoEnabledState(true);
          sendersRef.current = addMediaTracks(pc, stream);
          // Need renegotiation
          const offerStr = await createOffer(pc);
          await sendSignal('renegotiate', offerStr);
        }
        sendDirectMessage({ type: 'video-toggle', enabled: true });
      } catch (e) {
        console.warn('[WebRTC] Camera failed:', e);
      }
    }
  }, [videoEnabled, sendSignal]);

  // ── Switch camera front/back ──
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || sendersRef.current.length === 0) return;
    try {
      const newStream = await switchCamera(localStreamRef.current, sendersRef.current);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
    } catch (e) {
      console.warn('[WebRTC] Camera flip failed:', e);
    }
  }, []);

  // ── Send via DataChannel ──
  const sendDirectMessage = useCallback((msg) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return false;
    return sendViaDataChannel(dcRef.current, msg);
  }, []);

  // ── Auto-connect when partner joins ──
  // Host initiates, guest accepts
  useEffect(() => {
    if (!roomId || !myName || webrtcState !== 'idle') return;

    // Poll for incoming offers
    const checkForOffer = async () => {
      const signals = await pollSignals();
      for (const sig of signals) {
        if (sig.from === myName) continue;
        if (sig.type === 'offer') {
          console.log('[WebRTC] Received offer from', sig.from);
          acceptConnectionFromOffer(sig.data, false);
          return;
        }
      }
    };

    const interval = setInterval(checkForOffer, 2000);
    return () => clearInterval(interval);
  }, [roomId, myName, webrtcState, pollSignals, acceptConnectionFromOffer]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    cleanup();
    setWebrtcState('idle');
  }, [cleanup]);

  return {
    webrtcState,
    webrtcConnected,
    localStream,
    remoteStream,
    videoEnabled,
    remoteVideoActive,
    initiateConnection,
    acceptConnection: acceptConnectionFromOffer,
    toggleVideo,
    flipCamera,
    sendDirectMessage,
    disconnect,
  };
}

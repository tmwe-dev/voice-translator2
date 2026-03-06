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

// ═══════════════════════════════════════════════
// useWebRTC — P2P video call with Supabase Realtime signaling
//
// BEFORE: Signaling via Redis polling (1-2s delay → connection failures)
// AFTER:  Signaling via Supabase Realtime broadcast (~50ms → instant)
//
// Flow:
// 1. User A clicks video → sends "offer" via Realtime channel
// 2. User B receives offer instantly → sends "answer" back
// 3. ICE candidates exchanged in real-time via same channel
// 4. P2P connection established directly between devices
// ═══════════════════════════════════════════════

const CONNECTION_TIMEOUT = 30000; // 30s (was 15s — more time for mobile)

export default function useWebRTC({ roomId, myName, onDirectMessage, roomSessionTokenRef }) {
  const [webrtcState, setWebrtcState] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoEnabled, setVideoEnabledState] = useState(false);
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);
  const [audioEnabled, setAudioEnabledState] = useState(true);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const timeoutRef = useRef(null);
  const sendersRef = useRef([]);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const channelRef = useRef(null);
  const stateRef = useRef('idle'); // mirrors webrtcState for use in async callbacks
  const iceCandidateQueueRef = useRef([]); // queue ICE candidates until remote desc is set

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = webrtcState; }, [webrtcState]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
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

  const sendSignal = useCallback((type, data) => {
    if (!channelRef.current) {
      console.warn('[WebRTC] No signaling channel');
      return;
    }
    channelRef.current.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: { type, data, from: myName, timestamp: Date.now() },
    });
  }, [myName]);

  // ── Handle incoming remote tracks ──
  const handleRemoteTrack = useCallback((track, stream) => {
    console.log('[WebRTC] Remote track received:', track.kind, 'stream:', !!stream);
    // Use the provided stream if available (keeps audio+video in sync)
    if (stream) {
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    } else {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    }
    if (track.kind === 'video') setRemoteVideoActive(true);

    track.onended = () => { if (track.kind === 'video') setRemoteVideoActive(false); };
    track.onmute = () => { if (track.kind === 'video') setRemoteVideoActive(false); };
    track.onunmute = () => { if (track.kind === 'video') setRemoteVideoActive(true); };
  }, []);

  const handleDCMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      onDirectMessage?.(msg);
    } catch {}
  }, [onDirectMessage]);

  const handleStateChange = useCallback((state) => {
    console.log('[WebRTC] Connection state:', state);
    if (state === 'connected') {
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      setWebrtcState('failed');
      stateRef.current = 'failed';
      cleanup();
    }
  }, [cleanup]);

  function setupDC(dc) {
    dcRef.current = dc;
    dc.onopen = () => {
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
    dc.onmessage = handleDCMessage;
    dc.onclose = () => {
      setWebrtcState('failed');
      stateRef.current = 'failed';
    };
  }

  // ── Get media stream with fallback ──
  async function getMediaWithFallback(withVideo) {
    try {
      const stream = await getLocalMediaStream({ video: withVideo, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (withVideo) setVideoEnabledState(true);
      return stream;
    } catch (e) {
      console.warn('[WebRTC] Media failed:', e);
      if (withVideo) {
        try {
          const stream = await getLocalMediaStream({ video: false, audio: true });
          localStreamRef.current = stream;
          setLocalStream(stream);
          return stream;
        } catch (e2) {
          console.warn('[WebRTC] Audio-only also failed:', e2);
        }
      }
    }
    return null;
  }

  // ── Flush queued ICE candidates after remote description is set ──
  async function flushIceCandidates(pc) {
    const queue = iceCandidateQueueRef.current;
    iceCandidateQueueRef.current = [];
    for (const candidateStr of queue) {
      try {
        await addIceCandidate(pc, candidateStr);
      } catch (e) {
        console.warn('[WebRTC] Queued ICE candidate error:', e.message);
      }
    }
  }

  // ── Handle incoming signal from Realtime ──
  const handleIncomingSignal = useCallback(async (payload) => {
    if (!payload || payload.from === myName) return;
    const { type, data } = payload;

    console.log('[WebRTC] Signal received:', type, 'from:', payload.from, 'state:', stateRef.current);

    if (type === 'offer') {
      // Someone is calling us — auto-accept
      if (stateRef.current === 'connecting' || stateRef.current === 'connected') {
        console.log('[WebRTC] Already busy, ignoring offer');
        return;
      }

      cleanup();
      setWebrtcState('connecting');
      stateRef.current = 'connecting';
      iceCandidateQueueRef.current = [];

      try {
        const newPc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
        pcRef.current = newPc;
        newPc.ondatachannel = (event) => setupDC(event.channel);

        // Match caller's media: if the offer contains video, we send video too
        const offerSdp = JSON.parse(data);
        const callerHasVideo = offerSdp.sdp?.includes('m=video');
        const stream = await getMediaWithFallback(callerHasVideo);
        if (stream) sendersRef.current = addMediaTracks(newPc, stream);

        collectIceCandidates(newPc, (candidateStr) => {
          sendSignal('ice-candidate', candidateStr);
        });

        const answerStr = await createAnswer(newPc, data);
        sendSignal('answer', answerStr);

        // Flush any ICE candidates that arrived before remote description was set
        await flushIceCandidates(newPc);

        timeoutRef.current = setTimeout(() => {
          if (stateRef.current !== 'connected') {
            console.log('[WebRTC] Callee timeout');
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
          // Flush any ICE candidates that arrived before answer
          await flushIceCandidates(pc);
        } catch (e) {
          console.error('[WebRTC] Accept answer error:', e);
        }
      }

    } else if (type === 'ice-candidate') {
      const pc = pcRef.current;
      if (!pc) return;
      // Queue if remote description not yet set
      if (!pc.remoteDescription || !pc.remoteDescription.type) {
        iceCandidateQueueRef.current.push(data);
        return;
      }
      try {
        await addIceCandidate(pc, data);
      } catch (e) {
        console.warn('[WebRTC] ICE candidate error:', e.message);
      }

    } else if (type === 'renegotiate') {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal('answer', JSON.stringify(pc.localDescription));
      } catch (e) {
        console.error('[WebRTC] Renegotiate error:', e);
      }
    }
  }, [myName, cleanup, handleDCMessage, handleStateChange, handleRemoteTrack, sendSignal]);

  // Keep a stable ref to the signal handler (prevents channel re-subscription on every render)
  const handleIncomingSignalRef = useRef(handleIncomingSignal);
  useEffect(() => { handleIncomingSignalRef.current = handleIncomingSignal; }, [handleIncomingSignal]);

  // ── Subscribe to Realtime signaling channel when in a room ──
  useEffect(() => {
    if (!roomId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(`webrtc:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'webrtc-signal' }, (event) => {
      handleIncomingSignalRef.current(event.payload);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[WebRTC] Signaling channel ready for room:${roomId}`);
      }
    });

    channelRef.current = channel;

    return () => {
      try { channel.unsubscribe(); } catch {}
      channelRef.current = null;
    };
  }, [roomId]); // Only re-subscribe when roomId changes

  // ── Initiate connection (caller side) ──
  const initiateConnection = useCallback(async (withVideo = false) => {
    if (stateRef.current === 'connecting' || stateRef.current === 'connected') return;
    cleanup();
    setWebrtcState('connecting');
    stateRef.current = 'connecting';
    iceCandidateQueueRef.current = [];

    try {
      const pc = createPeerConnection(handleDCMessage, handleStateChange, handleRemoteTrack);
      pcRef.current = pc;

      const dc = createDataChannel(pc);
      setupDC(dc);

      const stream = await getMediaWithFallback(withVideo);
      if (stream) sendersRef.current = addMediaTracks(pc, stream);

      collectIceCandidates(pc, (candidateStr) => {
        sendSignal('ice-candidate', candidateStr);
      });

      // Create and send offer via Realtime (instant delivery!)
      const offerStr = await createOffer(pc);
      sendSignal('offer', offerStr);

      timeoutRef.current = setTimeout(() => {
        if (stateRef.current !== 'connected') {
          console.log('[WebRTC] Caller timeout');
          setWebrtcState('failed');
          stateRef.current = 'failed';
          cleanup();
        }
      }, CONNECTION_TIMEOUT);

    } catch (e) {
      console.error('[WebRTC] Init error:', e);
      setWebrtcState('failed');
      stateRef.current = 'failed';
      cleanup();
    }
  }, [cleanup, handleDCMessage, handleStateChange, handleRemoteTrack, sendSignal]);

  // ── Toggle video on/off during call ──
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
            sendSignal('renegotiate', offerStr);
          }
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

  // ── Toggle P2P audio (mute/unmute) ──
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newState = !audioEnabled;
    for (const track of audioTracks) {
      track.enabled = newState;
    }
    setAudioEnabledState(newState);
    sendDirectMessage({ type: 'audio-toggle', enabled: newState });
  }, [audioEnabled]);

  // ── Send via DataChannel ──
  const sendDirectMessage = useCallback((msg) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return false;
    return sendViaDataChannel(dcRef.current, msg);
  }, []);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    cleanup();
    setWebrtcState('idle');
    stateRef.current = 'idle';
  }, [cleanup]);

  return {
    webrtcState,
    webrtcConnected: webrtcState === 'connected',
    localStream,
    remoteStream,
    videoEnabled,
    audioEnabled,
    remoteVideoActive,
    initiateConnection,
    acceptConnection: () => {}, // Auto-accepted via Realtime signal
    toggleVideo,
    toggleAudio,
    flipCamera,
    sendDirectMessage,
    disconnect,
  };
}

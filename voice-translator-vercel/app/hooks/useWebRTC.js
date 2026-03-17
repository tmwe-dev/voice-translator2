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

  useEffect(() => { stateRef.current = webrtcState; }, [webrtcState]);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    if (incomingCallTimerRef.current) { clearTimeout(incomingCallTimerRef.current); incomingCallTimerRef.current = null; }
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
    console.log('[WebRTC] Remote track received:', track.kind);
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

  // ── Connection state handler ──
  const handleStateChange = useCallback((info) => {
    const { source, state } = typeof info === 'object' ? info : { source: 'unknown', state: info };
    console.log(`[WebRTC] State change: ${source}=${state}`);

    if (state === 'connected' || state === 'completed') {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setWebrtcState('connected');
      stateRef.current = 'connected';
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    } else if (state === 'disconnected') {
      if (!disconnectTimerRef.current && stateRef.current === 'connected') {
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null;
          const pc = pcRef.current;
          if (pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' ||
                     pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
            setWebrtcState('failed');
            stateRef.current = 'failed';
            cleanup();
          }
        }, 10000);
      }
    } else if (state === 'failed' || state === 'closed') {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
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
    dc.onclose = () => { dcRef.current = null; };
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

  const sendDirectMessage = useCallback((msg) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return false;
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

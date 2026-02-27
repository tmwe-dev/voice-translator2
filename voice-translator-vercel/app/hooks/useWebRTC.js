'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createPeerConnection, createDataChannel, createOffer,
  createAnswer, acceptAnswer, addIceCandidate,
  sendViaDataChannel, collectIceCandidates,
} from '../lib/webrtc.js';

// ═══════════════════════════════════════════════
// useWebRTC — React hook for direct phone-to-phone connection
//
// Manages WebRTC DataChannel lifecycle:
// - Signaling via /api/room (webrtc-signal action)
// - ICE candidate exchange
// - Automatic fallback to polling if WebRTC fails
//
// Usage in RoomView:
//   const { webrtcConnected, initiateConnection, sendDirectMessage } = useWebRTC(roomId, onMessage);
// ═══════════════════════════════════════════════

const SIGNAL_POLL_INTERVAL = 1000; // Check for signaling messages
const CONNECTION_TIMEOUT = 15000;  // 15s to establish connection

export default function useWebRTC({ roomId, myName, onDirectMessage }) {
  const [webrtcState, setWebrtcState] = useState('idle'); // idle | connecting | connected | failed
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const signalPollRef = useRef(null);
  const iceCandidatesRef = useRef([]);
  const timeoutRef = useRef(null);

  const webrtcConnected = webrtcState === 'connected';

  // Cleanup function
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
    iceCandidatesRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Send a WebRTC signal via the room API
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

  // Poll for incoming signals
  const pollSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'webrtc-poll',
          roomId,
          name: myName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.signals || [];
      }
    } catch {}
    return [];
  }, [roomId, myName]);

  // Handle incoming DataChannel message
  const handleDCMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      onDirectMessage?.(msg);
    } catch (e) {
      console.error('[WebRTC] Message parse error:', e);
    }
  }, [onDirectMessage]);

  // Handle connection state changes
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

  // Initiate connection (caller side)
  const initiateConnection = useCallback(async () => {
    if (webrtcState === 'connecting' || webrtcState === 'connected') return;
    cleanup();
    setWebrtcState('connecting');

    try {
      // Create peer connection
      const pc = createPeerConnection(handleDCMessage, handleStateChange);
      pcRef.current = pc;

      // Create data channel
      const dc = createDataChannel(pc);
      dcRef.current = dc;
      dc.onopen = () => {
        setWebrtcState('connected');
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
      dc.onmessage = handleDCMessage;
      dc.onclose = () => setWebrtcState('failed');

      // Collect ICE candidates
      collectIceCandidates(pc, async (candidateStr) => {
        await sendSignal('ice-candidate', candidateStr);
      });

      // Create and send offer
      const offerStr = await createOffer(pc);
      await sendSignal('offer', offerStr);

      // Start polling for answer + ICE candidates
      signalPollRef.current = setInterval(async () => {
        const signals = await pollSignals();
        for (const sig of signals) {
          if (sig.from === myName) continue; // Skip own signals
          if (sig.type === 'answer' && pc.signalingState !== 'stable') {
            await acceptAnswer(pc, sig.data);
          } else if (sig.type === 'ice-candidate') {
            await addIceCandidate(pc, sig.data);
          }
        }
      }, SIGNAL_POLL_INTERVAL);

      // Connection timeout
      timeoutRef.current = setTimeout(() => {
        if (webrtcState !== 'connected') {
          console.log('[WebRTC] Connection timeout — falling back to polling');
          setWebrtcState('failed');
          cleanup();
        }
      }, CONNECTION_TIMEOUT);

    } catch (e) {
      console.error('[WebRTC] Init error:', e);
      setWebrtcState('failed');
      cleanup();
    }
  }, [webrtcState, cleanup, handleDCMessage, handleStateChange, sendSignal, pollSignals, myName]);

  // Accept connection (callee side) — called when we receive an offer
  const acceptConnection = useCallback(async (offerStr) => {
    cleanup();
    setWebrtcState('connecting');

    try {
      const pc = createPeerConnection(handleDCMessage, handleStateChange);
      pcRef.current = pc;

      // Listen for incoming data channel
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;
        dc.onopen = () => {
          setWebrtcState('connected');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
        dc.onmessage = handleDCMessage;
        dc.onclose = () => setWebrtcState('failed');
      };

      // Collect ICE candidates
      collectIceCandidates(pc, async (candidateStr) => {
        await sendSignal('ice-candidate', candidateStr);
      });

      // Create and send answer
      const answerStr = await createAnswer(pc, offerStr);
      await sendSignal('answer', answerStr);

      // Poll for ICE candidates
      signalPollRef.current = setInterval(async () => {
        const signals = await pollSignals();
        for (const sig of signals) {
          if (sig.from === myName) continue;
          if (sig.type === 'ice-candidate') {
            await addIceCandidate(pc, sig.data);
          }
        }
      }, SIGNAL_POLL_INTERVAL);

      // Connection timeout
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
  }, [cleanup, handleDCMessage, handleStateChange, sendSignal, pollSignals, myName]);

  // Send message via DataChannel
  const sendDirectMessage = useCallback((msg) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') return false;
    return sendViaDataChannel(dcRef.current, msg);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
    setWebrtcState('idle');
  }, [cleanup]);

  return {
    webrtcState,
    webrtcConnected,
    initiateConnection,
    acceptConnection,
    sendDirectMessage,
    disconnect,
  };
}

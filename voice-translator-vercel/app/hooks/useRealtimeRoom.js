'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * useRealtimeRoom — Supabase Realtime Channels for room communication.
 *
 * Replaces the 1-second polling loop with push-based WebSocket events.
 * Falls back gracefully if Supabase isn't configured (polling still works).
 *
 * Events broadcast on channel `room:{roomId}`:
 *   - "new-message"    → { message }           (new translated message)
 *   - "speaking"       → { name, speaking, liveText, typing }
 *   - "member-update"  → { members }           (join/leave/lang change)
 *   - "heartbeat"      → { name }              (presence keepalive)
 *
 * This hook does NOT replace the API routes — messages are still stored
 * in Redis via POST /api/messages. This just broadcasts them instantly
 * to all connected clients so they don't need to poll.
 */
export default function useRealtimeRoom({
  roomId,
  myName,
  onNewMessage,
  onSpeakingChange,
  onMemberUpdate,
  onPresenceChange,
}) {
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const readyRef = useRef(false);

  /**
   * Subscribe to a room channel
   */
  const subscribe = useCallback((rid) => {
    // Unsubscribe from previous channel if any
    readyRef.current = false;
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }

    // Get Supabase client directly (no lazy useEffect init — eliminates race condition)
    const supabase = getSupabaseClient();
    console.log('[Realtime] subscribe() called, rid:', rid, 'supabase:', !!supabase);
    if (!supabase || !rid) {
      console.warn('[Realtime] Cannot subscribe — supabase:', !!supabase, 'rid:', rid);
      return;
    }

    const channel = supabase.channel(`room:${rid}`, {
      config: { broadcast: { self: false } }, // Don't receive own broadcasts
    });

    // ── Listen for new messages ──
    channel.on('broadcast', { event: 'new-message' }, (payload) => {
      if (payload.payload?.message && onNewMessage) {
        onNewMessage(payload.payload.message);
      }
    });

    // ── Listen for speaking/typing state changes ──
    channel.on('broadcast', { event: 'speaking' }, (payload) => {
      if (payload.payload && onSpeakingChange) {
        onSpeakingChange(payload.payload);
      }
    });

    // ── Listen for member updates (join/leave/lang change) ──
    channel.on('broadcast', { event: 'member-update' }, (payload) => {
      if (payload.payload && onMemberUpdate) {
        onMemberUpdate(payload.payload);
      }
    });

    // ── Listen for heartbeats (presence) ──
    channel.on('broadcast', { event: 'heartbeat' }, (payload) => {
      if (payload.payload && onPresenceChange) {
        onPresenceChange(payload.payload);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        readyRef.current = true;
        setConnected(true);
        console.log(`[Realtime] Connected to room:${rid}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        readyRef.current = false;
        setConnected(false);
        console.warn(`[Realtime] Channel ${status} for room:${rid}`);
      }
    });

    channelRef.current = channel;
  }, [onNewMessage, onSpeakingChange, onMemberUpdate, onPresenceChange]);

  /**
   * Unsubscribe from current room
   */
  const unsubscribe = useCallback(() => {
    readyRef.current = false;
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }
  }, []);

  /**
   * Safe broadcast helper — checks channel readiness and validates result.
   */
  const safeBroadcast = useCallback(async (event, payload) => {
    if (!channelRef.current || !readyRef.current) return false;

    const result = await channelRef.current.send({
      type: 'broadcast',
      event,
      payload,
    });

    if (result !== 'ok') {
      console.warn(`[Realtime] Broadcast failed for ${event}:`, result);
      return false;
    }

    return true;
  }, []);

  /**
   * Broadcast a new message to all room participants.
   * Called AFTER the message is saved to Redis (in sendMessage).
   */
  const broadcastMessage = useCallback((message) => {
    return safeBroadcast('new-message', { message });
  }, [safeBroadcast]);

  /**
   * Broadcast speaking/typing state change
   */
  const broadcastSpeaking = useCallback((data) => {
    return safeBroadcast('speaking', data);
  }, [safeBroadcast]);

  /**
   * Broadcast member update (join/leave/lang change)
   */
  const broadcastMemberUpdate = useCallback((data) => {
    return safeBroadcast('member-update', data);
  }, [safeBroadcast]);

  /**
   * Broadcast heartbeat (presence keepalive)
   */
  const broadcastHeartbeat = useCallback((name) => {
    return safeBroadcast('heartbeat', { name, ts: Date.now() });
  }, [safeBroadcast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    connected,
    subscribe,
    unsubscribe,
    broadcastMessage,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  };
}

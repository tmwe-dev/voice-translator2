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
  const supabaseRef = useRef(null);

  // Initialize Supabase client once
  useEffect(() => {
    supabaseRef.current = getSupabaseClient();
  }, []);

  /**
   * Subscribe to a room channel
   */
  const subscribe = useCallback((rid) => {
    // Unsubscribe from previous channel if any
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }

    const supabase = supabaseRef.current;
    if (!supabase || !rid) return;

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
        setConnected(true);
        console.log(`[Realtime] Connected to room:${rid}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
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
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }
  }, []);

  /**
   * Broadcast a new message to all room participants.
   * Called AFTER the message is saved to Redis (in sendMessage).
   */
  const broadcastMessage = useCallback((message) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'new-message',
      payload: { message },
    });
  }, []);

  /**
   * Broadcast speaking/typing state change
   */
  const broadcastSpeaking = useCallback((data) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'speaking',
      payload: data,
    });
  }, []);

  /**
   * Broadcast member update (join/leave/lang change)
   */
  const broadcastMemberUpdate = useCallback((data) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'member-update',
      payload: data,
    });
  }, []);

  /**
   * Broadcast heartbeat (presence keepalive)
   */
  const broadcastHeartbeat = useCallback((name) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'heartbeat',
      payload: { name, ts: Date.now() },
    });
  }, []);

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

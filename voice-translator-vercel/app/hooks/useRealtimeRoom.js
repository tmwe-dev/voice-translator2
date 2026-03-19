'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * useRealtimeRoom — Supabase Realtime Channels for room communication.
 *
 * Uses REFS for all callbacks to avoid stale closures.
 * The channel is subscribed ONCE and always calls the latest callback versions.
 */
export default function useRealtimeRoom({
  roomId,
  myName,
  onNewMessage,
  onMessageUpdate,
  onSpeakingChange,
  onMemberUpdate,
  onPresenceChange,
}) {
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const readyRef = useRef(false);

  // ── Callback refs: always point to the LATEST version ──
  // This eliminates stale closure bugs in channel event handlers.
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdateRef = useRef(onMessageUpdate);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const onMemberUpdateRef = useRef(onMemberUpdate);
  const onPresenceChangeRef = useRef(onPresenceChange);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onMessageUpdateRef.current = onMessageUpdate; }, [onMessageUpdate]);
  useEffect(() => { onSpeakingChangeRef.current = onSpeakingChange; }, [onSpeakingChange]);
  useEffect(() => { onMemberUpdateRef.current = onMemberUpdate; }, [onMemberUpdate]);
  useEffect(() => { onPresenceChangeRef.current = onPresenceChange; }, [onPresenceChange]);

  /**
   * Subscribe to a room channel.
   * No callback dependencies — channel handlers read from refs.
   */
  const subscribe = useCallback((rid) => {
    readyRef.current = false;
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }

    const supabase = getSupabaseClient();
    console.log('[Realtime] subscribe() called, rid:', rid, 'supabase:', !!supabase);
    if (!supabase || !rid) {
      console.warn('[Realtime] Cannot subscribe — supabase:', !!supabase, 'rid:', rid);
      return;
    }

    const channel = supabase.channel(`room:${rid}`, {
      config: { broadcast: { self: false } },
    });

    // All handlers read from refs → always call the latest callback version
    channel.on('broadcast', { event: 'new-message' }, (payload) => {
      if (payload.payload?.message && onNewMessageRef.current) {
        onNewMessageRef.current(payload.payload.message);
      }
    });

    channel.on('broadcast', { event: 'message-update' }, (payload) => {
      if (payload.payload && onMessageUpdateRef.current) {
        onMessageUpdateRef.current(payload.payload);
      }
    });

    channel.on('broadcast', { event: 'speaking' }, (payload) => {
      if (payload.payload && onSpeakingChangeRef.current) {
        onSpeakingChangeRef.current(payload.payload);
      }
    });

    channel.on('broadcast', { event: 'member-update' }, (payload) => {
      if (payload.payload && onMemberUpdateRef.current) {
        onMemberUpdateRef.current(payload.payload);
      }
    });

    channel.on('broadcast', { event: 'heartbeat' }, (payload) => {
      if (payload.payload && onPresenceChangeRef.current) {
        onPresenceChangeRef.current(payload.payload);
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
  }, []); // No deps — handlers use refs

  const unsubscribe = useCallback(() => {
    readyRef.current = false;
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch {}
      channelRef.current = null;
      setConnected(false);
    }
  }, []);

  // ── Broadcast with single retry on failure ──
  // Supabase Realtime does NOT guarantee delivery — if the first attempt fails
  // (transient network blip, channel reconnecting), a single retry after 500ms
  // catches most cases. Combined with P2P DataChannel + HTTP polling, this gives
  // triple redundancy for every message.
  const safeBroadcast = useCallback(async (event, payload) => {
    if (!channelRef.current || !readyRef.current) return false;
    try {
      const result = await channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
      if (result === 'ok') return true;
      // First attempt failed — retry once after 500ms
      console.warn(`[Realtime] Broadcast failed for ${event}, retrying in 500ms...`);
      await new Promise(r => setTimeout(r, 500));
      if (!channelRef.current || !readyRef.current) return false;
      const retry = await channelRef.current.send({ type: 'broadcast', event, payload });
      if (retry === 'ok') return true;
      console.warn(`[Realtime] Broadcast retry failed for ${event}`);
      return false;
    } catch (e) {
      console.error(`[Realtime] Broadcast error for ${event}:`, e);
      return false;
    }
  }, []);

  const broadcastMessage = useCallback((message) => {
    return safeBroadcast('new-message', { message });
  }, [safeBroadcast]);

  const broadcastMessageUpdate = useCallback((data) => {
    return safeBroadcast('message-update', data);
  }, [safeBroadcast]);

  const broadcastSpeaking = useCallback((data) => {
    return safeBroadcast('speaking', data);
  }, [safeBroadcast]);

  const broadcastMemberUpdate = useCallback((data) => {
    return safeBroadcast('member-update', data);
  }, [safeBroadcast]);

  const broadcastHeartbeat = useCallback((name) => {
    return safeBroadcast('heartbeat', { name, ts: Date.now() });
  }, [safeBroadcast]);

  useEffect(() => {
    return () => { unsubscribe(); };
  }, [unsubscribe]);

  return {
    connected,
    subscribe,
    unsubscribe,
    broadcastMessage,
    broadcastMessageUpdate,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  };
}

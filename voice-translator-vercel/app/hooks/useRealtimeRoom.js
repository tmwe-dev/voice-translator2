'use client';
import { useRef, useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('realtime');

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
  // b.128 — le conferme di consegna e lettura: prima esistevano solo
  // sul canale P2P, che vive solo durante una chiamata.
  onAck,
  onRead,
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
  const onAckRef = useRef(onAck);
  const onReadRef = useRef(onRead);

  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onMessageUpdateRef.current = onMessageUpdate; }, [onMessageUpdate]);
  useEffect(() => { onAckRef.current = onAck; }, [onAck]);
  useEffect(() => { onReadRef.current = onRead; }, [onRead]);
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
      try { channelRef.current.unsubscribe(); } catch { /* il canale era gia chiuso */ }
      channelRef.current = null;
      setConnected(false);
    }

    const supabase = getSupabaseClient();
    log.debug('[Realtime] subscribe() called, rid:', rid, 'supabase:', !!supabase);
    if (!supabase || !rid) {
      log.warn('[Realtime] Cannot subscribe — supabase:', !!supabase, 'rid:', rid);
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

    // b.128 — `self: false` sopra garantisce che la conferma non torni
    // a chi l'ha mandata: si segna consegnato solo cio che ha davvero
    // raggiunto l'altro telefono.
    channel.on('broadcast', { event: 'msg-ack' }, (payload) => {
      if (payload.payload?.msgId && onAckRef.current) {
        onAckRef.current(payload.payload.msgId);
      }
    });

    channel.on('broadcast', { event: 'msg-read' }, (payload) => {
      if (payload.payload?.msgId && onReadRef.current) {
        onReadRef.current(payload.payload.msgId);
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
        log.debug(`[Realtime] Connected to room:${rid}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        readyRef.current = false;
        setConnected(false);
        log.warn(`[Realtime] Channel ${status} for room:${rid}`);
      }
    });

    channelRef.current = channel;
  }, []); // No deps — handlers use refs

  const unsubscribe = useCallback(() => {
    readyRef.current = false;
    if (channelRef.current) {
      try { channelRef.current.unsubscribe(); } catch { /* il canale era gia chiuso */ }
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
      log.warn(`[Realtime] Broadcast failed for ${event}, retrying in 500ms...`);
      await new Promise(r => setTimeout(r, 500));
      if (!channelRef.current || !readyRef.current) return false;
      const retry = await channelRef.current.send({ type: 'broadcast', event, payload });
      if (retry === 'ok') return true;
      log.warn(`[Realtime] Broadcast retry failed for ${event}`);
      return false;
    } catch (e) {
      log.error(`[Realtime] Broadcast error for ${event}:`, e);
      return false;
    }
  }, []);

  const broadcastMessage = useCallback((message) => {
    return safeBroadcast('new-message', { message });
  }, [safeBroadcast]);

  const broadcastMessageUpdate = useCallback((data) => {
    return safeBroadcast('message-update', data);
  }, [safeBroadcast]);

  // ── b.128 · le conferme di consegna e lettura ──
  //
  // In b.120 avevo costruito cinque stati per un messaggio, e in
  // produzione ne funzionavano TRE. Trovato provando in due: il mio
  // messaggio restava a una spunta anche dopo che Luca aveva gia
  // risposto.
  //
  // Il motivo: `msg-ack` e `msg-read` venivano spediti SOLO da
  // `sendDirectMessageRef`, cioe sul canale dati WebRTC — che esiste
  // solo durante una chiamata. In chat normale non c'era nessun
  // mittente: 'consegnato' e 'letto' erano irraggiungibili.
  //
  // Non erano rotti. Non avevano proprio chi li mandasse. E nessun test
  // poteva accorgersene: il ricevente sa gestirli, la chat sa
  // mostrarli, manca solo chi parla — e quel vuoto si vede solo con due
  // telefoni accesi.
  const broadcastAck = useCallback((msgId) => {
    return safeBroadcast('msg-ack', { msgId });
  }, [safeBroadcast]);

  const broadcastRead = useCallback((msgId) => {
    return safeBroadcast('msg-read', { msgId });
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
    broadcastAck,
    broadcastRead,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  };
}

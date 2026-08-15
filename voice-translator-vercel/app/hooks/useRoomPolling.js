'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { CONTEXTS, getLang, LIVE_TEXT_THROTTLE, TYPING_TIMEOUT, SPEAKING_TIMEOUT } from '../lib/constants.js';
import useRealtimeRoom from './useRealtimeRoom.js';
import { createLogger } from '../lib/logger.js';
// b.138 — gli avvisi di questo hook si leggono a schermo: vanno tradotti.
import { tFuori } from '../lib/i18n.js';
const dbg = createLogger('polling');

// ═══════════════════════════════════════════════════════════════
// POLLING_INTERVAL: With Supabase Realtime active, polling is just
// a safety net. We poll every 6s to catch anything missed (was 10s).
// Reduced to 6s for faster recovery if both P2P and Realtime fail silently.
// Without Realtime, we fall back to 2s polling (still better than 1s).
// ═══════════════════════════════════════════════════════════════
const REALTIME_FALLBACK_POLL = 3000;   // 3s when WebSocket is active (was 6s)
const LEGACY_POLL_INTERVAL = 1500;     // 1.5s fallback when no WebSocket (was 2s)

// ── b.111 · a schermo spento si rallenta, non si smette ──
// Prima no: si chiedeva al server ogni secondo e mezzo anche col
// telefono in tasca. Quaranta richieste al minuto, a vuoto, per ogni
// persona in una stanza — batteria dell'utente e conto nostro.
//
// Perche RALLENTARE e non fermarsi del tutto, come fa il ticker
// condiviso: le notifiche di messaggio arrivano proprio quando la
// pagina e nascosta (useNotifications guarda `document.hidden`).
// Fermarsi le spegnerebbe. Sei volte piu lento e il compromesso: da 40
// richieste al minuto a 7, e un messaggio si annuncia entro nove
// secondi invece che entro uno e mezzo — su un telefono in tasca
// nessuno se ne accorge.
const FRENO_A_SCHERMO_SPENTO = 6;

const paginaNascosta = () =>
  typeof document !== 'undefined' && document.hidden;

const intervalloOra = (realtimeConnected) => {
  const base = realtimeConnected ? REALTIME_FALLBACK_POLL : LEGACY_POLL_INTERVAL;
  return paginaNascosta() ? base * FRENO_A_SCHERMO_SPENTO : base;
};

export default function useRoomPolling({
  prefsRef,
  myLangRef,
  roomInfoRef,
  queueAudio,
  getEffectiveToken,
  onMessageReceived, // Callback when a new unique incoming message arrives (for conversation context)
}) {
  const [roomId, setRoomId] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [partnerLiveText, setPartnerLiveText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);

  const pollRef = useRef(null);
  const pollFnRef = useRef(null);  // store pollFn so interval changes can reuse it
  const lastMsgRef = useRef(0);
  const liveTextTimerRef = useRef(null);
  const lastLiveTextRef = useRef('');
  // ── sentByMeRef: track IDs of messages I sent (for dedup) ──
  // LRU cap prevents unbounded growth after thousands of messages in long sessions
  const sentByMeRef = useRef(new Set());
  const addSentByMe = (id) => {
    sentByMeRef.current.add(id);
    if (sentByMeRef.current.size > 500) {
      const first = sentByMeRef.current.values().next().value;
      sentByMeRef.current.delete(first);
    }
  };
  const pollErrorCountRef = useRef(0);
  const [pollError, setPollError] = useState(false);
  const roomSessionTokenRef = useRef(null);
  const verifiedNameRef = useRef(null);
  const isHostRef = useRef(false);

  // ── Callback ref for conversation context ──
  const onMessageReceivedRef = useRef(onMessageReceived);
  onMessageReceivedRef.current = onMessageReceived;

  // ── Unified dedup: track ALL message IDs that have been processed for TTS ──
  // This prevents TTS replay when polling replaces a temp message with a server version
  const processedForTTSRef = useRef(new Set());

  // ── Guard: track message IDs that have already been through processIncomingMessage ──
  // This prevents calling processIncomingMessage twice for the same message when both
  // P2P and Realtime deliver it. Without this, handleRealtimeMessage calls it unconditionally.
  const processedMsgIdsRef = useRef(new Set());

  // ── Helper: process incoming message (shared by realtime + polling + P2P) ──
  // ALWAYS checks content fingerprint to prevent TTS replay.
  // This handles: P2P + Realtime arriving ~50ms apart, and polling replacing temp with server ID.
  const processIncomingMessage = useCallback((msg) => {
    if (!msg || !msg.id) { dbg.debug('[TTS-TRACE] skip: no msg/id'); return; }
    if (sentByMeRef.current.has(msg.id)) { dbg.debug('[TTS-TRACE] skip: sentByMe', msg.id); return; }
    const myVerifiedName = verifiedNameRef.current || prefsRef.current.name;
    if (msg.sender === myVerifiedName) { dbg.debug('[TTS-TRACE] skip: sender=me', msg.sender, '=', myVerifiedName); return; }

    // ── b.131 · la conferma parte DA QUI, che e l'imbuto di tutti ──
    //
    // In b.128 l'avevo messa in `handleRealtimeMessage`. Sbagliato: e
    // solo UNA delle due strade. I messaggi arrivano anche dal polling —
    // che e la strada primaria quando Realtime non e attivo, e quella
    // che resta viva quando la scheda va in secondo piano e il browser
    // sospende il canale.
    //
    // Provato in due schede: Bruno VEDEVA il messaggio (arrivato col
    // polling) e Ada restava con una spunta sola. La correzione di b.128
    // c'era, era deployata, e non serviva a niente meta delle volte.
    //
    // `processIncomingMessage` lo chiamano tutti e due i percorsi, e ha
    // gia i controlli giusti sopra: scarta i miei messaggi e quelli gia
    // visti. Il posto era questo dall'inizio.
    try { broadcastAckRef.current?.(msg.id); } catch (e) { /* la spunta restera a una: non vale un errore a schermo */ }

    const timeWindow = Math.floor((msg.timestamp || Date.now()) / 30000);
    const contentFingerprint = `${msg.sender}|${msg.original?.substring(0,20)}|${timeWindow}`;
    if (processedForTTSRef.current.has(contentFingerprint)) {
      dbg.debug('[TTS-TRACE] skip: fingerprint dup', contentFingerprint);
      return;
    }

    const myLang = myLangRef.current;
    let textToPlay = '';
    let speechLang = '';
    if (msg.translations && msg.translations[myLang]) {
      textToPlay = msg.translations[myLang];
      speechLang = getLang(myLang).speech;
    } else if (msg.sourceLang === myLang && msg.original) {
      textToPlay = msg.original;
      speechLang = getLang(myLang).speech;
    } else if (msg.targetLang === myLang && msg.translated) {
      textToPlay = msg.translated;
      speechLang = getLang(myLang).speech;
    }

    dbg.debug('[TTS-TRACE] processIncoming:', {
      id: msg.id?.substring(0,20), sender: msg.sender,
      myLang, myName: myVerifiedName,
      hasTranslations: !!msg.translations, translationKeys: msg.translations ? Object.keys(msg.translations) : [],
      sourceLang: msg.sourceLang, targetLang: msg.targetLang,
      hasTranslated: !!msg.translated,
      textToPlay: textToPlay?.substring(0,30) || '(empty)',
      autoPlay: prefsRef.current.autoPlay,
    });

    if (textToPlay && prefsRef.current.autoPlay !== false) {
      processedForTTSRef.current.add(contentFingerprint);
      if (processedForTTSRef.current.size > 500) {
        const first = processedForTTSRef.current.values().next().value;
        processedForTTSRef.current.delete(first);
      }
      dbg.debug('[TTS-TRACE] >>> queueAudio:', textToPlay?.substring(0,30), speechLang);
      queueAudio(textToPlay, speechLang, msg.id);
    } else {
      dbg.debug('[TTS-TRACE] no TTS:', textToPlay ? 'autoPlay=false' : 'no textToPlay');
    }

    // ── Feed incoming message to conversation context (knowledge base) ──
    if (onMessageReceivedRef.current && msg.original) {
      try {
        onMessageReceivedRef.current({
          sender: msg.sender,
          original: msg.original,
          translated: msg.translated || (msg.translations ? Object.values(msg.translations)[0] : null),
          sourceLang: msg.sourceLang,
          targetLang: msg.targetLang,
          timestamp: msg.timestamp || Date.now(),
        });
      } catch { /* la base di conoscenza perde un messaggio: la conversazione continua */ }
    }
  }, [prefsRef, myLangRef, queueAudio]);

  // ── Supabase Realtime handlers ──

  // b.128 — passa da un ref: `broadcastAck` nasce dalla destrutturazione
  // di useRealtimeRoom, che sta piu sotto. Leggerlo direttamente qui
  // funzionerebbe (la chiusura cattura il legame, non il valore) ma
  // legherebbe questa callback a un ordine di righe. Il ref lo rende
  // indipendente, come gia fa l'hook per i propri gestori.
  const broadcastAckRef = useRef(null);

  const handleRealtimeMessage = useCallback((message) => {
    // ── ID-based guard: skip if already processed by another delivery channel ──
    // P2P and Realtime both call this function for the same message.
    // Without this guard, processIncomingMessage would be called twice.
    const alreadyProcessed = processedMsgIdsRef.current.has(message.id);

    if (!alreadyProcessed) {
      processedMsgIdsRef.current.add(message.id);
      // LRU cap
      if (processedMsgIdsRef.current.size > 500) {
        const first = processedMsgIdsRef.current.values().next().value;
        processedMsgIdsRef.current.delete(first);
      }
    }

    setMessages(prev => {
      // Dedup by ID
      const ids = new Set(prev.map(m => m.id));
      if (ids.has(message.id)) return prev;
      // Caso inverso: il polling ha GIÀ portato la versione server di questo
      // messaggio (il suo clientId è il nostro tmp id) → il broadcast in ritardo
      // non deve aggiungerlo di nuovo.
      if (message.id?.startsWith('tmp_') && prev.some(m => m.clientId === message.id)) return prev;
      // Dedup: if a temp message (tmp_xxx) exists with same sender+original, replace it with server version
      // (clientId first — esatto; testo come fallback per messaggi vecchi)
      const tempIdx = prev.findIndex(m =>
        m.id?.startsWith('tmp_') && (
          (message.clientId && m.id === message.clientId) ||
          (m.sender === message.sender && m.original === message.original)
        )
      );
      if (tempIdx >= 0) {
        // Replace temp with server version, but MERGE translations to avoid
        // losing Phase 2 data that arrived before this poll.
        const tempMsg = prev[tempIdx];
        const updated = [...prev];
        if (sentByMeRef.current.has(tempMsg.id)) {
          addSentByMe(message.id);
        }
        updated[tempIdx] = {
          ...message,
          translated: message.translated || tempMsg.translated,
          translations: message.translations || tempMsg.translations,
          targetLang: message.targetLang || tempMsg.targetLang,
          _replaced: true,
          _stableKey: tempMsg._stableKey || tempMsg.id,
        };
        return updated;
      }
      return [...prev, message];
    });
    if (message.timestamp) {
      lastMsgRef.current = Math.max(lastMsgRef.current, message.timestamp);
    }
    // Only call processIncomingMessage if this is the FIRST time we see this message ID
    if (!alreadyProcessed) {
      processIncomingMessage(message);
    }
  }, [processIncomingMessage]);

  // ── Handle translation update for an existing message (Phase 2) ──
  // When sender translates text after sending the original, this updates the message
  // and triggers TTS for the receiver.
  const handleMessageUpdate = useCallback((data) => {
    if (!data || !data.original) return;
    // ── Deterministic update ID: same content = same ID across P2P + Realtime ──
    // Previously used `update_${Date.now()}` which generated different IDs for each
    // delivery channel, defeating the message-ID dedup guard.
    const updateId = data.tempId || `update_${data.sender}|${data.original}`;

    // ── ID-based guard: skip if already processed by another delivery channel ──
    const alreadyProcessed = processedMsgIdsRef.current.has(updateId);
    if (!alreadyProcessed) {
      processedMsgIdsRef.current.add(updateId);
      if (processedMsgIdsRef.current.size > 500) {
        const first = processedMsgIdsRef.current.values().next().value;
        processedMsgIdsRef.current.delete(first);
      }
    }

    // Find the message by sender + original text (works for both temp and server IDs)
    setMessages(prev => {
      const idx = prev.findIndex(m => m.sender === data.sender && m.original === data.original);
      if (idx < 0) {
        // ── Fallback: try matching by sender only + similar original (trim whitespace) ──
        const trimmedOriginal = data.original?.trim();
        const altIdx = prev.findIndex(m => m.sender === data.sender && m.original?.trim() === trimmedOriginal);
        if (altIdx >= 0) {
          const updated = [...prev];
          updated[altIdx] = {
            ...updated[altIdx],
            translated: data.translated || updated[altIdx].translated,
            targetLang: data.targetLang || updated[altIdx].targetLang,
            translations: data.translations || updated[altIdx].translations,
          };
          return updated;
        }
        console.warn('[handleMessageUpdate] Message not found for update:', { sender: data.sender, original: data.original?.substring(0, 30), messagesCount: prev.length });
        return prev;
      }
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        translated: data.translated || updated[idx].translated,
        targetLang: data.targetLang || updated[idx].targetLang,
        translations: data.translations || updated[idx].translations,
      };
      return updated;
    });
    // Trigger TTS for the receiver ONLY on the first delivery channel
    if (!alreadyProcessed && (data.translated || data.translations)) {
      processIncomingMessage({
        id: updateId,
        sender: data.sender,
        original: data.original,
        translated: data.translated,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        translations: data.translations,
        // IMPORTANT: preserve original timestamp for TTS fingerprint dedup.
        // Without this, Date.now() is used, which can cross 30-second bucket
        // boundaries and cause duplicate TTS playback.
        timestamp: data.timestamp,
      });
    }
  }, [processIncomingMessage]);

  const handleRealtimeSpeaking = useCallback((data) => {
    const myName = verifiedNameRef.current || prefsRef.current.name;
    if (data.name === myName) return;
    if (data.speaking !== undefined) {
      setPartnerSpeaking(data.speaking);
      if (data.liveText !== undefined) setPartnerLiveText(data.liveText);
      if (!data.speaking) setPartnerLiveText('');
    }
    if (data.typing !== undefined) {
      setPartnerTyping(data.typing);
    }
  }, [prefsRef]);

  const handleRealtimeMemberUpdate = useCallback((data) => {
    if (data.room) {
      roomInfoRef.current = data.room;
      setRoomInfo(data.room);
      setPartnerConnected(data.room.members.length >= 2);
      return;
    }

    if (data.members) {
      if (roomInfoRef.current) roomInfoRef.current = { ...roomInfoRef.current, members: data.members };
      setRoomInfo(prev => prev ? { ...prev, members: data.members } : prev);
      setPartnerConnected(data.members.length >= 2);
      return;
    }

    // Handle langChange broadcast (payload: { action, name, lang })
    if (data.action === 'langChange' && data.name && data.lang) {
      // Update ref immediately so translation targets are correct RIGHT NOW
      if (roomInfoRef.current?.members) {
        const updatedMembers = roomInfoRef.current.members.map(m =>
          m.name === data.name ? { ...m, lang: data.lang } : m
        );
        roomInfoRef.current = { ...roomInfoRef.current, members: updatedMembers };
      }
      // Also update React state for UI re-render
      setRoomInfo(prev => {
        if (!prev?.members) return prev;
        const members = prev.members.map((m) =>
          m.name === data.name ? { ...m, lang: data.lang } : m
        );
        setPartnerConnected(members.length >= 2);
        return { ...prev, members };
      });
    }
  }, []);

  const handleRealtimePresence = useCallback(() => {
    // Heartbeats confirm partner is still connected
    // The polling fallback handles full room state refresh
  }, []);

  // ── Supabase Realtime hook ──
  // ── b.128 · definite QUI, non piu in fondo ──
  // Servono a `useRealtimeRoom` poche righe sotto, che gira durante il
  // render: lasciate in fondo al file sarebbero state ancora nella loro
  // zona morta e la pagina sarebbe esplosa al primo render. C'era gia
  // andata vicina in b.117, e c'e un test che sorveglia questa classe.
  // ── Mark a message as read (partner has SEEN it on screen) ──
  const markRead = useCallback((msgId) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId || (m.id?.startsWith('tmp_') && m.id === msgId));
      if (idx < 0) return prev;
      if (prev[idx]._status === 'letto') return prev; // gia segnato
      const updated = [...prev];
      updated[idx] = { ...updated[idx], _status: 'letto' };
      return updated;
    });
  }, []);

  // ── Mark a message as delivered (partner received it via P2P) ──
  const markDelivered = useCallback((msgId) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId || (m.id?.startsWith('tmp_') && m.id === msgId));
      if (idx < 0) return prev;
      // b.120 — 'letto' viene DOPO 'consegnato': una conferma di
      // consegna arrivata in ritardo non deve far tornare indietro.
      if (prev[idx]._status === 'consegnato' || prev[idx]._status === 'letto') return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], _status: 'consegnato' };
      return updated;
    });
  }, []);



  const {
    connected: realtimeConnected,
    subscribe: realtimeSubscribe,
    unsubscribe: realtimeUnsubscribe,
    broadcastMessage,
    broadcastMessageUpdate,
    broadcastAck,
    broadcastRead,
    broadcastSpeaking,
    broadcastMemberUpdate,
    broadcastHeartbeat,
  } = useRealtimeRoom({
    roomId,
    myName: verifiedNameRef.current || prefsRef.current?.name,
    onNewMessage: handleRealtimeMessage,
    onMessageUpdate: handleMessageUpdate,
    onSpeakingChange: handleRealtimeSpeaking,
    onMemberUpdate: handleRealtimeMemberUpdate,
    onPresenceChange: handleRealtimePresence,
    // b.128 — le conferme arrivano anche senza chiamata in corso.
    onAck: markDelivered,
    onRead: markRead,
  });

  // b.128 — il ref punta al mittente vero appena esiste.
  broadcastAckRef.current = broadcastAck;

  // ── Polling: safety-net when Realtime is active, primary when not ──

  // Use a ref to read realtimeConnected inside pollFn without causing re-creation
  const realtimeConnectedRef = useRef(false);
  useEffect(() => { realtimeConnectedRef.current = realtimeConnected; }, [realtimeConnected]);

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollErrorCountRef.current = 0;
    setPollError(false);

    // Subscribe to Supabase Realtime channel (only once on room join)
    realtimeSubscribe(rid);

    const pollFn = async () => {
      try {
        const nameParam = `&name=${encodeURIComponent(prefsRef.current.name)}`;
        const pollHeaders = {};
        if (roomSessionTokenRef.current) pollHeaders['x-room-session'] = roomSessionTokenRef.current;
        const mRes = await fetch(`/api/messages?room=${rid}${nameParam}&after=${lastMsgRef.current}`, { headers: pollHeaders });
        if (mRes.ok) {
          const { messages: newMsgs } = await mRes.json();
          if (newMsgs && newMsgs.length > 0) {
            // Track which messages got new translations in this poll cycle
            const msgsWithNewTranslations = [];

            setMessages(prev => {
              const idMap = new Map(prev.map(m => [m.id, m]));
              let updated = [...prev];
              let changed = false;
              for (const m of newMsgs) {
                const existing = idMap.get(m.id);
                if (existing) {
                  // Message already exists — check if server has translations we don't
                  const hadTranslation = existing.translated || (existing.translations && Object.keys(existing.translations).length > 0);
                  const hasNewTranslation = (m.translated && !existing.translated) ||
                    (m.translations && Object.keys(m.translations).length > (existing.translations ? Object.keys(existing.translations).length : 0));
                  if (hasNewTranslation) {
                    // Update local message with new translations from server
                    const idx = updated.findIndex(u => u.id === m.id);
                    if (idx >= 0) {
                      updated[idx] = {
                        ...updated[idx],
                        translated: m.translated || updated[idx].translated,
                        targetLang: m.targetLang || updated[idx].targetLang,
                        translations: { ...(updated[idx].translations || {}), ...(m.translations || {}) },
                      };
                      changed = true;
                      if (!hadTranslation) msgsWithNewTranslations.push(updated[idx]);
                    }
                  }
                  continue;
                }
                // Replace temp message with server version (dedup broadcast vs poll).
                // 1° criterio: clientId — esatto, immune da sanitizzazione/rinomina.
                // 2° criterio (fallback per messaggi vecchi): sender + testo identico.
                const tempIdx = updated.findIndex(t =>
                  t.id?.startsWith('tmp_') && (
                    (m.clientId && t.id === m.clientId) ||
                    (t.sender === m.sender && t.original === m.original)
                  )
                );
                if (tempIdx >= 0) {
                  const tempMsg = updated[tempIdx];
                  if (sentByMeRef.current.has(tempMsg.id)) {
                    addSentByMe(m.id);
                  }
                  updated[tempIdx] = {
                    ...m,
                    translated: m.translated || tempMsg.translated,
                    translations: m.translations || tempMsg.translations,
                    targetLang: m.targetLang || tempMsg.targetLang,
                    _stableKey: tempMsg._stableKey || tempMsg.id,
                  };
                  changed = true;
                } else {
                  updated.push(m);
                  changed = true;
                }
              }
              return changed ? updated : prev;
            });
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));

            // Trigger TTS for messages that just got translations via polling
            // This is the critical path for guests without Realtime/P2P
            for (const msg of msgsWithNewTranslations) {
              processIncomingMessage(msg);
            }

            // Build set of server IDs that replaced temp messages (already processed via P2P/Realtime)
            const replacedServerIds = new Set();
            for (const m of newMsgs) {
              const wasTemp = msgsWithNewTranslations.find(t => t.id === m.id);
              if (wasTemp) replacedServerIds.add(m.id);
            }
            for (const msg of newMsgs) {
              // Guard: skip if this message ID was already processed via Realtime/P2P
              if (processedMsgIdsRef.current.has(msg.id)) continue;
              processedMsgIdsRef.current.add(msg.id);
              if (processedMsgIdsRef.current.size > 500) {
                const first = processedMsgIdsRef.current.values().next().value;
                processedMsgIdsRef.current.delete(first);
              }
              // Skip TTS/processing for messages that replaced a temp (already handled)
              if (replacedServerIds.has(msg.id)) continue;
              // Skip if already handled as a new-translation update above
              if (msgsWithNewTranslations.some(t => t.id === msg.id)) continue;
              processIncomingMessage(msg);
            }
          }
        }

        // Heartbeat (always needed to keep room alive and detect members)
        const heartbeatBody = { action: 'heartbeat', roomId: rid, roomSessionToken: roomSessionTokenRef.current, name: prefsRef.current.name };
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(heartbeatBody)
        });
        if (rRes.ok) {
          const { room, verifiedName, isHost: hostFlag } = await rRes.json();
          if (verifiedName) verifiedNameRef.current = verifiedName;
          if (hostFlag !== undefined) isHostRef.current = hostFlag;
          roomInfoRef.current = room;
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          const myName = verifiedNameRef.current || prefsRef.current.name;
          const others = room.members.filter(m => m.name !== myName);
          // Only update speaking/typing from polling if Realtime is NOT connected
          if (!realtimeConnectedRef.current) {
            const anyoneSpeaking = others.some(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
            const speakingPartner = others.find(p => p.speaking && Date.now() - p.speakingAt < SPEAKING_TIMEOUT);
            setPartnerSpeaking(anyoneSpeaking);
            setPartnerLiveText(speakingPartner?.liveText || '');
            setPartnerTyping(others.some(p => p.typing && Date.now() - (p.typingAt || 0) < TYPING_TIMEOUT));
          }
        }

        // Also broadcast heartbeat via Realtime
        broadcastHeartbeat(verifiedNameRef.current || prefsRef.current.name).catch(() => {});

        if (pollErrorCountRef.current > 0) {
          pollErrorCountRef.current = 0;
          setPollError(false);
        }
      } catch (e) {
        console.error('[Poll] error:', e);
        pollErrorCountRef.current++;
        if (pollErrorCountRef.current >= 3) {
          setPollError(true);
        }
      }
    };

    // Save pollFn so the interval-adjustment effect can reuse it
    pollFnRef.current = pollFn;

    // Immediate first poll (don't wait for interval)
    pollFn();

    // Start with legacy interval; the effect below will adjust when Realtime connects
    pollRef.current = setInterval(pollFn, LEGACY_POLL_INTERVAL);
  }, [realtimeSubscribe, broadcastHeartbeat, processIncomingMessage]);

  // ── Adjust poll interval when realtime connects/disconnects ──
  // IMPORTANT: This does NOT re-subscribe — only changes the timer interval
  useEffect(() => {
    if (!roomId || !pollFnRef.current) return;

    // Un solo posto decide ogni quanto si chiede: il collegamento
    // Realtime e se lo schermo e acceso. Prima la visibilita non
    // entrava nel conto e si martellava il server anche in tasca.
    const riarma = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const interval = intervalloOra(realtimeConnected);
      pollRef.current = setInterval(pollFnRef.current, interval);
      dbg.debug(`[Poll] ogni ${interval}ms (Realtime: ${realtimeConnected ? 'ON' : 'OFF'}, schermo: ${paginaNascosta() ? 'spento' : 'acceso'})`);
    };

    const alCambioVisibilita = () => {
      // Tornando, si guarda subito: nessuno deve aspettare il prossimo
      // giro per vedere cosa e successo mentre non guardava.
      if (!paginaNascosta()) { try { pollFnRef.current(); } catch { /* il giro dopo riprova */ } }
      riarma();
    };

    riarma();
    document.addEventListener('visibilitychange', alCambioVisibilita);
    return () => document.removeEventListener('visibilitychange', alCambioVisibilita);
  }, [realtimeConnected, roomId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (liveTextTimerRef.current) {
      clearTimeout(liveTextTimerRef.current);
      liveTextTimerRef.current = null;
    }
    realtimeUnsubscribe();
  }, [realtimeUnsubscribe]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // ── Speaking state: now also broadcasts via Realtime ──

  async function setSpeakingState(rid, speaking, liveText = null, typing = false) {
    // Broadcast instantly via Realtime (other clients see it immediately)
    broadcastSpeaking({
      name: verifiedNameRef.current || prefsRef.current.name,
      speaking,
      liveText,
      typing,
    });

    // Also persist to Redis (for polling fallback / new joiners)
    try {
      const body = {
        action: 'speaking',
        roomId: rid,
        roomSessionToken: roomSessionTokenRef.current,
        name: prefsRef.current.name,
        speaking, liveText, typing
      };
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch { /* la rete puo mancare: chi chiama decide cosa fare del vuoto */ }
  }

  function broadcastLiveText(text) {
    if (!roomId || text === lastLiveTextRef.current) return;
    lastLiveTextRef.current = text;
    if (liveTextTimerRef.current) return;
    liveTextTimerRef.current = setTimeout(() => {
      liveTextTimerRef.current = null;
      setSpeakingState(roomId, true, lastLiveTextRef.current);
    }, LIVE_TEXT_THROTTLE);
  }

  async function syncLangChange(newLang) {
    if (!roomId) return;
    const myName = verifiedNameRef.current || prefsRef.current.name;

    // ── Immediately update local roomInfoRef so translation targets are correct ──
    // Don't wait for Realtime broadcast round-trip or next poll
    if (roomInfoRef.current?.members) {
      const updatedMembers = roomInfoRef.current.members.map(m =>
        m.name === myName ? { ...m, lang: newLang } : m
      );
      roomInfoRef.current = { ...roomInfoRef.current, members: updatedMembers };
      // Also update React state so UI re-renders
      setRoomInfo(prev => {
        if (!prev?.members) return prev;
        return { ...prev, members: prev.members.map(m =>
          m.name === myName ? { ...m, lang: newLang } : m
        )};
      });
    }

    // Broadcast lang change via Realtime (so partner updates too)
    broadcastMemberUpdate({
      action: 'langChange',
      name: myName,
      lang: newLang,
    }).catch(() => {});
    try {
      const body = {
        action: 'changeLang',
        roomId,
        roomSessionToken: roomSessionTokenRef.current,
        name: prefsRef.current.name,
        lang: newLang,
      };
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.error('[SyncLang] Error:', e);
    }
  }

  function sendTypingState(isTyping) {
    if (!roomId) return;
    // Broadcast instantly via Realtime
    broadcastSpeaking({
      name: verifiedNameRef.current || prefsRef.current.name,
      speaking: false,
      typing: isTyping,
    });
    // Also persist to Redis
    const body = {
      action: 'speaking',
      roomId,
      roomSessionToken: roomSessionTokenRef.current,
      name: prefsRef.current.name,
      speaking: false,
      typing: isTyping
    };
    fetch('/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {});
  }

  async function handleCreateRoom(
    name, lang, mode, avatar, selectedContext, selectedMode,
    roomDescription, isTrial, isTopPro, userAccount, diretta = false,
    // b.139-bis — la capienza scelta nel modulo di creazione non arrivava
    // mai alla stanza: viaggiava solo verso /api/mondo, cioe solo per le
    // stanze pubblicate. In una stanza privata il numero scelto veniva
    // buttato via e valeva il ripiego dello script Lua.
    maxPartecipanti = null
  ) {
    try {
      const ctxObj = CONTEXTS.find(c => c.id === selectedContext) || CONTEXTS[0];
      const currentTier = isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO';
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name, lang, mode, avatar,
          context: selectedContext,
          contextPrompt: ctxObj.prompt,
          description: roomDescription,
          hostTier: currentTier,
          // b.107 — prima qui viaggiava `hostEmail: userAccount?.email`, e
          // il server si fidava. Chi voleva poteva scriverci l'email di un
          // altro e fargli pagare tutti i consumi della stanza. Ora si
          // manda il TOKEN e l'email la ricava il server dalla sessione:
          // si puo far pagare solo se stessi.
          // b.113 — Stanza Diretta: la scelta dell'host viaggia con la
          // stanza, cosi chi entra da un invito la eredita invece di
          // mandare la propria voce alla nuvola credendosi al riparo.
          diretta: !!diretta,
          maxPartecipanti,
          userToken: getEffectiveToken?.() || null
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `${tFuori('serverErrorWord')} (${res.status})`);
      }
      const data = await res.json();
      const { room, roomSessionToken: token, hostSecret } = data;
      if (token) roomSessionTokenRef.current = token;
      // b.169 — l'unica occasione in cui il server manda questo segreto:
      // si tiene qui, per poterlo ripresentare a `join` se si perde
      // roomSessionTokenRef (vive solo in memoria) — ricarica pagina,
      // nuovo dispositivo, "rientra" dall'elenco stanze lasciate a meta.
      // Senza, si rientrerebbe sempre come guest anche essendo l'host.
      if (hostSecret) {
        try {
          const mappa = JSON.parse(localStorage.getItem('vt-host-secrets') || '{}');
          mappa[room.id] = hostSecret;
          // Tetto a 20 stanze: non deve crescere senza limite nel tempo.
          const chiavi = Object.keys(mappa);
          if (chiavi.length > 20) delete mappa[chiavi[0]];
          localStorage.setItem('vt-host-secrets', JSON.stringify(mappa));
        } catch { /* navigazione privata o memoria piena: si perde solo la comodita del rientro come host */ }
      }
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setPartnerConnected(room.members.length >= 2);
      startPolling(room.id);
      return room;
    } catch (e) {
      throw e;
    }
  }

  async function handleJoinRoom(joinCode, name, lang, avatar) {
    if (!joinCode.trim()) return;
    const rid = joinCode.trim().toUpperCase();
    // b.169 — se questo browser ha creato la stanza (o vi e gia rientrato
    // come host), il segreto e qui: si ripresenta per riprovare a
    // rientrare come host. Se manca o non combacia piu, il server
    // assegna guest — vedi verificaSegretoHost in roomActions.js.
    let hostSecret = null;
    try {
      const mappa = JSON.parse(localStorage.getItem('vt-host-secrets') || '{}');
      hostSecret = mappa[rid] || null;
    } catch { /* nessun segreto disponibile: si rientra come guest se non si e piu host */ }
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId: rid,
          name, lang, avatar, hostSecret
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        // b.98 — un rifiuto della moderazione NON e un guasto, e una
        // risposta. Prima finiva tutto in "Room not found", e chi bussava
        // a una stanza su approvazione credeva che il codice fosse
        // sbagliato: riprovava, e riprovava.
        if (res.status === 403 && (err.motivo || err.stato)) {
          const e = new Error(
            err.motivo === 'bloccato'
              ? tFuori('blockedFromRoom')
              : err.stato === 'rifiutato'
                ? tFuori('requestRejected')
                : tFuori('knockedWait')
          );
          e.moderazione = err.motivo || err.stato;
          e.inAttesa = !!err.inAttesa;
          throw e;
        }

        // b.139 — qui si mostrava all'utente il testo che arrivava dal
        // SERVER (`err.error`), scritto in italiano nelle rotte. Chi apriva
        // l'applicazione in coreano leggeva 'La stanza e al completo'.
        // Il server resta l'autorita sul FATTO (la stanza e piena, la stanza
        // non c'e); la PAROLA da mostrare la sceglie il client, che e l'unico
        // a sapere in che lingua sta guardando chi legge.
        if (res.status === 409 && err.piena) throw new Error(tFuori('roomIsFull'));
        throw new Error(tFuori('roomNotFound'));
      }
      const data = await res.json();
      const { room, roomSessionToken: token } = data;
      if (token) roomSessionTokenRef.current = token;
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setPartnerConnected(room.members.length >= 2);
      startPolling(room.id);

      // Broadcast member join via Realtime
      broadcastMemberUpdate({ room, action: 'join', name });

      return room;
    } catch (e) {
      throw e;
    }
  }

  // ── Stable callbacks for two-phase send (avoid cascading re-creations) ──
  const updateLocalMessage = useCallback((original, sender, updates) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.sender === sender && m.original === original);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  }, []); // setMessages is stable — no deps needed

  const addLocalMessage = useCallback((msg) => {
    setMessages(prev => {
      const ids = new Set(prev.map(m => m.id));
      if (ids.has(msg.id)) return prev;
      return [...prev, msg];
    });
  }, []); // setMessages is stable — no deps needed

  function leaveRoom() {
    stopPolling();
    roomSessionTokenRef.current = null;
    verifiedNameRef.current = null;
    isHostRef.current = false;
    processedForTTSRef.current.clear();
    setRoomId(null);
    setRoomInfo(null);
    setMessages([]);
    setPartnerConnected(false);
    setPartnerSpeaking(false);
    setPartnerLiveText('');
    setPartnerTyping(false);
  }

  return {
    roomId,
    setRoomId,
    roomInfo,
    setRoomInfo,
    messages,
    setMessages,
    partnerConnected,
    partnerSpeaking,
    partnerLiveText,
    partnerTyping,
    pollError,
    realtimeConnected,
    startPolling,
    stopPolling,
    setSpeakingState,
    broadcastLiveText,
    sendTypingState,
    syncLangChange,
    handleCreateRoom,
    handleJoinRoom,
    leaveRoom,
    sentByMeRef,
    roomSessionTokenRef,
    verifiedNameRef,
    isHostRef,
    // Realtime broadcast functions (for use in useTranslationAPI)
    broadcastMessage,
    broadcastMessageUpdate,
    broadcastMemberUpdate,
    // P2P message-update handler (reused by handleDirectMessage in page.js)
    handleMessageUpdate,
    updateLocalMessage,
    addLocalMessage,
    markDelivered,
    markRead,
    // P2P DataChannel: add incoming message (same logic as Realtime)
    addIncomingMessage: handleRealtimeMessage,
  };
}

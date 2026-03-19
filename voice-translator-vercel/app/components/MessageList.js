'use client';
import { memo, useEffect, useRef, useCallback } from 'react';
import AvatarImg from './AvatarImg.js';
import { IconPlay, IconVolume, IconCheck, IconCheckDouble, IconWarning, IconLoader, IconMic, IconKeyboard, IconListening } from './Icons.js';

/**
 * MessageList — Extracted from RoomView.js
 *
 * Renders the scrollable message area including:
 * - Empty state placeholder
 * - Message bubbles (original + translation, sender + receiver views)
 * - Streaming live bubble (current recording preview)
 * - Partner speaking/typing indicator with live text
 *
 * Props:
 * - messages: array of message objects
 * - streamingMsg: { original, translated, isStreaming } | null
 * - myName: string (verified name or pref name)
 * - myLang: string (e.g. 'it')
 * - prefs: { name, avatar, ... }
 * - partner: { name, lang, avatar } | null
 * - roomInfo: room object
 * - roomMode: string
 * - isHost: boolean
 * - getTranslationForMe: function(msg) => string
 * - getSenderAvatar: function(name) => avatar URL
 * - playMessage: function(msg)
 * - playingMsgId: string | null
 * - partnerSpeaking: boolean
 * - partnerTyping: boolean
 * - partnerLiveText: string
 * - msgsEndRef: React ref
 * - S: styles object
 * - L: i18n function
 */
const MessageList = memo(function MessageList({
  messages, streamingMsg, myName, myLang, prefs, partner,
  roomInfo, roomMode, isHost,
  getTranslationForMe, getSenderAvatar,
  playMessage, playingMsgId,
  partnerSpeaking, partnerTyping, partnerLiveText,
  msgsEndRef, S, L,
  onMessageRead, // callback(msgId) when a partner's message becomes visible
}) {
  // ── Read receipt: IntersectionObserver to detect when partner messages are on screen ──
  const observerRef = useRef(null);
  const readMsgIdsRef = useRef(new Set());

  useEffect(() => {
    if (!onMessageRead) return;
    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const msgId = entry.target.dataset.msgid;
          if (msgId && !readMsgIdsRef.current.has(msgId)) {
            readMsgIdsRef.current.add(msgId);
            onMessageRead(msgId);
          }
          observerRef.current?.unobserve(entry.target);
        }
      }
    }, { threshold: 0.5 }); // 50% visible = read
    return () => { observerRef.current?.disconnect(); };
  }, [onMessageRead]);

  // Ref callback for partner message elements
  const observeMsg = useCallback((el) => {
    if (el && observerRef.current) observerRef.current.observe(el);
  }, []);

  return (
    <div style={S.chatArea}>
      {messages.length === 0 && (
        <div style={{textAlign:'center', color:S.colors.textMuted, marginTop:60, fontSize:13, lineHeight:1.6}}>
          {L('speakNow')}{'\n'}
          {roomMode === 'freetalk' ? L('freeTalkDesc')
            : roomMode === 'simultaneous' ? L('simultaneousDesc')
            : roomMode === 'classroom' && !isHost
              ? `${roomInfo?.host || 'Host'} - ${L('classroomDesc')}`
              : L('conversationDesc')}
        </div>
      )}
      {messages.map((m, i) => {
        const isMine = m.sender === myName;
        const translationForMe = getTranslationForMe(m);
        const hasTranslation = !!(m.translated || (m.translations && Object.keys(m.translations).length > 0));
        const pendingTranslation = !hasTranslation && m.original;
        return (
          <div key={m._stableKey || m.id || `${m.sender}-${m.timestamp}-${i}`}
            ref={!isMine && m.id ? observeMsg : undefined}
            data-msgid={!isMine ? m.id : undefined}
            style={{display:'flex', gap:8,
            flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end',
            animation:'vtSlideIn 0.25s ease-out'}}>
            <AvatarImg src={isMine ? prefs.avatar : getSenderAvatar(m.sender)} size={56} style={{marginBottom:2}} />
            <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
              alignItems:isMine ? 'flex-end' : 'flex-start'}}>
              <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3}}>
                {isMine ? 'Tu' : m.sender}
              </div>
              <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                {/* Primary line: original for sender, translation for receiver */}
                <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary}}>
                  {isMine ? m.original : (hasTranslation ? translationForMe : m.original)}
                </div>
                {/* Secondary line: translation for sender, original for receiver */}
                {pendingTranslation ? (
                  <div style={{fontSize:11, color:S.colors.textMuted, marginTop:4, fontStyle:'italic'}}>
                    {m._translationError
                      ? (L('translationFailed') || 'Traduzione fallita \u26A0\uFE0F')
                      : (L('translating') || 'Traducendo...')}
                  </div>
                ) : (
                  <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4}}>
                    {isMine ? translationForMe : m.original}
                  </div>
                )}
              </div>
              <div style={{display:'flex', alignItems:'center', gap:4, marginTop:2}}>
                {hasTranslation && (
                  <button onClick={() => playMessage(m)}
                    style={{padding:'2px 8px', borderRadius:8,
                      background:'transparent', border:'none', color:S.colors.textMuted,
                      fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                    {playingMsgId === m.id ? <IconVolume size={14}/> : <IconPlay size={14}/>}
                  </button>
                )}
                {/* Delivery status: ✓ sent → ✓✓ delivered → ✓✓ green (read) */}
                {isMine && (
                  <span style={{
                    color: m._status === 'read' ? '#22c55e' : m._status === 'delivered' ? '#60a5fa' : S.colors.textMuted,
                    marginLeft:'auto', display:'flex', alignItems:'center',
                  }}>
                    {m._status === 'read' || m._status === 'delivered'
                      ? <IconCheckDouble size={13}/>
                      : <IconCheck size={13}/>}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {/* Streaming live bubble — includes Whisper "listening" indicator for Asian languages */}
      {streamingMsg && (streamingMsg.original || streamingMsg._whisperListening || streamingMsg._whisperProcessing) &&
        !(streamingMsg.original && messages.length > 0 && messages[messages.length - 1].sender === prefs.name && messages[messages.length - 1].original === streamingMsg.original.trim()) && (
        <div style={{display:'flex', gap:8, flexDirection:'row-reverse', marginBottom:12, alignItems:'flex-end'}}>
          <AvatarImg src={prefs.avatar} size={56} style={{marginBottom:2}} />
          <div style={{maxWidth:'75%', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
            <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3, display:'flex', alignItems:'center', gap:4}}>
              <span>Tu</span>
              <span style={{display:'inline-block', width:6, height:6, borderRadius:3,
                background: streamingMsg._whisperProcessing ? S.colors.accent4 : S.colors.accent3,
                animation:'vtPulse 1.2s infinite ease-in-out'}} />
              <span style={{color: streamingMsg._whisperProcessing ? S.colors.accent4 : S.colors.accent3,
                fontSize:9, fontWeight:600}}>
                {streamingMsg._whisperProcessing ? 'ELABORAZIONE' : streamingMsg._whisperListening ? 'ASCOLTO' : 'LIVE'}
              </span>
            </div>
            <div style={{...S.bubble, ...S.bubbleMine, border:`1px solid ${S.colors.accent3Border}`}}>
              {/* Whisper listening: show animated dots instead of text */}
              {streamingMsg._whisperListening && !streamingMsg.original ? (
                <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
                  <div style={S.speakingDots}>
                    <span style={{...S.dot, animationDelay:'0s'}}/>
                    <span style={{...S.dot, animationDelay:'0.2s'}}/>
                    <span style={{...S.dot, animationDelay:'0.4s'}}/>
                  </div>
                  <span style={{fontSize:12, color:S.colors.textMuted, fontStyle:'italic'}}>
                    {L('listening') || 'In ascolto...'}
                  </span>
                </div>
              ) : streamingMsg._whisperProcessing && !streamingMsg.original ? (
                <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
                  <IconLoader size={18}/>
                  <span style={{fontSize:12, color:S.colors.textMuted, fontStyle:'italic'}}>
                    {L('processing') || 'Elaborazione in corso...'}
                  </span>
                </div>
              ) : (
                <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary}}>
                  {streamingMsg.original}
                </div>
              )}
              {streamingMsg.translated ? (
                <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4,
                  borderTop:`1px solid ${S.colors.dividerColor}`, paddingTop:4}}>
                  {streamingMsg.translated}
                </div>
              ) : streamingMsg.original ? (
                <div style={{fontSize:11, color:S.colors.textMuted, marginTop:4, fontStyle:'italic'}}>
                  {L('translating')}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* Partner speaking/typing indicator */}
      {(partnerSpeaking || partnerTyping) && (
        <div style={{display:'flex', flexDirection:'column', gap:4, padding:'6px 10px',
          margin:'4px 0 8px', borderRadius:14, background:S.colors.accent3Bg,
          border:`1px solid ${S.colors.accent3Border}`}}>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={S.speakingDots}>
              <span style={{...S.dot, animationDelay:'0s'}}/>
              <span style={{...S.dot, animationDelay:'0.2s'}}/>
              <span style={{...S.dot, animationDelay:'0.4s'}}/>
            </div>
            <span style={{fontSize:12, color:S.colors.accent3}}>
              {partner?.name} {partnerSpeaking ? <IconMic size={13}/> : <IconKeyboard size={13}/>}...
            </span>
          </div>
          {partnerLiveText && (
            <div style={{fontSize:13, color:S.colors.textSecondary, padding:'4px 8px',
              background:S.colors.overlayBg, borderRadius:10, lineHeight:1.4,
              fontStyle:'italic', maxHeight:60, overflow:'hidden'}}>
              {partnerLiveText}
            </div>
          )}
        </div>
      )}
      <div ref={msgsEndRef} />
    </div>
  );
});

export default MessageList;

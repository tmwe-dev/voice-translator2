'use client';
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import AvatarImg from './AvatarImg.js';
import { IconPlay, IconVolume, IconCheck, IconCheckDouble, IconWarning, IconLoader, IconMic, IconKeyboard, IconListening } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import BarraReazioni from './BarraReazioni.js';
import Velo from './Velo.js';
import { velare } from '../lib/velo.js';

// b.120 — le parole che l'utente legge toccando la spunta. Servono
// anche a chi usa un lettore di schermo, che altrimenti sentirebbe
// solo "immagine".
// b.138 — le cinque etichette erano in italiano fisso: chi ascoltava la
// chat con un lettore di schermo in un'altra lingua sentiva "Arrivato
// all'altro telefono" in italiano. Ora sono nomi di chiave.
const ETICHETTA_STATO = {
  'in-coda':    'statusQueued',
  'inviato':    'statusSent',
  'consegnato': 'statusDelivered',
  'letto':      'statusRead',
  'fallito':    'statusFailed',
};

// Avvolge la nuvoletta solo quando serve davvero: se non c'e niente da
// coprire, il messaggio esce identico a prima, senza un livello in piu.
function ForseVelato({ messaggio, attivo, hot, C, children }) {
  if (!attivo) return children;
  // b.111 — nelle stanze hot la tendina non scende: e il senso della
  // stanza. Il confine sui reati non passa di qui — quei messaggi non
  // partono nemmeno (reati.js), quindi qui non arrivano.
  const esito = velare(messaggio, { hot });
  if (!esito.velare) return children;
  return <Velo motivo={esito.motivo} C={C}>{children}</Velo>;
}

// Haptic feedback helper (mobile)
function haptic(ms = 10) {
  try { navigator?.vibrate?.(ms); } catch { /* il dispositivo non vibra: non cambia nulla */ }
}

// Virtual scroll threshold — only render all messages if under this count
// Above this, render last N + spacer to avoid DOM bloat
const VIRTUAL_THRESHOLD = 50;
const VISIBLE_WINDOW = 30;

const QUICK_REACTIONS = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDC4D', '\uD83D\uDE4F', '\uD83D\uDD25'];

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
  userToken, roomId,
  roomInfo, roomMode, isHost,
  getTranslationForMe, getSenderAvatar,
  playMessage, playingMsgId,
  partnerSpeaking, partnerTyping, partnerLiveText,
  msgsEndRef, S, L,
  onMessageRead, // callback(msgId) when a partner's message becomes visible
  onReaction, // callback(msgId, emoji) for sending reactions via P2P
  onMessageDoubleClick, // callback(msg) for Taxi Mode activation on double-tap
  // ── b.99 · reazioni durevoli (pollice su/giu, cuore) e risposte ──
  conteReazioni, mieReazioni, onReagisci, onRispondi,
}) {
  // b.326 — audit Mondo D2: la traduzione del mittente puo non arrivare mai
  // (stanza vuota alla scrittura: nessuna lingua di destinazione). Il lettore
  // non resta appeso a "Traduzione…": puo TRADURRE QUI, a richiesta, nella
  // sua lingua — stesso meccanismo delle discussioni del Mondo.
  const [tradLocali, setTradLocali] = useState({});
  const traduciQui = useCallback(async (m) => {
    const chiave = m.id || `${m.sender}-${m.timestamp}`;
    if (tradLocali[chiave]) return;
    setTradLocali(t => ({ ...t, [chiave]: '…' }));
    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.original, sourceLang: m.senderLang || m.lang || 'auto', targetLang: myLang, userToken: userToken || '', roomId: roomId || undefined }),
      });
      const d = await r.json();
      const tradotto = d.translated || d.translation || '';
      setTradLocali(t => ({ ...t, [chiave]: tradotto || null }));
      if (!tradotto) setTradLocali(t => { const nn = { ...t }; delete nn[chiave]; return nn; });
    } catch { setTradLocali(t => { const nn = { ...t }; delete nn[chiave]; return nn; }); }
  }, [tradLocali, myLang, userToken, roomId]);

  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const longPressTimerRef = useRef(null);
  // ── Read receipt: IntersectionObserver to detect when partner messages are on screen ──
  const observerRef = useRef(null);
  const readMsgIdsRef = useRef(new Set());

  useEffect(() => {
    if (!onMessageRead) return;
    if (observerRef.current) observerRef.current.disconnect();
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
    <div style={S.chatArea} role="log" aria-live="polite" aria-label={L('chatMessagesAria')}>
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
      {/* Virtual scroll: for 50+ messages, only render last 30 + spacer */}
      {messages.length > VIRTUAL_THRESHOLD && (
        <div style={{ height: (messages.length - VISIBLE_WINDOW) * 80, flexShrink: 0 }}
          aria-hidden="true" />
      )}
      {(messages.length > VIRTUAL_THRESHOLD ? messages.slice(-VISIBLE_WINDOW) : messages).map((m, i) => {
        const isMine = m.sender === myName;
        const translationForMe = getTranslationForMe(m);
        const hasTranslation = !!(m.translated || (m.translations && Object.keys(m.translations).length > 0));
        const pendingTranslation = !hasTranslation && m.original;
        return (
          <div key={m._stableKey || m.id || `${m.sender}-${m.timestamp}-${i}`}
            ref={!isMine && m.id ? observeMsg : undefined}
            data-msgid={!isMine ? m.id : undefined}
            onDoubleClick={() => { if (onMessageDoubleClick) { haptic(20); onMessageDoubleClick(m); } }}
            style={{display:'flex', gap:8,
            flexDirection:isMine ? 'row-reverse' : 'row', marginBottom:12, alignItems:'flex-end',
            animation:'vtSlideIn 0.25s ease-out', cursor: onMessageDoubleClick ? 'pointer' : undefined}}>
            <AvatarImg src={isMine ? prefs.avatar : getSenderAvatar(m.sender)} size={56} style={{marginBottom:2}} />
            <div style={{maxWidth:'75%', display:'flex', flexDirection:'column',
              alignItems:isMine ? 'flex-end' : 'flex-start'}}>
              <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:3}}>
                {isMine ? L('youWord') : m.sender}
              </div>
              <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                {/* b.101 \u2014 quello che uno scrive di suo pugno non gli si
                    copre in faccia: sa cosa ha scritto. Si vela solo cio
                    che arriva dagli altri. */}
                <ForseVelato messaggio={m} attivo={!isMine} hot={!!roomInfo?.hot} C={S.colors}>
                  {/* b.353 — LA MIA BOLLA PARLA LA LINGUA DELL'ALTRO (Luca:
                      «se scrivo in italiano e traduci in inglese, non
                      riscrivere in italiano: mostra la traduzione, col
                      pallino verde quando e stata consegnata»). In grande
                      la TRADUZIONE; sotto, piccolo, quello che ho scritto
                      io — cosi ognuno controlla la propria frase. */}
                  <div style={{fontSize:14, fontWeight:500, lineHeight:1.5, color:S.colors.textPrimary, display:'flex', alignItems:'baseline', gap:6}}>
                    <span style={{flex:1, minWidth:0}}>
                      {isMine
                        ? (hasTranslation ? translationForMe : m.original)
                        : (hasTranslation ? translationForMe : m.original)}
                    </span>
                    {isMine && hasTranslation && (
                      <span title="Tradotto"
                        aria-label="tradotto"
                        style={{width:8, height:8, borderRadius:4, background:'#3ddc84', flexShrink:0,
                          boxShadow:'0 0 6px rgba(61,220,132,0.6)'}} />
                    )}
                  </div>
                  {/* Secondary line: original for sender (small), original for receiver */}
                  {pendingTranslation ? (
                    isMine ? (
                      <div style={{fontSize:11, color:S.colors.textMuted, marginTop:4, fontStyle:'italic'}}>
                        {m._translationError ? L('translationFailedShort') : L('translating')}
                      </div>
                    ) : (() => {
                      // b.326 — D2: il lettore traduce QUI, subito, senza aspettare
                      // una traduzione del mittente che potrebbe non arrivare mai.
                      const chiave = m.id || `${m.sender}-${m.timestamp}`;
                      const locale = tradLocali[chiave];
                      if (locale && locale !== '…') return (
                        <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4}}>{locale}</div>
                      );
                      return (
                        <button onClick={() => traduciQui(m)} disabled={locale === '…'}
                          style={{marginTop:4, padding:'3px 10px', borderRadius:8, cursor:'pointer', border:`1px solid ${S.colors.cardBorder}`, background:'transparent', color:S.colors.accent1 || S.colors.textSecondary, fontSize:11, fontWeight:700, fontFamily:'inherit'}}>
                          {locale === '…' ? '…' : (L('showTranslation') !== 'showTranslation' ? L('showTranslation') : 'Traduci')}
                        </button>
                      );
                    })()
                  ) : (
                    <div style={{fontSize:12, color:S.colors.textSecondary, marginTop:4, lineHeight:1.4}}>
                      {/* b.353 — per me: sotto c'e il MIO originale; per lui: l'originale dell'altro */}
                      {isMine ? m.original : m.original}
                    </div>
                  )}
                </ForseVelato>
              </div>
              {/* b.99 — pollice su, pollice giu, cuore e risposta: sempre
                  in vista, non dietro una pressione lunga che nessuno
                  scopre. Vale anche nelle chat cifrate: si conta un
                  identificativo, non si legge un testo. */}
              {onReagisci && (
                <BarraReazioni
                  msgId={m.id}
                  conte={conteReazioni?.[m.id]}
                  mie={mieReazioni?.[m.id]}
                  onReagisci={onReagisci}
                  onRispondi={onRispondi}
                  C={S.colors}
                  compatta />
              )}
              {/* Reactions display */}
              {m._reactions && Object.keys(m._reactions).length > 0 && (
                <div style={{display:'flex', gap:2, flexWrap:'wrap', marginTop:4}}>
                  {Object.entries(m._reactions).map(([emoji, users]) => (
                    <span key={emoji} style={{
                      display:'inline-flex', alignItems:'center', gap:2,
                      padding:'1px 6px', borderRadius:10,
                      background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)',
                      fontSize:13, cursor:'pointer',
                    }}
                    onClick={() => onReaction?.(m.id, emoji)}>
                      {emoji}<span style={{fontSize:10, color:S.colors.textMuted}}>{users.length}</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{display:'flex', alignItems:'center', gap:4, marginTop:2}}>
                {hasTranslation && (
                  <button onClick={() => playMessage(m)}
                    aria-label={playingMsgId === m.id ? L('stopAudio') : L('playMessageAudio')}
                    style={{padding:'2px 8px', borderRadius:8,
                      background:'transparent', border:'none', color:S.colors.textMuted,
                      fontSize:11, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                    {playingMsgId === m.id ? <IconVolume size={14}/> : <IconPlay size={14}/>}
                  </button>
                )}
                {/* React button */}
                <button onClick={() => setReactionPickerMsgId(reactionPickerMsgId === m.id ? null : m.id)}
                  aria-label={L('addReaction')}
                  aria-expanded={reactionPickerMsgId === m.id}
                  style={{padding:'2px 6px', borderRadius:8,
                    background:'transparent', border:'none', color:S.colors.textMuted,
                    fontSize:13, cursor:'pointer', WebkitTapHighlightColor:'transparent'}}>
                  +
                </button>
                {/* ── b.120 · cinque stati, non due ──
                    Prima c'erano due sole spunte, e la prima veniva
                    messa PRIMA che qualcosa fosse partito: un messaggio
                    parcheggiato in attesa di rete sembrava spedito.
                    Adesso ognuno dei cinque momenti si vede:

                      in coda    ·   in attesa che il canale si apra
                      inviato    ✓   il server o il canale l'ha preso
                      consegnato ✓✓  e arrivato all'altro telefono
                      letto      ✓✓  l'ha visto (in verde)
                      fallito    !   non e partito, e non partira

                    Il grigio non e un dettaglio estetico: e la
                    differenza fra "aspetta" e "e andata". */}
                {isMine && (
                  <span
                    title={L(ETICHETTA_STATO[m._status] || ETICHETTA_STATO['in-coda'])}
                    aria-label={L(ETICHETTA_STATO[m._status] || ETICHETTA_STATO['in-coda'])}
                    style={{
                      color: m._status === 'fallito' ? (PALETTE.red || '#EF4444')
                        : m._status === 'letto' ? PALETTE.green
                        : m._status === 'consegnato' ? PALETTE.blue
                        : S.colors.textMuted,
                      marginLeft:'auto', display:'flex', alignItems:'center', gap:3,
                      opacity: m._status === 'in-coda' ? 0.55 : 1,
                    }}>
                    {m._status === 'fallito'
                      ? <span style={{fontSize:12, fontWeight:800}}>!</span>
                      : m._status === 'in-coda'
                        ? <span style={{fontSize:12, lineHeight:1}}>·</span>
                        : (m._status === 'letto' || m._status === 'consegnato')
                          ? <IconCheckDouble size={13}/>
                          : <IconCheck size={13}/>}
                  </span>
                )}
              </div>
              {/* Reaction picker */}
              {reactionPickerMsgId === m.id && (
                <div style={{
                  display:'flex', gap:4, marginTop:4, padding:'4px 8px',
                  background:'rgba(0,0,0,0.5)', backdropFilter:'blur(12px)',
                  borderRadius:16, border:'1px solid rgba(255,255,255,0.1)',
                  animation:'vtSlideIn 0.15s ease-out',
                }}>
                  {QUICK_REACTIONS.map(emoji => (
                    <button key={emoji}
                      aria-label={`${L('reactWith')} ${emoji}`}
                      onClick={() => { haptic(); onReaction?.(m.id, emoji); setReactionPickerMsgId(null); }}
                      style={{
                        background:'none', border:'none', fontSize:20, cursor:'pointer',
                        padding:'2px 4px', borderRadius:8,
                        transition:'transform 0.15s',
                      }}
                      onPointerDown={e => e.currentTarget.style.transform = 'scale(1.3)'}
                      onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
                      onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >{emoji}</button>
                  ))}
                </div>
              )}
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
              <span>{L('youWord')}</span>
              <span style={{display:'inline-block', width:6, height:6, borderRadius:3,
                background: streamingMsg._whisperProcessing ? S.colors.accent4 : S.colors.accent3,
                animation:'vtPulse 1.2s infinite ease-in-out'}} />
              <span style={{color: streamingMsg._whisperProcessing ? S.colors.accent4 : S.colors.accent3,
                fontSize:9, fontWeight:600}}>
                {streamingMsg._whisperProcessing ? L('processingUpper') : streamingMsg._whisperListening ? L('listeningUpper') : L('liveUpper')}
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
                    {L('listening')}
                  </span>
                </div>
              ) : streamingMsg._whisperProcessing && !streamingMsg.original ? (
                <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
                  <IconLoader size={18}/>
                  <span style={{fontSize:12, color:S.colors.textMuted, fontStyle:'italic'}}>
                    {L('processing')}
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

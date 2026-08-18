'use client';
import { memo, useState } from 'react';
import { LANGS, FONT, getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';
import ConnectionQuality from './ConnectionQuality.js';
import { IconBack, IconCamera, IconVolume, IconVolumeOff, IconCheck,
  IconClipboard, IconMusic, IconArchive, IconBattery, IconSwap, IconBrainAI } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import { BatteryPillSlot } from './BatteryPill.js';
import ConsumoChip from './ConsumoChip.js';

// ═══ INIZIO b.129 — due colori, una forma ═══
//
// Prima la barra aveva QUATTRO colori — verde (in chiamata), rosso
// (audio spento e partner assente), giallo (Taxi), accento (attivo) —
// e quattro forme: pillole da 10px, da 12px, quadrati da 36, e un
// pulsante con testo. Nessuna gerarchia: tutto gridava allo stesso modo.
//
// Ora due soli stati, e si leggono a colpo d'occhio:
//
//   riposo  → fondo neutro, icona smorzata
//   attivo  → fondo accento, icona piena
//
// Il rosso e sparito. Un'icona barrata dice "spento" meglio di un
// colore d'allarme: l'audio disattivato non e un guasto, e una scelta.
// Il verde e sparito: "in chiamata" e gia detto dal fondo acceso.
//
// E lo stato del partner NON sta piu sull'ingranaggio, dove non voleva
// dire niente. Sta sulla sua bandiera, smorzata quando non c'e — sulla
// persona, non sulle impostazioni.
const BOTTONE = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: 18,
  border: 'none', cursor: 'pointer', flexShrink: 0,
  transition: 'background 0.15s, color 0.15s',
  WebkitTapHighlightColor: 'transparent',
};
const veste = (S, attivo) => ({
  ...BOTTONE,
  background: attivo ? S.colors.accent4Bg : S.colors.overlayBg,
  color: attivo ? S.colors.textPrimary : S.colors.textMuted,
});
// ═══ FINE b.129 ═══

// b.173 — stile riga di menu, condiviso da tutte le voci del menu ••• .
const rigaMenu = (S) => ({
  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8,
  color: S.colors.textPrimary, fontSize: 13, fontWeight: 500, textAlign: 'left',
  WebkitTapHighlightColor: 'transparent', fontFamily: FONT,
});
const iconaMenu = { fontSize: 15, width: 24, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const RoomHeader = memo(function RoomHeader({
  L, S, myLang, myL, otherL, otherMembers, partner,
  showLangPicker, setShowLangPicker, handleLangChange,
  audioEnabled, setAudioEnabled, unlockAudio,
  webrtc, partnerConnected, realtimeConnected,
  stanzaSoloTesto,
  showVideoCall, setShowVideoCall, videoFullscreen, setVideoFullscreen,
  setShowVoiceCall,
  showCaptions, setShowCaptions,
  exportConversation,
  messages, setShowChatActions,
  duckingLevel, setDuckingLevel,
  isTrial, freeCharsUsed, freeLimitExceeded, freeResetTime,
  endChatAndSave, leaveRoomTemporary,
  taxiVisible, setTaxiVisible, setTaxiData, myName, roomId,
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // b.173 — attivazione Taxi: identica a prima (era dentro TaxiButton),
  // ora invocata da una voce di menu. Nessun cambiamento di logica.
  const attivaTaxi = () => {
    const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
    if (lastMsg) {
      const original = lastMsg.original || '';
      const translated = lastMsg.translated || '';
      const fromLang = lastMsg.sourceLang || myLang;
      const toLang = lastMsg.targetLang || 'en';
      if (setTaxiData) setTaxiData({ original, translated, fromLang, toLang });
    }
    setTaxiVisible(true);
  };

  const flagsPartner = otherMembers.length > 0
    ? [...new Set(otherMembers.map(m => getLang(m.lang).flag))]
    : null;

  return (
    <>
      {/* ═══ INIZIO b.173 — Top bar "Immersive" (template C, scelto da Luca) ═══
          COSA: barra ridotta all'essenziale — indietro, la coppia di
          lingue GRANDE e centrata, e un unico menu ••• che raccoglie
          TUTTO il resto (chiamata vocale, videochiamata, Taxi, audio,
          credito e le impostazioni che erano gia qui).
          PERCHE: massimo spazio alla conversazione. Metodo topografico:
          nessun handler cambia — i bottoni sono stati SPOSTATI dentro il
          menu con lo STESSO onClick di prima; il motore WebRTC/microfono
          NON e toccato. */}
      {/* b.174 — quando il menu ••• e aperto, la barra sale sopra lo
          sfondo-chiusura (z99). La barra ha backdrop-filter, che crea un
          contesto d'impilamento: senza questo, il menu (z100) resta
          intrappolato SOTTO lo sfondo trasparente e i click sulle voci
          finivano sullo sfondo (che chiude il menu) invece che sui
          comandi — il menu si apriva ma i comandi non partivano. */}
      <div style={{...S.roomHeader, position:'relative', flexWrap:'nowrap', gap:6, padding:'8px 10px',
        display:'flex', alignItems:'center', zIndex: showMoreMenu ? 200 : undefined}} role="banner">

        {/* ── Sinistra: indietro ── */}
        <button onClick={() => { if (leaveRoomTemporary) leaveRoomTemporary(); }}
          style={{...veste(S, false), width:38, height:38, borderRadius:12}}
          title={L('exit')} aria-label={L('exit')}>
          <IconBack size={18}/>
        </button>

        {/* ── Centro: coppia di lingue, grande ── */}
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, minWidth:0}}>
          <button onClick={() => setShowLangPicker(!showLangPicker)}
            style={{fontSize:24, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:'2px 4px',
              borderRadius:10, transition:'outline 0.15s', flexShrink:0,
              outline: showLangPicker ? `2px solid ${S.colors.accent4Border}` : 'none'}}
            title={L('yourLang')} aria-label={L('yourLang')}>
            {myL.flag}
          </button>
          <span style={{color:S.colors.accent4Border || S.colors.textTertiary, display:'flex', alignItems:'center', flexShrink:0}}>
            <IconSwap size={16}/>
          </span>
          {flagsPartner ? (
            <span style={{fontSize:24, lineHeight:1, display:'flex', gap:3, flexShrink:0,
              /* b.129 — il partner assente si vede sulla SUA bandiera, smorzata. */
              opacity: partnerConnected ? 1 : 0.35, transition:'opacity 0.3s'}}
              title={partnerConnected ? L('connectedWord') : L('notConnectedWord')}>
              {flagsPartner.map((flag, i) => (<span key={i}>{flag}</span>))}
            </span>
          ) : (
            <span style={{fontSize:24, lineHeight:1, flexShrink:0}}>{otherL.flag}</span>
          )}
        </div>

        {/* ── b.193 · Consumo sempre a vista (cresce dal vivo) ── */}
        <ConsumoChip roomId={roomId} />

        {/* ── Destra: speaker (accesso rapido) + menu ••• ── */}
        {/* b.175 — l'icona speaker torna VISIBILE in barra: durante una
            chiamata serve a portata di dito per attivare/disattivare la
            voce delle traduzioni, non sepolta nel menu. Stesso handler. */}
        <button onClick={() => { if (!audioEnabled) unlockAudio(); setAudioEnabled(!audioEnabled); }}
          title={audioEnabled ? L('muteTranslations') : L('unmuteTranslations')}
          aria-label={audioEnabled ? L('muteTranslations') : L('unmuteTranslations')}
          style={{...veste(S, false), width:38, height:38, borderRadius:12, flexShrink:0}}>
          {audioEnabled ? <IconVolume size={18}/> : <IconVolumeOff size={18}/>}
        </button>

        {/* ── Destra: un solo menu ••• ── */}
        <div style={{position:'relative', flexShrink:0}}>
          <button onClick={() => setShowMoreMenu(!showMoreMenu)}
            title={L('settings')} aria-label={L('settings')}
            style={{...veste(S, showMoreMenu), width:38, height:38, borderRadius:12}}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/>
            </svg>
          </button>

          {/* ── Menu a tendina ── */}
          {/* b.175 — la tendina era trasparente e si mischiava con lo
              sfondo: overlayBg2 non esiste nel tema, cadeva su overlayBg
              (alpha 0.04). Ora usa headerBg (quasi opaco) + blur forte,
              cosi si legge su qualunque sfondo. */}
          {showMoreMenu && (
            <div style={{position:'absolute', top:'100%', right:0, zIndex:100, marginTop:6,
              background:S.colors.headerBg, border:`1px solid ${S.colors.overlayBorder}`,
              borderRadius:14, padding:6, minWidth:236, backdropFilter:'blur(24px) saturate(1.1)',
              boxShadow:'0 12px 40px rgba(0,0,0,0.55)'}}>

              {/* Stato connessione + credito */}
              <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                borderBottom:`1px solid ${S.colors.overlayBorder}`, marginBottom:4}}>
                <ConnectionQuality
                  webrtcState={webrtc?.webrtcState || 'idle'}
                  partnerConnected={partnerConnected}
                  realtimeConnected={realtimeConnected}
                />
                <span style={{fontSize:11, color: partnerConnected ? S.colors.statusOk : S.colors.textMuted, fontWeight:600}}>
                  {partnerConnected ? (partner?.name || 'Partner') : L('waitingDots')}
                </span>
                {!showVideoCall && <span style={{marginLeft:'auto'}}><BatteryPillSlot /></span>}
              </div>

              {/* b.173 — AZIONI spostate qui dalla barra (stesso onClick).
                  Chiamata vocale e video restano nascoste nelle stanze
                  solo-testo di Mondo, come prima (regola b.152). */}
              {webrtc && !stanzaSoloTesto && (
                <button onClick={() => {
                    if (webrtc.webrtcConnected && webrtc.callType === 'voice') {
                      setShowVoiceCall(true);
                    } else {
                      // ── b.248 · stessa cura di b.245, ma sul pulsante VOCE ──
                      // La guardia `webrtcState === 'idle'` era rimasta QUI:
                      // dopo una chiamata caduta lo stato resta 'failed' e
                      // ripremere Voce non faceva piu niente — identico al
                      // difetto corretto per il Video in b.245. (Il commento
                      // di b.245 qui sotto diceva che l'audio "non ha mai
                      // avuto questa guardia": non era vero, ce l'aveva.)
                      // Chi decide se si puo chiamare e' initiateConnection,
                      // che gia rifiuta 'connecting' e 'connected'.
                      webrtc.initiateConnection(false);
                    }
                    setShowMoreMenu(false);
                  }}
                  style={rigaMenu(S)} aria-label={L('startVoiceCall')}>
                  <span style={iconaMenu}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  <span>{L('voiceCall')}</span>
                  {webrtc.webrtcConnected && webrtc.callType === 'voice' &&
                    <span style={{marginLeft:'auto', color:S.colors.statusOk}}><IconCheck size={12}/></span>}
                </button>
              )}
              {webrtc && !stanzaSoloTesto && (
                <button onClick={() => {
                    if (!showVideoCall) {
                      setShowVideoCall(true);
                      // ── b.245 · il pulsante VIDEO non giudica piu lo stato ──
                      // C'era `if (webrtcState === 'idle')`: dopo una chiamata
                      // caduta lo stato resta 'failed', e premere Video non
                      // faceva PIU NIENTE — sembrava che tentasse, e invece
                      // non partiva nessuna chiamata. Il pulsante AUDIO, due
                      // righe sopra, non ha mai avuto questa guardia: era solo
                      // il video a restare bloccato.
                      // Chi decide se si puo chiamare e' initiateConnection,
                      // che gia rifiuta 'connecting' e 'connected'.
                      webrtc.initiateConnection(true);
                    } else {
                      // ── b.248 · "chiudi" CHIUDE, non nasconde ──
                      // Prima qui c'era solo setShowVideoCall(false): la
                      // finestra spariva ma camera e connessione restavano
                      // VIVE. Chi vuole solo ridurre la finestra ha gia il
                      // comando nell'overlay (fullscreen -> riquadro); la
                      // voce di menu si chiama "Chiudi video" e deve fare
                      // quello che dice. Si usa la stessa via dei pulsanti
                      // rossi dell'overlay: disconnect() marca la chiusura
                      // VOLUTA (b.116), avvisa l'altro con call-ended
                      // (b.117) e spegne davvero camera e connessione.
                      webrtc.disconnect();
                      setShowVideoCall(false);
                      setVideoFullscreen(false);
                    }
                    setShowMoreMenu(false);
                  }}
                  style={rigaMenu(S)} aria-label={showVideoCall ? L('closeVideo') : L('videoCallWord')}>
                  <span style={iconaMenu}><IconCamera size={16}/></span>
                  <span>{showVideoCall ? L('closeVideo') : L('videoCallWord')}</span>
                  {showVideoCall && <span style={{marginLeft:'auto', color:S.colors.statusOk}}><IconCheck size={12}/></span>}
                </button>
              )}
              {setTaxiVisible && !showVideoCall && (
                <button onClick={() => { attivaTaxi(); setShowMoreMenu(false); }}
                  style={rigaMenu(S)} aria-label="TaxiTalk">
                  <span style={iconaMenu}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 1 0 0 .01M19 17a2 2 0 1 0 0 .01M6 17l1.5-5h9L18 17M9 12V9h6v3M10 6h4"/></svg>
                  </span>
                  <span>TaxiTalk</span>
                </button>
              )}
              {/* b.175 — audio traduzioni NON piu qui: l'icona speaker e
                  tornata VISIBILE in barra (accesso rapido). Doppione tolto. */}

              <div style={{height:1, background:S.colors.overlayBorder, margin:'4px 0'}} />

              {/* Sottotitoli */}
              <button onClick={() => { setShowCaptions(!showCaptions); setShowMoreMenu(false); }}
                style={rigaMenu(S)}>
                <span style={iconaMenu}>{showCaptions ? 'CC' : 'cc'}</span>
                <span>{showCaptions ? L('hideCaptions') : L('showCaptions')}</span>
                {showCaptions && <span style={{marginLeft:'auto', color:S.colors.statusOk}}><IconCheck size={12}/></span>}
              </button>
              {/* Esporta */}
              <button onClick={() => { exportConversation(); setShowMoreMenu(false); }}
                style={rigaMenu(S)}>
                <span style={iconaMenu}><IconClipboard size={15}/></span>
                <span>{L('exportConversation')}</span>
              </button>
              {/* Azioni AI */}
              {messages.length >= 3 && (
                <button onClick={() => { setShowChatActions(true); setShowMoreMenu(false); }}
                  style={rigaMenu(S)}>
                  <span style={iconaMenu}><IconBrainAI size={15}/></span>
                  <span>{L('aiActionsTitle')}</span>
                </button>
              )}
              {/* Audio Ducking */}
              <div style={{padding:'8px 12px'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                  <span style={iconaMenu}><IconMusic size={15}/></span>
                  <span style={{fontSize:13, fontWeight:500, color:S.colors.textPrimary}}>{L('audioDuckingLabel')}</span>
                  <span style={{marginLeft:'auto', fontSize:11, color:S.colors.textSecondary, fontFamily:'monospace'}}>
                    {Math.round((duckingLevel || 0.2) * 100)}%
                  </span>
                </div>
                <input type="range" min="5" max="80" step="5"
                  value={Math.round((duckingLevel || 0.2) * 100)}
                  onChange={e => { if (setDuckingLevel) setDuckingLevel(Number(e.target.value) / 100); }}
                  style={{width:'100%', accentColor:S.colors.accent4Border, height:4}} />
                <div style={{fontSize:9, color:S.colors.textMuted, marginTop:4}}>{L('duckingHint')}</div>
              </div>
              {/* Chiudi e archivia */}
              <button onClick={() => { setShowMoreMenu(false); endChatAndSave(); }}
                style={{...rigaMenu(S), color: S.colors.statusError || PALETTE.coral, fontWeight:600,
                  borderTop:`1px solid ${S.colors.overlayBorder}`, marginTop:4, paddingTop:12}}>
                <span style={iconaMenu}><IconArchive size={15}/></span>
                <span>{L('closeArchive')}</span>
              </button>
              {/* Batteria FREE */}
              {isTrial && (() => {
                const pct = Math.min(100, (freeCharsUsed / FREE_DAILY_LIMIT) * 100);
                const remaining = 100 - pct;
                const battColor = freeLimitExceeded ? S.colors.statusError
                  : remaining <= 20 ? S.colors.statusError
                  : remaining <= 50 ? S.colors.statusWarning
                  : S.colors.statusOk;
                return (
                  <div style={{padding:'8px 12px', borderTop:`1px solid ${S.colors.overlayBorder}`, marginTop:4}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <span style={iconaMenu}><IconBattery size={15}/></span>
                      <span style={{fontSize:13, fontWeight:500, color:S.colors.textPrimary}}>
                        {freeLimitExceeded ? L('freeDailyLimitHit') : L('freePlan')}
                      </span>
                      <span style={{marginLeft:'auto', fontSize:12, fontWeight:700, color:battColor, fontFamily:'monospace'}}>
                        {freeLimitExceeded ? '0%' : `${Math.round(remaining)}%`}
                      </span>
                    </div>
                    <div style={{marginTop:6, height:4, borderRadius:2, background:`${S.colors.overlayBorder}`, overflow:'hidden'}}>
                      <div style={{height:'100%', borderRadius:2, width:`${remaining}%`, background:battColor, transition:'width 0.5s ease'}} />
                    </div>
                    <div style={{fontSize:9, color:S.colors.textMuted, marginTop:4}}>
                      {Math.round(freeCharsUsed/1000)}K / {FREE_DAILY_LIMIT/1000}K caratteri
                      {freeResetTime && ` • Reset: ${freeResetTime}`}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      {/* ═══ FINE b.173 ═══ */}

      {/* Sfondo per chiudere il menu */}
      {showMoreMenu && (
        <div onClick={() => { setShowMoreMenu(false); }}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}

      {/* Selettore lingua */}
      {showLangPicker && (
        <div style={{position:'absolute', top:52, left:'50%', transform:'translateX(-50%)', zIndex:100,
          background:S.colors.glassCard,
          border:`1px solid ${S.colors.cardBorder}`,
          borderRadius:14, padding:'6px 0', maxHeight:280, overflowY:'auto', width:200,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => handleLangChange(l.code)}
              style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 14px',
                background: l.code === myLang ? S.colors.accent4Bg : 'transparent',
                border:'none', cursor:'pointer', fontFamily:FONT, fontSize:13,
                color:S.colors.textPrimary,
                transition:'background 0.1s'}}>
              <span style={{fontSize:18}}>{l.flag}</span>
              <span>{l.name}</span>
              {l.code === myLang && <span style={{marginLeft:'auto', color:S.colors.statusOk, fontSize:14}}>{<IconCheck size={12}/>}</span>}
            </button>
          ))}
        </div>
      )}
      {showLangPicker && (
        <div onClick={() => setShowLangPicker(false)}
          style={{position:'fixed', inset:0, zIndex:99, background:'transparent'}} />
      )}
    </>
  );
});

export default RoomHeader;

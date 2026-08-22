'use client';
import { memo, useState } from 'react';
import { LANGS, FONT, getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';
import ConnectionQuality from './ConnectionQuality.js';
import { IconBack, IconCamera, IconVolume, IconVolumeOff, IconCheck,
  IconClipboard, IconArchive, IconBattery, IconSwap, IconBrainAI } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import { ultimoRapportoTesto } from '../lib/diagnosticaChiamata.js';
import { rapportoMonitorTesto } from '../lib/monitorSviluppo.js';
import { toast } from '../lib/avvisi.js';
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

        {/* ── b.353 — CHIAMATE A PORTATA DI DITO (Luca: «dietro icona
            dedicata in alto», non sepolte nel menu). Stessi handler di
            prima, spostati; nelle stanze solo-testo restano nascoste. */}
        {webrtc && !stanzaSoloTesto && (
          <button onClick={() => {
              if (webrtc.webrtcConnected && webrtc.callType === 'voice') setShowVoiceCall(true);
              else webrtc.initiateConnection(false);
            }}
            title={L('voiceCall')} aria-label={L('startVoiceCall')}
            style={{...veste(S, webrtc.webrtcConnected && webrtc.callType === 'voice'), width:38, height:38, borderRadius:12, flexShrink:0}}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </button>
        )}
        {webrtc && !stanzaSoloTesto && (
          <button onClick={() => {
              if (!showVideoCall) { setShowVideoCall(true); webrtc.initiateConnection(true); }
              else { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }
            }}
            title={showVideoCall ? L('closeVideo') : L('videoCallWord')} aria-label={showVideoCall ? L('closeVideo') : L('videoCallWord')}
            style={{...veste(S, showVideoCall), width:38, height:38, borderRadius:12, flexShrink:0}}>
            <IconCamera size={18}/>
          </button>
        )}

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

        {/* b.353 — RAPPORTO TECNICO dietro la sua icona in barra (Luca):
            un tocco copia la scatola nera della chiamata + catena voce. */}
        <button onClick={async () => {
            const testo = ultimoRapportoTesto() + '\n\n— CATENA VOCE / TESTO —\n' + rapportoMonitorTesto();
            try { await navigator.clipboard.writeText(testo); toast.success(L('techReportCopied')); }
            catch { toast.info(testo.slice(0, 300)); }
          }}
          title={L('techReport')} aria-label={L('techReport')}
          style={{...veste(S, false), width:38, height:38, borderRadius:12, flexShrink:0}}>
          <IconClipboard size={16}/>
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
              /* b.394 — IL MENU ERA ILLEGGIBILE, E LE SCRITTE SI ACCAVALLAVANO.
                 La tendina e appoggiata dentro un contenitore largo quanto
                 il tastino: 38 pixel. Senza una larghezza dichiarata, per
                 le regole del CSS poteva contare solo su quei 38, quindi
                 ripiegava sulla larghezza MINIMA possibile — quella in cui
                 ogni frase si spezza a ogni spazio. minWidth alzava il
                 pavimento ma non le dava mai lo spazio per scrivere in
                 riga. Da qui le parole a capo in mezzo alla frase, e le
                 due scritte «In attesa» spezzate in «In / attesa» che
                 finivano una addosso all'altra. */
              borderRadius:14, padding:6, boxSizing:'border-box',
              width:'min(304px, calc(100vw - 20px))', backdropFilter:'blur(24px) saturate(1.1)',
              boxShadow:'0 12px 40px rgba(0,0,0,0.55)'}}>

              {/* Stato connessione + credito */}
              <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                borderBottom:`1px solid ${S.colors.overlayBorder}`, marginBottom:4}}>
                <ConnectionQuality
                  webrtcState={webrtc?.webrtcState || 'idle'}
                  partnerConnected={partnerConnected}
                  realtimeConnected={realtimeConnected}
                  style={{flexShrink:0}}
                />
                {/* Lo stato «In attesa» lo dice gia l'indicatore di segnale
                    qui accanto: dirlo due volte non aggiungeva niente e
                    rubava lo spazio. Qui resta solo il NOME di chi c'e, e
                    se e lungo si tronca invece di mandare la riga a capo.
                    (via anche 'Partner', che era una parola fissa dentro un
                    menu tradotto in trentotto lingue) */}
                <span style={{fontSize:11, color:S.colors.statusOk, fontWeight:600,
                  minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {partnerConnected ? (partner?.name || '') : ''}
                </span>
                {!showVideoCall && <span style={{marginLeft:'auto', flexShrink:0}}><BatteryPillSlot /></span>}
              </div>

              {/* b.353 — MENU RIPULITO (collaudo di Luca: «il menu in alto
                  e incomprensibile»). Via da qui: chiamata vocale e video
                  (ora ICONE in barra), TaxiTalk (si raggiunge dalla Home),
                  sottotitoli (si gestiscono dentro la chiamata), esporta
                  (vive nell'elenco conversazioni), rapporto tecnico (icona
                  in barra durante la chiamata), "abbassa la musica" (i
                  volumi vivono nel pannello Volumi della chiamata).
                  Restano: lo stato qui sopra, gli strumenti AI, la
                  chiusura, la batteria. */}
              {/* Azioni AI */}
              {messages.length >= 3 && (
                <button onClick={() => { setShowChatActions(true); setShowMoreMenu(false); }}
                  style={rigaMenu(S)}>
                  <span style={iconaMenu}><IconBrainAI size={15}/></span>
                  <span>{L('aiActionsTitle')}</span>
                </button>
              )}
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
                      {/* b.363 — italiano fisso dentro un menu tradotto */}
                      {Math.round(freeCharsUsed/1000)}K / {FREE_DAILY_LIMIT/1000}K {L('charactersWord')}
                      {freeResetTime && ` • ${L('resetWord')}: ${freeResetTime}`}
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

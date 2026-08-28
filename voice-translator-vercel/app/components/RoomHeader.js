'use client';
import { memo, useState } from 'react';
import { LANGS, FONT, getLang, FREE_DAILY_LIMIT } from '../lib/constants.js';
import ConnectionQuality from './ConnectionQuality.js';
import AvatarImg from './AvatarImg.js';
import { IconBack, IconCamera, IconVolume, IconVolumeOff, IconCheck,
  IconClipboard, IconBattery, IconSwap, IconBrainAI } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import { ultimoRapportoTesto } from '../lib/diagnosticaChiamata.js';
import { rapportoMonitorTesto } from '../lib/monitorSviluppo.js';
import { toast } from '../lib/avvisi.js';
import { BatteryPillSlot } from './BatteryPill.js';
import ConsumoChip from './ConsumoChip.js';
import NumeroSicurezza from './NumeroSicurezza.js';

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

// b.490 — tavola 19: «ogni voce dice cosa fa, non solo come si chiama».
// La spiegazione sta sotto il nome, piccola e muta: nessuno deve toccare
// una voce per scoprire cosa fa.
const VoceMenu = ({ S, icona, nome, spiega, onClick }) => (
  <button onClick={onClick} style={rigaMenu(S)}>
    <span style={iconaMenu}>{icona}</span>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span>{nome}</span>
      {spiega && <span style={{ fontSize: 11, fontWeight: 400, color: S.colors.textMuted }}>{spiega}</span>}
    </span>
  </button>
);
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
  setView, setZoomTesto,
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [mostraNumero, setMostraNumero] = useState(false); // b.490 — l'overlay del numero di sicurezza

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
      <div style={{...S.roomHeader, position:'relative', flexWrap:'nowrap', gap:6, padding:'8px 20px',
        display:'flex', alignItems:'center', zIndex: showMoreMenu ? 200 : undefined}} role="banner">

        {/* ── Sinistra: indietro ── */}
        <button onClick={() => { if (leaveRoomTemporary) leaveRoomTemporary(); }}
          style={{...veste(S, false), width:44, height:44, borderRadius:12}}
          title={L('exit')} aria-label={L('exit')}>
          <IconBack size={18}/>
        </button>

        {/* ══ b.466 — IN DUE, IN ALTO C'E' CHI HAI DAVANTI ══
            Ordine di Luca: «in alto nella singola inserisci nome e
            bandiera». Con una persona sola dall'altra parte, chi e non e un
            dettaglio: e la cosa che dice dove sei. Il codice della stanza
            serve mentre si aspetta qualcuno — e in due non si aspetta piu
            nessuno.
            In tre o piu non si mette: i nomi sono gia nei chip sotto la
            testata, e ripeterne uno solo direbbe una cosa falsa (che quella
            e LA persona con cui parli). */}
        {partner && otherMembers.length === 1 && (
          <span style={{display:'flex', alignItems:'center', gap:8, minWidth:0, flexShrink:1}}>
            {/* b.486 — la faccia c'e SEMPRE: se il membro non ha un avatar
                si ricade su quello di default, come fa gia getSenderAvatar
                nelle bolle. Nel collaudo del 25/08 il partner senza avatar
                lasciava la testata con solo nome e bandiera: il template
                04b la vuole con la faccia, ed e la faccia che si riconosce
                al volo, prima ancora di leggere. */}
            <AvatarImg src={partner.avatar || 'av1'} size={30} alt="" />
            <span style={{fontSize:16, fontWeight: 500, color:S.colors.textPrimary, fontFamily:FONT,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0}}>
              {partner.name}
            </span>
            <span style={{fontSize:15, lineHeight:1, flexShrink:0,
              opacity: partnerConnected ? 1 : 0.35, transition:'opacity 0.3s'}}
              title={partnerConnected ? L('connectedWord') : L('notConnectedWord')}>
              {otherL.flag}
            </span>
          </span>
        )}

        {/* b.473 — LA COPPIA DI LINGUE NON SI RIPETE. In una chat a due
            adesso la stessa informazione compariva TRE volte: qui il nome
            con la sua bandiera, qui accanto la coppia grande, e sotto i chip
            «Tu / Luca». Tre copie della stessa cosa non informano tre volte:
            occupano tre volte lo spazio e fanno dubitare che siano tre cose
            diverse.
            Quando c'e l'identita (due persone), la coppia sparisce da qui: la
            dicono i chip sotto la testata, che e dove il template la mette.
            Il selettore della lingua resta raggiungibile — lo apre il chip. */}
        <div style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:10, minWidth:0,
          ...(partner && otherMembers.length === 1 ? { display:'none' } : {})}}>
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

        {/* b.470 — LA CHIAMATA VOCALE SCENDE NEL MENU. Il template tiene
            in testata quattro comandi, non sette: indietro, carattere, voce,
            video. Sette tondini da trentotto in una riga da trecentonovanta
            punti non sono comandi, sono una fila — e in una fila non si
            distingue piu quello che serve adesso.
            La chiamata vocale c'e ancora, nel menu ••• insieme al resto.
            Il video resta in testata: e la porta al gruppo. */}
        {/* b.461, ordine di Luca: «le stanze partono normali come testo e si
            seleziona la camera all'interno della pagina chat». La telecamera
            era gia qui, e faceva una cosa sola: il video a due. Adesso fa la
            cosa giusta per quanti sono davvero in stanza — a due apre il
            video diretto, in tre o piu apre la STANZA VIDEO di gruppo.
            Serviva: quella porta stava nella sala d'attesa, dove pero non
            c'e ancora nessuno con cui fare video, ed e stata tolta. Qui
            invece la gente c'e, ed e il momento in cui la scelta ha senso. */}
        {webrtc && !stanzaSoloTesto && (
          <button onClick={() => {
              if (otherMembers.length > 1 && setView) { unlockAudio?.(); setView('stanza-video'); return; }
              if (!showVideoCall) { setShowVideoCall(true); webrtc.initiateConnection(true); }
              else { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }
            }}
            title={showVideoCall ? L('closeVideo') : L('videoCallWord')} aria-label={showVideoCall ? L('closeVideo') : L('videoCallWord')}
            style={{...veste(S, showVideoCall), width:44, height:44, borderRadius:12, flexShrink:0}}>
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
          style={{...veste(S, false), width:44, height:44, borderRadius:12, flexShrink:0}}>
          {audioEnabled ? <IconVolume size={18}/> : <IconVolumeOff size={18}/>}
        </button>

        {/* b.470 — IL TASTO DEL CARATTERE, come nel template: c'e su ogni
            pagina, sempre nello stesso posto. Qui mancava, e la misura del
            testo si poteva cambiare solo dalla vista a carte — cioe non
            dalla chat, che e dove si legge davvero. */}
        {setZoomTesto && (
          <button onClick={() => setZoomTesto((v) => (v >= 3 ? -2 : v + 1))}
            title={L('textBigger')} aria-label={L('textBigger')}
            style={{...veste(S, false), width:44, height:44, borderRadius:12, flexShrink:0,
              fontFamily:FONT, fontSize:15, fontWeight: 500, color:S.colors.textSecondary}}>
            Aa
          </button>
        )}

        {/* b.470 — il RAPPORTO TECNICO non sta piu in testata: e uno
            strumento da guasto, si usa una volta ogni mille e occupava un
            posto fisso accanto a cose che si usano parlando. E' nel menu. */}
        {/* b.482 — LA PILA TORNA NEL SUO ANGOLO. Ordine di Luca guardando
            questa schermata: «nell'angolo dovrebbe esserci la pila». In
            tutte le altre pagine sta li, in alto a destra, e si legge senza
            toccare niente; qui invece era finita DENTRO il menu •••, cioe
            per sapere quanto credito ti resta dovevi aprire un menu — e la
            chat e proprio il posto dove il credito si consuma mentre
            guardi. Durante una videochiamata resta nascosta: li lo schermo
            e dell'altra persona. */}
        {!showVideoCall && <span style={{flexShrink:0, display:'flex', alignItems:'center'}}><BatteryPillSlot /></span>}

        {/* ── Destra: un solo menu ••• ── */}
        <div style={{position:'relative', flexShrink:0}}>
          <button onClick={() => setShowMoreMenu(!showMoreMenu)}
            title={L('settings')} aria-label={L('settings')}
            style={{...veste(S, showMoreMenu), width:44, height:44, borderRadius:12}}>
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
              // b.464 — anche questo menu galleggia: fondo opaco, non vetro.
              background:S.colors.menuBg || S.colors.bg, border:`1px solid ${S.colors.overlayBorder}`,
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
                <span style={{fontSize:11, color:S.colors.statusOk, fontWeight: 500,
                  minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {partnerConnected ? (partner?.name || '') : ''}
                </span>
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
              {/* b.477 — LA CHIAMATA VOCALE, RIMESSA. In b.470 l'avevo tolta
                  dalla testata e scritto nel commento che era «nel menu
                  insieme al resto»: non era vero, l'avevo solo cancellata.
                  Una prova di guardia se n'e accorta — chiede che le due
                  chiamate siano nascoste INSIEME nelle stanze solo testo, e
                  ne trovava una sola. Aveva ragione lei.
                  Sta qui, con la stessa guardia del video: dove non si puo
                  chiamare, non compare nessuna delle due. */}
              {webrtc && !stanzaSoloTesto && (
                <button onClick={() => {
                    setShowMoreMenu(false);
                    if (webrtc.webrtcConnected && webrtc.callType === 'voice') setShowVoiceCall(true);
                    else webrtc.initiateConnection(false);
                  }}
                  style={rigaMenu(S)}>
                  <span style={iconaMenu}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </span>
                  {/* b.490 — tavola 19: la voce dice cosa fa */}
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span>{L('voiceCall')}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: S.colors.textMuted }}>{L('voiceCallDesc')}</span>
                  </span>
                </button>
              )}

              {/* Azioni AI */}
              {messages.length >= 3 && (
                <button onClick={() => { setShowChatActions(true); setShowMoreMenu(false); }}
                  style={rigaMenu(S)}>
                  <span style={iconaMenu}><IconBrainAI size={15}/></span>
                  {/* b.490 — tavola 19: la voce dice cosa fa */}
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span>{L('aiActionsTitle')}</span>
                    <span style={{ fontSize: 11, fontWeight: 400, color: S.colors.textMuted }}>{L('aiActionsDesc')}</span>
                  </span>
                </button>
              )}

              {/* b.510 — «sono in stanze, permettimi di creare a stanza e
                  invitare anche da dentro la stanza» (Luca). Prima
                  l'invito si raggiungeva solo dal logo di Home, che crea
                  sempre una stanza NUOVA: da dentro una stanza gia aperta
                  non c'era modo di invitare qualcun altro alla STESSA
                  stanza. QuickInvite gia sapeva gestire una stanza
                  esistente (prop roomId): mancava solo la porta da qui.
                  roomId qui e sempre quello della stanza in cui si e ora
                  (arriva da roomPolling.roomId in page.js). */}
              {roomId && setView && (
                <VoceMenu S={S}
                  icona={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>}
                  nome={L('inviteFriend')} spiega={L('inviteExplain')}
                  onClick={() => { setShowMoreMenu(false); setView('quickinvite'); }} />
              )}

              {/* b.490 — tavola 19: IL NUMERO DI SICUREZZA ENTRA NEL MENU,
                  con la sua spiegazione («Controlla che nessuno ascolti»).
                  Prima viveva solo come chip sopra la chat, visibile ma
                  anonimo: nel menu ha nome e scopo. Compare solo quando il
                  collegamento diretto esiste — senza E2E il numero non c'e,
                  e una voce che apre il nulla e un tasto finto.
                  SCOSTAMENTI DICHIARATI dalla tavola: «Chi puo entrare» non
                  ha oggi un controllo da dentro la stanza (si aggiungera
                  con quello); «Rapporto tecnico» e «Chiudi la stanza» vivono
                  nel pannello laterale per la regola 11 e per b.482 — un
                  comando rosso a un dito dalla chiamata e una trappola. */}
              {webrtc?.webrtcConnected && webrtc?.numeroSicurezza && (
                <VoceMenu S={S}
                  icona={<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                  nome={L('securityNumberWord')} spiega={L('securityNumberDesc')}
                  onClick={() => { setShowMoreMenu(false); setMostraNumero(true); }} />
              )}
              {/* b.482 — «CHIUDI E ARCHIVIA» SE NE VA DA QUI, e va nel
                  pannello laterale, in fondo alle preferenze. Non e sparita:
                  si apre con la linguetta sul bordo.
                  Il motivo e che questo menu si apre MENTRE si parla — dentro
                  ci sono la chiamata vocale e gli strumenti AI — e un comando
                  rosso che chiude la conversazione, a un dito da quelli, e
                  una trappola: basta un tocco storto e la chat e finita. Nel
                  pannello sta con le altre cose di fine sessione, dove ci si
                  arriva apposta. */}
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
                      <span style={{marginLeft:'auto', fontSize:12, fontWeight: 500, color:battColor, fontFamily:'monospace'}}>
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
          /* b.518 — TERZA VOLTA LA STESSA TENDINA DI VETRO, IN QUESTO STESSO FILE.
             b.175 e b.464 l'hanno chiusa per il menu «···», b.261 per il
             pannello delle voci («i messaggi si leggevano ATTRAVERSO
             l'elenco»); il selettore della lingua era rimasto indietro,
             ancora su `glassCard` — che nel tema vale rgba(...,0.06),
             cioe il 6% di opacita. RIPRODOTTO dal vivo in stanza (#805):
             con un messaggio dietro, la riga «English (US)» risulta
             illeggibile perche il testo della bolla si vede attraverso.
             Stesso rimedio gia adottato due volte qui accanto: fondo
             pieno del tema + sfocatura, nessun'altra modifica. */
          background:S.colors.menuBg || S.colors.bg,
          backdropFilter:'blur(24px) saturate(1.1)',
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

      {/* b.490 — tavola 20: il numero di sicurezza a schermo pieno, aperto
          dal menu. Il componente e lo stesso del chip: una cosa sola, due
          porte. */}
      {mostraNumero && (
        <div onClick={() => setMostraNumero(false)}
          style={{position:'fixed', inset:0, zIndex:210, background:'rgba(0,0,0,0.6)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
          <div onClick={(e) => e.stopPropagation()} style={{width:'min(420px, 100%)'}}>
            <NumeroSicurezza numero={webrtc?.numeroSicurezza} C={S.colors} />
            <button onClick={() => setMostraNumero(false)}
              style={{marginTop:10, width:'100%', minHeight:44, borderRadius:12, cursor:'pointer',
                background:'transparent', border:`1px solid ${S.colors.cardBorder}`,
                color:S.colors.textMuted, fontFamily:FONT, fontSize:13}}>
              {L('closeWord')}
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default RoomHeader;

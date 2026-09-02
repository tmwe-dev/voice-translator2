'use client';
import TendinaVetro from './ui/TendinaVetro.js'; // b.535 — la tendina unica dell'app
import { memo, useRef, useEffect, useState } from 'react';
import AvatarImg from './AvatarImg.js';
import { IconMic, IconKeyboard, IconVolume, IconVolumeOff, IconVolumeLow, IconCamera, IconCameraOff,
  IconFlipCamera, IconPhoneOff, IconExpand, IconGlobe } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import { traccia } from '../lib/monitorSviluppo.js';
import { toast } from '../lib/avvisi.js';
import { getVolumeTTS, setVolumeTTS, getAttenuazione, setAttenuazione, getVoceChiamata, setVoceChiamata, PRESET_ATTENUAZIONE } from '../lib/audioPrefs.js';
import { VOCI_ELENCO } from '../lib/compagni/catalogo.js';
import { useApp } from '../contexts/AppContext.js';
import { getLang } from '../lib/constants.js';

// ── I mattoni della videochiamata ──
//
// b.145 — erano tutti e quattro definiti DENTRO VideoCallOverlay, e il
// piu grave era VolumeControl: contiene un <input type="range">, cioe
// un elemento con uno stato suo che il browser tiene. Ricreare la
// funzione a ogni disegno la rendeva un TIPO nuovo per React, che
// smontava e rimontava il cursore mentre il dito lo stava trascinando —
// lo stesso meccanismo che in b.133 faceva perdere il fuoco al campo
// del nome. Fuori dal corpo l'identita e stabile e cio che veniva dalla
// chiusura passa come proprieta.
//
// Nel trasloco sono cadute anche tre frasi in italiano fisso
// ("sta parlando...", "sta scrivendo...", "ASCOLTO"): le leggeva anche
// chi ha l'applicazione in coreano.
const ControlBtn = ({ onClick, active, icon, label, color, activeColor, size = 56 }) => (
  <button onClick={onClick} style={{
    width: size, height: size + 16, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 3,
    borderRadius: 16, border: 'none', cursor: 'pointer',
    background: active ? (activeColor || 'rgba(34,197,94,0.2)') : 'rgba(255,255,255,0.1)',
    color: active ? (color || PALETTE.green) : '#94a3b8',
    transition: 'all 0.2s ease', WebkitTapHighlightColor: 'transparent',
  }}>
    <span style={{ lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{typeof icon === 'string' ? icon : icon}</span>
    <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
  </button>
);

// ── Partner activity badge (shows in both modes) ──
const PartnerActivityBadge = ({ L, partner, partnerSpeaking, partnerTyping }) => {
  const isSpeaking = partnerSpeaking;
  const isTyping = partnerTyping;
  if (!isSpeaking && !isTyping) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 24,
      background: 'rgba(99,102,241,0.85)', backdropFilter: 'blur(8px)',
      animation: 'vtPulse 2s infinite ease-in-out',
    }}>
      {isSpeaking ? <IconMic size={14}/> : <IconKeyboard size={14}/>}
      <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>
        {partner?.name || 'Partner'} {isSpeaking ? L('isSpeakingNow') : L('isTypingNow')}
      </span>
    </div>
  );
};

// ── Recording indicator (I'm recording → partner will see message incoming) ──
const RecordingIndicator = ({ L, recording, isListening }) => {
  if (!recording && !isListening) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      background: recording ? 'rgba(239,68,68,0.85)' : 'rgba(234,179,8,0.85)',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 4,
        background: '#fff',
        animation: 'vtPulse 1s infinite ease-in-out',
      }} />
      <span style={{ fontSize: 10, color: '#fff', fontWeight: 500 }}>
        {recording ? 'REC' : L('listeningUpper')}
      </span>
    </div>
  );
};

// ── Volume control component ──
/**
 * VideoCallOverlay — Beautiful, child-simple video call UI.
 *
 * Design principles:
 * - Big, colorful buttons with text labels
 * - Obvious visual states (green = on, red = off)
 * - Volume slider with large touch target
 * - Single-tap fullscreen/minimize
 * - Smooth animations
 * - Partner incoming message indicator
 *
 * The hidden <audio> element for WebRTC audio stays in RoomView.
 */
const VideoCallOverlay = memo(function VideoCallOverlay({
  webrtc, partner, getSenderAvatar,
  videoFullscreen, setVideoFullscreen,
  showVideoCall, setShowVideoCall,
  videoDucking, setVideoDucking,
  partnerVolume, setPartnerVolume,
  lastTranslationSubtitle,
  // ── b.132 · l'interprete, che qui non arrivava ──
  // La chiamata VOCALE riceveva `interpreter`, `interpreterActive` e
  // `setInterpreterActive`. La videochiamata no: riceveva solo
  // `lastTranslationSubtitle`, che e il sottotitolo dell'ultimo
  // messaggio di CHAT — un'altra cosa.
  //
  // Quindi in videochiamata non esisteva nessun modo di accendere
  // l'interprete: niente testo della voce tradotta, niente voce
  // dell'agente. Mentre la Home promette "Videochiamata tradotta —
  // con sottotitoli e voce tradotta".
  //
  // Tutto il resto c'era gia e funzionava: trascrizione, traduzione,
  // sintesi, invio sul canale dati, ricezione, riproduzione. Mancava
  // il comando per accenderlo, in una sola delle due chiamate.
  interpreter, interpreterActive, setInterpreterActive,
  recording, isListening,
  partnerSpeaking, partnerTyping,
  S,
  stanzaDiretta = false,
  stanzaConPiuDiDue = false,
}) {
  const localVideoRef = useRef(null);
  const localVideoInlineRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoInlineRef = useRef(null);
  // Comandi del pannello traduzione (persistenti tra le chiamate)
  const [mostraTesto, setMostraTesto] = useState(true);

  // b.275 — IL TESTO DURANTE LA VIDEOCHIAMATA.
  // Si registra quando un sottotitolo nuovo arriva, da dove viene
  // (interprete dal vivo o chat), quanto e lungo e se in quel momento i
  // sottotitoli erano accesi. Serve a distinguere tre guasti che a
  // schermo si assomigliano: il testo non arriva, arriva e non si vede,
  // arriva in ritardo. Il contenuto NON viene mai registrato.
  const ultimoSottotitoloRef = useRef(null);
  useEffect(() => {
    try {
      const daInterprete = interpreterActive && interpreter?.lastSubtitle ? interpreter.lastSubtitle : null;
      const grezzo = daInterprete
        || (Array.isArray(lastTranslationSubtitle)
          ? lastTranslationSubtitle[lastTranslationSubtitle.length - 1]
          : lastTranslationSubtitle);
      const testo = typeof grezzo === 'string' ? grezzo : (grezzo?.text || grezzo?.testo || null);
      if (!testo || testo === ultimoSottotitoloRef.current) return;
      ultimoSottotitoloRef.current = testo;
      traccia('sottotitolo-a-schermo', {
        caratteri: testo.length,
        fonte: daInterprete ? 'interprete' : 'chat',
        sottotitoliAccesi: mostraTesto ? 1 : 0,
      });
    } catch { /* il monitor non deve mai fermare il disegno del sottotitolo: si perde la riga e si prosegue */ }
  }, [lastTranslationSubtitle, interpreter?.lastSubtitle, interpreterActive, mostraTesto]);
  const [volTTS, setVolTTS] = useState(() => getVolumeTTS());
  const [livelloAtt, setLivelloAtt] = useState(() => getAttenuazione());
  // b.530 — la voce che traduce, scelta in chiamata (vale dalla frase dopo).
  const [voceTraduzione, setVoceTraduzione] = useState(() => getVoceChiamata());
  // b.176 — Versione B: due interruttori grandi. "Avanzate" nasconde i
  // controlli fini (modi SENTI + volume partner). Il ref ricorda il
  // volume voce prima di spegnerla, per ripristinarlo alla riaccensione.
  // b.352 — il pannello Volumi: l'unico secondario sopravvissuto alla
  // demolizione delle tre superfici di comandi accumulate.
  const [volumiAperti, setVolumiAperti] = useState(false);
  // ═══ b.491 — tavola 18: TRE COMANDI SOLI in barra (camera, microfono,
  // chiudi). Il resto — ruota, interprete, sottotitoli, voce, volumi,
  // schermo — sta dentro «Altro»: stessi onClick, stessi aria, niente
  // perso. E i comandi SPARISCONO DA SOLI dopo qualche secondo: un tocco
  // in qualunque punto li riporta. La X rossa in alto resta SEMPRE
  // visibile (b.352: la chiusura non deve mai sparire). ═══
  const [altroAperto, setAltroAperto] = useState(false);
  // b.527 — I COMANDI NON SPARISCONO PIU DA SOLI. La sparizione dopo 6
  // secondi (b.491) contraddiceva la regola che l'aveva preceduta e che
  // Luca ha ripetuto dal vivo: «i menu devono sempre essere
  // raggiungibili... non mantieni i menu quando sei a tutta pagina».
  // Il video resta protagonista perche la barra e un velo scuro in
  // basso, non perche i comandi giocano a nascondino.
  const comandiVisibili = true;
  const risveglia = () => {};
  const volTTSPrimaRef = useRef(volTTS > 0.01 ? volTTS : 0.7);
  // Il contatore € deve usare la tariffa VERA (premium se voce ElevenLabs)
  const { L, prefs, savePrefs } = useApp();

  // b.598 — L'ULTIMO SOTTOTITOLO, CALCOLATO UNA VOLTA SOLA.
  // Prima viveva SOLO dentro l'IIFE del ramo a tutto schermo: la
  // modalita compatta non aveva modo di sapere se c'era un sottotitolo
  // pronto. Portato qui (component scope) cosi entrambe le modalita
  // possono leggerlo.
  const inScheda = (x) => !x ? null
    : (typeof x === 'string' ? { text: x, original: '' } : x);
  const daInterpreteCompatto = interpreterActive && interpreter?.lastSubtitle
    ? [inScheda(interpreter.lastSubtitle)] : null;
  const subsCompatto = daInterpreteCompatto || (Array.isArray(lastTranslationSubtitle)
    ? lastTranslationSubtitle.map(inScheda)
    : lastTranslationSubtitle ? [inScheda(lastTranslationSubtitle)] : []);
  const latest = subsCompatto.length > 0 ? subsCompatto[subsCompatto.length - 1] : null;

  // Attach local video stream to BOTH fullscreen and inline elements
  useEffect(() => {
    const stream = webrtc?.localStream;
    if (!stream) return;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    if (localVideoInlineRef.current) localVideoInlineRef.current.srcObject = stream;
  }, [webrtc?.localStream, videoFullscreen]);

  // Attach remote VIDEO stream (MUTED — audio via hidden <audio> in parent)
  useEffect(() => {
    const stream = webrtc?.remoteStream;
    if (!stream) return;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.muted = true;
    }
    if (remoteVideoInlineRef.current) {
      remoteVideoInlineRef.current.srcObject = stream;
      remoteVideoInlineRef.current.muted = true;
    }
  }, [webrtc?.remoteStream, webrtc?.remoteVideoActive, videoFullscreen, showVideoCall]);

  if (!webrtc) return null;


  // ═══════════════════════════════════════════════════════
  // ── FULLSCREEN MODE ──
  // ═══════════════════════════════════════════════════════
  if (videoFullscreen && (webrtc.webrtcConnected || webrtc.webrtcState === 'connecting')) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        background: '#03050c', display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      }}>
      {/* b.352 — IL CONTAINER: anche a pieno schermo la chiamata vive in una
          cornice da app (larghezza contenuta sui grandi schermi, bordi e
          colori del design system), non in un buco nero senza forma. */}
      <div onPointerDown={risveglia} style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        width: 'min(920px, 100vw)', height: '100%',
        background: '#000', overflow: 'hidden',
        borderLeft: `1px solid ${S?.colors?.overlayBorder || 'rgba(160,190,255,0.14)'}`,
        borderRight: `1px solid ${S?.colors?.overlayBorder || 'rgba(160,190,255,0.14)'}`,
      }}>
        {/* Remote video area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {webrtc.remoteVideoActive && webrtc.remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
              background: 'linear-gradient(145deg, #0f172a, #1e293b)',
            }}>
              <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={110} />
              <span style={{ color: '#cbd5e1', fontSize: 18, fontWeight: 500 }}>
                {!webrtc.webrtcConnected ? L('connectingLabel') : (partner?.name || 'Partner')}
              </span>
              {!webrtc.webrtcConnected && (
                <div style={{
                  width: 60, height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: '60%', height: '100%', borderRadius: 2, background: PALETTE.blue,
                    animation: 'vtConnecting 1.5s ease-in-out infinite',
                  }} />
                </div>
              )}
              {webrtc.webrtcConnected && (
                <span style={{ color: '#64748b', fontSize: 13 }}>{L('cameraOff')}</span>
              )}
            </div>
          )}

          {/* Local video PiP — b.531: c'e SEMPRE (Luca: «non vedo la mia
              miniatura»). Prima spariva del tutto a camera spenta: non
              sapevi ne come ti vedevano ne DOVE toccare per riaccenderti.
              Ora a camera spenta resta il riquadro col tuo avatar e la
              telecamera barrata: un tocco la riaccende. zIndex sopra la
              testata: la miniatura non finisce mai sotto niente. */}
          <button onClick={() => { if (!webrtc.videoEnabled) webrtc.toggleVideo(); }}
            aria-label={webrtc.videoEnabled ? L('cameraWord') : L('cameraOffTap')}
            style={{
              /* b.491 — tavola 18: il PiP e VERTICALE come un telefono. */
              position: 'absolute', top: 'max(74px, calc(env(safe-area-inset-top) + 58px))', right: 16,
              width: 84, height: 112, zIndex: 8, padding: 0,
              borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)', background: '#0f172a',
              cursor: webrtc.videoEnabled ? 'default' : 'pointer',
            }}>
            {webrtc.localStream && webrtc.videoEnabled ? (
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            ) : (
              <span style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <AvatarImg src={prefs?.avatar || null} size={40} />
                <IconCameraOff size={16} />
              </span>
            )}
          </button>

          {/* ═══ b.527 — LA TESTATA UNICA. Luca dal vivo: «non hai
              impostato nulla come da template... i comandi sono separati
              e non seguono lo standard». Prima qui galleggiavano QUATTRO
              pezzi sparsi (pillola Chat, pillola nome, pillola Connesso,
              cerchio rosso), ognuno col suo fondo e la sua quota. Ora e
              UNA barra, come ogni testata dell'applicazione: indietro a
              sinistra, chi e come al centro, la chiusura a destra. Tutto
              a 44 punti, tutto tradotto. ═══ */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 7,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'max(10px, env(safe-area-inset-top)) 14px 10px',
            background: 'linear-gradient(180deg, rgba(3,5,12,0.92) 30%, rgba(3,5,12,0))',
          }}>
            {/* ← torna alla chat (riduce la chiamata, NON la chiude) */}
            <button onClick={() => setVideoFullscreen(false)}
              aria-label={L('backToChatCall')}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 14px',
                borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${S?.colors?.overlayBorder || 'rgba(160,190,255,0.18)'}`,
                color: '#eef2ff', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              }}>
              {'←'} {L('chatWord')}
            </button>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {partner?.name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 500, color: '#eef2ff',
                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {partner.lang ? <span aria-hidden="true">{getLang(partner.lang).flag}</span> : null}
                  {partner.name}
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 500,
                color: webrtc.webrtcConnected ? '#4ade80' : PALETTE.amber }}>
                <i style={{ width: 6, height: 6, borderRadius: 3, background: 'currentColor', display: 'block',
                  animation: webrtc.webrtcConnected ? 'none' : 'vtBattPulse 1.5s infinite' }} />
                {webrtc.webrtcConnected ? L('connectedWord') : L('connectingLabel')}
              </span>
            </div>
            {/* chiudi la chiamata — il rosso resta solo qui */}
            <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
              aria-label={L('endCall')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.9)', color: '#fff',
                boxShadow: '0 2px 12px rgba(239,68,68,0.45)',
              }}>
              <IconPhoneOff size={20}/>
            </button>
          </div>
          {/* i badge di attivita restano sull'immagine, sotto la testata */}
          <div style={{ position: 'absolute', top: 'max(74px, calc(env(safe-area-inset-top) + 58px))', left: 16,
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', zIndex: 6 }}>
            <RecordingIndicator L={L} recording={recording} isListening={isListening} />
            <PartnerActivityBadge L={L} partner={partner} partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping} />
          </div>

          {/* b.284 — il costo non sta piu sopra il video: vive nel
              cassetto (•••), la pagina resta vuota. */}

          {/* ═══ Pannello traduzione — SEMPRE visibile, dal primo secondo ═══ */}
          {(() => {
            // b.132 — quando l'interprete e acceso, il sottotitolo VERO
            // e il suo: arriva dalla voce in tempo reale, non dalla chat.
            // b.276 — comunque arrivi (scheda o semplice testo), qui
            // diventa una scheda: cosi un mittente distratto non svuota
            // piu il sottotitolo a schermo.
            // b.598 — `latest` non si calcola piu qui: e stato portato a
            // livello di componente (sopra) cosi la modalita compatta lo
            // puo leggere anche lei. Qui si usa quello.
            const acc = S?.colors?.accent2 || '#38e1ff';
            const acc1 = S?.colors?.accent1 || '#5b8cff';
            const pillOn = {
              padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 750, cursor: 'pointer',
              fontFamily: 'inherit', border: 'none', color: '#fff',
              background: `linear-gradient(90deg, ${acc1}, ${acc})`,
              boxShadow: '0 4px 14px -4px rgba(91,140,255,0.5)',
            };
            const pillOff = {
              padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 750, cursor: 'pointer',
              fontFamily: 'inherit', border: '1px solid rgba(160,190,255,0.2)',
              background: 'transparent', color: 'rgba(238,242,255,0.5)',
            };
            return (
              <>
              {/* ═══ INIZIO b.278 — linguetta + cassetto al posto del pannello fisso ═══
                  COSA: il pannello b.176 copriva il video con interruttori e
                  cursori sempre a schermo. Ora: (1) il SOTTOTITOLO resta in
                  basso, da solo, sempre leggibile; (2) una LINGUETTA compatta
                  mostra lo stato reale (CC, voce, volume) e apre (3) il
                  CASSETTO laterale con GLI STESSI controlli di prima — stessi
                  onClick, stessi aria, niente perso. PERCHE: "il video prima
                  di tutto" (gerarchia chiesta da Luca). */}

              {/* b.284 — la linguetta e stata sostituita dalla barra laterale
                  di icone (richiesta di Luca: comandi raccolti, pagina vuota). */}

              {/* (2) il sottotitolo, da solo, in basso: la parte che si legge */}
              {mostraTesto && (
              <div style={{
                position: 'absolute', bottom: 128, left: 14, right: 14,
                background: 'rgba(5,7,15,0.84)', backdropFilter: 'blur(18px)',
                border: '1px solid rgba(160,190,255,0.16)', borderRadius: 20,
                padding: '12px 14px 10px',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6)',
              }}>
                {(
                  <div style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                      {partnerSpeaking && (
                        <span style={{ display: 'inline-flex', gap: 2.5, alignItems: 'center', height: 11, color: acc }}>
                          {[5,10,13,8,5].map((h, i) => (
                            <i key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: 'currentColor',
                              display: 'block', animation: `vtWave 0.85s ${i * 0.12}s ease-in-out infinite` }} />
                          ))}
                        </span>
                      )}
                      <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: 1.6, color: 'rgba(238,242,255,0.5)' }}>
                        {String(partner?.name || partner || 'PARTNER').toUpperCase()}{partnerSpeaking ? ` \u00b7 ${String(L('isSpeakingNow')).toUpperCase()}` : ''}
                      </span>
                    </div>
                    {latest ? (
                      <>
                        {latest.original && (
                          <div style={{ fontSize: 11, color: 'rgba(238,242,255,0.45)', fontStyle: 'italic' }}>
                            "{latest.original}"
                          </div>
                        )}
                        <div style={{ fontSize: 16.5, fontWeight: 500, color: '#eef2ff', lineHeight: 1.3, marginTop: 3, letterSpacing: -0.2 }}>
                          {latest.text}
                        </div>
                      </>
                    ) : stanzaDiretta ? (
                      // b.597 — IL SILENZIO SPIEGATO ANCHE QUI. Prima, in
                      // una Stanza Diretta, questo riquadro diceva sempre
                      // "le traduzioni appariranno qui appena parlate" —
                      // una promessa che in una Stanza Diretta non si
                      // avvera MAI (la voce non passa dai server per
                      // scelta di design, vedi directNoCloud). Luca dal
                      // vivo: "non traduce" — perche non poteva, e niente
                      // lo diceva finche non si andava a scovare il motivo
                      // dentro "Altro".
                      <div style={{ fontSize: 12.5, color: 'rgba(238,242,255,0.5)', fontStyle: 'italic' }}>
                        {L('directNoCloud')}
                      </div>
                    ) : stanzaConPiuDiDue ? (
                      // b.597 — stesso principio, per la stanza di gruppo:
                      // il pannello spiega subito perche non arriva niente,
                      // invece di lasciar credere che stia per arrivare.
                      <div style={{ fontSize: 12.5, color: 'rgba(238,242,255,0.5)', fontStyle: 'italic' }}>
                        {L('interpreterTwoOnly')}
                      </div>
                    ) : !interpreterActive && setInterpreterActive ? (
                      // b.527 — IL SILENZIO SPIEGATO, dov'era muto. Nel
                      // collaudo di Luca i sottotitoli restavano vuoti e
                      // niente diceva PERCHE: se la traduzione e spenta,
                      // qui ora c'e scritto, ed e il tasto per accenderla.
                      // b.597 — il comando gemello vive ora anche nella
                      // barra principale (vedi piu sotto): questo resta
                      // un secondo modo di trovarlo, non l'unico.
                      <button onClick={() => setInterpreterActive(true)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 12px',
                          borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                          background: `${acc1}1f`, border: `1px solid ${acc1}55`,
                          color: '#eef2ff', fontSize: 12.5, fontWeight: 500,
                        }}>
                        <IconGlobe size={14}/> {L('translationOffTap')}
                      </button>
                    ) : interpreterActive && interpreter?.erroreAvvio ? (
                      // l'avvio e caduto: lo si dice (e RoomView sta gia
                      // riprovando da solo, vedi b.527 li).
                      <div style={{ fontSize: 12.5, color: '#ffc44d', fontStyle: 'italic' }}>
                        {L('interpreterFailed')}
                      </div>
                    ) : interpreterActive && interpreter?.problemaAudio ? (
                      // b.598 — IL SILENZIO SPIEGATO ANCHE A META CHIAMATA.
                      // Tre blocchi audio di fila che Whisper non riesce a
                      // trascrivere ("audio corrotto o non supportato")
                      // prima sparivano senza una riga a schermo: sembrava
                      // che la traduzione avesse smesso di ascoltare, senza
                      // nessun motivo visibile.
                      <div style={{ fontSize: 12.5, color: '#ffc44d', fontStyle: 'italic' }}>
                        {L('audioNonChiaro')}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12.5, color: 'rgba(238,242,255,0.35)', fontStyle: 'italic' }}>
                        {L('captionsWillAppear')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* ═══ FINE b.278 ═══ */}
              </>
            );
          })()}
        </div>

        {/* ═══ b.285 — QUANDO NON TI VEDONO O NON TI SENTONO, C'E UN
            CARTELLO, non un'icona da interpretare. Regola di Luca: un
            bambino o un anziano devono capire al volo. Il cartello e
            anche il pulsante: lo tocchi e il problema si risolve. */}
        {(!webrtc.videoEnabled || !webrtc.audioEnabled) && (
          <div style={{ position: 'absolute', top: 'max(58px, env(safe-area-inset-top))', left: 0, right: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 7, pointerEvents: 'none' }}>
            {!webrtc.videoEnabled && (
              <button onClick={() => webrtc.toggleVideo()}
                style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(255,196,77,0.5)',
                  background: 'rgba(120,72,0,0.85)', color: '#ffe9c2', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(10px)' }}>
                <IconCameraOff size={16}/> {L('cameraOffTap')}
              </button>
            )}
            {!webrtc.audioEnabled && (
              <button onClick={() => webrtc.toggleAudio()}
                style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(239,68,68,0.55)',
                  background: 'rgba(110,15,15,0.88)', color: '#ffd9d9', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(10px)' }}>
                <IconVolumeOff size={16}/> {L('micOffWarn')}
              </button>
            )}
          </div>
        )}



        {/* ═══ b.352 — LA PLANCIA UNICA (collaudo di Luca: «i comandi sono
            incomprensibili, i menu devono sempre essere raggiungibili, la
            grafica deve essere quella dell'app»). Tre superfici accumulate
            (colonna destra b.286, colonna sinistra b.284, cassetto b.278
            con doppioni, contatore e motore-voce) sono state DEMOLITE.
            Resta UNA barra in basso, sempre visibile, con parole chiare
            sotto ogni tasto, nello stile dell'app. Il pannello Volumi e
            l'unico secondario: si apre sopra la barra, non copre nulla. */}

        {/* Il pannello VOLUMI: due cursori con nomi umani + come sentire
            l'originale mentre parla la traduzione. Stile carta dell'app. */}
        {volumiAperti && (
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 8,
            width: 'min(360px, calc(100vw - 28px))',
            background: S?.colors?.cardBg || 'rgba(10,14,26,0.96)',
            border: `1px solid ${S?.colors?.overlayBorder || 'rgba(160,190,255,0.18)'}`,
            borderRadius: 18, padding: 14, backdropFilter: 'blur(20px)',
            boxShadow: '0 14px 48px rgba(0,0,0,0.55)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#eef2ff' }}>{L('volumesWord')}</span>
              <button onClick={() => setVolumiAperti(false)} aria-label={L('close')}
                style={{ background: 'none', border: 'none', color: 'rgba(238,242,255,0.6)', fontSize: 16, cursor: 'pointer', padding: 4 }}>{'\u2715'}</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(238,242,255,0.75)', marginBottom: 5 }}>
                {L('partnerVolume')}
              </div>
              <input type="range" min="0" max="1" step="0.05" value={partnerVolume ?? 1}
                onChange={(e) => setPartnerVolume && setPartnerVolume(parseFloat(e.target.value))}
                aria-label={L('partnerVolume')} style={{ width: '100%', accentColor: S?.colors?.accent2 || '#38e1ff', height: 4 }} />
            </div>
            {/* b.530 — Luca: «permettimi nella video call di cambiare la
                voce di traduzione». Le voci con nome sono quelle premium
                (multilingua: la stessa voce parla ogni lingua di arrivo);
                Automatica lascia scegliere al sistema una voce
                madrelingua. La scelta vale DALLA FRASE DOPO: si legge a
                ogni sintesi, non alla partenza. */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(238,242,255,0.75)', marginBottom: 5 }}>
                {L('ttsVoicePick')}
              </div>
              {/* INIZIO b.535 — via la <select> di sistema: TendinaVetro,
                  stesso campo, pannello di vetro del template. FINE b.535 */}
              <TendinaVetro
                valore={voceTraduzione}
                onScegli={(v) => { setVoceTraduzione(v); setVoceChiamata(v); }}
                targa={L('ttsVoicePick')}
                accento={S?.colors?.accent2 || '#38e1ff'}
                opzioni={[{ id: '', label: L('autoVoiceWord') }, ...VOCI_ELENCO.map((v) => ({ id: v.id, label: v.nome }))]}
                stile={{ width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(160,190,255,0.18)',
                  color: '#eef2ff', fontSize: 13 }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(238,242,255,0.75)', marginBottom: 5 }}>
                {L('translatedVolume')}
              </div>
              <input type="range" min="0" max="1" step="0.05" value={volTTS}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolTTS(v); setVolumeTTS(v);
                  // b.352 — agisce anche sulla frase GIA in corso
                  try { window.dispatchEvent(new CustomEvent('bartalk:vol-tts')); } catch { /* fuori dal browser nessuno ascolta */ }
                }}
                aria-label={L('translatedVolume')} style={{ width: '100%', accentColor: S?.colors?.accent1 || '#5b8cff', height: 4 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(238,242,255,0.75)', marginBottom: 6 }}>
              {L('whileTranslationSpeaks')}
            </div>
            {PRESET_ATTENUAZIONE.map(pz => {
              const on = livelloAtt === pz.valore;
              return (
                <button key={pz.id}
                  onClick={() => { setAttenuazione(pz.valore); setLivelloAtt(pz.valore); if (setVideoDucking) setVideoDucking(pz.valore < 0.5); }}
                  aria-pressed={on}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    padding: '10px 12px', marginBottom: 5, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: on ? 'rgba(91,140,255,0.16)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${on ? (S?.colors?.accent1 || '#5b8cff') : 'rgba(160,190,255,0.14)'}`,
                    color: '#eef2ff', fontSize: 13.5, fontWeight: 500,
                  }}>
                  <span aria-hidden="true" style={{ width: 16, textAlign: 'center', color: on ? (S?.colors?.accent1 || '#5b8cff') : 'rgba(238,242,255,0.35)' }}>{on ? '\u2713' : '\u25CB'}</span>
                  {L(pz.chiave)}
                </button>
              );
            })}
          </div>
        )}

        {/* ═══ b.491 — IL CASSETTO «ALTRO»: i comandi di riserva della
            tavola 18. Ruota, interprete, sottotitoli, voce, volumi e
            schermo non stanno piu in barra: un tocco su «Altro» e sono
            qui, con gli STESSI onClick di prima. Regola 11 del template:
            il resto va nella sidebar. ═══ */}
        {altroAperto && (
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(96px + env(safe-area-inset-bottom))', zIndex: 8,
            width: 'min(360px, calc(100vw - 28px))',
            background: S?.colors?.cardBg || 'rgba(10,14,26,0.96)',
            border: `1px solid ${S?.colors?.overlayBorder || 'rgba(160,190,255,0.18)'}`,
            borderRadius: 18, padding: 10, backdropFilter: 'blur(20px)',
            boxShadow: '0 14px 48px rgba(0,0,0,0.55)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, padding: '2px 4px' }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#eef2ff' }}>{L('otherWord')}</span>
              <button onClick={() => setAltroAperto(false)} aria-label={L('close')}
                style={{ background: 'none', border: 'none', color: 'rgba(238,242,255,0.6)', fontSize: 16, cursor: 'pointer', padding: 4 }}>{'\u2715'}</button>
            </div>
            {[
              { chiave: 'ruota', icona: <IconFlipCamera size={17}/>, parola: L('rotateWord'), acceso: false,
                fa: () => webrtc.flipCamera() },
              // b.597 — «interprete» non abita piu qui: e diventato un
              // comando primario nella barra (Luca: "non si sa come
              // attivarla"). Restava, sarebbero stati DUE interruttori per
              // la stessa cosa in due posti diversi — piu confusione, non
              // meno.
              { chiave: 'cc', icona: <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.5 }}>CC</span>,
                parola: L('subtitlesWord'), acceso: mostraTesto, fa: () => setMostraTesto(v => !v) },
              { chiave: 'voce', icona: volTTS > 0.01 ? <IconVolume size={17}/> : <IconVolumeOff size={17}/>,
                parola: L('voiceWord'), acceso: volTTS > 0.01,
                fa: () => {
                  if (volTTS > 0.01) { volTTSPrimaRef.current = volTTS; setVolTTS(0); setVolumeTTS(0); try { window.dispatchEvent(new CustomEvent('bartalk:vol-tts')); } catch { /* fuori dal browser nessuno ascolta */ } }
                  else { const v = volTTSPrimaRef.current > 0.01 ? volTTSPrimaRef.current : 0.7; setVolTTS(v); setVolumeTTS(v); }
                } },
              { chiave: 'volumi', icona: <IconVolumeLow size={17}/>, parola: L('volumesWord'), acceso: volumiAperti,
                fa: () => { setAltroAperto(false); setVolumiAperti(true); } },
              ...((typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia && webrtc.condividiSchermo)
                ? [{ chiave: 'schermo', icona: <IconExpand size={17}/>, parola: L('screenWord'),
                    acceso: !!webrtc.schermoCondiviso, fa: () => webrtc.condividiSchermo() }] : []),
            ].map(vo => (
              <button key={vo.chiave} onClick={vo.fa} aria-pressed={vo.acceso}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  padding: '11px 12px', marginBottom: 4, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                  background: vo.acceso ? 'rgba(91,140,255,0.16)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${vo.acceso ? (S?.colors?.accent1 || '#5b8cff') : 'rgba(160,190,255,0.14)'}`,
                  color: '#eef2ff', fontSize: 13.5, fontWeight: 500,
                }}>
                <span style={{ width: 20, display: 'flex', justifyContent: 'center', color: vo.acceso ? (S?.colors?.accent2 || '#38e1ff') : 'rgba(238,242,255,0.6)' }}>{vo.icona}</span>
                {vo.parola}
              </button>
            ))}
          </div>
        )}

        {/* ═══ b.491 — LA BARRA DELLA TAVOLA 18: comandi grandi, il rosso
            solo per chiudere. b.597 — «tre comandi soli» si allarga a
            quattro: la traduzione (vedi sotto) e nata come parte di
            "Altro" e in pratica restava invisibile — Luca l'ha segnalato
            due volte prima di questa correzione. Restano fuori dalla
            barra solo i comandi davvero secondari (ruota, sottotitoli,
            voce, volumi, schermo). ═══ */}
        <div style={{
          padding: '10px 10px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
          background: 'linear-gradient(to top, rgba(3,5,12,0.97) 55%, rgba(0,0,0,0))',
          opacity: comandiVisibili ? 1 : 0,
          pointerEvents: comandiVisibili ? 'auto' : 'none',
          transition: 'opacity 0.35s ease',
        }}>
          {/* microfono */}
          <button onClick={() => webrtc.toggleAudio()} aria-pressed={webrtc.audioEnabled}
            aria-label={L('micWord')}
            style={{ width: 54, height: 54, borderRadius: 27, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: webrtc.audioEnabled ? 'rgba(5,7,15,0.6)' : 'rgba(239,68,68,0.25)',
              color: webrtc.audioEnabled ? '#fff' : '#ef4444',
              WebkitTapHighlightColor: 'transparent' }}>
            {webrtc.audioEnabled ? <IconMic size={22}/> : <IconVolumeOff size={22}/>}
          </button>
          {/* telecamera */}
          <button onClick={() => webrtc.toggleVideo()} aria-pressed={webrtc.videoEnabled}
            aria-label={L('cameraWord')}
            style={{ width: 54, height: 54, borderRadius: 27, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: webrtc.videoEnabled ? 'rgba(5,7,15,0.6)' : 'rgba(239,68,68,0.25)',
              color: webrtc.videoEnabled ? '#fff' : '#ef4444',
              WebkitTapHighlightColor: 'transparent' }}>
            {webrtc.videoEnabled ? <IconCamera size={22}/> : <IconCameraOff size={22}/>}
          </button>
          {/* ═══ b.597 — LA TRADUZIONE, PROMOSSA A COMANDO PRIMARIO.
              Prima viveva SOLO dentro "Altro": due tocchi, un'icona fra
              sei, nessuna indicazione che fosse li. Luca dal vivo: "non si
              sa come attivarla, come disattivarla". Ora e qui, un tocco,
              sempre visibile, con lo stato che si vede (acceso = colorato).
              In Stanza Diretta o di gruppo resta comunque tappabile: dice
              perche non si puo' invece di sparire e basta. ═══ */}
          {setInterpreterActive && (
            <button onClick={() => {
                if (stanzaDiretta) { toast.info(L('directNoCloud')); return; }
                if (stanzaConPiuDiDue) { toast.info(L('interpreterTwoOnly')); return; }
                setInterpreterActive(!interpreterActive);
              }}
              aria-pressed={interpreterActive && !stanzaDiretta && !stanzaConPiuDiDue}
              aria-label={interpreterActive ? L('translatingWord') : L('translateWord')}
              title={interpreterActive ? L('translatingWord') : L('translateWord')}
              style={{ width: 44, height: 44, borderRadius: 22, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (interpreterActive && !stanzaDiretta && !stanzaConPiuDiDue)
                  ? `${S?.colors?.accent2 || '#38e1ff'}30` : 'rgba(5,7,15,0.6)',
                border: `1px solid ${(interpreterActive && !stanzaDiretta && !stanzaConPiuDiDue)
                  ? `${S?.colors?.accent2 || '#38e1ff'}90` : 'rgba(160,190,255,0.2)'}`,
                color: (interpreterActive && !stanzaDiretta && !stanzaConPiuDiDue)
                  ? (S?.colors?.accent2 || '#38e1ff') : '#fff',
                opacity: (stanzaDiretta || stanzaConPiuDiDue) ? 0.55 : 1,
                WebkitTapHighlightColor: 'transparent' }}>
              <IconGlobe size={20}/>
            </button>
          )}
          {/* chiudi — il rosso e solo per questo */}
          <button
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            aria-label={L('endCall')}
            style={{
              width: 54, height: 54, borderRadius: 27, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(145deg, #ef4444, #dc2626)', color: '#fff',
              boxShadow: '0 6px 24px rgba(239,68,68,0.5)',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <IconPhoneOff size={24}/>
          </button>
          {/* Altro — la porta ai comandi di riserva, piu piccola dei tre */}
          <button onClick={() => { setAltroAperto(v => !v); setVolumiAperti(false); }}
            aria-expanded={altroAperto} aria-label={L('otherWord')}
            style={{ width: 44, height: 44, borderRadius: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: altroAperto ? 'rgba(91,140,255,0.25)' : 'rgba(5,7,15,0.6)',
              border: '1px solid rgba(160,190,255,0.2)', color: '#fff',
              fontSize: 18, fontWeight: 500, letterSpacing: 1,
              WebkitTapHighlightColor: 'transparent' }}>
            {'\u22EF'}
          </button>
        </div>
      </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ── INLINE (COMPACT) MODE ──
  // ═══════════════════════════════════════════════════════
  if (!showVideoCall || videoFullscreen) return null;

  return (
    <div style={{
      position: 'relative', flexShrink: 0, background: '#000',
      borderBottom: S ? `1px solid ${S.colors.overlayBorder}` : '1px solid rgba(255,255,255,0.1)',
    }}>
      {/* Remote video */}
      <div style={{ position: 'relative', width: '100%', height: 220, background: '#111' }}>
        {webrtc.remoteVideoActive && webrtc.remoteStream ? (
          <video ref={remoteVideoInlineRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            background: 'linear-gradient(145deg, #0f172a, #1e293b)',
          }}>
            <AvatarImg src={partner ? getSenderAvatar(partner.name) : null} size={64} />
            <span style={{ color: S?.colors?.textMuted || '#94a3b8', fontSize: 13, fontWeight: 500 }}>
              {webrtc.webrtcState === 'connecting' ? L('connConnecting')
                : webrtc.webrtcConnected ? (partner?.name || 'Partner')
                : L('waitingDots')}
            </span>
            {webrtc.webrtcConnected && !webrtc.remoteVideoActive && (
              <span style={{ color: '#475569', fontSize: 11 }}>{L('cameraOff')}</span>
            )}
          </div>
        )}

        {/* Local PiP — b.531: sempre presente, come nel pieno schermo. */}
        <button onClick={() => { if (!webrtc.videoEnabled) webrtc.toggleVideo(); }}
          aria-label={webrtc.videoEnabled ? L('cameraWord') : L('cameraOffTap')}
          style={{
            position: 'absolute', bottom: 8, right: 8, width: 90, height: 68, zIndex: 3, padding: 0,
            borderRadius: 10, overflow: 'hidden',
            border: '2px solid rgba(96,165,250,0.5)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)', background: '#0f172a',
            cursor: webrtc.videoEnabled ? 'default' : 'pointer',
          }}>
          {webrtc.localStream && webrtc.videoEnabled ? (
            <video ref={localVideoInlineRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          ) : (
            <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconCameraOff size={16} />
            </span>
          )}
        </button>

        {/* Status badge */}
        <div style={{
          position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            background: webrtc.webrtcConnected ? '#4ade80'
              : webrtc.webrtcState === 'connecting' ? PALETTE.amber : PALETTE.red,
          }} />
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 500 }}>
            {webrtc.webrtcConnected ? 'P2P' : webrtc.webrtcState === 'connecting' ? '...' : 'OFF'}
          </span>
        </div>

        {/* Partner activity badge (top center) */}
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>
          <PartnerActivityBadge L={L} partner={partner} partnerSpeaking={partnerSpeaking} partnerTyping={partnerTyping} />
        </div>

        {/* Recording indicator (top right) */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <RecordingIndicator L={L} recording={recording} isListening={isListening} />
        </div>

        {/* b.598 — SOTTOTITOLO ANCHE IN MODALITA COMPATTA.
            Prima la modalita compatta non aveva alcun accesso
            all'interprete (ne comando ne testo): la traduzione esisteva
            solo se l'utente passava a tutto schermo. Qui una striscia
            minima, sola andata (nessun cassetto, nessun volume): solo
            l'ultima frase tradotta, se c'e. */}
        {interpreterActive && latest && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8, right: 8,
            background: 'rgba(5,7,15,0.82)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(160,190,255,0.16)', borderRadius: 12,
            padding: '6px 10px', zIndex: 3,
          }}>
            <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>
              {latest.text}
            </div>
          </div>
        )}
      </div>

      {/* Controls area */}
      <div style={{ background: 'rgba(0,0,0,0.92)', padding: '8px 12px 10px' }}>
        {/* Volume row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 8px',
        }}>
          <button onClick={() => setPartnerVolume(partnerVolume > 0.01 ? 0 : 0.7)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 18, lineHeight: 1 }}>
            {partnerVolume < 0.01 ? <IconVolumeOff size={18}/> : partnerVolume < 0.4 ? <IconVolumeLow size={18}/> : <IconVolume size={18}/>}
          </button>
          <input type="range" min="0" max="100" step="5"
            value={Math.round(partnerVolume * 100)}
            onChange={e => setPartnerVolume(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: PALETTE.blue, height: 6 }} />
          <span style={{
            fontSize: 11, color: '#94a3b8', fontFamily: 'monospace',
            minWidth: 32, textAlign: 'right', fontWeight: 500,
          }}>
            {Math.round(partnerVolume * 100)}%
          </span>
        </div>

        {/* Buttons row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: 6 }}>
          <ControlBtn size={48}
            onClick={() => webrtc.toggleVideo()}
            active={webrtc.videoEnabled}
            icon={webrtc.videoEnabled ? <IconCamera size={20}/> : <IconCameraOff size={20}/>}
            label={webrtc.videoEnabled ? L('cameraWord') : L('cameraOffWord')}
            color="#22c55e" activeColor="rgba(34,197,94,0.15)"
          />
          {/* b.598 — LA TRADUZIONE, ANCHE QUI. Stesso comando, stesso
              guard (Stanza Diretta / gruppo), della barra a tutto
              schermo: la modalita compatta non deve piu essere un vicolo
              cieco per l'interprete. */}
          {setInterpreterActive && (
            <ControlBtn size={48}
              onClick={() => {
                if (stanzaDiretta) { toast.info(L('directNoCloud')); return; }
                if (stanzaConPiuDiDue) { toast.info(L('interpreterTwoOnly')); return; }
                setInterpreterActive(!interpreterActive);
              }}
              active={interpreterActive && !stanzaDiretta && !stanzaConPiuDiDue}
              icon={<IconGlobe size={20}/>}
              label={interpreterActive ? L('translatingWord') : L('translateWord')}
              color="#38e1ff" activeColor="rgba(56,225,255,0.15)"
            />
          )}
          <ControlBtn size={48}
            onClick={() => webrtc.flipCamera()}
            active={true}
            icon={<IconFlipCamera size={20}/>}
            label={L('rotateWord')}
            color="#60a5fa" activeColor="rgba(96,165,250,0.12)"
          />
          <ControlBtn size={48}
            onClick={() => setVideoFullscreen(true)}
            active={true}
            icon={<IconExpand size={20}/>}
            label={L('expandWord')}
            color="#f59e0b" activeColor="rgba(245,158,11,0.15)"
          />
          <ControlBtn size={48}
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            active={false}
            icon={<IconPhoneOff size={20}/>}
            label={L('closeWord')}
            color="#ef4444" activeColor="rgba(239,68,68,0.2)"
          />
        </div>
      </div>
    </div>
  );
});

export default VideoCallOverlay;

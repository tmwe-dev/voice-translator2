'use client';
import { memo, useRef, useEffect, useState } from 'react';
import AvatarImg from './AvatarImg.js';
import { IconMic, IconKeyboard, IconVolume, IconVolumeOff, IconVolumeLow, IconCamera, IconCameraOff,
  IconFlipCamera, IconMinimize, IconPhoneOff, IconExpand, IconRecord } from './Icons.js';
import { PALETTE } from '../lib/palette.js';
import CostTicker from './CostTicker.js';

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
  recording, isListening,
  partnerSpeaking, partnerTyping,
  S,
}) {
  const localVideoRef = useRef(null);
  const localVideoInlineRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteVideoInlineRef = useRef(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

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

  // ── Shared control button component ──
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
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
    </button>
  );

  // ── Partner activity badge (shows in both modes) ──
  const PartnerActivityBadge = () => {
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
        <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>
          {partner?.name || 'Partner'} {isSpeaking ? 'sta parlando...' : 'sta scrivendo...'}
        </span>
      </div>
    );
  };

  // ── Recording indicator (I'm recording → partner will see message incoming) ──
  const RecordingIndicator = () => {
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
        <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
          {recording ? 'REC' : 'ASCOLTO'}
        </span>
      </div>
    );
  };

  // ── Volume control component ──
  const VolumeControl = ({ compact }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: compact ? 6 : 10,
      padding: compact ? '6px 10px' : '8px 16px',
      borderRadius: 24, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
    }}>
      <button onClick={() => setPartnerVolume(partnerVolume > 0.01 ? 0 : 0.7)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: compact ? 18 : 22, lineHeight: 1 }}>
        {partnerVolume < 0.01 ? '\u{1F507}' : partnerVolume < 0.4 ? '\u{1F509}' : '\u{1F50A}'}
      </button>
      <input type="range" min="0" max="100" step="5"
        value={Math.round(partnerVolume * 100)}
        onChange={e => setPartnerVolume(Number(e.target.value) / 100)}
        style={{
          width: compact ? 90 : 120, height: compact ? 6 : 8,
          accentColor: PALETTE.blue, borderRadius: 4,
        }} />
      <span style={{
        fontSize: compact ? 10 : 12, color: '#94a3b8',
        fontFamily: 'monospace', minWidth: 32, textAlign: 'right', fontWeight: 600,
      }}>
        {Math.round(partnerVolume * 100)}%
      </span>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // ── FULLSCREEN MODE ──
  // ═══════════════════════════════════════════════════════
  if (videoFullscreen && (webrtc.webrtcConnected || webrtc.webrtcState === 'connecting')) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200,
        background: '#000', display: 'flex', flexDirection: 'column',
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
              <span style={{ color: '#cbd5e1', fontSize: 18, fontWeight: 600 }}>
                {!webrtc.webrtcConnected ? 'Connessione in corso...' : (partner?.name || 'Partner')}
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
                <span style={{ color: '#64748b', fontSize: 13 }}>Camera spenta</span>
              )}
            </div>
          )}

          {/* Local video PiP */}
          {webrtc.localStream && webrtc.videoEnabled && (
            <div style={{
              position: 'absolute', top: 60, right: 16, width: 120, height: 90,
              borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            </div>
          )}

          {/* Top bar: torna alla chat + status + chiusura SEMPRE visibili */}
          <div style={{
            position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 16, right: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 7,
          }}>
            {/* ← Torna alla chat (riduce la call, NON la chiude) */}
            <button onClick={() => setVideoFullscreen(false)}
              aria-label="Torna alla chat (la chiamata continua)"
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 24, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              }}>
              {'←'} Chat
            </button>
            {/* Connection status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 24,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: webrtc.webrtcConnected ? '#4ade80' : PALETTE.amber,
                animation: webrtc.webrtcConnected ? 'none' : 'vtBattPulse 1.5s infinite',
              }} />
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                {webrtc.webrtcConnected ? 'Connesso' : 'Connessione...'}
              </span>
            </div>
            {/* Chiudi chiamata — rosso, sempre raggiungibile anche se la
                barra in basso finisce sotto la UI del browser */}
            <button onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
              aria-label="Termina la chiamata"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 20, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.9)', color: '#fff',
                boxShadow: '0 2px 12px rgba(239,68,68,0.45)',
              }}>
              <IconPhoneOff size={20}/>
            </button>
          </div>
          {/* Recording / Partner activity, sotto la testata */}
          <div style={{ position: 'absolute', top: 'max(64px, calc(env(safe-area-inset-top) + 48px))', right: 16,
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', zIndex: 6 }}>
            <RecordingIndicator />
            <PartnerActivityBadge />
          </div>

          {/* Volume control (tap speaker icon to show/hide slider) */}
          <div style={{
            position: 'absolute', bottom: 110, right: 16,
            display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
          }}>
            {showVolumeSlider && <VolumeControl compact={false} />}
            <button onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              style={{
                width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {partnerVolume < 0.01 ? <IconVolumeOff size={20}/> : <IconVolume size={20}/>}
            </button>
          </div>

          {/* Costo call in euro, tempo reale */}
          <div style={{ position: 'absolute', top: 52, right: 106, zIndex: 6 }}>
            <CostTicker attivo={true} vocePremium={false} />
          </div>

          {/* ═══ Pannello traduzione live (Spatial Design) ═══
              Chi parla · originale piccolo · TRADUZIONE GRANDE · ASCOLTI (audio partner) */}
          {lastTranslationSubtitle && (() => {
            const subs = Array.isArray(lastTranslationSubtitle) ? lastTranslationSubtitle : [lastTranslationSubtitle];
            const latest = subs[subs.length - 1];
            const acc = S?.colors?.accent2 || '#38e1ff';
            return (
              <div style={{
                position: 'absolute', bottom: 110, left: 14, right: 14,
                background: 'rgba(5,7,15,0.82)', backdropFilter: 'blur(18px)',
                border: '1px solid rgba(160,190,255,0.16)', borderRadius: 18,
                padding: '11px 14px 9px', animation: 'vtSlideUp 0.35s ease-out',
                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.6)',
              }}>
                {/* Chi parla */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  {partnerSpeaking && (
                    <span style={{ display: 'inline-flex', gap: 2.5, alignItems: 'center', height: 11, color: acc }}>
                      {[5,10,13,8,5].map((h, i) => (
                        <i key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: 'currentColor',
                          display: 'block', animation: `vtWave 0.85s ${i * 0.12}s ease-in-out infinite` }} />
                      ))}
                    </span>
                  )}
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6, color: 'rgba(238,242,255,0.5)' }}>
                    {(partner || 'PARTNER').toUpperCase()}{partnerSpeaking ? ' · STA PARLANDO' : ''}
                  </span>
                </div>
                {/* Originale piccolo, corsivo */}
                {latest.original && (
                  <div style={{ fontSize: 11, color: 'rgba(238,242,255,0.45)', fontStyle: 'italic' }}>
                    "{latest.original}"
                  </div>
                )}
                {/* TRADUZIONE — grande, è quella che leggi */}
                <div style={{ fontSize: 16.5, fontWeight: 800, color: '#eef2ff', lineHeight: 1.3, marginTop: 3, letterSpacing: -0.2 }}>
                  {latest.text}
                </div>
                {/* ASCOLTI — audio del partner: tradotta (ducking) o originale + volume */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, paddingTop: 7,
                  borderTop: '1px solid rgba(160,190,255,0.12)' }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2, color: 'rgba(238,242,255,0.45)' }}>ASCOLTI</span>
                  <button onClick={() => setVideoDucking && setVideoDucking(true)} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 750, cursor: 'pointer',
                    fontFamily: 'inherit', border: 'none',
                    background: videoDucking ? `linear-gradient(90deg, ${S?.colors?.accent1 || '#5b8cff'}, ${acc})` : 'transparent',
                    color: videoDucking ? '#fff' : 'rgba(238,242,255,0.45)',
                    boxShadow: videoDucking ? '0 4px 14px -4px rgba(91,140,255,0.5)' : 'none',
                  }}>Voce tradotta</button>
                  <button onClick={() => setVideoDucking && setVideoDucking(false)} style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 750, cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: videoDucking ? '1px solid rgba(160,190,255,0.2)' : 'none',
                    background: !videoDucking ? `linear-gradient(90deg, ${S?.colors?.accent1 || '#5b8cff'}, ${acc})` : 'transparent',
                    color: !videoDucking ? '#fff' : 'rgba(238,242,255,0.45)',
                  }}>Originale</button>
                  <input type="range" min="0" max="1" step="0.05" value={partnerVolume ?? 1}
                    onChange={(e) => setPartnerVolume && setPartnerVolume(parseFloat(e.target.value))}
                    aria-label="Volume interlocutore"
                    style={{ flex: 1, accentColor: acc, height: 3, minWidth: 60 }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Bottom controls bar (safe-area: mai sotto la UI del browser) ── */}
        <div style={{
          padding: '12px 16px', paddingBottom: 'max(36px, env(safe-area-inset-bottom))',
          display: 'flex', justifyContent: 'center', gap: 10,
          background: 'linear-gradient(to top, rgba(0,0,0,0.98), rgba(0,0,0,0.7))',
        }}>
          <ControlBtn
            onClick={() => webrtc.toggleVideo()}
            active={webrtc.videoEnabled}
            icon={webrtc.videoEnabled ? <IconCamera size={24}/> : <IconCameraOff size={24}/>}
            label={webrtc.videoEnabled ? 'Camera' : 'Camera OFF'}
            color="#22c55e" activeColor="rgba(34,197,94,0.2)"
          />
          <ControlBtn
            onClick={() => webrtc.toggleAudio()}
            active={webrtc.audioEnabled}
            icon={webrtc.audioEnabled ? <IconMic size={24}/> : <IconVolumeOff size={24}/>}
            label={webrtc.audioEnabled ? 'Micro' : 'Muto'}
            color="#22c55e" activeColor="rgba(34,197,94,0.2)"
          />
          <ControlBtn
            onClick={() => webrtc.flipCamera()}
            active={true}
            icon={<IconFlipCamera size={24}/>}
            label="Ruota"
            color="#60a5fa" activeColor="rgba(96,165,250,0.15)"
          />
          <ControlBtn
            onClick={() => setVideoFullscreen(false)}
            active={true}
            icon={<IconMinimize size={24}/>}
            label="Riduci"
            color="#f59e0b" activeColor="rgba(245,158,11,0.15)"
          />
          <ControlBtn
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            active={false}
            icon={<IconPhoneOff size={24}/>}
            label="Chiudi"
            color="#ef4444" activeColor="rgba(239,68,68,0.3)"
            size={56}
          />
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
              {webrtc.webrtcState === 'connecting' ? 'Connessione...'
                : webrtc.webrtcConnected ? (partner?.name || 'Partner')
                : 'In attesa...'}
            </span>
            {webrtc.webrtcConnected && !webrtc.remoteVideoActive && (
              <span style={{ color: '#475569', fontSize: 11 }}>Camera spenta</span>
            )}
          </div>
        )}

        {/* Local PiP */}
        {webrtc.localStream && webrtc.videoEnabled && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8, width: 90, height: 68,
            borderRadius: 10, overflow: 'hidden',
            border: '2px solid rgba(96,165,250,0.5)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            <video ref={localVideoInlineRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          </div>
        )}

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
          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600 }}>
            {webrtc.webrtcConnected ? 'P2P' : webrtc.webrtcState === 'connecting' ? '...' : 'OFF'}
          </span>
        </div>

        {/* Partner activity badge (top center) */}
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>
          <PartnerActivityBadge />
        </div>

        {/* Recording indicator (top right) */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <RecordingIndicator />
        </div>
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
            minWidth: 32, textAlign: 'right', fontWeight: 600,
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
            label={webrtc.videoEnabled ? 'Camera' : 'OFF'}
            color="#22c55e" activeColor="rgba(34,197,94,0.15)"
          />
          <ControlBtn size={48}
            onClick={() => webrtc.flipCamera()}
            active={true}
            icon={<IconFlipCamera size={20}/>}
            label="Ruota"
            color="#60a5fa" activeColor="rgba(96,165,250,0.12)"
          />
          <ControlBtn size={48}
            onClick={() => setVideoFullscreen(true)}
            active={true}
            icon={<IconExpand size={20}/>}
            label="Espandi"
            color="#f59e0b" activeColor="rgba(245,158,11,0.15)"
          />
          <ControlBtn size={48}
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            active={false}
            icon={<IconPhoneOff size={20}/>}
            label="Chiudi"
            color="#ef4444" activeColor="rgba(239,68,68,0.2)"
          />
        </div>
      </div>
    </div>
  );
});

export default VideoCallOverlay;

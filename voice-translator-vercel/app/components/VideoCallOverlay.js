'use client';
import { memo, useRef, useEffect, useState } from 'react';
import AvatarImg from './AvatarImg.js';

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
      color: active ? (color || '#22c55e') : '#94a3b8',
      transition: 'all 0.2s ease', WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{ fontSize: size > 50 ? 24 : 20, lineHeight: 1 }}>{icon}</span>
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
        <span style={{ fontSize: 14 }}>{isSpeaking ? '\u{1F3A4}' : '\u{2328}\uFE0F'}</span>
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
          accentColor: '#60a5fa', borderRadius: 4,
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
                    width: '60%', height: '100%', borderRadius: 2, background: '#60a5fa',
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

          {/* Top bar: status + partner activity */}
          <div style={{
            position: 'absolute', top: 16, left: 16, right: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            {/* Connection status */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 24,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: 4,
                background: webrtc.webrtcConnected ? '#4ade80' : '#f59e0b',
                animation: webrtc.webrtcConnected ? 'none' : 'vtBattPulse 1.5s infinite',
              }} />
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                {webrtc.webrtcConnected ? 'Connesso' : 'Connessione...'}
              </span>
            </div>
            {/* Recording / Partner activity indicators */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <RecordingIndicator />
              <PartnerActivityBadge />
            </div>
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
              {partnerVolume < 0.01 ? '\u{1F507}' : '\u{1F50A}'}
            </button>
          </div>

          {/* Translation subtitle */}
          {lastTranslationSubtitle && (
            <div style={{
              position: 'absolute', bottom: 110, left: 16, right: 76,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 16, padding: '12px 18px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)',
              animation: 'vtSlideUp 0.3s ease-out',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1e3a5f', lineHeight: 1.5 }}>
                {lastTranslationSubtitle.text}
              </div>
              {lastTranslationSubtitle.original && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {lastTranslationSubtitle.original}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom controls bar ── */}
        <div style={{
          padding: '12px 16px 36px', display: 'flex', justifyContent: 'center', gap: 10,
          background: 'linear-gradient(to top, rgba(0,0,0,0.98), rgba(0,0,0,0.7))',
        }}>
          <ControlBtn
            onClick={() => webrtc.toggleVideo()}
            active={webrtc.videoEnabled}
            icon={webrtc.videoEnabled ? '\u{1F4F9}' : '\u{1F6AB}'}
            label={webrtc.videoEnabled ? 'Camera' : 'Camera OFF'}
            color="#22c55e" activeColor="rgba(34,197,94,0.2)"
          />
          <ControlBtn
            onClick={() => webrtc.toggleAudio()}
            active={webrtc.audioEnabled}
            icon={webrtc.audioEnabled ? '\u{1F3A4}' : '\u{1F507}'}
            label={webrtc.audioEnabled ? 'Micro' : 'Muto'}
            color="#22c55e" activeColor="rgba(34,197,94,0.2)"
          />
          <ControlBtn
            onClick={() => webrtc.flipCamera()}
            active={true}
            icon={'\u{1F504}'}
            label="Ruota"
            color="#60a5fa" activeColor="rgba(96,165,250,0.15)"
          />
          <ControlBtn
            onClick={() => setVideoFullscreen(false)}
            active={true}
            icon={'\u{2B07}\uFE0F'}
            label="Riduci"
            color="#f59e0b" activeColor="rgba(245,158,11,0.15)"
          />
          <ControlBtn
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            active={false}
            icon={'\u{1F4F5}'}
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
              : webrtc.webrtcState === 'connecting' ? '#f59e0b' : '#ef4444',
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
            {partnerVolume < 0.01 ? '\u{1F507}' : partnerVolume < 0.4 ? '\u{1F509}' : '\u{1F50A}'}
          </button>
          <input type="range" min="0" max="100" step="5"
            value={Math.round(partnerVolume * 100)}
            onChange={e => setPartnerVolume(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: '#60a5fa', height: 6 }} />
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
            icon={webrtc.videoEnabled ? '\u{1F4F9}' : '\u{1F6AB}'}
            label={webrtc.videoEnabled ? 'Camera' : 'OFF'}
            color="#22c55e" activeColor="rgba(34,197,94,0.15)"
          />
          <ControlBtn size={48}
            onClick={() => webrtc.flipCamera()}
            active={true}
            icon={'\u{1F504}'}
            label="Ruota"
            color="#60a5fa" activeColor="rgba(96,165,250,0.12)"
          />
          <ControlBtn size={48}
            onClick={() => setVideoFullscreen(true)}
            active={true}
            icon={'\u{1F5A5}\uFE0F'}
            label="Espandi"
            color="#f59e0b" activeColor="rgba(245,158,11,0.15)"
          />
          <ControlBtn size={48}
            onClick={() => { webrtc.disconnect(); setShowVideoCall(false); setVideoFullscreen(false); }}
            active={false}
            icon={'\u{1F4F5}'}
            label="Chiudi"
            color="#ef4444" activeColor="rgba(239,68,68,0.2)"
          />
        </div>
      </div>
    </div>
  );
});

export default VideoCallOverlay;

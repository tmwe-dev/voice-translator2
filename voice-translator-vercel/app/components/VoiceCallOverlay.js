'use client';
import { memo, useState, useEffect, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════
// VoiceCallOverlay — Full-screen audio-only call UI
// Shows partner avatar with animated audio rings, call timer, interpreter subtitles
// ═══════════════════════════════════════

function VoiceCallOverlay({
  webrtc, partner, getSenderAvatar, S,
  partnerVolume, setPartnerVolume,
  partnerSpeaking, partnerTyping,
  interpreterActive, setInterpreterActive, interpreter,
  onClose, onUpgradeToVideo,
}) {
  const [duration, setDuration] = useState(0);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const partnerName = partner?.name || partner?.from || 'Partner';
  const avatarUrl = getSenderAvatar ? getSenderAvatar(partnerName) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg, rgba(10,12,30,0.97) 0%, rgba(20,15,40,0.98) 100%)',
      backdropFilter: 'blur(30px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: FONT,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'rgba(255,255,255,0.7)', fontSize: 14,
      }}>
        <Icon name="phone" size={16} color="rgba(255,255,255,0.5)" />
        <span>Chiamata vocale</span>
        <span style={{ marginLeft: 8, color: '#26D9B0', fontWeight: 600 }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Center — Avatar with pulse rings */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          {/* Animated pulse rings when speaking */}
          {partnerSpeaking && [0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute', inset: -10 - i * 14,
              borderRadius: '50%',
              border: '2px solid rgba(38,217,176,0.3)',
              animation: `voicePulse 1.5s ease-out infinite`,
              animationDelay: `${i * 0.3}s`,
              opacity: 0,
            }} />
          ))}
          {/* Avatar */}
          <div style={{
            width: 140, height: 140, borderRadius: '50%',
            background: 'linear-gradient(135deg, #26D9B0 0%, #4A40E0 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: partnerSpeaking
              ? '0 0 40px rgba(38,217,176,0.5)'
              : '0 0 20px rgba(38,217,176,0.2)',
            transition: 'box-shadow 0.3s',
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={partnerName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 48, color: '#fff', fontWeight: 700 }}>
                {partnerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 600 }}>{partnerName}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>
            {partnerSpeaking ? 'Sta parlando...' : partnerTyping ? 'Sta scrivendo...' : 'In chiamata'}
          </div>
        </div>

        {/* Interpreter subtitles */}
        {interpreterActive && interpreter?.lastSubtitle && (
          <div style={{
            maxWidth: '85%', padding: '10px 18px',
            background: 'rgba(38,217,176,0.12)',
            border: '1px solid rgba(38,217,176,0.2)',
            borderRadius: 12, color: '#fff', fontSize: 15,
            textAlign: 'center', lineHeight: 1.4,
          }}>
            {interpreter.lastSubtitle}
          </div>
        )}
      </div>

      {/* Volume slider */}
      <div style={{
        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <Icon name="speaker" size={14} color="rgba(255,255,255,0.75)" />
        <input type="range" min={0} max={2} step={0.01}
          value={partnerVolume}
          onChange={e => setPartnerVolume(parseFloat(e.target.value))}
          style={{
            writingMode: 'vertical-lr', direction: 'rtl',
            width: 28, height: 100, accentColor: '#26D9B0',
          }}
        />
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>
          {Math.round(partnerVolume * 100)}%
        </span>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '24px 20px 40px', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        {/* Mute */}
        <button aria-label={webrtc.audioEnabled ? 'Disattiva microfono' : 'Attiva microfono'} onClick={() => webrtc.toggleAudio()} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: webrtc.audioEnabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,80,80,0.2)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name={webrtc.audioEnabled ? 'mic' : 'mute'} size={22}
            color={webrtc.audioEnabled ? '#fff' : '#ff5050'} />
        </button>

        {/* Interpreter toggle */}
        <button aria-label={interpreterActive ? 'Disattiva interprete' : 'Attiva interprete'} onClick={() => setInterpreterActive && setInterpreterActive(!interpreterActive)} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: interpreterActive ? 'rgba(38,217,176,0.25)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${interpreterActive ? 'rgba(38,217,176,0.4)' : 'rgba(255,255,255,0.12)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="globe" size={22} color={interpreterActive ? '#26D9B0' : '#fff'} />
        </button>

        {/* Upgrade to video */}
        <button aria-label="Passa a videochiamata" onClick={onUpgradeToVideo} style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="video" size={22} color="#fff" />
        </button>

        {/* End call */}
        <button aria-label="Termina chiamata" onClick={() => { webrtc.disconnect(); onClose(); }} style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff4444, #cc0000)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255,0,0,0.3)',
        }}>
          <Icon name="phoneOff" size={24} color="#fff" />
        </button>
      </div>

      {/* CSS animation for pulse rings — respects prefers-reduced-motion */}
      <style>{`
        @keyframes voicePulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

export default memo(VoiceCallOverlay);

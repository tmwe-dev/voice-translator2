'use client';
// ═══════════════════════════════════════════════
// InterpreterView — Fullscreen live translation overlay
//
// Displays during active interpreter mode on video calls.
// Shows: partner video, translated subtitles, latency stats.
// Auto-hides controls after 5s of inactivity.
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import getStyles from '../lib/styles.js';
import { FONT } from '../lib/constants.js';

const CONTROLS_HIDE_DELAY = 5000;

function InterpreterView({
  theme = 'dark',
  remoteStream,
  mySubtitles = [],
  partnerSubtitles = [],
  latencyMs = 0,
  onClose,
  partnerName = '',
  myLang = '',
  partnerLang = '',
  // ── Streaming mode props (subtitle-first pipeline) ──
  isStreaming = false,
  myLiveText = '',
  partnerLiveSubtitle = '',
}) {
  const s = getStyles(theme);
  const videoRef = useRef(null);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef(null);

  // Attach remote stream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  const lastPartnerSub = partnerSubtitles[partnerSubtitles.length - 1];
  const lastMySub = mySubtitles[mySubtitles.length - 1];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000', display: 'flex', flexDirection: 'column',
        fontFamily: FONT,
      }}
      onPointerMove={resetHideTimer}
      onPointerDown={resetHideTimer}
    >
      {/* Partner video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', position: 'absolute', inset: 0,
        }}
      />

      {/* My subtitles — top-left, small */}
      {/* In streaming mode: show live STT text; in legacy mode: show last final subtitle */}
      {(isStreaming ? myLiveText : lastMySub?.text) && (
        <div style={{
          position: 'absolute', top: 60, left: 16, right: '40%',
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: `1px solid ${isStreaming ? 'rgba(38,217,176,0.3)' : 'rgba(255,255,255,0.1)'}`,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 14, lineHeight: 1.4,
          animation: 'vtSubtitleIn 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <span style={{ opacity: 0.5, fontSize: 11 }}>
            {isStreaming ? '🎤 ' : ''}{myLang.toUpperCase()}
          </span>{' '}
          {isStreaming ? myLiveText : lastMySub?.text}
        </div>
      )}

      {/* Partner subtitles — bottom center, large, glass */}
      {/* In streaming mode: show live translated subtitle; in legacy mode: show last final */}
      {(isStreaming ? partnerLiveSubtitle : lastPartnerSub?.text) && (
        <div style={{
          position: 'absolute', bottom: 100, left: 16, right: 16,
          padding: '14px 20px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: 16,
          border: `1px solid ${isStreaming ? 'rgba(38,217,176,0.2)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
          color: '#fff',
          fontSize: 20, fontWeight: 500, lineHeight: 1.5,
          textAlign: 'center',
          animation: 'vtSubtitleIn 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {isStreaming ? partnerLiveSubtitle : lastPartnerSub?.text}
          {!isStreaming && lastPartnerSub?.original && (
            <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>
              {lastPartnerSub.original}
            </div>
          )}
        </div>
      )}

      {/* Streaming mode indicator */}
      {isStreaming && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          padding: '4px 10px', borderRadius: 20,
          background: 'rgba(38,217,176,0.3)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(38,217,176,0.4)',
          color: '#B0A8FF', fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#26D9B0',
            animation: 'vtSubtitlePulse 1.5s ease-in-out infinite',
          }} />
          LIVE
        </div>
      )}

      {/* Stats pill */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        padding: '4px 12px',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        borderRadius: 20,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
      }}>
        {latencyMs > 0 ? `${latencyMs}ms` : '...'}
      </div>

      {/* Controls — auto-hide */}
      {showControls && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 16, alignItems: 'center',
          animation: 'vtFadeIn 0.2s ease',
        }}>
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close interpreter"
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,59,48,0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
            onPointerDown={e => e.currentTarget.style.transform = 'scale(0.9)'}
            onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          {/* Partner info */}
          <div style={{
            padding: '6px 14px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: 20,
            color: '#fff', fontSize: 13,
          }}>
            {partnerName} — {partnerLang}
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes vtSubtitleIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vtSubtitlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default memo(InterpreterView);

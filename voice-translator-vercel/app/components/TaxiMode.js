'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import { getLang } from '../lib/constants';

/**
 * TaxiMode Component
 * A full-screen overlay that rotates translated text 180° for showing to others (e.g., taxi drivers).
 * Supports device orientation activation and TTS playback.
 */
const TaxiMode = memo(function TaxiMode({
  visible = false,
  onClose = () => {},
  originalText = '',
  translatedText = '',
  fromLang = 'en',
  toLang = 'en',
  onPlayTTS = () => {},
  onAutoActivate = undefined,
  S = {},
  theme = 'dark',
}) {
  const containerRef = useRef(null);
  const deviceOrientationListenerRef = useRef(null);

  // Get language info
  const toLangInfo = getLang(toLang);
  const langFlag = toLangInfo?.flag || '🌍';
  const langName = toLangInfo?.name || toLang.toUpperCase();

  // Handle device orientation for auto-activation
  useEffect(() => {
    if (!visible || !onAutoActivate || typeof window === 'undefined') return;

    const handleDeviceOrientation = (event) => {
      const beta = event.beta; // -180 to 180 (tilt front-back)

      // Detect if device is tilted back > 120° (showing screen upside down)
      if (Math.abs(beta) > 120) {
        onAutoActivate();
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      deviceOrientationListenerRef.current = handleDeviceOrientation;
      window.addEventListener('deviceorientation', handleDeviceOrientation);

      return () => {
        if (deviceOrientationListenerRef.current) {
          window.removeEventListener('deviceorientation', handleDeviceOrientation);
        }
      };
    }
  }, [visible, onAutoActivate]);

  const handlePlayTTS = useCallback(() => {
    onPlayTTS(translatedText, toLang);
  }, [translatedText, toLang, onPlayTTS]);

  if (!visible) return null;

  // Color defaults — use S.colors namespace
  const C = S.colors || {};
  const bgColor = C.bgGradient || (theme === 'dark' ? '#1a1a2e' : '#f8f8f8');
  const textPrimary = C.textPrimary || (theme === 'dark' ? '#ffffff' : '#000000');
  const textMuted = C.textMuted || (theme === 'dark' ? '#9ca3af' : '#666666');
  const accentGradient = C.accentGradient || 'linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)';
  const statusWarning = C.statusWarning || '#f59e0b';
  const borderColor = C.cardBorder || (theme === 'dark' ? '#374151' : '#e5e7eb');

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bgColor,
        zIndex: 450,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUpFade 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: bgColor,
          zIndex: 451,
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: '600', color: textPrimary }}>
          🚕 TAXI MODE
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handlePlayTTS}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: statusWarning,
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Play text-to-speech"
          >
            🔊
          </button>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: `1px solid ${textMuted}`,
              cursor: 'pointer',
              fontSize: '18px',
              color: textMuted,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = borderColor;
              e.currentTarget.style.color = textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = textMuted;
            }}
            title="Close Taxi Mode"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main content area (rotated 180°) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          transform: 'rotate(180deg)',
          WebkitTransform: 'rotate(180deg)',
          MozTransform: 'rotate(180deg)',
          msTransform: 'rotate(180deg)',
          overflow: 'hidden',
        }}
      >
        {/* Language indicator */}
        <div
          style={{
            fontSize: '32px',
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          {langFlag}
        </div>

        {/* Language name */}
        <div
          style={{
            fontSize: '14px',
            color: textMuted,
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          {langName}
        </div>

        {/* Translated text (large, gradient) */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: '700',
            background: accentGradient,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            textAlign: 'center',
            lineHeight: '1.4',
            marginBottom: '24px',
            maxWidth: '90%',
            wordWrap: 'break-word',
            hyphens: 'auto',
          }}
        >
          {translatedText || '(no text)'}
        </div>

        {/* Divider */}
        <div
          style={{
            width: '60px',
            height: '1px',
            backgroundColor: borderColor,
            marginBottom: '24px',
          }}
        />

        {/* Original text (smaller, muted) */}
        {originalText && (
          <div
            style={{
              fontSize: '14px',
              color: textMuted,
              textAlign: 'center',
              lineHeight: '1.4',
              maxWidth: '85%',
              wordWrap: 'break-word',
              hyphens: 'auto',
              fontStyle: 'italic',
            }}
          >
            {originalText}
          </div>
        )}
      </div>

      {/* Big round TTS button at the bottom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px 32px',
          borderTop: `1px solid ${borderColor}`,
        }}
      >
        <button
          onClick={handlePlayTTS}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: statusWarning,
            border: 'none',
            cursor: 'pointer',
            fontSize: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 158, 11, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
          }}
          title="Play translation (tap to repeat)"
        >
          🔊
        </button>
      </div>
    </div>
  );
});

/**
 * TaxiButton Component
 * A small toolbar button to activate Taxi Mode.
 */
const TaxiButton = memo(function TaxiButton({ onClick, S = {}, theme = 'dark' }) {
  const C = S.colors || {};
  const statusWarning = C.statusWarning || '#f59e0b';
  const textPrimary = C.textPrimary || (theme === 'dark' ? '#ffffff' : '#000000');
  const borderColor = C.cardBorder || (theme === 'dark' ? '#374151' : '#e5e7eb');

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '6px',
        backgroundColor: statusWarning,
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        color: '#000000',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title="Show Taxi Mode"
    >
      <span>🚕</span>
      <span>Taxi</span>
    </button>
  );
});

export default TaxiMode;
export { TaxiButton };

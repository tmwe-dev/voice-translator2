'use client';
import { memo, useEffect, useRef } from 'react';
import { FONT } from '../lib/constants.js';

// ═══════════════════════════════════════════════
// LiveSubtitles — Real-time subtitle overlay
//
// Shows streaming translated text as the user speaks.
// Two lines: top = what I'm saying (my lang), bottom = translation (partner lang)
// Subtitles fade in/out and auto-scroll.
// ═══════════════════════════════════════════════

function LiveSubtitles({ myLiveText, partnerLiveSubtitle, mySubtitles, partnerSubtitles, isActive }) {
  const scrollRef = useRef(null);

  // Auto-scroll to latest subtitle
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mySubtitles, partnerSubtitles, partnerLiveSubtitle]);

  if (!isActive) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(transparent, rgba(0,0,0,0.85) 30%)',
      padding: '40px 16px 16px',
      pointerEvents: 'none',
      zIndex: 20,
    }}>
      {/* Subtitle history (last 3 finalized) */}
      <div ref={scrollRef} style={{
        maxHeight: 120, overflowY: 'auto', marginBottom: 8,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {[...mySubtitles.slice(-3)].map((sub, i) => (
          <div key={`my-${sub.ts}-${i}`} style={{
            padding: '4px 10px', marginBottom: 4, borderRadius: 8,
            background: 'rgba(108,99,255,0.2)', backdropFilter: 'blur(8px)',
            fontSize: 12, fontFamily: FONT, color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.4,
          }}>
            <span style={{ opacity: 0.5, fontSize: 10 }}>{sub.original}</span>
            <br />
            {sub.text}
          </div>
        ))}
        {[...partnerSubtitles.slice(-3)].map((sub, i) => (
          <div key={`p-${sub.ts}-${i}`} style={{
            padding: '4px 10px', marginBottom: 4, borderRadius: 8,
            background: 'rgba(255,180,50,0.15)', backdropFilter: 'blur(8px)',
            fontSize: 12, fontFamily: FONT, color: 'rgba(255,220,150,0.8)',
            lineHeight: 1.4,
          }}>
            {sub.text}
          </div>
        ))}
      </div>

      {/* Live current text — what I'm saying now (STT real-time) */}
      {myLiveText && (
        <div style={{
          padding: '6px 12px', marginBottom: 6, borderRadius: 10,
          background: 'rgba(108,99,255,0.3)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(108,99,255,0.3)',
          fontSize: 14, fontFamily: FONT, color: '#fff',
          fontWeight: 500, lineHeight: 1.5,
          animation: 'subtitlePulse 2s ease-in-out infinite',
        }}>
          <span style={{ opacity: 0.4, fontSize: 10, marginRight: 6 }}>{'🎤'}</span>
          {myLiveText}
        </div>
      )}

      {/* Live translation — subtitle for partner */}
      {partnerLiveSubtitle && (
        <div style={{
          padding: '8px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.15)',
          fontSize: 16, fontFamily: FONT, color: '#fff',
          fontWeight: 600, lineHeight: 1.5,
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          animation: 'subtitleFadeIn 0.3s ease-out',
        }}>
          {partnerLiveSubtitle}
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes subtitlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes subtitleFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default memo(LiveSubtitles);

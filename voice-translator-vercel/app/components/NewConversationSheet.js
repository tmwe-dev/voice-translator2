'use client';

import { memo } from 'react';
import { vibrate } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// NewConversationSheet — bottom sheet with 4 conversation options
// "Con chi vuoi parlare?" → Faccia a faccia, Invita, Video, TaxiTalk
// ═══════════════════════════════════════════════════════════════

const OPTIONS = [
  {
    id: 'face-to-face',
    icon: '📱',
    title: 'Parla con chi hai davanti',
    desc: 'Mostra il QR e parlate ciascuno nella propria lingua',
  },
  {
    id: 'invite',
    icon: '✉️',
    title: 'Invita una persona',
    desc: 'Invia un link via WhatsApp, SMS o email',
  },
  {
    id: 'videocall',
    icon: '📹',
    title: 'Videochiamata tradotta',
    desc: 'Chiamata video con traduzione in tempo reale',
  },
  {
    id: 'taxitalk',
    icon: '🚕',
    title: 'TaxiTalk',
    desc: 'Comunica la destinazione al tassista',
  },
];

const NewConversationSheet = ({ open, onClose, onSelect }) => {
  const { S } = useApp();
  const C = S?.colors || {};
  const sheetRef = useSheetA11y(open, onClose);

  if (!open) return null;

  const accentColor = C.accent1 || PALETTE.purple;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'ncsOverlayIn 0.2s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Nuova conversazione"
    >
      <div ref={sheetRef} style={{
        width: '100%', maxWidth: '480px',
        backgroundColor: C.cardBg || 'rgba(15, 15, 25, 0.98)',
        borderRadius: '20px 20px 0 0',
        padding: '12px 20px max(20px, env(safe-area-inset-bottom))',
        animation: 'ncsSheetUp 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '4px', borderRadius: '2px',
            backgroundColor: C.textMuted || 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '18px', fontWeight: '700', margin: '0 0 16px',
          color: C.text || '#fff',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          Con chi vuoi parlare?
        </h2>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { vibrate(15); onSelect(opt.id); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '14px',
                backgroundColor: C.inputBg || 'rgba(255,255,255,0.05)',
                border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background-color 0.15s, transform 0.1s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(139,92,246,0.12)`;
                e.currentTarget.style.borderColor = accentColor;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = C.inputBg || 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = C.cardBorder || 'rgba(255,255,255,0.06)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
              <div>
                <div style={{
                  fontSize: '15px', fontWeight: '600',
                  color: C.text || '#fff', marginBottom: '2px',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  {opt.title}
                </div>
                <div style={{
                  fontSize: '13px', color: C.textMuted || 'rgba(255,255,255,0.5)',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  {opt.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ncsOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ncsSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default memo(NewConversationSheet);

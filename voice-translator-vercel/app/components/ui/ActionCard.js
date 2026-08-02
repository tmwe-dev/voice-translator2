'use client';
import { memo } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';

// ═══════════════════════════════════════
// ActionCard — reusable action item with icon, title, description
// Usage: <ActionCard icon="📱" title="Face to face" desc="..." onClick={fn} S={S} />
// ═══════════════════════════════════════

const ActionCard = ({ icon, title, desc, onClick, S, primary, disabled }) => {
  const C = S?.colors || {};
  const accentColor = C.accent1 || '#8b5cf6';
  const accent2Color = C.accent2 || '#06b6d4';

  return (
    <button
      onClick={() => { if (!disabled) { vibrate(15); onClick?.(); } }}
      disabled={disabled}
      style={{
        width: '100%', padding: primary ? '20px 18px' : '14px 16px',
        borderRadius: primary ? 18 : 14,
        background: primary
          ? `linear-gradient(145deg, ${accentColor}18, ${accent2Color}12)`
          : (C.cardBg || 'rgba(255,255,255,0.04)'),
        border: primary
          ? `1.5px solid ${accentColor}35`
          : `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left', display: 'flex', alignItems: 'center',
        gap: primary ? 16 : 14,
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.15s, background-color 0.15s',
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      {primary ? (
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(145deg, ${accentColor}, ${accent2Color})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
          boxShadow: `0 4px 20px ${accentColor}40`,
        }}>
          {icon}
        </div>
      ) : (
        <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      )}
      <div>
        <div style={{
          fontSize: primary ? 17 : 14, fontWeight: primary ? 700 : 600,
          color: C.text || C.textPrimary || '#fff',
          fontFamily: FONT, marginBottom: primary ? 3 : 1,
        }}>
          {title}
        </div>
        {desc && (
          <div style={{
            fontSize: primary ? 13 : 12,
            color: primary ? (C.textSecondary || 'rgba(255,255,255,0.6)') : (C.textMuted || 'rgba(255,255,255,0.4)'),
            fontFamily: FONT, lineHeight: 1.4,
          }}>
            {desc}
          </div>
        )}
      </div>
    </button>
  );
};

export default memo(ActionCard);

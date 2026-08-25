'use client';
import { memo } from 'react';
import { FONT } from '../../lib/constants.js';

// ═══════════════════════════════════════
// EmptyState — consistent empty state for lists/views
// Usage: <EmptyState icon="💬" title="Nessuna conversazione" desc="..." S={S} />
// ═══════════════════════════════════════

const EmptyState = ({ icon, title, desc, actionLabel, onAction, S }) => {
  const C = S?.colors || {};

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.6 }}>{icon}</div>
      )}
      <div style={{
        fontSize: 16, fontWeight: 600, color: C.textPrimary || '#fafafa',
        fontFamily: FONT, marginBottom: 6,
      }}>
        {title}
      </div>
      {desc && (
        <div style={{
          fontSize: 13, color: C.textMuted || 'rgba(255,255,255,0.4)',
          fontFamily: FONT, lineHeight: 1.5, maxWidth: 280,
        }}>
          {desc}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 12,
            background: C.accent1 || '#8b5cf6', border: 'none',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default memo(EmptyState);

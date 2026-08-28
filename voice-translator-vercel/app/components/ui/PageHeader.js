'use client';
import { memo } from 'react';
import { FONT } from '../../lib/constants.js';
import { tFuori } from '../../lib/i18n.js';

// ═══════════════════════════════════════
// PageHeader — consistent header for all views
// Usage: <PageHeader title="Impostazioni" onBack={() => setView('home')} S={S} />
// ═══════════════════════════════════════

const PageHeader = ({ title, subtitle, onBack, S, rightAction }) => {
  const C = S?.colors || {};

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))',
      backgroundColor: C.headerBg || 'rgba(9,9,11,0.85)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${C.headerBorder || 'rgba(255,255,255,0.04)'}`,
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 8, margin: -8, display: 'flex', alignItems: 'center',
            color: C.textPrimary || '#fafafa',
          }}
          aria-label={tFuori('backWord')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          // b.481 — niente grassetto: e la testata condivisa, quindi questo
          // 700 pesava su ogni schermata che la usa.
          fontSize: 18, fontWeight: 500, color: C.textPrimary || '#fafafa',
          fontFamily: FONT, margin: 0, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{
            fontSize: 12, color: C.textMuted || 'rgba(255,255,255,0.5)',
            fontFamily: FONT, marginTop: 2,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {rightAction}
    </div>
  );
};

export default memo(PageHeader);

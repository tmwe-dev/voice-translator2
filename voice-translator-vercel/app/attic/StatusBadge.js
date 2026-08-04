'use client';
import { memo } from 'react';
import { FONT } from '../../lib/constants.js';

// ═══════════════════════════════════════
// StatusBadge — colored label for states (online, offline, translating, etc.)
// Usage: <StatusBadge label="Online" variant="success" />
// ═══════════════════════════════════════

const VARIANTS = {
  success: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  warning: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  error: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  info: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  neutral: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: 'rgba(255,255,255,0.1)' },
};

const StatusBadge = ({ label, variant = 'neutral', dot, size = 'sm' }) => {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  const fontSize = size === 'xs' ? 10 : size === 'sm' ? 11 : 13;
  const padding = size === 'xs' ? '2px 6px' : size === 'sm' ? '3px 8px' : '4px 12px';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding, borderRadius: 99,
      background: v.bg, border: `1px solid ${v.border}`,
      fontSize, fontWeight: 600, color: v.color,
      fontFamily: FONT, letterSpacing: 0.2, lineHeight: 1,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: size === 'xs' ? 5 : 6, height: size === 'xs' ? 5 : 6,
          borderRadius: '50%', backgroundColor: v.color, flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  );
};

export default memo(StatusBadge);

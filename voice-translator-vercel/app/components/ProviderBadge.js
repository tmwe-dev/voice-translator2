'use client';
// ═══════════════════════════════════════════════
// ProviderBadge — Shows active provider for current room
//
// Displays which AI provider is handling translations.
// Fetches from providerRouter based on language pair.
// ═══════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { routeProvider, getRouteDescription } from '../lib/providerRouter.js';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

const PROVIDER_COLORS = {
  asia: { bg: 'rgba(255,165,0,0.15)', border: 'rgba(255,165,0,0.3)', text: '#FFA500', label: 'Qwen' },
  global: { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', text: '#6366F1', label: 'Global' },
};

// b.482 — erano due EMOJI del mappamondo. Adesso e il nome dell'icona
// di casa: una sola, monocroma, che prende il colore del distintivo.
const PROVIDER_ICONS = {
  asia: 'globe',
  global: 'globe',
};

function ProviderBadge({ sourceLang, targetLang, theme = 'dark', compact = false }) {
  const route = useMemo(() => {
    if (!sourceLang || !targetLang) return null;
    return routeProvider(sourceLang, targetLang);
  }, [sourceLang, targetLang]);

  if (!route) return null;

  const colors = PROVIDER_COLORS[route.provider] || PROVIDER_COLORS.global;
  const icona = PROVIDER_ICONS[route.provider] || 'globe';
  const confidence = Math.round(route.confidence * 100);

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize: 11, color: colors.text,
        fontFamily: FONT,
      }}>
        <Icon name={icona} size={11} /> {colors.label}
      </span>
    );
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      fontSize: 12, color: colors.text,
      fontFamily: FONT,
    }}>
      <span style={{ lineHeight: 0 }}><Icon name={icona} size={12} /></span>
      <span style={{ fontWeight: 500 }}>{colors.label}</span>
      <span style={{ opacity: 0.6 }}>{confidence}%</span>
      <span style={{ opacity: 0.5, fontSize: 11 }} title={getRouteDescription(route)}>
        {getRouteDescription(route)}
      </span>
    </div>
  );
}

export default memo(ProviderBadge);

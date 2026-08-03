// ═══════════════════════════════════════════════
// PALETTE — Single source of truth for raw color values
//
// Components must import from here instead of hardcoding hex.
// Theme-aware colors live in styles.js (getStyles); this file
// centralizes the raw constants those components use directly.
//
// Legacy palette (teal/coral/violet) predates the P4 Manifesto
// palette — kept as named tokens until full migration.
// ═══════════════════════════════════════════════

export const PALETTE = {
  // ── P4 Manifesto (matches styles.js dark theme accents) ──
  purple: '#8b5cf6',   // accent1 — primary actions
  cyan: '#06b6d4',     // accent2 — secondary
  red: '#ef4444',      // accent3 — recording, errors
  green: '#22c55e',    // accent4 — success, online
  amber: '#f59e0b',    // warnings, gold accents
  blue: '#60a5fa',     // info, links
  orange: '#f97316',   // brand CTA (landing)

  // ── Legacy design system (pre-P4) — still used in older views ──
  teal: '#26D9B0',     // legacy primary
  coral: '#FF6B6B',    // legacy danger/record
  violet: '#8B6AFF',   // legacy accent
  bgDeep: '#060810',   // legacy deep background
  grayLight: '#F2F4F7',// legacy light surface

  // ── Neutrals ──
  black: '#09090b',
  white: '#fafafa',
};

export default PALETTE;

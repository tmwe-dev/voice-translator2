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
  purple: '#5b8cff',   // accent1 — primary actions
  cyan: '#38e1ff',     // accent2 — secondary
  red: '#ff5470',      // accent3 — recording, errors
  green: '#3ddc84',    // accent4 — success, online
  amber: '#ffc44d',    // warnings, gold accents
  blue: '#5b8cff',     // info, links
  orange: '#f97316',   // brand CTA (landing)

  // ── Legacy design system (pre-P4) — still used in older views ──
  teal: '#38e1ff',   // Spatial: cyan Deep Space (era teal legacy)     // legacy primary
  coral: '#ff5470',    // legacy danger/record
  violet: '#5b8cff',   // legacy accent
  bgDeep: '#05070f',   // legacy deep background
  grayLight: '#eef2ff',// legacy light surface

  // ── Neutrals ──
  black: '#05070f',
  white: '#eef2ff',
};

export default PALETTE;

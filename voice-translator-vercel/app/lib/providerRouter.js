// ═══════════════════════════════════════════════
// Provider Router — Smart per-language-pair routing
//
// Routes translation/STT/TTS requests to the optimal provider
// based on language pair analysis. Single codebase, no regional deploys.
//
// CJK↔CJK  → Qwen (95% confidence)
// CJK↔any  → Qwen (90% confidence)
// SEA↔CJK  → Qwen (90% confidence)
// EU↔EU    → Global (90% confidence)
// Arabic↔EU → Global (85% confidence)
// Mixed    → Global (80% confidence)
// ═══════════════════════════════════════════════

import { getLangFamily, baseLang } from './asiaConstants.js';
import { isDashScopeAvailable } from './llmAsia.js';

/**
 * Route a request to the optimal provider based on language pair.
 *
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {object} [opts]
 * @param {string} [opts.userPreference] - User's explicit provider choice (overrides routing)
 * @param {string} [opts.model] - Requested model ID
 * @returns {{ provider: 'asia'|'global', model: string, reason: string, confidence: number }}
 */
export function routeProvider(sourceLang, targetLang, opts = {}) {
  // User explicit override always wins
  if (opts.userPreference === 'asia' && isDashScopeAvailable()) {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'user_preference', confidence: 1.0 };
  }
  if (opts.userPreference === 'global') {
    return { provider: 'global', model: opts.model || 'auto', reason: 'user_preference', confidence: 1.0 };
  }

  // If DashScope not available, always global
  if (!isDashScopeAvailable()) {
    return { provider: 'global', model: opts.model || 'auto', reason: 'asia_unavailable', confidence: 1.0 };
  }

  const srcFamily = getLangFamily(sourceLang);
  const tgtFamily = getLangFamily(targetLang);

  // CJK ↔ CJK — Qwen is clearly superior
  if (srcFamily === 'CJK' && tgtFamily === 'CJK') {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'cjk_pair', confidence: 0.95 };
  }

  // ── b.126 · l'ordine dei casi rendeva due rami irraggiungibili ──
  //
  // Prima veniva qui `if (srcFamily === 'CJK' || tgtFamily === 'CJK')`,
  // che intercetta OGNI coppia con una lingua CJK. Quindi i due casi
  // scritti sotto — SEA↔CJK e SOUTH_ASIAN↔CJK — non venivano raggiunti
  // mai: quella condizione li aveva gia presi tutti.
  //
  // Sul fornitore finale cambiava poco (restava 'asia' comunque), ma il
  // `reason` e la `confidence` erano sbagliati. E la confidenza non e
  // decorativa: /api/translate usa Qwen solo sopra 0,85. Un caso
  // classificato male puo finire dalla parte sbagliata di quella soglia.
  //
  // I casi specifici vanno PRIMA di quello generale. E la stessa regola
  // di sempre: dal piu stretto al piu largo.

  // SEA ↔ CJK: specifico, quindi prima.
  if ((srcFamily === 'SEA' && tgtFamily === 'CJK') || (srcFamily === 'CJK' && tgtFamily === 'SEA')) {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'sea_cjk_pair', confidence: 0.90 };
  }

  // SOUTH_ASIAN ↔ CJK: specifico, quindi prima.
  if ((srcFamily === 'SOUTH_ASIAN' && tgtFamily === 'CJK') || (srcFamily === 'CJK' && tgtFamily === 'SOUTH_ASIAN')) {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'south_asian_cjk', confidence: 0.85 };
  }

  // CJK ↔ tutto il resto — il caso generale, ora in fondo ai suoi.
  if (srcFamily === 'CJK' || tgtFamily === 'CJK') {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'cjk_involved', confidence: 0.90 };
  }

  if (srcFamily === 'SEA' && tgtFamily === 'SEA') {
    return { provider: 'asia', model: opts.model || 'auto', reason: 'sea_pair', confidence: 0.80 };
  }

  // South Asian senza CJK (il caso con CJK e gia stato preso sopra).
  if (srcFamily === 'SOUTH_ASIAN' || tgtFamily === 'SOUTH_ASIAN') {
    return { provider: 'global', model: opts.model || 'auto', reason: 'south_asian_global', confidence: 0.80 };
  }

  // European ↔ European — Global providers are excellent
  if (srcFamily === 'EUROPEAN' && tgtFamily === 'EUROPEAN') {
    return { provider: 'global', model: opts.model || 'auto', reason: 'european_pair', confidence: 0.90 };
  }

  // Middle East ↔ European — Global is reliable
  if (srcFamily === 'MIDDLE_EAST' || tgtFamily === 'MIDDLE_EAST') {
    return { provider: 'global', model: opts.model || 'auto', reason: 'middle_east', confidence: 0.85 };
  }

  // Default: Global provider
  return { provider: 'global', model: opts.model || 'auto', reason: 'default', confidence: 0.80 };
}

/**
 * Get a human-readable description of why a provider was chosen
 */
export function getRouteDescription(route) {
  const descriptions = {
    user_preference: 'Scelta manuale utente',
    asia_unavailable: 'Provider Asia non configurato',
    cjk_pair: 'Coppia CJK — Qwen ottimale',
    cjk_involved: 'Lingua CJK presente — Qwen preferito',
    sea_cjk_pair: 'Coppia SEA↔CJK — Qwen preferito',
    sea_pair: 'Coppia SEA — Qwen buono',
    south_asian_cjk: 'Sud-Asia↔CJK — Qwen preferito',
    south_asian_global: 'Sud-Asia — Provider globale',
    european_pair: 'Coppia europea — Provider globale',
    middle_east: 'Medio Oriente — Provider globale',
    default: 'Routing predefinito',
  };
  return descriptions[route.reason] || route.reason;
}

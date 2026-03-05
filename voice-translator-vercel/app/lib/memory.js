// ═══════════════════════════════════════════════
// Translation Memory System — 3-Level Context
// Adapted from BarTalk v79 memory.ts
//
// Keeps translation context during long conversations
// so the LLM produces consistent terminology
//
// Level 1 (Full):      Last N messages — complete source + translation
// Level 2 (Condensed): Next N — 1-line summaries of each exchange
// Level 3 (Summary):   AI-generated cumulative summary of oldest messages
// ═══════════════════════════════════════════════

const DEFAULT_CONFIG = {
  fullDetailCount: 10,       // Keep last 10 messages in full (shorter than BarTalk — translation is more compact)
  condensedCount: 10,        // Next 10 as 1-line summaries
  summaryTrigger: 15,        // Auto-summarize every 15 unsummarized messages
  maxContextTokens: 4000,    // Conservative — translation prompts are shorter
};

/**
 * Build context messages for the translation LLM
 * @param {Array} history - Array of {sourceLang, targetLang, sourceText, translatedText, provider}
 * @param {string|null} summary - Existing cumulative summary
 * @param {object} config - Memory config overrides
 * @returns {object} { contextMessages, needsSummary, messagesToSummarize }
 */
export function buildTranslationContext(history, summary = null, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!history || history.length === 0) {
    return { contextMessages: [], needsSummary: false, messagesToSummarize: [] };
  }

  const messages = [];
  const total = history.length;

  // ── Level 3: Summary (oldest) ──
  if (summary) {
    messages.push({
      role: 'system',
      content: `[Translation context summary]\n${summary}`,
    });
  }

  // ── Level 2: Condensed (middle) ──
  const condensedStart = Math.max(0, total - cfg.fullDetailCount - cfg.condensedCount);
  const condensedEnd = Math.max(0, total - cfg.fullDetailCount);

  if (condensedEnd > condensedStart) {
    const condensedLines = [];
    for (let i = condensedStart; i < condensedEnd; i++) {
      const m = history[i];
      const srcSnippet = (m.sourceText || '').substring(0, 40);
      const tgtSnippet = (m.translatedText || '').substring(0, 40);
      condensedLines.push(`• ${m.sourceLang}→${m.targetLang}: "${srcSnippet}..." → "${tgtSnippet}..."`);
    }
    messages.push({
      role: 'system',
      content: `[Previous translations (condensed)]\n${condensedLines.join('\n')}`,
    });
  }

  // ── Level 1: Full detail (most recent) ──
  const fullStart = Math.max(0, total - cfg.fullDetailCount);
  for (let i = fullStart; i < total; i++) {
    const m = history[i];
    messages.push({
      role: 'user',
      content: `[${m.sourceLang}→${m.targetLang}] ${m.sourceText}`,
    });
    messages.push({
      role: 'assistant',
      content: m.translatedText,
    });
  }

  // ── Check if we need to trigger auto-summary ──
  const unsummarizedCount = summary
    ? total  // all messages since last summary
    : total;
  const needsSummary = unsummarizedCount >= cfg.summaryTrigger && total > cfg.fullDetailCount + cfg.condensedCount;

  // Messages to summarize = everything older than full + condensed
  const messagesToSummarize = needsSummary
    ? history.slice(0, condensedStart)
    : [];

  return { contextMessages: messages, needsSummary, messagesToSummarize };
}

/**
 * Generate a cumulative summary of old translation exchanges
 * @param {Array} messages - Messages to summarize
 * @param {string|null} existingSummary - Previous summary to build upon
 * @returns {string} Summary prompt for an LLM to generate
 */
export function buildSummaryPrompt(messages, existingSummary = null) {
  const exchanges = messages.map(m =>
    `${m.sourceLang}→${m.targetLang}: "${(m.sourceText || '').substring(0, 60)}" → "${(m.translatedText || '').substring(0, 60)}"`
  ).join('\n');

  let prompt = `Summarize these translation exchanges into a brief context paragraph (max 200 words) that captures:
- Key topics and terminology used
- Any domain-specific vocabulary (medical, legal, technical)
- Conversation tone (formal/informal)
- Recurring phrases or names

Exchanges:\n${exchanges}`;

  if (existingSummary) {
    prompt = `Update the existing translation context summary with new exchanges.

Existing summary:\n${existingSummary}\n\nNew exchanges:\n${exchanges}\n\nGenerate an updated summary (max 200 words) incorporating both old and new context.`;
  }

  return prompt;
}

/**
 * Extract key terminology from translation history
 * Useful for building auto-glossaries
 * @param {Array} history - Translation history
 * @returns {Array} [{source, target, count}]
 */
export function extractTerminology(history) {
  const termMap = new Map();

  for (const m of history) {
    // Simple word-level alignment (rough but useful)
    const srcWords = (m.sourceText || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const tgtWords = (m.translatedText || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);

    // Track word frequency
    for (const w of srcWords) {
      const key = `${m.sourceLang}:${w}`;
      const existing = termMap.get(key) || { source: w, sourceLang: m.sourceLang, targetLang: m.targetLang, count: 0 };
      existing.count++;
      termMap.set(key, existing);
    }
  }

  // Return terms that appear 3+ times (likely domain-specific)
  return Array.from(termMap.values())
    .filter(t => t.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

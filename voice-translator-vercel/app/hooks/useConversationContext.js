'use client';
import { useRef, useCallback } from 'react';

/**
 * useConversationContext — Rolling knowledge base for context-aware translation.
 *
 * Maintains a conversation memory that helps AI disambiguation:
 * - First 10 messages stored in full
 * - After that, summarize messages in batches of 5
 * - Always keep the last 10 messages in full verbatim
 * - Summary ≤ 30 lines with generic context tags
 * - Total context window ~150 lines
 *
 * The context is passed to the LLM system prompt so it can disambiguate
 * terms based on conversation topic (e.g., "pannolini" vs "assorbenti"
 * when discussing children).
 *
 * Architecture:
 *   fullMessages[]       — all messages (for summarization source)
 *   earlyMessages[]      — first 10 messages, kept in full forever
 *   rollingSummary       — compressed summary of messages 11..N-10
 *   contextTags          — extracted topic/entity tags for quick reference
 *
 * Returns: { addMessage, getContext, resetContext }
 */

// ── Constants ──
const EARLY_FULL_COUNT = 10;       // Keep first N messages verbatim
const RECENT_FULL_COUNT = 10;      // Keep last N messages verbatim
const SUMMARY_BATCH_SIZE = 5;      // Summarize every N messages
const MAX_SUMMARY_LINES = 30;      // Summary cap
const MAX_CONTEXT_LINES = 150;     // Total context window cap

/**
 * Extract context tags from a message: topics, entities, key terms.
 * Lightweight client-side extraction — no AI needed.
 */
function extractTags(text, sourceLang) {
  if (!text || text.length < 3) return [];
  const tags = [];

  // Common topic indicators (bilingual patterns)
  const topicPatterns = [
    // Family/children
    { pattern: /\b(bambin[oi]|figli[oa]?|neonat[oa]|beb[eè]|infant|child|children|kids?|baby|babies|toddler|son|daughter)\b/i, tag: 'family:children' },
    { pattern: /\b(madre|padre|mamma|papà|genitor[ie]|mom|dad|mother|father|parent)\b/i, tag: 'family:parents' },
    // Health/medical
    { pattern: /\b(medic[oa]|dottor|hospital|ospedale|malatti[ae]|medicine|doctor|health|sick|fever|pain|dolore)\b/i, tag: 'topic:medical' },
    { pattern: /\b(allergi[ae]|allergy|allergic)\b/i, tag: 'topic:allergies' },
    // Food/cooking
    { pattern: /\b(cucin[ae]|ristorante|cibo|mangiare|cook|food|restaurant|eat|recipe|ricetta|pranzo|cena|lunch|dinner)\b/i, tag: 'topic:food' },
    // Travel
    { pattern: /\b(viaggio|aeroporto|hotel|volo|flight|travel|airport|booking|prenotazione|vacanz[ae]|holiday)\b/i, tag: 'topic:travel' },
    // Work/business
    { pattern: /\b(lavoro|ufficio|riunione|meeting|work|office|project|progetto|deadline|client[ei]?|customer)\b/i, tag: 'topic:business' },
    // Technology
    { pattern: /\b(computer|software|app|telefono|phone|internet|website|programm[ao]|code|server)\b/i, tag: 'topic:technology' },
    // Education
    { pattern: /\b(scuola|universit[àa]|studi|esame|school|university|study|exam|teacher|student|lezione|class)\b/i, tag: 'topic:education' },
    // Legal
    { pattern: /\b(contratto|avvocato|legge|tribunale|contract|lawyer|law|court|legal)\b/i, tag: 'topic:legal' },
    // Shopping/commerce
    { pattern: /\b(comprare|negozio|prezzo|sconto|buy|shop|store|price|discount|pagamento|payment)\b/i, tag: 'topic:shopping' },
    // Home/housing
    { pattern: /\b(casa|appartamento|affitto|mutuo|house|home|apartment|rent|mortgage)\b/i, tag: 'topic:housing' },
    // Sports
    { pattern: /\b(calcio|partita|sport|palestra|football|soccer|game|gym|match|allenamento|training)\b/i, tag: 'topic:sports' },
    // Weather
    { pattern: /\b(tempo|pioggia|sole|caldo|freddo|weather|rain|sun|hot|cold|temperatura|temperature)\b/i, tag: 'topic:weather' },
  ];

  for (const { pattern, tag } of topicPatterns) {
    if (pattern.test(text)) {
      tags.push(tag);
    }
  }

  // Detect formality register
  if (/\b(Lei|Voi|vous|usted|Sie)\b/.test(text)) tags.push('register:formal');
  if (/\b(tu |te |toi|tú|du )\b/i.test(text)) tags.push('register:informal');

  return tags;
}

/**
 * Compress a batch of messages into a summary block.
 * Client-side summarization — extracts key info without AI.
 */
function summarizeBatch(messages) {
  if (!messages.length) return '';

  const speakers = new Set();
  const topics = new Set();
  const keyPhrases = [];

  for (const msg of messages) {
    if (msg.sender) speakers.add(msg.sender);
    if (msg.tags) msg.tags.forEach(t => topics.add(t));
    // Extract first meaningful sentence as key phrase (max 80 chars)
    const original = msg.original || '';
    if (original.length > 10) {
      const firstSentence = original.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length <= 80) {
        keyPhrases.push(`${msg.sender || '?'}: "${firstSentence}"`);
      }
    }
  }

  const lines = [];
  if (topics.size > 0) {
    lines.push(`[Topics: ${[...topics].join(', ')}]`);
  }
  lines.push(`[Speakers: ${[...speakers].join(', ')} | ${messages.length} messages]`);

  // Include up to 3 key phrases to preserve context thread
  const phrasesToInclude = keyPhrases.slice(0, 3);
  for (const phrase of phrasesToInclude) {
    lines.push(phrase);
  }

  return lines.join('\n');
}

export default function useConversationContext() {
  // All messages in order (source of truth)
  const allMessagesRef = useRef([]);
  // Summarized batches (messages 11..N-10)
  const summaryBlocksRef = useRef([]);
  // Context tags accumulated over the conversation
  const contextTagsRef = useRef(new Set());
  // Counter for summarization: how many messages have been summarized
  const summarizedUpToRef = useRef(0);

  /**
   * Add a message to the conversation context.
   * Called after every sent or received message.
   *
   * @param {Object} msg - { sender, original, translated, sourceLang, targetLang }
   */
  const addMessage = useCallback((msg) => {
    if (!msg || !msg.original) return;

    // Extract context tags
    const tags = extractTags(msg.original, msg.sourceLang);
    if (msg.translated) {
      tags.push(...extractTags(msg.translated, msg.targetLang));
    }

    // Deduplicate tags
    const uniqueTags = [...new Set(tags)];
    uniqueTags.forEach(tag => contextTagsRef.current.add(tag));

    const entry = {
      sender: msg.sender || '?',
      original: msg.original,
      translated: msg.translated || null,
      sourceLang: msg.sourceLang || '',
      targetLang: msg.targetLang || '',
      tags: uniqueTags,
      ts: msg.timestamp || Date.now(),
    };

    allMessagesRef.current.push(entry);

    // ── Check if we need to summarize a new batch ──
    // Summarize when we have enough messages beyond early + recent windows
    const totalCount = allMessagesRef.current.length;
    const middleStart = EARLY_FULL_COUNT;

    // Only summarize if we have more than early + recent + batch
    if (totalCount > EARLY_FULL_COUNT + RECENT_FULL_COUNT) {
      const middleEnd = totalCount - RECENT_FULL_COUNT;
      const unsummarized = middleEnd - summarizedUpToRef.current;

      if (unsummarized >= SUMMARY_BATCH_SIZE) {
        // Summarize the next batch
        const batchStart = summarizedUpToRef.current;
        const batchEnd = batchStart + SUMMARY_BATCH_SIZE;
        const batch = allMessagesRef.current.slice(batchStart, batchEnd);
        const summary = summarizeBatch(batch);

        if (summary) {
          summaryBlocksRef.current.push(summary);
          // Trim summary if it exceeds max lines
          const totalSummaryLines = summaryBlocksRef.current.join('\n').split('\n').length;
          if (totalSummaryLines > MAX_SUMMARY_LINES) {
            // Remove oldest summary blocks to stay within limit
            while (summaryBlocksRef.current.length > 1 &&
              summaryBlocksRef.current.join('\n').split('\n').length > MAX_SUMMARY_LINES) {
              summaryBlocksRef.current.shift();
            }
          }
        }

        summarizedUpToRef.current = batchEnd;
      }
    }
  }, []);

  /**
   * Build the conversation context string for the translation prompt.
   * Returns a formatted string that fits within ~150 lines.
   *
   * Structure:
   *   [CONVERSATION CONTEXT]
   *   [Active topics: ...]
   *   --- Early messages (first 10, verbatim) ---
   *   --- Summary of middle conversation ---
   *   --- Recent messages (last 10, verbatim) ---
   */
  const getContext = useCallback(() => {
    const all = allMessagesRef.current;
    if (all.length === 0) return null;

    const lines = [];

    // ── Context tags header ──
    if (contextTagsRef.current.size > 0) {
      const recentTags = [...contextTagsRef.current].slice(-15); // Last 15 tags
      lines.push(`[Active context: ${recentTags.join(', ')}]`);
    }

    // ── Early messages (first 10, verbatim) ──
    const earlyCount = Math.min(EARLY_FULL_COUNT, all.length);
    if (earlyCount > 0) {
      lines.push('--- Conversation start ---');
      for (let i = 0; i < earlyCount; i++) {
        const m = all[i];
        const translatedPart = m.translated ? ` → [${m.targetLang}] ${m.translated}` : '';
        lines.push(`${m.sender} [${m.sourceLang}]: ${m.original}${translatedPart}`);
      }
    }

    // ── Rolling summary (middle section) ──
    if (summaryBlocksRef.current.length > 0) {
      lines.push('--- Conversation summary ---');
      lines.push(summaryBlocksRef.current.join('\n'));
    }

    // ── Recent messages (last 10, verbatim) ──
    if (all.length > EARLY_FULL_COUNT) {
      const recentStart = Math.max(EARLY_FULL_COUNT, all.length - RECENT_FULL_COUNT);
      // Avoid overlapping with early messages
      if (recentStart > earlyCount || all.length > EARLY_FULL_COUNT) {
        const actualStart = Math.max(recentStart, earlyCount);
        if (actualStart < all.length) {
          lines.push('--- Recent messages ---');
          for (let i = actualStart; i < all.length; i++) {
            const m = all[i];
            const translatedPart = m.translated ? ` → [${m.targetLang}] ${m.translated}` : '';
            lines.push(`${m.sender} [${m.sourceLang}]: ${m.original}${translatedPart}`);
          }
        }
      }
    }

    // ── Enforce line limit ──
    const result = lines.join('\n');
    const resultLines = result.split('\n');
    if (resultLines.length > MAX_CONTEXT_LINES) {
      return resultLines.slice(-MAX_CONTEXT_LINES).join('\n');
    }

    return result || null;
  }, []);

  /**
   * Reset context — called when leaving a room or starting a new conversation.
   */
  const resetContext = useCallback(() => {
    allMessagesRef.current = [];
    summaryBlocksRef.current = [];
    contextTagsRef.current = new Set();
    summarizedUpToRef.current = 0;
  }, []);

  /**
   * Get current message count (for debugging/UI).
   */
  const getMessageCount = useCallback(() => {
    return allMessagesRef.current.length;
  }, []);

  return {
    addMessage,
    getContext,
    resetContext,
    getMessageCount,
  };
}

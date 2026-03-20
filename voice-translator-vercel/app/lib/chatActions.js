// ═══════════════════════════════════════════════
// Chat Actions — AI-powered post-chat analysis
//
// 5 actions: summary, report, analysis, advice, vocabulary
// Smart provider routing: Qwen for CJK, OpenAI for others
// ═══════════════════════════════════════════════

/**
 * Available post-chat actions
 */
export const CHAT_ACTIONS = [
  {
    id: 'summary',
    icon: '\u{1F4DD}',
    nameKey: 'chatActionSummary',
    name: 'Summary',
    description: 'Concise summary of the conversation',
  },
  {
    id: 'report',
    icon: '\u{1F4CA}',
    nameKey: 'chatActionReport',
    name: 'Report',
    description: 'Formal business report of the discussion',
  },
  {
    id: 'analysis',
    icon: '\u{1F50D}',
    nameKey: 'chatActionAnalysis',
    name: 'Language Analysis',
    description: 'Analyze grammar, errors, and improvements',
  },
  {
    id: 'advice',
    icon: '\u{1F4A1}',
    nameKey: 'chatActionAdvice',
    name: 'Contextual Advice',
    description: 'Advice based on conversation content',
  },
  {
    id: 'vocabulary',
    icon: '\u{1F4DA}',
    nameKey: 'chatActionVocabulary',
    name: 'Key Vocabulary',
    description: 'Extract and explain key terms used',
  },
];

/**
 * Build a compact transcript from messages (max 100 messages)
 * Compresses for AI context window efficiency
 * @param {object[]} messages
 * @param {number} [maxMsgs=100]
 * @returns {string}
 */
export function buildCompactTranscript(messages, maxMsgs = 100) {
  const selected = messages.length > maxMsgs
    ? [...messages.slice(0, 10), ...messages.slice(-maxMsgs + 10)]
    : messages;

  return selected.map(m => {
    const lang = m.sourceLang ? ` [${m.sourceLang}]` : '';
    const translation = m.translated ? ` → ${m.translated}` : '';
    return `${m.sender}${lang}: ${m.original || m.text || ''}${translation}`;
  }).join('\n');
}

/**
 * Get the system prompt for a chat action
 * @param {string} actionId - One of: summary, report, analysis, advice, vocabulary
 * @param {object} [context] - { mode, domain, members }
 * @returns {string}
 */
export function getActionPrompt(actionId, context = {}) {
  const memberInfo = context.members?.length
    ? `Participants: ${context.members.map(m => `${m.name} (${m.lang})`).join(', ')}.`
    : '';
  const modeInfo = context.mode ? `Conversation mode: ${context.mode}.` : '';
  const domainInfo = context.domain ? `Domain: ${context.domain}.` : '';
  const contextLine = [memberInfo, modeInfo, domainInfo].filter(Boolean).join(' ');

  const prompts = {
    summary: [
      'You are a professional conversation summarizer.',
      contextLine,
      'Create a concise summary of this multilingual conversation.',
      'Highlight: main topics discussed, key decisions made, action items.',
      'Write in the language of the first speaker.',
      'Be brief but comprehensive. Use natural prose, no bullet points.',
    ],
    report: [
      'You are a business report writer.',
      contextLine,
      'Create a formal report of this conversation.',
      'Include: executive summary, main discussion points, agreements reached, next steps.',
      'Write in professional business language.',
      'Use the language of the first speaker.',
    ],
    analysis: [
      'You are a language learning assistant.',
      contextLine,
      'Analyze the language used in this conversation.',
      'For each speaker, note:',
      '- Grammar patterns (correct and incorrect)',
      '- Vocabulary level (beginner/intermediate/advanced)',
      '- Common errors and corrections',
      '- Suggestions for improvement',
      'Be encouraging and constructive.',
    ],
    advice: [
      'You are a contextual advisor.',
      contextLine,
      'Based on this conversation, provide relevant advice.',
      'Consider the domain, cultural context, and participants.',
      'Give practical, actionable suggestions.',
      'Write in the language of the first speaker.',
    ],
    vocabulary: [
      'You are a multilingual vocabulary teacher.',
      contextLine,
      'Extract the 15-20 most important/interesting terms from this conversation.',
      'For each term:',
      '- Original word/phrase and language',
      '- Translation in the other language(s) used',
      '- Brief usage note or example',
      'Focus on domain-specific, cultural, or frequently-used terms.',
    ],
  };

  return (prompts[actionId] || prompts.summary).filter(Boolean).join('\n');
}

/**
 * Detect if a conversation is primarily CJK (for provider routing)
 * @param {object[]} messages
 * @returns {boolean}
 */
export function isCJKConversation(messages) {
  const cjkLangs = new Set(['zh', 'zh-TW', 'ja', 'ko']);
  let cjkCount = 0;
  let totalCount = 0;

  for (const m of messages) {
    if (m.sourceLang) {
      totalCount++;
      if (cjkLangs.has(m.sourceLang) || cjkLangs.has(m.sourceLang?.replace(/-.*/, ''))) {
        cjkCount++;
      }
    }
  }

  return totalCount > 0 && (cjkCount / totalCount) > 0.3;
}

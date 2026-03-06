import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════
// LLM Translation Test Endpoint — runs ALL paid models in parallel
// Used by the Test Center page to compare LLM translation quality
//
// Uses platform API keys from env — no user auth, no credit deduction
// Rate limited: 10 req/min per IP
// ═══════════════════════════════════════════════

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Clean up periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 120000);

// ── Output validation (shared with /api/translate) ──
const SCRIPT_RANGES = {
  'th': /[\u0E00-\u0E7F]/,
  'zh': /[\u4E00-\u9FFF]/,
  'ja': /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
  'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/,
  'ar': /[\u0600-\u06FF]/,
  'hi': /[\u0900-\u097F]/,
  'ru': /[\u0400-\u04FF]/,
  'el': /[\u0370-\u03FF]/,
};
const LATIN_LANGS = new Set(['en','es','fr','de','it','pt','nl','pl','sv','tr','vi','id','ms','cs','ro','hu','fi']);

function validateOutput(original, translated, targetLang) {
  if (!translated || !translated.trim()) return { valid: false, reason: 'empty' };
  const t = translated.trim();
  if (t.startsWith('Translation:') || t.startsWith('Here is') || t.startsWith('Note:'))
    return { valid: false, reason: 'meta_text' };
  const ratio = t.length / Math.max(original.trim().length, 1);
  if (ratio > 8 || ratio < 0.05) return { valid: false, reason: 'length_ratio' };
  if (!LATIN_LANGS.has(targetLang) && SCRIPT_RANGES[targetLang]) {
    if (!SCRIPT_RANGES[targetLang].test(t)) return { valid: false, reason: 'wrong_script' };
  }
  return { valid: true };
}

// ── Model mapping ──
const MODEL_MAP = {
  'gpt-4o-mini':    { actual: 'gpt-4o-mini', provider: 'openai' },
  'gpt-4o':         { actual: 'gpt-4o', provider: 'openai' },
  'claude-sonnet':  { actual: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  'claude-haiku':   { actual: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  'gemini-flash':   { actual: 'gemini-2.0-flash', provider: 'gemini' },
  'gemini-pro':     { actual: 'gemini-2.5-pro-preview-05-06', provider: 'gemini' },
};

// Language names for system prompt
const LANG_NAMES = {
  'it': 'Italian', 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
  'pt': 'Portuguese', 'zh': 'Chinese (Simplified)', 'ja': 'Japanese', 'ko': 'Korean',
  'ar': 'Arabic', 'hi': 'Hindi', 'ru': 'Russian', 'tr': 'Turkish', 'th': 'Thai',
  'vi': 'Vietnamese', 'nl': 'Dutch', 'pl': 'Polish', 'sv': 'Swedish', 'el': 'Greek',
  'id': 'Indonesian', 'ms': 'Malay', 'cs': 'Czech', 'ro': 'Romanian', 'hu': 'Hungarian', 'fi': 'Finnish',
};

// Language pair notes for problematic combinations
const PAIR_NOTES = {
  'it->th': 'Italian→Thai: very different structures. Thai is SVO with topic-comment. Rearrange naturally.',
  'it->zh': 'Italian→Chinese: use measure words (量词) and topic-prominent structure. Sound native, not translated.',
  'it->ja': 'Italian→Japanese: SOV order, use です/ます form unless very casual.',
  'en->th': 'English→Thai: no verb conjugation/articles in Thai. Use particles (ค่ะ/ครับ) appropriately.',
  'th->en': 'Thai→English: Thai is pro-drop. Infer and add appropriate pronouns.',
  'zh->en': 'Chinese→English: restructure topic-comment to natural SVO.',
  'th->it': 'Thai→Italian: add articles and conjugations that Thai lacks.',
  'zh->it': 'Chinese→Italian: add articles, conjugations, restructure from topic-comment to SVO.',
  'ja->en': 'Japanese→English: restructure SOV to SVO. Expand implied subjects.',
  'ja->it': 'Japanese→Italian: restructure SOV, add articles and conjugations.',
  'ko->en': 'Korean→English: restructure SOV to SVO, expand honorifics contextually.',
};

const TONAL_LANGS = {
  'th': 'Thai (tonal, no spaces between words, use Thai script ภาษาไทย)',
  'zh': 'Chinese (Simplified, use 简体中文)',
  'ja': 'Japanese (use appropriate kanji/hiragana/katakana)',
  'vi': 'Vietnamese (tonal, ALL diacritics critical — never omit dấu)',
  'ko': 'Korean (use Hangul 한국어)'
};

function buildSystemPrompt(sourceLang, targetLang) {
  const sourceLangName = LANG_NAMES[sourceLang] || sourceLang;
  const targetLangName = LANG_NAMES[targetLang] || targetLang;
  const srcTonal = TONAL_LANGS[sourceLang];
  const tgtTonal = TONAL_LANGS[targetLang];
  let toneNote = '';
  if (tgtTonal) toneNote = ` The target language is ${tgtTonal}. Preserve all diacritics, tone marks, and native script exactly. Use natural ${targetLangName} phrasing — NOT transliteration.`;
  else if (srcTonal) toneNote = ` The source language is ${srcTonal}. Interpret tone marks and diacritics accurately.`;

  let prompt = `You are a real-time voice interpreter translating live speech from ${sourceLangName} to ${targetLangName}.${toneNote}

RULES:
- Output ONLY the translated text — nothing else
- NO notes, NO explanations, NO labels, NO commentary, NO transliterations
- This is SPOKEN language: keep the same register, tone, and emotion
- Preserve casual/informal style — do NOT formalize slang or colloquialisms
- Keep exclamations, questions, hesitations natural in the target language
- Translate idioms to equivalent idioms, NOT literally
- If speech is fragmented or unclear, reconstruct the most likely meaning naturally
- NEVER output the original language — always translate to ${targetLangName}`;

  const pairKey = `${sourceLang}->${targetLang}`;
  if (PAIR_NOTES[pairKey]) prompt += `\n\nLanguage pair note: ${PAIR_NOTES[pairKey]}`;

  return prompt;
}

/**
 * Test a single LLM model
 */
async function testModel(modelId, text, sourceLang, targetLang, systemPrompt) {
  const modelInfo = MODEL_MAP[modelId];
  if (!modelInfo) return { model: modelId, text: null, elapsed: 0, valid: false, reason: 'unknown_model' };

  const start = Date.now();
  let translated = null;
  let usage = null;

  try {
    if (modelInfo.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: modelInfo.actual,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      translated = completion.choices[0].message.content.trim();
      usage = completion.usage;
    } else if (modelInfo.provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
      const anthropic = new Anthropic({ apiKey });
      const msg = await anthropic.messages.create({
        model: modelInfo.actual,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      translated = msg.content[0]?.text?.trim() || '';
      usage = { prompt_tokens: msg.usage?.input_tokens || 0, completion_tokens: msg.usage?.output_tokens || 0 };
    } else if (modelInfo.provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelInfo.actual });
      const userText = `${systemPrompt}\n\nTranslate:\n${text}`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      });
      translated = result.response.text()?.trim() || '';
      const gUsage = result.response.usageMetadata;
      usage = { prompt_tokens: gUsage?.promptTokenCount || 0, completion_tokens: gUsage?.candidatesTokenCount || 0 };
    }
  } catch (e) {
    return {
      model: modelId,
      provider: modelInfo.provider,
      text: null,
      elapsed: Date.now() - start,
      valid: false,
      reason: e.message || 'error',
      tokens: null,
    };
  }

  const elapsed = Date.now() - start;
  const validation = validateOutput(text, translated, targetLang);

  // Clean meta-text if needed
  if (!validation.valid && validation.reason === 'meta_text' && translated) {
    translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
  }

  const finalValidation = validateOutput(text, translated, targetLang);

  return {
    model: modelId,
    provider: modelInfo.provider,
    text: translated,
    elapsed,
    valid: finalValidation.valid,
    reason: finalValidation.valid ? 'ok' : finalValidation.reason,
    tokens: usage ? (usage.prompt_tokens + usage.completion_tokens) : null,
  };
}

export async function POST(req) {
  try {
    // Require admin pass in production to prevent abuse of platform API keys
    if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASS) {
      const { searchParams } = new URL(req.url);
      const pass = searchParams.get('key') || req.headers.get('x-admin-key');
      if (pass !== process.env.ADMIN_PASS) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    // Rate limit
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit: max 10 test/min' }, { status: 429 });
    }

    const { text, sourceLang, targetLang, models } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const trimmed = text.trim();
    const selectedModels = models || Object.keys(MODEL_MAP);
    const systemPrompt = buildSystemPrompt(sourceLang, targetLang);

    // Run all selected models in parallel
    const results = await Promise.allSettled(
      selectedModels.map(modelId => testModel(modelId, trimmed, sourceLang, targetLang, systemPrompt))
    );

    const output = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        model: selectedModels[i],
        provider: MODEL_MAP[selectedModels[i]]?.provider || 'unknown',
        text: null,
        elapsed: 0,
        valid: false,
        reason: r.reason?.message || 'promise_rejected',
        tokens: null,
      };
    });

    return NextResponse.json({
      results: output,
      sourceText: trimmed,
      sourceLang,
      targetLang,
    });
  } catch (e) {
    console.error('LLM test error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

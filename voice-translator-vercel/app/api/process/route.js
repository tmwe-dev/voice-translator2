import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { addCost } from '../../lib/store.js';
import { deductCredits, deductLendingTokens } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, calcWhisperCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';

// ═══════════════════════════════════════════════
// Output validation — detect garbage/wrong-script LLM output
// (aligned with translate/route.js FASE 9)
// ═══════════════════════════════════════════════
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

// Model mapping — aligned with translate/route.js
const MODEL_MAP = {
  'gpt-4o-mini':    { actual: 'gpt-4o-mini', provider: 'openai' },
  'gpt-4o':         { actual: 'gpt-4o', provider: 'openai' },
  'claude-sonnet':  { actual: 'claude-sonnet-4-5-20250929', provider: 'anthropic' },
  'claude-haiku':   { actual: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
  'gemini-flash':   { actual: 'gemini-2.0-flash', provider: 'gemini' },
  'gemini-pro':     { actual: 'gemini-2.5-pro-preview-05-06', provider: 'gemini' },
};

// Tonal language notes for better translation quality
const TONAL_LANGS = {
  'th': 'Thai (tonal, no spaces between words, use Thai script ภาษาไทย)',
  'zh': 'Chinese (Simplified, use 简体中文)',
  'ja': 'Japanese (use appropriate kanji/hiragana/katakana)',
  'vi': 'Vietnamese (tonal, ALL diacritics critical — never omit dấu)',
  'ko': 'Korean (use Hangul 한국어)'
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

async function handlePost(req) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const sourceLang = formData.get('sourceLang');
    const targetLang = formData.get('targetLang');
    const sourceLangName = formData.get('sourceLangName');
    const targetLangName = formData.get('targetLangName');
    const roomId = formData.get('roomId');
    const domainContext = formData.get('domainContext') || '';
    const description = formData.get('description') || '';
    const userToken = formData.get('userToken') || '';
    const aiModel = formData.get('aiModel') || '';
    const lendingCode = formData.get('lendingCode') || '';

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    // Resolve model + provider for translation
    const modelInfo = MODEL_MAP[aiModel] || MODEL_MAP['gpt-4o-mini'];
    const authProvider = modelInfo.provider === 'anthropic' ? 'anthropic'
      : modelInfo.provider === 'gemini' ? 'gemini' : 'openai';

    // 3-tier auth — always need OpenAI for STT, but translation may use different provider
    const { apiKey, isOwnKey, billingEmail, isLending, lendingCodeUsed } = await resolveAuth({
      userToken: userToken || undefined,
      roomId: roomId || undefined,
      lendingCode: lendingCode || undefined,
      provider: 'openai',  // STT always uses OpenAI
      minCredits: MIN_CREDITS.PROCESS,
    });

    // Get translation provider key if different from OpenAI
    let translationApiKey = apiKey;
    if (authProvider !== 'openai') {
      try {
        const authResult = await resolveAuth({
          userToken: userToken || undefined,
          roomId: roomId || undefined,
          provider: authProvider,
          minCredits: 0,
          skipCreditCheck: true,
        });
        translationApiKey = authResult.apiKey;
      } catch {
        // Fall back to OpenAI for translation if provider key unavailable
      }
    }

    const openai = new OpenAI({ apiKey });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const tempPath = join('/tmp', `audio-${Date.now()}.${ext}`);
    await writeFile(tempPath, buffer);

    const whisperCost = calcWhisperCost(buffer.length);

    // ── STT: Use gpt-4o-mini-transcribe (2x cheaper, more accurate than whisper-1) ──
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'gpt-4o-mini-transcribe',
      language: sourceLang,
    });
    await unlink(tempPath).catch(() => {});

    const original = transcription.text;
    if (!original.trim()) return NextResponse.json({ original: '', translated: '', cost: 0 });

    // ── Build translation prompt — aligned with translate/route.js ──
    const srcTonal = TONAL_LANGS[sourceLang];
    const tgtTonal = TONAL_LANGS[targetLang];
    let toneNote = '';
    if (tgtTonal) toneNote = ` The target language is ${tgtTonal}. Preserve all diacritics, tone marks, and native script exactly. Use natural ${targetLangName} phrasing — NOT transliteration.`;
    else if (srcTonal) toneNote = ` The source language is ${srcTonal}. Interpret tone marks and diacritics accurately.`;

    let sysPrompt = `You are a real-time voice interpreter translating live speech from ${sourceLangName} to ${targetLangName}.${toneNote}

RULES:
- Output ONLY the translated text — nothing else
- NO notes, NO explanations, NO labels, NO commentary, NO transliterations
- This is SPOKEN language: keep the same register, tone, and emotion
- Clean up filler words (um, uh, etc.) but preserve the meaning and style
- Preserve casual/informal style — do NOT formalize slang or colloquialisms
- Keep exclamations, questions, hesitations natural in the target language
- Translate idioms to equivalent idioms, NOT literally
- If speech is fragmented or unclear, reconstruct the most likely meaning naturally
- NEVER output the original language — always translate to ${targetLangName}`;
    if (domainContext) sysPrompt += `\n\nDomain: ${domainContext}`;
    if (description) sysPrompt += `\nTopic: ${description}`;

    // Add language pair notes for problematic combinations
    const pairKey = `${sourceLang}->${targetLang}`;
    if (PAIR_NOTES[pairKey]) sysPrompt += `\n\nLanguage pair note: ${PAIR_NOTES[pairKey]}`;

    // ── Translate with multi-provider support ──
    let translated;
    let usage = null;

    if (modelInfo.provider === 'anthropic' && translationApiKey !== apiKey) {
      // ── Anthropic Claude ──
      const anthropic = new Anthropic({ apiKey: translationApiKey });
      const msg = await anthropic.messages.create({
        model: modelInfo.actual,
        max_tokens: 500,
        system: sysPrompt,
        messages: [{ role: 'user', content: original }],
      });
      translated = msg.content[0]?.text?.trim() || '';
      usage = { prompt_tokens: msg.usage?.input_tokens || 0, completion_tokens: msg.usage?.output_tokens || 0,
        total_tokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0) };
    } else if (modelInfo.provider === 'gemini' && translationApiKey !== apiKey) {
      // ── Google Gemini ──
      const genAI = new GoogleGenerativeAI(translationApiKey);
      const model = genAI.getGenerativeModel({ model: modelInfo.actual });
      const userText = `${sysPrompt}\n\nTranslate:\n${original}`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
      });
      translated = result.response.text()?.trim() || '';
      const gUsage = result.response.usageMetadata;
      usage = { prompt_tokens: gUsage?.promptTokenCount || 0, completion_tokens: gUsage?.candidatesTokenCount || 0,
        total_tokens: gUsage?.totalTokenCount || 0 };
    } else {
      // ── OpenAI (default) ──
      const completion = await openai.chat.completions.create({
        model: modelInfo.actual || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: original }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      translated = completion.choices[0].message.content.trim();
      usage = completion.usage;
    }

    // ── Output validation (FASE 9) ──
    const validation = validateOutput(original, translated, targetLang);
    if (!validation.valid) {
      console.warn(`[Process] Output validation failed: reason=${validation.reason}, target=${targetLang}, output="${translated?.substring(0, 60)}"`);
      if (validation.reason === 'meta_text') {
        translated = translated.replace(/^(Translation:|Here is|Note:)\s*/i, '').trim();
      }
      const recheck = validateOutput(original, translated, targetLang);
      if (!recheck.valid) {
        // Retry with gpt-4o if the primary model failed validation (Asian language fix)
        if (modelInfo.actual !== 'gpt-4o') {
          try {
            console.log(`[Process] Retrying translation with gpt-4o for ${targetLang}`);
            const retryCompletion = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: original }
              ],
              temperature: 0.3,
              max_tokens: 500
            });
            const retryTranslated = retryCompletion.choices[0].message.content.trim();
            const retryValidation = validateOutput(original, retryTranslated, targetLang);
            if (retryValidation.valid) {
              translated = retryTranslated;
              usage = retryCompletion.usage;
            }
          } catch (retryErr) {
            console.error('[Process] Retry with gpt-4o failed:', retryErr.message);
          }
        }
        // Final check — if still invalid, return original
        const finalCheck = validateOutput(original, translated, targetLang);
        if (!finalCheck.valid) {
          return NextResponse.json({
            original,
            translated: original,
            cost: roundCost(calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 })),
            costEurCents: 0,
            validationFailed: true
          });
        }
      }
    }

    // ── Calculate costs ──
    const gptCost = calcGptCost(usage || { prompt_tokens: 0, completion_tokens: 0 });
    const ttsCost = calcTtsCost(translated.length);
    const msgCostUsd = whisperCost + gptCost + ttsCost;
    const msgCostEurCents = usdToEurCents(msgCostUsd);

    if (roomId) {
      try { await addCost(roomId, msgCostUsd); } catch (e) { console.error('Cost tracking error:', e); }
    }

    // Deduct credits
    let remainingCredits = undefined;
    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.PROCESS, msgCostEurCents);
        const updatedUser = await deductCredits(billingEmail, charge);
        if (updatedUser) remainingCredits = updatedUser.credits;
        await trackDailySpend(billingEmail, charge);
      } catch (e) { console.error('Credit deduct error:', e); }
    }

    // Track lending token usage
    if (isLending && lendingCodeUsed) {
      try {
        const tokenEstimate = Math.ceil(((original?.length || 0) + (translated?.length || 0)) / 4) + 200; // +200 for STT
        await deductLendingTokens(lendingCodeUsed, tokenEstimate);
      } catch (e) { console.error('Lending token tracking error:', e); }
    }

    return NextResponse.json({
      original,
      translated,
      cost: roundCost(msgCostUsd),
      costEurCents: roundEurCents(msgCostEurCents),
      ...(remainingCredits !== undefined ? { remainingCredits } : {})
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('Process error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'process' });

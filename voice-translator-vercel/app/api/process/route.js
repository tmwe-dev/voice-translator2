import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { addCost } from '../../lib/store.js';
import { deductCredits, deductLendingTokens } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, calcWhisperCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';
import { validateOutput, MODEL_MAP } from '../../lib/translateValidation.js';
import { buildSystemPrompt } from '../../lib/translatePrompt.js';
import { callLLM } from '../../lib/llmCaller.js';

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
    const conversationContext = formData.get('conversationContext') || '';
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

    // ── Build translation prompt — reuse shared module ──
    const systemPrompt = buildSystemPrompt({
      sourceLang, targetLang, sourceLangName, targetLangName,
      domainContext, description,
      conversationContext: conversationContext || undefined,
    });

    // ── Translate with multi-provider support — reuse shared LLM caller ──
    let { translated, usage } = await callLLM({
      provider: modelInfo.provider,
      model: modelInfo.actual,
      apiKey: translationApiKey,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: original }
      ],
      systemPrompt,
      text: original,
    });

    // ── Output validation (FASE 9) — reuse shared validator ──
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
            const retryResult = await callLLM({
              provider: 'openai',
              model: 'gpt-4o',
              apiKey,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: original }
              ],
              systemPrompt,
              text: original,
            });
            const retryValidation = validateOutput(original, retryResult.translated, targetLang);
            if (retryValidation.valid) {
              translated = retryResult.translated;
              usage = retryResult.usage;
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

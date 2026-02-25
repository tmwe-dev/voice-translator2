import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { addCost } from '../../lib/store.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcGptCost, calcTtsCost, calcWhisperCost, usdToEurCents, roundCost, roundEurCents } from '../../lib/config.js';

export async function POST(req) {
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

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken: userToken || undefined,
      roomId: roomId || undefined,
      provider: 'openai',
      minCredits: MIN_CREDITS.PROCESS,
    });

    const openai = new OpenAI({ apiKey });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const tempPath = join('/tmp', `audio-${Date.now()}.${ext}`);
    await writeFile(tempPath, buffer);

    const whisperCost = calcWhisperCost(buffer.length);

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
      language: sourceLang,
    });
    await unlink(tempPath).catch(() => {});

    const original = transcription.text;
    if (!original.trim()) return NextResponse.json({ original: '', translated: '', cost: 0 });

    // Build system prompt with domain context
    let sysPrompt = `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational. Clean up filler words.`;
    if (domainContext) sysPrompt += `\n\n${domainContext}`;
    if (description) sysPrompt += `\nAdditional context about this conversation: ${description}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: original }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const translated = completion.choices[0].message.content.trim();

    // Calculate costs
    const gptCost = calcGptCost(completion.usage);
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
        const updatedUser = await deductCredits(billingEmail, Math.max(MIN_CHARGE.PROCESS, msgCostEurCents));
        if (updatedUser) remainingCredits = updatedUser.credits;
      } catch (e) { console.error('Credit deduct error:', e); }
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

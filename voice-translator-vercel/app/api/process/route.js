import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { addCost } from '../../lib/store.js';
import { getSession, getUser, deductCredits } from '../../lib/users.js';

// OpenAI pricing (USD)
const WHISPER_PER_MINUTE = 0.006;
const GPT4OMINI_INPUT_PER_TOKEN = 0.00000015;
const GPT4OMINI_OUTPUT_PER_TOKEN = 0.0000006;
const TTS_PER_CHAR = 0.000015;
const USD_TO_EUR_CENTS = 92;

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

    // Determine API key and check credits
    let apiKey = process.env.OPENAI_API_KEY;
    let isOwnKey = false;
    let userEmail = null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        userEmail = session.email;
        const user = await getUser(userEmail);
        if (user) {
          if (user.useOwnKeys && user.apiKeys?.openai) {
            apiKey = user.apiKeys.openai;
            isOwnKey = true;
          } else if (!user.useOwnKeys && user.credits < 0.5) {
            return NextResponse.json({ error: 'Credito esaurito. Ricarica per continuare.' }, { status: 402 });
          }
        }
      }
    }

    const openai = new OpenAI({ apiKey });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const tempPath = join('/tmp', `audio-${Date.now()}.${ext}`);
    await writeFile(tempPath, buffer);

    const estimatedSeconds = Math.max(1, buffer.length / 16000);
    const whisperCost = (estimatedSeconds / 60) * WHISPER_PER_MINUTE;

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
    const usage = completion.usage || {};
    const gptCost = (usage.prompt_tokens || 0) * GPT4OMINI_INPUT_PER_TOKEN
                  + (usage.completion_tokens || 0) * GPT4OMINI_OUTPUT_PER_TOKEN;
    const ttsCost = translated.length * TTS_PER_CHAR;
    const msgCostUsd = whisperCost + gptCost + ttsCost;
    const msgCostEurCents = msgCostUsd * USD_TO_EUR_CENTS;

    if (roomId) {
      try { await addCost(roomId, msgCostUsd); } catch (e) { console.error('Cost tracking error:', e); }
    }

    // Deduct credits
    if (userEmail && !isOwnKey) {
      try { await deductCredits(userEmail, Math.max(0.2, msgCostEurCents)); } catch (e) { console.error('Credit deduct error:', e); }
    }

    return NextResponse.json({
      original,
      translated,
      cost: Math.round(msgCostUsd * 1000000) / 1000000
    });
  } catch (e) {
    console.error('Process error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

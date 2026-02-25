import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';

// OpenAI pricing (USD)
const GPT4OMINI_INPUT_PER_TOKEN = 0.00000015;   // $0.15/1M tokens
const GPT4OMINI_OUTPUT_PER_TOKEN = 0.0000006;   // $0.60/1M tokens
const TTS_PER_CHAR = 0.000015;                   // $15/1M chars

export async function POST(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text, sourceLang, targetLang, sourceLangName, targetLangName, roomId, context, isReview, domainContext, description } = await req.json();

    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Build system prompt with optional context for streaming chunks
    let systemPrompt = `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational.`;

    // Add domain context for better translation quality
    if (domainContext) {
      systemPrompt += `\n\n${domainContext}`;
    }
    if (description) {
      systemPrompt += `\nAdditional context about this conversation: ${description}`;
    }

    if (context) {
      systemPrompt += `\n\nPrevious translation context (for continuity): "${context}"`;
    }
    if (isReview) {
      systemPrompt += `\nThis is a review pass. Ensure the translation is coherent and contextually accurate as a whole.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const translated = completion.choices[0].message.content.trim();

    // Calculate cost (no whisper for text input)
    const usage = completion.usage || {};
    const gptCost = (usage.prompt_tokens || 0) * GPT4OMINI_INPUT_PER_TOKEN
                  + (usage.completion_tokens || 0) * GPT4OMINI_OUTPUT_PER_TOKEN;
    const ttsCost = translated.length * TTS_PER_CHAR;
    const msgCost = gptCost + ttsCost;

    if (roomId) {
      try { await addCost(roomId, msgCost); } catch (e) { console.error('Cost tracking error:', e); }
    }

    return NextResponse.json({ translated, cost: Math.round(msgCost * 1000000) / 1000000 });
  } catch (e) {
    console.error('Translate error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

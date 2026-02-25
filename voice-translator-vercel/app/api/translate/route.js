import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { addCost } from '../../lib/store.js';
import { getSession, getUser, deductCredits, getUserApiKey } from '../../lib/users.js';

// OpenAI pricing (USD) - used for cost estimation
const GPT4OMINI_INPUT_PER_TOKEN = 0.00000015;
const GPT4OMINI_OUTPUT_PER_TOKEN = 0.0000006;
const TTS_PER_CHAR = 0.000015;
const USD_TO_EUR_CENTS = 92; // ~$1 = 92 euro cents

export async function POST(req) {
  try {
    const { text, sourceLang, targetLang, sourceLangName, targetLangName,
            roomId, context, isReview, domainContext, description, userToken } = await req.json();

    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Determine API key: user's own or platform
    let apiKey = process.env.OPENAI_API_KEY;
    let isOwnKey = false;
    let userEmail = null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        userEmail = session.email;
        const user = await getUser(userEmail);
        if (user) {
          if (user.useOwnKeys) {
            const ownKey = user.apiKeys?.openai;
            if (ownKey) { apiKey = ownKey; isOwnKey = true; }
          } else {
            // Check credits (estimate ~0.5 euro cents per message chunk)
            if (user.credits < 0.1 && !isReview) {
              return NextResponse.json({ error: 'Credito esaurito. Ricarica per continuare.' }, { status: 402 });
            }
          }
        }
      }
    }

    const openai = new OpenAI({ apiKey });

    // Build system prompt
    let systemPrompt = `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational.`;
    if (domainContext) systemPrompt += `\n\n${domainContext}`;
    if (description) systemPrompt += `\nAdditional context about this conversation: ${description}`;
    if (context) systemPrompt += `\n\nPrevious translation context (for continuity): "${context}"`;
    if (isReview) systemPrompt += `\nThis is a review pass. Ensure the translation is coherent and contextually accurate as a whole.`;

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

    // Calculate cost
    const usage = completion.usage || {};
    const gptCost = (usage.prompt_tokens || 0) * GPT4OMINI_INPUT_PER_TOKEN
                  + (usage.completion_tokens || 0) * GPT4OMINI_OUTPUT_PER_TOKEN;
    const ttsCost = translated.length * TTS_PER_CHAR;
    const msgCostUsd = gptCost + ttsCost;
    const msgCostEurCents = msgCostUsd * USD_TO_EUR_CENTS;

    // Track cost in room
    if (roomId) {
      try { await addCost(roomId, msgCostUsd); } catch (e) { console.error('Cost tracking error:', e); }
    }

    // Deduct credits if using platform key (only for non-review, non-trivial calls)
    if (userEmail && !isOwnKey && !isReview) {
      try { await deductCredits(userEmail, Math.max(0.1, msgCostEurCents)); } catch (e) { console.error('Credit deduct error:', e); }
    }

    return NextResponse.json({ translated, cost: Math.round(msgCostUsd * 1000000) / 1000000 });
  } catch (e) {
    console.error('Translate error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

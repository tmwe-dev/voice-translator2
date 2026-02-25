import { NextResponse } from 'next/server';
import { getSession, getUser } from '../../lib/users.js';

// OpenAI pricing (USD) - SAME AS translate/process endpoints
const WHISPER_PER_MINUTE = 0.006;
const GPT4OMINI_INPUT_PER_TOKEN = 0.00000015;
const GPT4OMINI_OUTPUT_PER_TOKEN = 0.0000006;
const TTS_PER_CHAR = 0.000015;
const USD_TO_EUR = 0.92;

// Token estimation (~4 chars per token for English, ~2-3 for other languages)
function estimateTokens(text, lang = 'en') {
  if (!text) return 0;
  const charsPerToken = ['zh', 'ja', 'ko', 'th', 'ar', 'hi'].includes(lang) ? 1.5 : 4;
  return Math.ceil(text.length / charsPerToken);
}

// System prompt templates (same as in translate/process)
function buildSystemPrompt(sourceLangName, targetLangName, domainContext, description, context, isReview) {
  let p = `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational.`;
  if (domainContext) p += `\n\n${domainContext}`;
  if (description) p += `\nAdditional context about this conversation: ${description}`;
  if (context) p += `\n\nPrevious translation context (for continuity): "${context}"`;
  if (isReview) p += `\nThis is a review pass. Ensure the translation is coherent and contextually accurate as a whole.`;
  return p;
}

export async function POST(req) {
  try {
    const { action, userToken, text, sourceLang, targetLang,
            sourceLangName, targetLangName, domainContext, description,
            audioSeconds } = await req.json();

    // === USER CREDIT INFO ===
    if (action === 'user-info') {
      if (!userToken) return NextResponse.json({ error: 'No token' }, { status: 401 });
      const session = await getSession(userToken);
      if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
      const user = await getUser(session.email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      return NextResponse.json({
        email: user.email,
        credits: user.credits,
        creditsEur: (user.credits / 100).toFixed(2),
        totalSpent: user.totalSpent,
        totalSpentEur: ((user.totalSpent || 0) / 100).toFixed(2),
        totalMessages: user.totalMessages || 0,
        avgCostPerMsg: user.totalMessages > 0
          ? ((user.totalSpent || 0) / user.totalMessages).toFixed(3)
          : '0',
        useOwnKeys: user.useOwnKeys,
        hasOpenaiKey: !!user.apiKeys?.openai,
      });
    }

    // === COST SIMULATION ===
    if (action === 'simulate') {
      const sysPrompt = buildSystemPrompt(
        sourceLangName || 'Italiano', targetLangName || 'English',
        domainContext || '', description || '', '', false
      );

      const sysTokens = estimateTokens(sysPrompt, 'en');
      const inputTextTokens = estimateTokens(text || 'Ciao come stai?', sourceLang || 'it');
      const totalInputTokens = sysTokens + inputTextTokens;

      // Estimate output (translated text is usually similar length)
      const estimatedOutputChars = Math.ceil((text || 'Ciao come stai?').length * 1.2);
      const outputTokens = estimateTokens('x'.repeat(estimatedOutputChars), targetLang || 'en');

      // GPT costs
      const gptInputCost = totalInputTokens * GPT4OMINI_INPUT_PER_TOKEN;
      const gptOutputCost = outputTokens * GPT4OMINI_OUTPUT_PER_TOKEN;
      const gptTotalCost = gptInputCost + gptOutputCost;

      // Whisper costs (if audio)
      const whisperSeconds = audioSeconds || 0;
      const whisperCost = (whisperSeconds / 60) * WHISPER_PER_MINUTE;

      // TTS costs
      const ttsChars = estimatedOutputChars;
      const ttsCost = ttsChars * TTS_PER_CHAR;

      // Total
      const totalUsd = gptTotalCost + whisperCost + ttsCost;
      const totalEur = totalUsd * USD_TO_EUR;
      const totalEurCents = totalEur * 100;

      // What we actually charge (with minimums)
      const minCharge = whisperSeconds > 0 ? 0.2 : 0.1; // euro cents
      const actualCharge = Math.max(minCharge, totalEurCents);

      // Messages possible with different packages
      const packages = [
        { id: 'pack_2', euros: 2, credits: 200 },
        { id: 'pack_5', euros: 5, credits: 550 },
        { id: 'pack_10', euros: 10, credits: 1200 },
        { id: 'pack_20', euros: 20, credits: 2600 },
      ];

      return NextResponse.json({
        simulation: {
          inputText: text || 'Ciao come stai?',
          inputChars: (text || 'Ciao come stai?').length,
          estimatedOutputChars,
          audioSeconds: whisperSeconds,
          domainContext: domainContext || '(none)',
        },
        tokens: {
          systemPromptTokens: sysTokens,
          inputTextTokens,
          totalInputTokens,
          estimatedOutputTokens: outputTokens,
          systemPromptText: sysPrompt,
          systemPromptChars: sysPrompt.length,
        },
        costs_usd: {
          gptInput: gptInputCost.toFixed(8),
          gptOutput: gptOutputCost.toFixed(8),
          gptTotal: gptTotalCost.toFixed(8),
          whisper: whisperCost.toFixed(8),
          tts: ttsCost.toFixed(8),
          total: totalUsd.toFixed(8),
        },
        costs_eur: {
          total: totalEur.toFixed(8),
          totalCents: totalEurCents.toFixed(4),
          actualCharge: actualCharge.toFixed(4),
          minCharge: minCharge.toFixed(1),
        },
        pricing_reference: {
          gpt4oMini_input: '$0.15 per 1M tokens',
          gpt4oMini_output: '$0.60 per 1M tokens',
          whisper: '$0.006 per minute',
          tts1: '$0.015 per 1K characters',
          usdToEur: USD_TO_EUR,
        },
        packages_estimate: packages.map(p => ({
          ...p,
          messagesEstimate: Math.floor(p.credits / actualCharge),
          creditsLabel: `€${p.euros} → ${p.credits} cent`,
        })),
        scenarios: generateScenarios(domainContext, description),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Debug error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function generateScenarios(domainContext, description) {
  const scenarios = [
    { name: 'Frase breve (5 parole)', text: 'Ciao, come stai oggi?', audioSec: 3 },
    { name: 'Frase media (15 parole)', text: 'Mi potresti indicare la strada per andare alla stazione dei treni per favore?', audioSec: 7 },
    { name: 'Frase lunga (30 parole)', text: 'Buongiorno, vorrei prenotare una camera doppia per due notti con colazione inclusa, possibilmente con vista mare. Avete disponibilità per il prossimo fine settimana?', audioSec: 14 },
    { name: 'Solo testo breve (no audio)', text: 'Quanto costa?', audioSec: 0 },
    { name: 'Solo testo lungo (no audio)', text: 'Vorrei sapere se è possibile ottenere uno sconto per un soggiorno di una settimana completa nella vostra struttura, siamo una famiglia di quattro persone.', audioSec: 0 },
  ];

  return scenarios.map(s => {
    const sysPrompt = buildSystemPrompt('Italiano', 'English', domainContext || '', description || '', '', false);
    const sysTokens = estimateTokens(sysPrompt, 'en');
    const inputTokens = estimateTokens(s.text, 'it');
    const outputChars = Math.ceil(s.text.length * 1.2);
    const outputTokens = estimateTokens('x'.repeat(outputChars), 'en');

    const gptCost = (sysTokens + inputTokens) * GPT4OMINI_INPUT_PER_TOKEN + outputTokens * GPT4OMINI_OUTPUT_PER_TOKEN;
    const whisperCost = (s.audioSec / 60) * WHISPER_PER_MINUTE;
    const ttsCost = outputChars * TTS_PER_CHAR;
    const totalUsd = gptCost + whisperCost + ttsCost;
    const totalEurCents = totalUsd * USD_TO_EUR * 100;
    const minCharge = s.audioSec > 0 ? 0.2 : 0.1;
    const actualCharge = Math.max(minCharge, totalEurCents);

    return {
      name: s.name,
      text: s.text,
      chars: s.text.length,
      audioSec: s.audioSec,
      tokens: { input: sysTokens + inputTokens, output: outputTokens },
      costUsd: totalUsd.toFixed(6),
      costEurCents: totalEurCents.toFixed(4),
      actualChargeCents: actualCharge.toFixed(4),
      msgsPerPack2: Math.floor(200 / actualCharge),
      msgsPerPack5: Math.floor(550 / actualCharge),
    };
  });
}

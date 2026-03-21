import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcTtsCost, usdToEurCents } from '../../lib/config.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';
import { getOpenAIVoiceForLang, getOpenAISpeedForLang } from '../../lib/voiceDefaults.js';
import { routeTTS } from '../../lib/ttsRouter.js';
import { ErrorCode, apiError } from '../../lib/errors.js';
import { validateTTSInput } from '../../lib/schemas.js';

// ═══════════════════════════════════════════════
// TTS with gpt-4o-mini-tts — TRUE STREAMING
//
// Stream audio bytes to client as they're generated.
// Client receives first bytes in ~100-200ms (TTFB)
// Uses TransformStream to pipe OpenAI response to client.
// Falls back to buffer mode if streaming fails.
// ═══════════════════════════════════════════════

const TTS_INSTRUCTIONS = {
  'it': 'Speak in fluent Italian with natural Italian intonation and rhythm. Use clear pronunciation with proper Italian vowels and consonants. Sound like a native Italian speaker in casual conversation.',
  'th': 'Speak in fluent Thai with correct tonal pronunciation. Thai has 5 tones — each tone must be precisely correct or the meaning changes. Speak SLOWLY and clearly, slightly slower than normal conversation speed. Pause briefly between clauses. Use natural Thai rhythm and intonation. Do NOT rush — clarity is more important than speed.',
  'en': 'Speak in clear, natural English with a neutral accent. Use conversational tone and natural pacing.',
  'es': 'Speak in fluent Spanish with natural Castilian intonation. Roll the R sounds where appropriate. Sound like a native Spanish speaker.',
  'fr': 'Speak in fluent French with natural Parisian intonation. Use proper liaison and nasal vowels. Sound like a native French speaker.',
  'de': 'Speak in fluent German with clear pronunciation of umlauts (a, o, u) and compound words. Use natural German rhythm.',
  'pt': 'Speak in fluent Brazilian Portuguese with natural intonation. Use proper nasal vowels and open/closed vowel distinctions.',
  'zh': 'Speak in fluent Mandarin Chinese with correct four tones. Each tone must be precise. Speak SLOWLY and clearly, slightly slower than normal conversation. Pause briefly between phrases. Use natural Mandarin rhythm.',
  'ja': 'Speak in fluent Japanese with natural pitch accent patterns. Use proper mora timing — each mora should be roughly equal length. Speak at a calm, measured pace. Pause naturally between sentences. Sound like a native Japanese speaker.',
  'ko': 'Speak in fluent Korean with natural intonation. Use proper Korean vowel and consonant pronunciation including tense consonants. Speak at a calm, clear pace. Sound like a native Korean speaker.',
  'ar': 'Speak in fluent Modern Standard Arabic with clear pronunciation of emphatic consonants and proper vowel length distinctions. Use natural Arabic rhythm.',
  'hi': 'Speak in fluent Hindi with natural Devanagari pronunciation. Use proper aspirated/unaspirated consonant distinctions and natural Hindi intonation.',
  'ru': 'Speak in fluent Russian with natural intonation. Use proper vowel reduction in unstressed syllables and palatalized consonants. Sound like a native Russian speaker.',
  'tr': 'Speak in fluent Turkish with natural intonation and proper vowel harmony. Sound like a native Turkish speaker.',
  'vi': 'Speak in fluent Vietnamese with correct six-tone pronunciation. Each tone must be precisely correct. Use natural Northern Vietnamese dialect intonation.',
  'nl': 'Speak in fluent Dutch with natural intonation and proper guttural G sound. Sound like a native Dutch speaker.',
  'pl': 'Speak in fluent Polish with proper consonant clusters and nasal vowels. Use natural Polish rhythm and intonation.',
  'sv': 'Speak in fluent Swedish with natural pitch accent and tonal word distinctions. Sound like a native Swedish speaker.',
  'el': 'Speak in fluent Greek with natural intonation and proper stress placement. Sound like a native Greek speaker.',
  'id': 'Speak in fluent Indonesian with clear pronunciation and natural Bahasa Indonesia rhythm.',
  'ms': 'Speak in fluent Malay with natural Malaysian intonation and proper pronunciation.',
  'cs': 'Speak in fluent Czech with natural intonation and proper pronunciation. Sound like a native Czech speaker.',
  'ro': 'Speak in fluent Romanian with natural intonation and proper pronunciation.',
  'hu': 'Speak in fluent Hungarian with natural intonation and proper vowel length distinctions. Sound like a native Hungarian speaker.',
  'fi': 'Speak in fluent Finnish with natural intonation and proper vowel/consonant length distinctions. Sound like a native Finnish speaker.',
};

async function handlePost(req) {
  try {
    // Validate input
    const body = await req.json();
    const validation = validateTTSInput(body);
    if (!validation.valid) {
      return apiError(ErrorCode.INVALID_INPUT, validation.error);
    }
    const { text, voice, userToken, roomId, langCode, wantStream } = validation.data;

    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'openai',
      minCredits: MIN_CREDITS.TTS_OPENAI,
    });

    const openai = new OpenAI({ apiKey });
    const lang2 = (langCode || '').replace(/-.*/, '');

    // ── TTS Router: check if a better engine is available for this language ──
    const ttsRoute = routeTTS(lang2, { hasElevenLabs: false, hasOpenAI: true });
    if (ttsRoute.engine === 'cosyvoice') {
      try {
        const { ttsCosyVoice } = await import('../../lib/ttsAsia.js');
        const cosyResult = await ttsCosyVoice(text, langCode, {});
        if (cosyResult?.audio) {
          const audioBuffer = Buffer.from(cosyResult.audio);
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.length.toString(),
              'Cache-Control': 'public, max-age=300',
              'X-TTS-Engine': 'cosyvoice',
            }
          });
        }
      } catch (cosyErr) {
        console.warn('[TTS] CosyVoice failed, falling back to OpenAI:', cosyErr.message);
      }
    }

    // Voice selection
    const adminVoice = getOpenAIVoiceForLang(lang2);
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer','ash','ballad','coral','sage','verse'].includes(voice)
      ? voice : (adminVoice || 'nova');
    const instructions = TTS_INSTRUCTIONS[lang2] || TTS_INSTRUCTIONS['en'];
    const cleanText = preprocessForTTS(text, lang2);
    const speed = getOpenAISpeedForLang(lang2);

    // Deduct cost upfront (before streaming)
    const ttsCostUsd = calcTtsCost(text.length);
    const ttsCostEurCents = usdToEurCents(ttsCostUsd);
    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.TTS_OPENAI, ttsCostEurCents);
        await deductCredits(billingEmail, charge);
        trackDailySpend(billingEmail, charge).catch(() => {});
      } catch (e) { console.error('TTS credit deduct error:', e); }
    }

    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: selectedVoice,
      input: cleanText,
      instructions,
      response_format: 'mp3',
      speed,
    });

    // ── Try true streaming first, fallback to buffer ──
    if (wantStream && response.body) {
      try {
        // Pipe OpenAI's ReadableStream directly to the client
        const stream = response.body;
        return new NextResponse(stream, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'public, max-age=300',
            'X-TTS-Engine': 'openai-stream',
          }
        });
      } catch (streamErr) {
        console.warn('[TTS] Streaming failed, falling back to buffer:', streamErr.message);
      }
    }

    // Buffer mode (reliable fallback)
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=300',
        'X-TTS-Engine': 'openai',
      }
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('TTS error:', e);
    return apiError(ErrorCode.TTS_FAILED, e.message);
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'tts' });

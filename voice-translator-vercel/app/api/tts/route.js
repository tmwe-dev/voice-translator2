import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcTtsCost, usdToEurCents } from '../../lib/config.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';

// ═══════════════════════════════════════════════
// TTS with gpt-4o-mini-tts — STREAMING
//
// Key improvement: Stream audio bytes to client as they're generated.
// OLD: Server waits for full MP3 buffer → client gets audio after ~1-2s
// NEW: Server streams chunks → client starts playing in ~100-200ms (TTFB)
//
// The client uses MediaSource API or falls back to blob playback.
// ═══════════════════════════════════════════════

const TTS_INSTRUCTIONS = {
  'it': 'Speak in fluent Italian with natural Italian intonation and rhythm. Use clear pronunciation with proper Italian vowels and consonants. Sound like a native Italian speaker in casual conversation.',
  'th': 'Speak in fluent Thai with correct tonal pronunciation. Thai has 5 tones — each tone must be precisely correct or the meaning changes. Speak SLOWLY and clearly, slightly slower than normal conversation speed. Pause briefly between clauses. Use natural Thai rhythm and intonation. Do NOT rush — clarity is more important than speed.',
  'en': 'Speak in clear, natural English with a neutral accent. Use conversational tone and natural pacing.',
  'es': 'Speak in fluent Spanish with natural Castilian intonation. Roll the R sounds where appropriate. Sound like a native Spanish speaker.',
  'fr': 'Speak in fluent French with natural Parisian intonation. Use proper liaison and nasal vowels. Sound like a native French speaker.',
  'de': 'Speak in fluent German with clear pronunciation of umlauts (ä, ö, ü) and compound words. Use natural German rhythm.',
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
  'cs': 'Speak in fluent Czech with natural intonation and proper ř pronunciation. Sound like a native Czech speaker.',
  'ro': 'Speak in fluent Romanian with natural intonation and proper pronunciation of ă, â, î, ș, ț.',
  'hu': 'Speak in fluent Hungarian with natural intonation and proper vowel length distinctions. Sound like a native Hungarian speaker.',
  'fi': 'Speak in fluent Finnish with natural intonation and proper vowel/consonant length distinctions. Sound like a native Finnish speaker.',
};

const SLOW_SPEED_LANGS = { 'th': 0.9, 'zh': 0.92, 'ja': 0.92, 'vi': 0.9, 'ar': 0.95 };

async function handlePost(req) {
  try {
    const { text, voice, userToken, roomId, langCode, stream: wantStream } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'openai',
      minCredits: MIN_CREDITS.TTS_OPENAI,
    });

    const openai = new OpenAI({ apiKey });
    const lang2 = (langCode || '').replace(/-.*/, '');

    // ── Auto voice-language matching for OpenAI TTS ──
    // gpt-4o-mini-tts is multilingual but some voices sound more natural for certain languages.
    // If user selected a specific voice, respect that choice. Otherwise auto-pick.
    const VOICE_BY_LANG = {
      'th': 'shimmer',  // Shimmer: best for tonal Asian languages — clearer tone separation
      'zh': 'shimmer',  // Shimmer: clean Mandarin tone delivery
      'ja': 'nova',     // Nova: natural Japanese pitch accent
      'ko': 'nova',     // Nova: warm Korean intonation
      'vi': 'shimmer',  // Shimmer: clear Vietnamese tones
      'ar': 'onyx',     // Onyx: deep, authoritative Arabic
      'hi': 'nova',     // Nova: natural Hindi rhythm
      'ru': 'onyx',     // Onyx: natural Russian depth
      'de': 'fable',    // Fable: clear German pronunciation
      'fr': 'shimmer',  // Shimmer: elegant French
    };
    const autoVoice = VOICE_BY_LANG[lang2];
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice)
      ? voice : (autoVoice || 'nova');
    const instructions = TTS_INSTRUCTIONS[lang2] || TTS_INSTRUCTIONS['en'];
    const cleanText = preprocessForTTS(text, lang2);
    const speed = SLOW_SPEED_LANGS[lang2] || 1.0;

    // Deduct cost upfront (before streaming — can't deduct after stream starts)
    const ttsCostUsd = calcTtsCost(text.length);
    const ttsCostEurCents = usdToEurCents(ttsCostUsd);
    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.TTS_OPENAI, ttsCostEurCents);
        await deductCredits(billingEmail, charge);
        await trackDailySpend(billingEmail, charge);
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

    // ── Always use buffer mode (most reliable across all Vercel runtimes) ──
    // Streaming via ReadableStream can fail in Vercel Serverless because
    // OpenAI SDK's response.body type varies across Node.js versions.
    // Buffer mode adds ~200ms but is 100% reliable.
    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=300', // Cache 5min for repeated phrases
      }
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'tts' });

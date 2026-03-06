import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcTtsCost, usdToEurCents } from '../../lib/config.js';

// ═══════════════════════════════════════════════
// FASE 3 + FASE 10: TTS with gpt-4o-mini-tts
//
// Upgrades from tts-1-hd:
// - gpt-4o-mini-tts: more natural, supports `instructions` parameter
// - Per-language voice instructions for accent/tone/pacing
// - Streaming support via ReadableStream for lower TTFB
// ═══════════════════════════════════════════════

// Per-language TTS instructions — tell the model HOW to speak
// These dramatically improve pronunciation for non-English languages
const TTS_INSTRUCTIONS = {
  'it': 'Speak in fluent Italian with natural Italian intonation and rhythm. Use clear pronunciation with proper Italian vowels and consonants. Sound like a native Italian speaker in casual conversation.',
  'th': 'Speak in fluent Thai with correct tonal pronunciation. Thai has 5 tones — each tone must be precisely correct or the meaning changes. Speak clearly at a moderate pace. Use natural Thai rhythm and intonation.',
  'en': 'Speak in clear, natural English with a neutral accent. Use conversational tone and natural pacing.',
  'es': 'Speak in fluent Spanish with natural Castilian intonation. Roll the R sounds where appropriate. Sound like a native Spanish speaker.',
  'fr': 'Speak in fluent French with natural Parisian intonation. Use proper liaison and nasal vowels. Sound like a native French speaker.',
  'de': 'Speak in fluent German with clear pronunciation of umlauts (ä, ö, ü) and compound words. Use natural German rhythm.',
  'pt': 'Speak in fluent Brazilian Portuguese with natural intonation. Use proper nasal vowels and open/closed vowel distinctions.',
  'zh': 'Speak in fluent Mandarin Chinese with correct four tones. Each tone must be precise. Speak clearly at a moderate pace with natural Mandarin rhythm.',
  'ja': 'Speak in fluent Japanese with natural pitch accent patterns. Use proper mora timing — each mora should be roughly equal length. Sound like a native Japanese speaker.',
  'ko': 'Speak in fluent Korean with natural intonation. Use proper Korean vowel and consonant pronunciation including tense consonants. Sound like a native Korean speaker.',
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

async function handlePost(req) {
  try {
    const { text, voice, userToken, roomId, langCode } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'openai',
      minCredits: MIN_CREDITS.TTS_OPENAI,
    });

    const openai = new OpenAI({ apiKey });
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice) ? voice : 'nova';

    // ── FASE 10: Build instructions for the target language ──
    const lang2 = (langCode || '').replace(/-.*/, ''); // 'th-TH' → 'th'
    const instructions = TTS_INSTRUCTIONS[lang2] || TTS_INSTRUCTIONS['en'];

    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: selectedVoice,
      input: text,
      instructions,
      response_format: 'mp3',
      speed: 1.0
    });

    // Calculate and deduct cost
    const ttsCostUsd = calcTtsCost(text.length);
    const ttsCostEurCents = usdToEurCents(ttsCostUsd);

    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.TTS_OPENAI, ttsCostEurCents);
        await deductCredits(billingEmail, charge);
        await trackDailySpend(billingEmail, charge);
      } catch (e) { console.error('TTS credit deduct error:', e); }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'tts' });

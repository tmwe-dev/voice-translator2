import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getEdgeVoice } from '../../lib/edgeVoices.js';

// ═══════════════════════════════════════════════
// TTS Test Endpoint — test any TTS engine without auth
//
// Supports: elevenlabs, openai, edge (free)
// Uses platform API keys from env — no user auth, no credit deduction
// Rate limited: 10 req/min per IP
// ═══════════════════════════════════════════════

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 120000);

// ElevenLabs language code mapping
const EL_LANG_CODES = {
  'it':'it', 'en':'en', 'es':'es', 'fr':'fr', 'de':'de', 'pt':'pt',
  'zh':'zh', 'ja':'ja', 'ko':'ko', 'ar':'ar', 'hi':'hi', 'ru':'ru',
  'tr':'tr', 'id':'id', 'ms':'ms', 'nl':'nl', 'pl':'pl', 'sv':'sv',
  'el':'el', 'cs':'cs', 'ro':'ro', 'fi':'fi', 'th':'th', 'vi':'vi', 'hu':'hu'
};

// Per-language TTS instructions for OpenAI
const TTS_INSTRUCTIONS = {
  'it': 'Speak in fluent Italian with natural Italian intonation and rhythm.',
  'th': 'Speak in fluent Thai with correct tonal pronunciation. Thai has 5 tones.',
  'en': 'Speak in clear, natural English with a neutral accent.',
  'es': 'Speak in fluent Spanish with natural Castilian intonation.',
  'fr': 'Speak in fluent French with natural Parisian intonation.',
  'de': 'Speak in fluent German with clear pronunciation of umlauts.',
  'pt': 'Speak in fluent Brazilian Portuguese with natural intonation.',
  'zh': 'Speak in fluent Mandarin Chinese with correct four tones.',
  'ja': 'Speak in fluent Japanese with natural pitch accent patterns.',
  'ko': 'Speak in fluent Korean with natural intonation.',
  'ar': 'Speak in fluent Modern Standard Arabic with clear pronunciation.',
  'hi': 'Speak in fluent Hindi with natural Devanagari pronunciation.',
  'ru': 'Speak in fluent Russian with natural intonation.',
  'tr': 'Speak in fluent Turkish with natural intonation.',
  'vi': 'Speak in fluent Vietnamese with correct six-tone pronunciation.',
};

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit: max 10 test/min' }, { status: 429 });
    }

    const { text, langCode, engine, voiceId, model, gender } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const trimmed = text.trim().substring(0, 500); // Limit for test
    const lang2 = (langCode || 'en').replace(/-.*/, '');

    // ── ElevenLabs ──
    if (engine === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 400 });

      const selectedVoice = voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Sarah default
      const selectedModel = model || 'eleven_flash_v2_5';
      const elLangCode = EL_LANG_CODES[lang2] || undefined;
      const TONAL = new Set(['th', 'zh', 'vi', 'ja']);
      const stability = TONAL.has(lang2) ? 0.75 : 0.65;

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text: trimmed,
          model_id: selectedModel,
          language_code: elLangCode,
          voice_settings: { stability, similarity_boost: TONAL.has(lang2) ? 0.85 : 0.80, style: 0.0, use_speaker_boost: true }
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown');
        return NextResponse.json({ error: `ElevenLabs ${response.status}: ${errText}` }, { status: response.status });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return new NextResponse(buffer, {
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
      });
    }

    // ── OpenAI TTS ──
    if (engine === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 400 });

      const openai = new OpenAI({ apiKey });
      const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voiceId) ? voiceId : 'nova';
      const instructions = TTS_INSTRUCTIONS[lang2] || TTS_INSTRUCTIONS['en'];

      const response = await openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice: selectedVoice,
        input: trimmed,
        instructions,
        response_format: 'mp3',
        speed: 1.0
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return new NextResponse(buffer, {
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
      });
    }

    // ── Edge TTS (Free) ──
    if (engine === 'edge') {
      let EdgeTTS;
      try {
        const mod = await import('edge-tts-universal');
        EdgeTTS = mod.default || mod.EdgeTTS || mod;
      } catch (e) {
        return NextResponse.json({ error: 'Edge TTS not available' }, { status: 503 });
      }

      const voiceName = getEdgeVoice(langCode || 'en', gender || 'female');
      const tts = new EdgeTTS();
      await tts.synthesize(trimmed, voiceName, { rate: '+0%', volume: '+0%', pitch: '+0Hz' });
      const audioBuffer = await tts.toBuffer();

      if (!audioBuffer || audioBuffer.length === 0) {
        return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
      }

      return new NextResponse(audioBuffer, {
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': audioBuffer.length.toString() }
      });
    }

    return NextResponse.json({ error: 'Invalid engine. Use: elevenlabs, openai, edge' }, { status: 400 });
  } catch (e) {
    console.error('TTS test error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

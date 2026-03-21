import { NextResponse } from 'next/server';
import { getEdgeVoice } from '../../lib/edgeVoices.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';

// ═══════════════════════════════════════════════
// Edge TTS — FREE Neural Text-to-Speech
//
// Uses Microsoft Edge's neural TTS voices via edge-tts-universal.
// No API key needed, no cost, high quality neural voices for ALL 25 languages.
// This replaces browser speechSynthesis for the FREE tier.
//
// Quality: ★★★★☆ (comparable to paid neural TTS)
// Latency: ~100-300ms
// Cost: FREE
// Languages: ALL 25 supported languages
// ═══════════════════════════════════════════════

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 60;       // requests per minute
const RATE_WINDOW = 60000;   // 1 minute in ms

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

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 120000);

export async function POST(req) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { text, langCode, gender } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Preprocess text for TTS quality
    const lang2 = (langCode || '').replace(/-.*/, ''); // 'en-US' → 'en'
    const cleanText = preprocessForTTS(text, lang2);

    // Limit text length (Edge TTS handles up to ~5000 chars well)
    const trimmed = cleanText.substring(0, 5000);

    // Get voice for language + gender preference
    const voiceName = getEdgeVoice(langCode || 'en', gender || 'female');

    // Dynamic import to handle if package is missing gracefully
    let EdgeTTSClass;
    try {
      const mod = await import('edge-tts-universal');
      EdgeTTSClass = mod.EdgeTTS || mod.default || mod;
    } catch (e) {
      console.error('[EdgeTTS] Package not available:', e.message);
      return NextResponse.json({ error: 'Edge TTS not available' }, { status: 503 });
    }

    // ── Language-specific speech rate (from voiceDefaults.js) ──
    const { getEdgeRateForLang } = await import('../../lib/voiceDefaults.js');
    const speechRate = getEdgeRateForLang(lang2);

    // Generate audio — edge-tts-universal API: new EdgeTTS(text, voice, opts)
    let audioBuffer;
    try {
      const tts = new EdgeTTSClass(trimmed, voiceName, {
        rate: speechRate,
        volume: '+0%',
        pitch: '+0Hz',
      });
      const result = await tts.synthesize();
      // result.audio is a Blob/File — convert to Buffer
      if (result?.audio?.arrayBuffer) {
        audioBuffer = Buffer.from(await result.audio.arrayBuffer());
      } else if (Buffer.isBuffer(result?.audio)) {
        audioBuffer = result.audio;
      } else if (result?.audio) {
        audioBuffer = Buffer.from(result.audio);
      }
    } catch (synthErr) {
      console.error('[EdgeTTS] Synthesize error, trying Communicate fallback:', synthErr.message);
      // Fallback: use Communicate streaming API
      try {
        const mod2 = await import('edge-tts-universal');
        const Communicate = mod2.Communicate || mod2.default?.Communicate;
        if (Communicate) {
          const comm = new Communicate(trimmed, { voice: voiceName, rate: speechRate });
          const chunks = [];
          for await (const chunk of comm.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
              chunks.push(Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data));
            }
          }
          audioBuffer = Buffer.concat(chunks);
        }
      } catch (commErr) {
        console.error('[EdgeTTS] Communicate fallback also failed:', commErr.message);
      }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24h
      }
    });
  } catch (e) {
    console.error('[EdgeTTS] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

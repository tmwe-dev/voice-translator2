import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getEdgeVoice } from '../../lib/edgeVoices.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';

// ═══════════════════════════════════════════════
// Edge TTS — FREE Neural Text-to-Speech
//
// Uses Microsoft Edge's neural TTS voices via @andresaya/edge-tts.
// No API key needed, no cost, high quality neural voices for ALL 25 languages.
//
// Quality: ★★★★☆ (comparable to paid neural TTS)
// Latency: ~100-300ms
// Cost: FREE
// Languages: ALL 25 supported languages
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {

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

    // ── Language-specific speech rate (from voiceDefaults.js) ──
    const { getEdgeRateForLang } = await import('../../lib/voiceDefaults.js');
    const speechRate = getEdgeRateForLang(lang2);

    // Dynamic import for graceful fallback
    let EdgeTTS;
    try {
      const mod = await import('@andresaya/edge-tts');
      EdgeTTS = mod.EdgeTTS || mod.default?.EdgeTTS || mod.default;
    } catch (e) {
      console.error('[EdgeTTS] @andresaya/edge-tts not available:', e.message);
      return NextResponse.json({ error: 'Edge TTS not available' }, { status: 503 });
    }

    // Generate audio — @andresaya/edge-tts API:
    // const tts = new EdgeTTS(); await tts.synthesize(text, voice, opts); tts.toBuffer()
    let audioBuffer;
    try {
      const tts = new EdgeTTS();
      await tts.synthesize(trimmed, voiceName, {
        rate: speechRate,
        volume: '+0%',
        pitch: '+0Hz',
      });
      audioBuffer = tts.toBuffer();
    } catch (synthErr) {
      console.error('[EdgeTTS] Synthesize error:', synthErr.message);
      return NextResponse.json({ error: 'Edge TTS synthesis failed: ' + synthErr.message }, { status: 503 });
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 503 });
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

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'tts-edge' });

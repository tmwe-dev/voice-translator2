import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getEdgeVoice } from '../../lib/edgeVoices.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';

// ═══════════════════════════════════════════════
// Edge TTS — FREE Neural Text-to-Speech
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {
    const { text, langCode, gender } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const lang2 = (langCode || '').replace(/-.*/, '');
    const cleanText = preprocessForTTS(text, lang2);
    const trimmed = cleanText.substring(0, 5000);
    const voiceName = getEdgeVoice(langCode || 'en', gender || 'female');

    const { getEdgeRateForLang } = await import('../../lib/voiceDefaults.js');
    const speechRate = getEdgeRateForLang(lang2);

    // Dynamic import
    let EdgeTTS;
    try {
      const mod = await import('@andresaya/edge-tts');
      EdgeTTS = mod.EdgeTTS || mod.default?.EdgeTTS || mod.default;
    } catch (e) {
      console.error('[EdgeTTS] import failed:', e.message, e.stack);
      return NextResponse.json({ error: 'Edge TTS not available: ' + e.message }, { status: 503 });
    }

    if (!EdgeTTS) {
      console.error('[EdgeTTS] EdgeTTS class is undefined after import');
      return NextResponse.json({ error: 'EdgeTTS class undefined' }, { status: 503 });
    }

    // Generate audio
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
      console.error('[EdgeTTS] Synthesize FULL error:', synthErr.message, '| Stack:', synthErr.stack);
      return NextResponse.json({
        error: 'Edge TTS synthesis failed',
        detail: synthErr.message,
        stack: synthErr.stack?.split('\n').slice(0, 5).join('\n')
      }, { status: 503 });
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 503 });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch (e) {
    console.error('[EdgeTTS] Top-level error:', e.message, e.stack);
    return NextResponse.json({ error: e.message, stack: e.stack?.split('\n').slice(0, 5).join('\n') }, { status: 500 });
  }
}

// GET /api/tts-edge?test=1 — diagnostic endpoint
export async function GET(req) {
  const checks = {
    timestamp: new Date().toISOString(),
    cryptoSubtle: typeof globalThis?.crypto?.subtle !== 'undefined',
    cryptoAvailable: typeof globalThis?.crypto !== 'undefined',
  };

  try {
    const mod = await import('@andresaya/edge-tts');
    checks.importOk = true;
    checks.exports = Object.keys(mod);
    const EdgeTTS = mod.EdgeTTS || mod.default?.EdgeTTS || mod.default;
    checks.edgeTTSClass = !!EdgeTTS;
    checks.edgeTTSType = typeof EdgeTTS;

    if (EdgeTTS) {
      const tts = new EdgeTTS();
      checks.instanceOk = true;
      checks.methods = Object.getOwnPropertyNames(Object.getPrototypeOf(tts)).filter(m => m !== 'constructor');

      // Quick synth test
      try {
        await tts.synthesize('test', 'en-US-AriaNeural', { rate: '+0%', volume: '+0%', pitch: '+0Hz' });
        const buf = tts.toBuffer();
        checks.synthOk = true;
        checks.audioBytes = buf?.length || 0;
      } catch (synthErr) {
        checks.synthOk = false;
        checks.synthError = synthErr.message;
        checks.synthStack = synthErr.stack?.split('\n').slice(0, 5);
      }
    }
  } catch (importErr) {
    checks.importOk = false;
    checks.importError = importErr.message;
    checks.importStack = importErr.stack?.split('\n').slice(0, 5);
  }

  return NextResponse.json(checks, { status: checks.synthOk ? 200 : 503 });
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'tts-edge' });

import { NextResponse } from 'next/server';
import { getSession, getUser } from '../../lib/users.js';

// ElevenLabs TTS API
// POST /api/tts-elevenlabs
// Body: { text, voiceId, userToken }
// Returns: audio/mpeg stream

// ElevenLabs pricing: ~$0.30 per 1K chars (Creator plan overage)
// Much higher quality than OpenAI TTS-1, with voice cloning support

// Default voices by language (curated for natural conversation)
const DEFAULT_VOICES = {
  'it': 'EXAVITQu4vr4xnSDxMaL',  // Sarah - warm female
  'en': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'es': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'fr': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'de': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'pt': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'zh': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'ja': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'ko': 'EXAVITQu4vr4xnSDxMaL',  // Sarah
  'default': 'EXAVITQu4vr4xnSDxMaL' // Sarah
};

export async function POST(req) {
  try {
    const { text, voiceId, langCode, userToken } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Resolve ElevenLabs API key
    let apiKey = process.env.ELEVENLABS_API_KEY || null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        const user = await getUser(session.email);
        if (user?.useOwnKeys && user.apiKeys?.elevenlabs) {
          apiKey = user.apiKeys.elevenlabs;
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No ElevenLabs API key configured' }, { status: 400 });
    }

    // Choose voice: explicit voiceId > user preference > language default
    const selectedVoice = voiceId || DEFAULT_VOICES[langCode] || DEFAULT_VOICES.default;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs TTS error:', response.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status}`, details: errText },
        { status: response.status }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString()
      }
    });
  } catch (e) {
    console.error('ElevenLabs TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/tts-elevenlabs?action=voices - List available voices
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userToken = searchParams.get('token');

    if (action !== 'voices') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Resolve API key
    let apiKey = process.env.ELEVENLABS_API_KEY || null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        const user = await getUser(session.email);
        if (user?.useOwnKeys && user.apiKeys?.elevenlabs) {
          apiKey = user.apiKeys.elevenlabs;
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No ElevenLabs API key' }, { status: 400 });
    }

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch voices' }, { status: res.status });
    }

    const data = await res.json();
    // Return simplified voice list
    const voices = (data.voices || []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category, // premade, cloned, generated
      labels: v.labels || {},
      preview: v.preview_url || null
    }));

    return NextResponse.json({ voices });
  } catch (e) {
    console.error('ElevenLabs voices error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSession, getUser, deductCredits } from '../../lib/users.js';
import { getRoom } from '../../lib/store.js';

// ElevenLabs pricing: ~$0.30 per 1K characters (Creator plan)
const EL_PER_CHAR_USD = 0.0003;
const USD_TO_EUR_CENTS = 92;

// Default voices by language
const DEFAULT_VOICES = {
  'it': 'EXAVITQu4vr4xnSDxMaL',
  'en': 'EXAVITQu4vr4xnSDxMaL',
  'es': 'EXAVITQu4vr4xnSDxMaL',
  'fr': 'EXAVITQu4vr4xnSDxMaL',
  'de': 'EXAVITQu4vr4xnSDxMaL',
  'pt': 'EXAVITQu4vr4xnSDxMaL',
  'zh': 'EXAVITQu4vr4xnSDxMaL',
  'ja': 'EXAVITQu4vr4xnSDxMaL',
  'ko': 'EXAVITQu4vr4xnSDxMaL',
  'default': 'EXAVITQu4vr4xnSDxMaL'
};

export async function POST(req) {
  try {
    const { text, voiceId, langCode, userToken, roomId } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Resolve ElevenLabs API key and billing
    let apiKey = process.env.ELEVENLABS_API_KEY || null;
    let isOwnKey = false;
    let billingEmail = null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        billingEmail = session.email;
        const user = await getUser(billingEmail);
        if (user) {
          if (user.useOwnKeys && user.apiKeys?.elevenlabs) {
            apiKey = user.apiKeys.elevenlabs;
            isOwnKey = true;
          } else if (!user.useOwnKeys && user.credits < 2) {
            // ElevenLabs is expensive - require at least 2 eurocent credits
            return NextResponse.json({ error: 'Credito esaurito' }, { status: 402 });
          }
        }
      }
    } else if (roomId) {
      // Guest in a room - bill to host
      const room = await getRoom(roomId);
      if (!room || room.hostTier !== 'TOP PRO') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (room.hostEmail) {
        billingEmail = room.hostEmail;
        const hostUser = await getUser(billingEmail);
        if (hostUser) {
          if (hostUser.useOwnKeys && hostUser.apiKeys?.elevenlabs) {
            apiKey = hostUser.apiKeys.elevenlabs;
            isOwnKey = true;
          } else if (!hostUser.useOwnKeys && hostUser.credits < 2) {
            return NextResponse.json({ error: 'Host credits exhausted' }, { status: 402 });
          }
        }
      }
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'No ElevenLabs API key configured' }, { status: 400 });
    }

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

    // Calculate and deduct cost
    const elCostUsd = text.trim().length * EL_PER_CHAR_USD;
    const elCostEurCents = elCostUsd * USD_TO_EUR_CENTS;

    if (billingEmail && !isOwnKey) {
      try {
        await deductCredits(billingEmail, Math.max(1, elCostEurCents));
      } catch (e) { console.error('ElevenLabs credit deduct error:', e); }
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

// GET /api/tts-elevenlabs?action=voices - List available voices (requires auth)
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userToken = searchParams.get('token');

    if (action !== 'voices') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!userToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Resolve API key
    let apiKey = process.env.ELEVENLABS_API_KEY || null;

    const session = await getSession(userToken);
    if (session) {
      const user = await getUser(session.email);
      if (user?.useOwnKeys && user.apiKeys?.elevenlabs) {
        apiKey = user.apiKeys.elevenlabs;
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
    const voices = (data.voices || []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels || {},
      preview: v.preview_url || null
    }));

    return NextResponse.json({ voices });
  } catch (e) {
    console.error('ElevenLabs voices error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

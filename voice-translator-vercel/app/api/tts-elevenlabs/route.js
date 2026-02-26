import { NextResponse } from 'next/server';
import { deductCredits } from '../../lib/users.js';
import { getSession, getUser } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcElevenLabsCost, usdToEurCents } from '../../lib/config.js';

// Languages NOT supported by eleven_multilingual_v2 (need v3 or flash_v2_5)
const V3_ONLY_LANGS = new Set(['th', 'vi', 'hu']);

// ElevenLabs language_code mapping (ISO 639-1 → ElevenLabs code)
const LANG_CODES = {
  'it':'it', 'en':'en', 'es':'es', 'fr':'fr', 'de':'de', 'pt':'pt',
  'zh':'zh', 'ja':'ja', 'ko':'ko', 'ar':'ar', 'hi':'hi', 'ru':'ru',
  'tr':'tr', 'id':'id', 'ms':'ms', 'nl':'nl', 'pl':'pl', 'sv':'sv',
  'el':'el', 'cs':'cs', 'ro':'ro', 'fi':'fi', 'th':'th', 'vi':'vi', 'hu':'hu'
};

// Default curated voices per avatar gender (ElevenLabs premade voice IDs)
// Male voices:
const MALE_VOICES = {
  default: 'pNInz6obpgDQGcFmaJgB', // Adam - deep male
  alt1: 'ErXwobaYiN019PkySvjV',    // Antoni - warm male
  alt2: 'TxGEqnHWrfWFTfGW9XjX',    // Josh - young male
  alt3: 'VR6AewLTigWG4xSOukaG',    // Arnold - strong male
  alt4: 'GBv7mTt0atIp3Br8iCZE',    // Thomas - calm male
  alt5: '29vD33N1CtxCmqQRPOHJ',    // Drew - confident male
};

// Female voices:
const FEMALE_VOICES = {
  default: 'EXAVITQu4vr4xnSDxMaL', // Sarah/Bella - warm female
  alt1: '21m00Tcm4TlvDq8ikWAM',    // Rachel - natural female
  alt2: 'XB0fDUnXU5powFXDhCwa',    // Charlotte - elegant female
  alt3: 'piTKgcLEGmPE4e6mEKli',    // Nicole - friendly female
  alt4: 'MF3mGyEYCl7XYWbV9V6O',    // Elli - soft female
};

// Avatar name → voice mapping
// Marcus=male, Elena=female, Omar=male, Aisha=female, Alex=male,
// Thomas=male, Yuki=female, Margaret=female, Leo=male
const AVATAR_VOICE_MAP = {
  'Marcus':   MALE_VOICES.default,   // Adam - deep, authoritative
  'Elena':    FEMALE_VOICES.default,  // Sarah - warm, natural
  'Omar':     MALE_VOICES.alt1,       // Antoni - warm
  'Aisha':    FEMALE_VOICES.alt1,     // Rachel - natural
  'Alex':     MALE_VOICES.alt2,       // Josh - young
  'Thomas':   MALE_VOICES.alt4,       // Thomas - calm
  'Yuki':     FEMALE_VOICES.alt2,     // Charlotte - elegant
  'Margaret': FEMALE_VOICES.alt3,     // Nicole - friendly
  'Leo':      MALE_VOICES.alt5,       // Drew - confident
};

export async function POST(req) {
  try {
    const { text, voiceId, langCode, userToken, roomId, avatarName } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject (TOP PRO only for guests)
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'elevenlabs',
      minCredits: MIN_CREDITS.TTS_ELEVENLABS,
      requiredHostTier: 'TOP PRO',
    });

    // Voice selection priority: explicit voiceId → avatar mapping → default
    const selectedVoice = voiceId
      || (avatarName && AVATAR_VOICE_MAP[avatarName])
      || FEMALE_VOICES.default;

    // Choose model: v3 for Thai/Vietnamese/Hungarian, multilingual_v2 for others
    const lang2 = (langCode || '').replace(/-.*/, ''); // 'th-TH' → 'th'
    const modelId = V3_ONLY_LANGS.has(lang2) ? 'eleven_v3' : 'eleven_multilingual_v2';

    // Map language code for pronunciation
    const elLangCode = LANG_CODES[lang2] || undefined;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        language_code: elLangCode,
        voice_settings: {
          stability: 0.65,
          similarity_boost: 0.80,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs TTS error:', response.status, errText);

      // If v3 fails, fallback to multilingual_v2
      if (modelId === 'eleven_v3') {
        console.log('v3 failed, trying multilingual_v2 fallback');
        const fallback = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text: text.trim(), model_id: 'eleven_multilingual_v2',
            language_code: elLangCode,
            voice_settings: { stability: 0.65, similarity_boost: 0.80, style: 0.0, use_speaker_boost: true }
          })
        });
        if (fallback.ok) {
          const buf = Buffer.from(await fallback.arrayBuffer());
          // Deduct cost
          if (billingEmail && !isOwnKey) {
            const cost = usdToEurCents(calcElevenLabsCost(text.trim().length));
            const charge1 = Math.max(MIN_CHARGE.TTS_ELEVENLABS, cost);
            try { await deductCredits(billingEmail, charge1); await trackDailySpend(billingEmail, charge1); } catch {}
          }
          return new NextResponse(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length.toString() } });
        }
      }

      return NextResponse.json(
        { error: `ElevenLabs error: ${response.status}`, details: errText },
        { status: response.status }
      );
    }

    // Calculate and deduct cost
    const elCostUsd = calcElevenLabsCost(text.trim().length);
    const elCostEurCents = usdToEurCents(elCostUsd);

    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.TTS_ELEVENLABS, elCostEurCents);
        await deductCredits(billingEmail, charge);
        await trackDailySpend(billingEmail, charge);
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
    if (e instanceof NextResponse) return e;
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
      preview: v.preview_url || null,
      language: v.labels?.language || null,
      accent: v.labels?.accent || null,
      gender: v.labels?.gender || null,
      age: v.labels?.age || null,
      useCase: v.labels?.use_case || v.labels?.['use case'] || null,
    }));

    // Also return our avatar mapping for the frontend
    return NextResponse.json({ voices, avatarVoiceMap: AVATAR_VOICE_MAP });
  } catch (e) {
    console.error('ElevenLabs voices error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

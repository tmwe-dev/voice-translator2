import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { deductCredits } from '../../lib/users.js';
import { getSession, getUser } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcElevenLabsCost, usdToEurCents } from '../../lib/config.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';

// ═══════════════════════════════════════════════
// FASE 4: ElevenLabs Flash v2.5 + adaptive stability
//
// Model hierarchy (by latency):
// 1. eleven_flash_v2_5 — 75ms latency, great quality, DEFAULT
// 2. eleven_multilingual_v2 — ~300ms latency, broader language support
// 3. eleven_v3 — latest, best for uncommon languages
//
// Languages NOT supported by flash_v2_5 (need v3 or multilingual_v2)
// ═══════════════════════════════════════════════
const V3_ONLY_LANGS = new Set(['th', 'vi', 'hu']);
// Languages where Flash v2.5 works well (Latin + common Asian)
const FLASH_SUPPORTED_LANGS = new Set([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'sv', 'tr',
  'id', 'ms', 'cs', 'ro', 'fi', 'el', 'ru',
  'zh', 'ja', 'ko', 'ar', 'hi'
]);

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
const AVATAR_VOICE_MAP = {
  'Marcus':   MALE_VOICES.default,
  'Elena':    FEMALE_VOICES.default,
  'Omar':     MALE_VOICES.alt1,
  'Aisha':    FEMALE_VOICES.alt1,
  'Alex':     MALE_VOICES.alt2,
  'Thomas':   MALE_VOICES.alt4,
  'Yuki':     FEMALE_VOICES.alt2,
  'Margaret': FEMALE_VOICES.alt3,
  'Leo':      MALE_VOICES.alt5,
};

// ═══════════════════════════════════════════════
// AUTO VOICE-LANGUAGE MATCHING — curated native voices per language
//
// When no explicit voiceId is selected, the system picks a native-sounding
// voice for the TARGET language. This ensures Thai text is read by a
// Thai-sounding voice, not an English one.
//
// These are ElevenLabs premade voices that sound natural for each language.
// Female + male options for each. Falls back to multilingual defaults.
// ═══════════════════════════════════════════════
const NATIVE_VOICES_BY_LANG = {
  'en': { female: 'EXAVITQu4vr4xnSDxMaL', male: 'pNInz6obpgDQGcFmaJgB' },  // Sarah / Adam
  'it': { female: 'EXAVITQu4vr4xnSDxMaL', male: 'ErXwobaYiN019PkySvjV' },  // Sarah / Antoni
  'es': { female: 'XB0fDUnXU5powFXDhCwa', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Charlotte / Josh
  'fr': { female: 'XB0fDUnXU5powFXDhCwa', male: 'GBv7mTt0atIp3Br8iCZE' },  // Charlotte / Thomas
  'de': { female: 'piTKgcLEGmPE4e6mEKli', male: 'GBv7mTt0atIp3Br8iCZE' },  // Nicole / Thomas
  'pt': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni
  'zh': { female: 'XB0fDUnXU5powFXDhCwa', male: 'pNInz6obpgDQGcFmaJgB' },  // Charlotte / Adam
  'ja': { female: 'piTKgcLEGmPE4e6mEKli', male: 'GBv7mTt0atIp3Br8iCZE' },  // Nicole / Thomas
  'ko': { female: 'MF3mGyEYCl7XYWbV9V6O', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Elli / Josh
  'th': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni (multilingual)
  'vi': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni (multilingual)
  'ar': { female: 'XB0fDUnXU5powFXDhCwa', male: 'pNInz6obpgDQGcFmaJgB' },  // Charlotte / Adam
  'hi': { female: '21m00Tcm4TlvDq8ikWAM', male: 'ErXwobaYiN019PkySvjV' },  // Rachel / Antoni
  'ru': { female: 'piTKgcLEGmPE4e6mEKli', male: 'VR6AewLTigWG4xSOukaG' },  // Nicole / Arnold
  'tr': { female: 'EXAVITQu4vr4xnSDxMaL', male: '29vD33N1CtxCmqQRPOHJ' },  // Sarah / Drew
  'nl': { female: 'XB0fDUnXU5powFXDhCwa', male: 'GBv7mTt0atIp3Br8iCZE' },  // Charlotte / Thomas
  'pl': { female: 'piTKgcLEGmPE4e6mEKli', male: 'VR6AewLTigWG4xSOukaG' },  // Nicole / Arnold
  'sv': { female: 'MF3mGyEYCl7XYWbV9V6O', male: 'TxGEqnHWrfWFTfGW9XjX' },  // Elli / Josh
};

async function handlePost(req) {
  try {
    const { text, voiceId, langCode, userToken, roomId, avatarName } = await req.json();
    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject
    // Any PRO user with credits can use ElevenLabs (platform key), not just TOP PRO
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'elevenlabs',
      minCredits: MIN_CREDITS.TTS_ELEVENLABS,
    });

    // ── Voice selection priority ──
    // 1. Explicit voiceId (user chose a specific voice or cloned voice)
    // 2. Native voice for target language (auto-matching — best experience)
    // 3. Avatar mapping (personality-based default)
    // 4. Global female default
    const lang2 = (langCode || '').replace(/-.*/, '');
    const genderHint = avatarName
      ? (['Marcus','Omar','Alex','Thomas','Leo'].includes(avatarName) ? 'male' : 'female')
      : 'female';
    const nativeVoice = NATIVE_VOICES_BY_LANG[lang2]?.[genderHint]
      || NATIVE_VOICES_BY_LANG[lang2]?.female;
    const selectedVoice = voiceId
      || nativeVoice
      || (avatarName && AVATAR_VOICE_MAP[avatarName])
      || FEMALE_VOICES.default;

    // ── FASE 4: Model selection with Flash v2.5 as default ──
    let modelId;

    // If using a cloned voice, use multilingual model for best quality
    const isClonedVoice = voiceId && !Object.values(MALE_VOICES).includes(voiceId)
      && !Object.values(FEMALE_VOICES).includes(voiceId);

    if (isClonedVoice) {
      modelId = 'eleven_multilingual_v2'; // Best quality for cloned voices
    } else if (V3_ONLY_LANGS.has(lang2)) {
      modelId = 'eleven_v3';
    } else if (FLASH_SUPPORTED_LANGS.has(lang2)) {
      modelId = 'eleven_flash_v2_5'; // 75ms latency — 4x faster than multilingual_v2
    } else {
      modelId = 'eleven_multilingual_v2'; // fallback for any unlisted language
    }

    // Map language code for pronunciation
    const elLangCode = LANG_CODES[lang2] || undefined;

    // Preprocess text for TTS quality
    const cleanText = preprocessForTTS(text, lang2);

    // ── Adaptive voice settings for tonal languages ──
    // Tonal languages need higher stability to preserve tone accuracy
    const TONAL_LANGS = new Set(['th', 'zh', 'vi', 'ja']);
    const stability = TONAL_LANGS.has(lang2) ? 0.75 : 0.65;
    const similarityBoost = TONAL_LANGS.has(lang2) ? 0.85 : 0.80;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        language_code: elLangCode,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      console.error('ElevenLabs TTS error:', response.status, errText);

      // Fallback chain: flash_v2_5 → multilingual_v2 → v3, or v3 → multilingual_v2
      const fallbackModel = modelId === 'eleven_v3' ? 'eleven_multilingual_v2'
        : modelId === 'eleven_flash_v2_5' ? 'eleven_multilingual_v2'
        : null;

      if (fallbackModel) {
        console.log(`${modelId} failed, trying ${fallbackModel} fallback`);
        const fallback = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text: cleanText, model_id: fallbackModel,
            language_code: elLangCode,
            voice_settings: { stability, similarity_boost: similarityBoost, style: 0.0, use_speaker_boost: true }
          })
        });
        if (fallback.ok) {
          const buf = Buffer.from(await fallback.arrayBuffer());
          if (billingEmail && !isOwnKey) {
            const cost = usdToEurCents(calcElevenLabsCost(cleanText.length));
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
    const elCostUsd = calcElevenLabsCost(cleanText.length);
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
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const userToken = searchParams.get('token');

    if (action !== 'voices') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Resolve API key — allow test center access without token (uses platform key)
    const source = searchParams.get('source');
    let apiKey = process.env.ELEVENLABS_API_KEY || null;

    if (userToken) {
      // Authenticated user — check for own key
      const session = await getSession(userToken);
      if (session) {
        const user = await getUser(session.email);
        if (user?.useOwnKeys && user.apiKeys?.elevenlabs) {
          apiKey = user.apiKeys.elevenlabs;
        }
      }
    } else if (source !== 'testcenter') {
      // No token and not test center — reject
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'tts-elevenlabs' });
export const GET = withApiGuard(handleGet, { maxRequests: 30, prefix: 'tts-elevenlabs', skipBodyCheck: true });

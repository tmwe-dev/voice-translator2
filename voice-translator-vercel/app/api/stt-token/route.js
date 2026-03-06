import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';

// ═══════════════════════════════════════════════
// STT Token endpoint — generates temporary Deepgram API key
// for client-side WebSocket streaming transcription
//
// Requires: DEEPGRAM_API_KEY env var
// Rate limit: 10 req/min (one per recording session)
// ═══════════════════════════════════════════════

async function handler(req) {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    return NextResponse.json(
      { error: 'Streaming STT not configured. Set DEEPGRAM_API_KEY.' },
      { status: 503 }
    );
  }

  try {
    // Request a temporary key from Deepgram (valid for short time)
    const res = await fetch('https://api.deepgram.com/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'VoiceTranslate streaming STT',
        // Temporary key: expires in 60 seconds
        time_to_live_in_seconds: 60,
        scopes: ['usage:write'],
      }),
    });

    if (!res.ok) {
      // Fallback: return the main key directly (less secure but works)
      // Some Deepgram plans don't support temporary keys
      console.warn('[STT-Token] Temporary key creation failed, using direct key');
      return NextResponse.json({
        key: deepgramKey,
        temporary: false,
        expiresIn: null,
      });
    }

    const data = await res.json();
    return NextResponse.json({
      key: data.key || deepgramKey,
      temporary: !!data.key,
      expiresIn: 60,
    });
  } catch (e) {
    console.error('[STT-Token] Error:', e);
    // Fallback: return main key
    return NextResponse.json({
      key: deepgramKey,
      temporary: false,
      expiresIn: null,
    });
  }
}

export const POST = withApiGuard(handler, {
  maxRequests: 10,
  prefix: 'stt-token',
});

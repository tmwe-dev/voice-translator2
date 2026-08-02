import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('sttToken');

// ═══════════════════════════════════════════════
// STT Token endpoint — generates temporary Deepgram API key
// for client-side WebSocket streaming transcription
//
// Requires: DEEPGRAM_API_KEY env var
// Rate limit: 10 req/min (one per recording session)
// ═══════════════════════════════════════════════

async function handler(req) {
  // Auth guard: require room session token or user token
  try {
    const body = await req.clone().json().catch(() => ({}));
    const hasRoomToken = !!body.roomSessionToken;
    const hasUserToken = !!body.userToken;
    if (!hasRoomToken && !hasUserToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
  } catch { /* allow if body parse fails — rate limit will catch abuse */ }

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
        comment: 'BarTalk streaming STT',
        // Temporary key: expires in 60 seconds
        time_to_live_in_seconds: 60,
        scopes: ['usage:write'],
      }),
    });

    if (!res.ok) {
      log.warn('Temporary key creation failed:', res.status);
      return NextResponse.json(
        { error: 'Temporary STT key creation failed. Streaming STT unavailable.' },
        { status: 503 }
      );
    }

    const data = await res.json();
    if (!data.key) {
      return NextResponse.json(
        { error: 'No temporary key returned from Deepgram.' },
        { status: 503 }
      );
    }
    return NextResponse.json({
      key: data.key,
      temporary: true,
      expiresIn: 60,
    });
  } catch (e) {
    log.error('Error:', e.message);
    return NextResponse.json(
      { error: 'STT token generation failed.' },
      { status: 503 }
    );
  }
}

export const POST = withApiGuard(handler, {
  maxRequests: 10,
  prefix: 'stt-token',
});

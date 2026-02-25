import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getSession, getUser, deductCredits } from '../../lib/users.js';
import { getRoom } from '../../lib/store.js';

// OpenAI TTS-1 pricing: $0.015 per 1K characters
const TTS_PER_CHAR_USD = 0.000015;
const USD_TO_EUR_CENTS = 92;

export async function POST(req) {
  try {
    const { text, voice, userToken, roomId } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Determine API key and billing
    let apiKey = process.env.OPENAI_API_KEY;
    let isOwnKey = false;
    let billingEmail = null;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        billingEmail = session.email;
        const user = await getUser(billingEmail);
        if (user) {
          if (user.useOwnKeys && user.apiKeys?.openai) {
            apiKey = user.apiKeys.openai;
            isOwnKey = true;
          } else if (!user.useOwnKeys && user.credits < 0.5) {
            return NextResponse.json({ error: 'Credito esaurito' }, { status: 402 });
          }
        }
      }
    } else if (roomId) {
      // Guest in a room - bill to host
      const room = await getRoom(roomId);
      if (!room || room.hostTier === 'FREE') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (room.hostEmail) {
        billingEmail = room.hostEmail;
        const hostUser = await getUser(billingEmail);
        if (hostUser) {
          if (hostUser.useOwnKeys && hostUser.apiKeys?.openai) {
            apiKey = hostUser.apiKeys.openai;
            isOwnKey = true;
          } else if (!hostUser.useOwnKeys && hostUser.credits < 0.5) {
            return NextResponse.json({ error: 'Host credits exhausted' }, { status: 402 });
          }
        }
      }
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const openai = new OpenAI({ apiKey });
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice) ? voice : 'nova';

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: text,
      response_format: 'mp3'
    });

    // Calculate and deduct cost
    const ttsCostUsd = text.length * TTS_PER_CHAR_USD;
    const ttsCostEurCents = ttsCostUsd * USD_TO_EUR_CENTS;

    if (billingEmail && !isOwnKey) {
      try {
        await deductCredits(billingEmail, Math.max(0.3, ttsCostEurCents));
      } catch (e) { console.error('TTS credit deduct error:', e); }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
    });
  } catch (e) {
    console.error('TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { deductCredits } from '../../lib/users.js';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcTtsCost, usdToEurCents } from '../../lib/config.js';

export async function POST(req) {
  try {
    const { text, voice, userToken, roomId } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // 3-tier auth: userToken → roomId → reject
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken,
      roomId,
      provider: 'openai',
      minCredits: MIN_CREDITS.TTS_OPENAI,
    });

    const openai = new OpenAI({ apiKey });
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice) ? voice : 'nova';

    const response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: selectedVoice,
      input: text,
      response_format: 'mp3',
      speed: 1.0
    });

    // Calculate and deduct cost
    const ttsCostUsd = calcTtsCost(text.length);
    const ttsCostEurCents = usdToEurCents(ttsCostUsd);

    if (billingEmail && !isOwnKey) {
      try {
        const charge = Math.max(MIN_CHARGE.TTS_OPENAI, ttsCostEurCents);
        await deductCredits(billingEmail, charge);
        await trackDailySpend(billingEmail, charge);
      } catch (e) { console.error('TTS credit deduct error:', e); }
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

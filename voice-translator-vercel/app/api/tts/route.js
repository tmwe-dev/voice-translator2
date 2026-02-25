import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { getSession, getUser } from '../../lib/users.js';

export async function POST(req) {
  try {
    const { text, voice, userToken } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Determine API key: user's own or platform
    let apiKey = process.env.OPENAI_API_KEY;

    if (userToken) {
      const session = await getSession(userToken);
      if (session) {
        const user = await getUser(session.email);
        if (user?.useOwnKeys && user.apiKeys?.openai) {
          apiKey = user.apiKeys.openai;
        }
      }
    }

    const openai = new OpenAI({ apiKey });
    const selectedVoice = ['alloy','echo','fable','onyx','nova','shimmer'].includes(voice) ? voice : 'nova';

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: selectedVoice,
      input: text,
      response_format: 'mp3'
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() }
    });
  } catch (e) {
    console.error('TTS error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { text, voice } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

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

import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';

export async function POST(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const sourceLang = formData.get('sourceLang');
    const targetLang = formData.get('targetLang');
    const sourceLangName = formData.get('sourceLangName');
    const targetLangName = formData.get('targetLangName');

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const tempPath = join('/tmp', `audio-${Date.now()}.${ext}`);
    await writeFile(tempPath, buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'whisper-1',
      language: sourceLang,
    });
    await unlink(tempPath).catch(() => {});

    const original = transcription.text;
    if (!original.trim()) return NextResponse.json({ original: '', translated: '' });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate from ${sourceLangName} to ${targetLangName}. Output ONLY the translation. Keep it natural and conversational. Clean up filler words.`
        },
        { role: 'user', content: original }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const translated = completion.choices[0].message.content.trim();
    return NextResponse.json({ original, translated });
  } catch (e) {
    console.error('Process error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

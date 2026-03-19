import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MIN_CREDITS } from '../../lib/config.js';

/**
 * /api/transcribe — STT-only endpoint (no translation)
 *
 * Purpose: Split the Whisper path into Phase 1 (STT) + Phase 2 (translate).
 * Before this, /api/process did STT+Translate in series, blocking the client
 * for ~1.5-2.5s. Now the client gets the transcription in ~500ms and can
 * immediately send the original text to the partner (Phase 1), then translate
 * in parallel (Phase 2).
 *
 * Timeline improvement for Asian languages:
 * OLD: [upload 200ms] → [STT 500ms] → [Translate 800ms] → respond → sendMessage
 *      Partner sees text after: ~1500ms
 *
 * NEW: [upload 200ms] → [STT 500ms] → respond → sendMessage(original) immediately
 *      Partner sees original after: ~700ms (2x faster!)
 *      Then: translate in parallel → sendTranslationUpdate
 *      Partner sees translation after: ~1500ms (same as before, but original was shown 800ms earlier)
 */
async function handlePost(req) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const sourceLang = formData.get('sourceLang');
    const userToken = formData.get('userToken') || '';
    const roomId = formData.get('roomId') || '';
    const lendingCode = formData.get('lendingCode') || '';

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    // Auth: need OpenAI for STT
    const { apiKey } = await resolveAuth({
      userToken: userToken || undefined,
      roomId: roomId || undefined,
      lendingCode: lendingCode || undefined,
      provider: 'openai',
      minCredits: MIN_CREDITS.PROCESS,
    });

    const openai = new OpenAI({ apiKey });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    const tempPath = join('/tmp', `stt-${Date.now()}.${ext}`);
    await writeFile(tempPath, buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: 'gpt-4o-mini-transcribe',
      language: sourceLang || undefined,
    });
    await unlink(tempPath).catch(() => {});

    const original = (transcription.text || '').trim();

    return NextResponse.json({ original });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('[Transcribe] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'transcribe' });

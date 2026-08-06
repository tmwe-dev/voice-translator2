import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { resolveAuth } from '../../lib/apiAuth.js';
import { MIN_CREDITS } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { creditoFinito, addebitaVoce } from '../../wallet/addebita.js';

const log = createLogger('transcribe');

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
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const sourceLang = formData.get('sourceLang');
    const userToken = formData.get('userToken') || '';
    const roomId = formData.get('roomId') || '';
    const lendingCode = formData.get('lendingCode') || '';
    // Durata della registrazione in secondi (la manda il client, che la conosce)
    const durataSec = Math.min(120, Math.max(0, parseFloat(formData.get('durata')) || 0));

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    // Security: validate audio file size (max 25MB)
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 413 });
    }

    // Security: validate sourceLang format (e.g., "en", "zh-CN")
    if (sourceLang && !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(sourceLang)) {
      return NextResponse.json({ error: 'Invalid sourceLang format' }, { status: 400 });
    }

    // Auth: need OpenAI for STT
    // billingEmail = chi paga: userToken → chi parla (Community),
    // roomId → chi ha aperto la conversazione (inviti)
    const { apiKey, isOwnKey, billingEmail } = await resolveAuth({
      userToken: userToken || undefined,
      roomId: roomId || undefined,
      lendingCode: lendingCode || undefined,
      provider: 'openai',
      minCredits: MIN_CREDITS.PROCESS,
    });

    // ── Wallet: credito finito? Fermiamo PRIMA di lavorare ──
    const pagante = isOwnKey ? null : billingEmail;
    if (pagante && await creditoFinito(pagante)) {
      return NextResponse.json({ error: 'Credito esaurito', creditoEsaurito: true }, { status: 402 });
    }

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

    // ── Wallet: addebito DOPO il lavoro riuscito (mai per un errore) ──
    // Durata dal client; se manca, stima prudente dal peso dell'audio (~4KB/s opus).
    const secondi = durataSec || Math.min(120, buffer.length / 4000);
    const esito = await addebitaVoce(pagante, secondi);

    // ── b.107 · la ricevuta che sostituisce la parola del client ──
    // La traduzione che segue questa trascrizione non va riaddebitata: e
    // la seconda meta dello stesso gesto. Prima lo diceva il CLIENT, con
    // un `giaAddebitato: true` nel corpo della richiesta — cioe chiunque
    // poteva scriverlo su ogni messaggio e tradurre gratis per sempre.
    //
    // Ora lo dice il server a se stesso: qui si lascia una ricevuta
    // legata a chi paga e al testo trascritto, e /api/translate la
    // consuma UNA volta sola. Vive un minuto: il tempo di completare il
    // giro, non abbastanza per essere riusata.
    if (pagante && original) {
      try {
        const { ricevutaVoce } = await import('../../lib/ricevute.js');
        await ricevutaVoce(pagante, original);
      } catch (e) { log.warn('ricevuta non emessa:', e?.message); }
    }

    // esito 'esaurito' = questo era l'ultimo pezzo: il client ferma la sessione
    return NextResponse.json({ original, ...(esito === 'esaurito' && { creditoEsaurito: true }) });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    log.error('Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'transcribe' });

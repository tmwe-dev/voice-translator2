import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { resolveAuth, trackDailySpend } from '../../lib/apiAuth.js';
import { MIN_CREDITS, MIN_CHARGE, calcWhisperCost, usdToEurCents } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';
import { creditoFinito } from '../../wallet/addebita.js';
import { riserva, commit, release } from '../../wallet/riserva.js';
import { costoProviderCent } from '../../wallet/provider-costi.js';

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
  let riservaId = null;
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const sourceLang = formData.get('sourceLang');
    // b.334 — ascolto LIBERO (drill di pronuncia): senza lingua forzata
    // l'ASR non "autocorregge" — se dici male "sheep" scrive "ship", e noi
    // lo vediamo. Con la lingua forzata la pronuncia mediocre passava liscia.
    const libera = formData.get('libera') === '1';
    const userToken = formData.get('userToken') || '';
    const roomId = formData.get('roomId') || '';
    const lendingCode = formData.get('lendingCode') || '';
    const roomSessionToken = formData.get('roomSessionToken') || '';
    // Durata della registrazione in secondi (la manda il client, che la conosce)
    const durataSec = Math.min(120, Math.max(0, parseFloat(formData.get('durata')) || 0));

    // ── Direct mode guard ──
    // b.167 — CONFERMATO (audit esterno 15/8): qui si chiedeva solo
    // all'intestazione x-session-mode, mandata dal client. Un client
    // alterato/vecchio poteva dichiarare una modalita diversa da quella
    // vera della stanza e far transitare l'audio lo stesso. Ora si chiede
    // anche alla stanza, quando roomId/roomSessionToken sono presenti —
    // per un client onesto non cambia niente (la richiesta in Diretta non
    // parte nemmeno), cambia per chi mente.
    try {
      await assertElaborazioneConsentita(req, { roomId, roomSessionToken });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    if (!audioFile) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    // Security: validate audio file size (max 25MB)
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 413 });
    }

    // Security: validate sourceLang format (e.g., "en", "zh-CN", "fil")
    // b.166 — CONFERMATO (caccia al tesoro): questo regex era rimasto a
    // 2 sole lettere mentre schemas.js (LANG_CODE_RE) fu allargato a 2-3
    // per supportare 'fil' (Filipino, b.110) — la correzione non era mai
    // arrivata qui. Un utente filippino otteneva 400 su ogni messaggio
    // vocale. Allineato allo stesso pattern di schemas.js.
    if (sourceLang && !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(sourceLang)) {
      return NextResponse.json({ error: 'Invalid sourceLang format' }, { status: 400 });
    }

    // Auth: need OpenAI for STT
    // billingEmail = chi paga: userToken → chi parla (Community),
    // roomId → chi ha aperto la conversazione (inviti)
    const { apiKey, isOwnKey, billingEmail, riservatoUtenteCents, riservatoPiattaformaCents } = await resolveAuth({
      userToken: userToken || undefined,
      roomId: roomId || undefined,
      roomSessionToken: roomSessionToken || undefined,
      lendingCode: lendingCode || undefined,
      provider: 'openai',
      minCredits: MIN_CREDITS.PROCESS,
    });

    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ── Wallet: RISERVA prima di chiamare il fornitore ──
    // b.161 — CONFERMATO (quarto audit esterno, punto 1): qui c'era solo
    // `creditoFinito` (saldo>0), mai un controllo sul costo vero — e
    // fail-open, per il fornitore che qui costa di piu (Whisper).
    //
    // b.161-bis — CONFERMATO (quinto giro, punto 5 "Reserve → Provider →
    // Commit/Release non implementato"): il preventivo pre-chiamata
    // (creditoInsufficiente) chiudeva il bypass RIPETIBILE ma non la
    // finestra di CORSA — due richieste concorrenti leggono lo stesso
    // saldo, lo passano ENTRAMBE, e solo l'addebito finale (atomico) le
    // distingue: la seconda torna "esaurito" ma Whisper, per lei, e gia
    // stato chiamato una volta di troppo. Ora il saldo scende SUBITO,
    // atomicamente, con la riserva — prima ancora di chiamare Whisper:
    // una seconda richiesta concorrente vede gia il saldo ridotto.
    //
    // La stima usa la STESSA regola dell'addebito vero piu sotto (durata
    // dichiarata o peso dell'audio, il maggiore dei due) — per questa
    // rotta il costo e noto per intero PRIMA di chiamare Whisper (non
    // dipende dalla trascrizione), quindi riserva e commit useranno
    // sempre lo stesso numero: mai un rilascio parziale da calcolare qui.
    const pagante = isOwnKey ? null : billingEmail;
    const stimaDalPeso = Math.min(120, buffer.length / 4000);
    const costoPrevisto = Math.ceil(Math.max(durataSec, stimaDalPeso));

    if (pagante && costoPrevisto > 0) {
      const r = await riserva(pagante, costoPrevisto, {
        tipo: 'voce',
        secondi_audio: costoPrevisto,
        costo_cent: costoProviderCent(costoPrevisto, 'gpt-5.4-mini', 'edge-tts'),
      });
      if (!r.ok) {
        return NextResponse.json({ error: 'Credito insufficiente', creditoEsaurito: true }, { status: 402 });
      }
      riservaId = r.riservaId;
    }

    const openai = new OpenAI({ apiKey });

    const ext = audioFile.type?.includes('webm') ? 'webm' : audioFile.type?.includes('mp4') ? 'mp4' : 'webm';
    // b.166 — SOSPETTO plausibile (caccia al tesoro), corretto per
    // prudenza: Date.now() da solo puo ripetersi fra due richieste
    // concorrenti sulla stessa istanza serverless calda, sovrascrivendo
    // il file audio dell'altra richiesta (trascrizione sbagliata). Un id
    // casuale elimina la collisione senza cambiare nient'altro.
    const tempPath = join('/tmp', `stt-${Date.now()}-${randomUUID()}.${ext}`);
    await writeFile(tempPath, buffer);

    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: createReadStream(tempPath),
        model: 'gpt-4o-mini-transcribe',
        language: libera ? undefined : (sourceLang || undefined),
      });
    } catch (e) {
      // Whisper e' fallito: il servizio non e' stato consegnato, la
      // riserva torna INTERA nel wallet — non e' un uso, non si paga.
      //
      // b.593 — MODULO 1 (radar qualita): "corrotto o non supportato" e
      // capitato 205 volte in due settimane, ma sempre e solo per 3
      // utenti — quindi quasi certo un pattern del LORO device/browser,
      // non un difetto diffuso. Letto tutto cio che alimenta questa
      // rotta (useVoiceRecorder, useParlatoTradotto, useInterpreterMode,
      // useTranslation): nessuna causa certa trovata da codice — solo un
      // dettaglio minore (Blob rietichettato 'audio/webm' invece del
      // mimeType negoziato, innocuo nella pratica). Senza poter
      // riprodurre il device di quei 3 utenti, un fix alla cieca
      // violerebbe la regola "nessun fix senza prova". Questa riga non
      // corregge: fotografa cosa arriva DAVVERO, cosi il prossimo caso
      // (quasi certo, e ricorrente) ha il dato che oggi manca.
      log.warn('Whisper ha rifiutato l\'audio:', {
        byte: buffer.length,
        tipoDichiarato: audioFile.type || '?',
        durataSecDichiarata: durataSec,
        userAgent: req.headers.get('user-agent') || '?',
      });
      await unlink(tempPath).catch(() => {});
      if (riservaId) { await release(riservaId, 'whisper_fallito'); riservaId = null; }
      throw e;
    }
    await unlink(tempPath).catch(() => {});

    const original = (transcription.text || '').trim();

    // ── Wallet: CONFERMA la riserva DOPO il lavoro riuscito ──
    // Stesso numero della riserva (vedi commento sopra): mai un rilascio
    // parziale da calcolare per questa rotta.
    let creditoEsaurito = false;
    if (riservaId) {
      await commit(riservaId, costoPrevisto, { tipo: 'voce', secondi_audio: costoPrevisto });
      riservaId = null; // confermata: la rete di sicurezza nel catch non deve piu toccarla
      creditoEsaurito = await creditoFinito(pagante);
    }

    // b.159 — CONFERMATO: questa rotta non chiamava MAI trackDailySpend,
    // quindi il costo Whisper/STT non contava mai per il tetto di
    // spesa GIORNALIERO di piattaforma (€100/giorno) — a differenza di
    // ogni altra rotta a pagamento (translate, tts, tts-elevenlabs...).
    if (!isOwnKey) {
      const costoUsd = calcWhisperCost(buffer.length);
      const costoEurCents = usdToEurCents(costoUsd);
      // b.170 — netta la riserva fatta da resolveAuth (vedi apiAuth.js).
      trackDailySpend(billingEmail, Math.max(MIN_CHARGE.PROCESS, costoEurCents), riservatoUtenteCents, riservatoPiattaformaCents).catch(() => {});
    }

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

    return NextResponse.json({ original, ...(creditoEsaurito && { creditoEsaurito: true }) });
  } catch (e) {
    // Rete di sicurezza: qualunque errore imprevisto DOPO la riserva ma
    // PRIMA del commit deve restituire il credito, altrimenti resta
    // bloccato fino alla pulizia periodica (wallet_rilascia_riserve_scadute,
    // 10 minuti). Se la riserva era gia stata rilasciata o confermata piu
    // sopra, riservaId e' gia null e questo non fa nulla.
    if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});
    if (e instanceof NextResponse) return e;
    log.error('Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'transcribe' });

import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getEdgeVoice } from '../../lib/edgeVoices.js';
import { preprocessForTTS } from '../../lib/ttsPreprocessor.js';
import { createLogger } from '../../lib/logger.js';
import { assertElaborazioneConsentita, DirectModeError } from '../../lib/sessionGuard.js';

const log = createLogger('ttsEdge');

// ═══════════════════════════════════════════════
// Edge TTS — FREE Neural Text-to-Speech
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {
    const { text, langCode, gender, roomId, roomSessionToken } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // ── Direct mode guard ──
    // b.167 — CONFERMATO (audit esterno 15/8): questa rotta non riceveva
    // affatto roomId/roomSessionToken, quindi non poteva mai chiedere alla
    // stanza — si fidava per intero dell'intestazione x-session-mode
    // mandata dal client. Ora i tre hook che la chiamano da dentro una
    // stanza (useTTSEngine, useInterpreterMode, useStreamingInterpreter)
    // mandano anche questi due campi; le chiamate di prova senza stanza
    // (SpeakerView/VoiceTestView/PrimaProva) restano semplicemente senza
    // roomId, e la guardia si comporta come prima (nessuna stanza da
    // interrogare, nessun rischio: non c'e niente da tenere riservato).
    try {
      await assertElaborazioneConsentita(req, { roomId, roomSessionToken });
    } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const lang2 = (langCode || '').replace(/-.*/, '');
    const cleanText = preprocessForTTS(text, lang2);
    const trimmed = cleanText.substring(0, 5000);
    const voiceName = getEdgeVoice(langCode || 'en', gender || 'female');

    // ═══ b.552 — NIENTE DA DIRE NON E' UN GUASTO ═══
    // Nei registri di produzione «sintesi riuscita ma audio vuoto» era
    // l'errore piu frequente dell'applicazione: 65 volte in una settimana,
    // sei persone. La causa non era Edge TTS: era QUI. `preprocessForTTS`
    // toglie markdown ed emoji — giustamente, non si legge ad alta voce
    // una faccina — e un messaggio fatto di sole emoji («👍😂») o di sola
    // punteggiatura resta la stringa vuota. Si chiedeva a Edge TTS di
    // pronunciare il nulla, lui restituiva il nulla, e noi lo scrivevamo
    // nei registri come errore. Non lo e': non c'e' niente da dire.
    //
    // Ora si risponde 204 (nessun contenuto): chi ha chiamato sa che non
    // deve suonare niente e non ripiega su un'altra voce per leggere il
    // vuoto. Vedi `voceDaSuonare` in hooks/useTTSEngine.js.
    const qualcosaDaDire = /[\p{L}\p{N}]/u.test(trimmed);
    if (!qualcosaDaDire) {
      log.info('niente da pronunciare dopo la pulizia (emoji o punteggiatura sola)', { lingua: lang2, caratteri: text.length });
      return new NextResponse(null, { status: 204 });
    }

    const { getEdgeRateForLang } = await import('../../lib/voiceDefaults.js');
    const speechRate = getEdgeRateForLang(lang2);

    // Dynamic import
    let EdgeTTS;
    try {
      const mod = await import('@andresaya/edge-tts');
      EdgeTTS = mod.EdgeTTS || mod.default?.EdgeTTS || mod.default;
    } catch (e) {
      log.error('Import failed:', e.message, e.stack);
      return NextResponse.json({ error: 'Edge TTS not available: ' + e.message }, { status: 503 });
    }

    if (!EdgeTTS) {
      log.error('EdgeTTS class is undefined after import');
      return NextResponse.json({ error: 'EdgeTTS class undefined' }, { status: 503 });
    }

    // Generate audio
    // b.552 — un SECONDO tentativo se il primo torna muto. Tolto il caso
    // «niente da dire» (sopra), un buffer vuoto con del testo vero e' un
    // singhiozzo del servizio, non una risposta: capita, e riprovare una
    // volta costa meno che far ripiegare la persona sulla voce robotica.
    let audioBuffer;
    const sintetizza = async () => {
      const tts = new EdgeTTS();
      await tts.synthesize(trimmed, voiceName, {
        rate: speechRate,
        volume: '+0%',
        pitch: '+0Hz',
      });
      return tts.toBuffer();
    };
    try {
      audioBuffer = await sintetizza();
      if (!audioBuffer || audioBuffer.length === 0) {
        // b.598 — MITIGAZIONE, NON CAUSA CONFERMATA. 112 «audio vuoto» su
        // 11 utenti/7gg (Vercel, aggregato) restano un difetto vivo: i
        // log grezzi per capire SE e' un rate-limit del servizio Edge non
        // sono recuperabili (retention troppo corta per interrogare
        // quell'intervallo). Il secondo tentativo (b.552) era IMMEDIATO,
        // a zero millisecondi dal primo — se la causa fosse un servizio
        // momentaneamente occupato, ripetere subito la stessa richiesta
        // e' la mossa che ha meno probabilita di riuscire. Una pausa
        // breve prima del secondo tentativo e' un'ipotesi ragionevole,
        // non una conferma: da riprendere se i 112 non calano.
        // b.626 — b.598 si chiudeva con «da riprendere se i 112 non
        // calano», ma per saperlo serviva un dato che nessuno registrava:
        // quante volte la pausa SALVA la sintesi. Il fallimento finale e
        // un `error` e si conserva sette giorni; questa riga era un `warn`
        // e ne durava uno — cosi si vedevano solo i casi persi, mai quelli
        // recuperati, e la mitigazione restava impossibile da giudicare.
        // Ora l'esito del secondo tentativo si scrive per intero, allo
        // stesso livello del guasto: al prossimo giro il conto si fa.
        log.error('Edge TTS: primo tentativo muto, riprovo', { voce: voiceName, lingua: lang2, attesaMs: 400 });
        await new Promise((resolve) => setTimeout(resolve, 400));
        audioBuffer = await sintetizza();
        log.error('Edge TTS: esito del secondo tentativo', {
          voce: voiceName,
          lingua: lang2,
          riuscito: !!(audioBuffer && audioBuffer.length),
          byte: audioBuffer?.length || 0,
        });
      }
    } catch (synthErr) {
      // b.363 — qui si rispediva al client `stack`: le prime cinque righe
      // della traccia dell'errore, cioe i PERCORSI DEI FILE SUL SERVER e i
      // nomi delle librerie interne. E' la pianta della casa, regalata a
      // chiunque sappia far fallire una sintesi vocale — che e' facile.
      // Il dettaglio serve a noi e resta nel registro; a chi chiama va
      // detto solo che non e' riuscita.
      log.error('Synthesize FULL error:', synthErr.message, '| Stack:', synthErr.stack);
      return NextResponse.json({ error: 'Edge TTS synthesis failed' }, { status: 503 });
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      // b.363 — uscita di guasto muta: dal registro sembrava che non
      // fosse successo niente. Un audio vuoto e un guasto silenzioso: nessuno se ne accorge.
      // b.552 — il registro dice ANCHE con quale voce e in quale lingua:
      // senza quei due dati, nel registro di prima, non si poteva capire
      // se il guasto fosse di una lingua sola o di tutte.
      log.error('Edge TTS: sintesi riuscita ma audio vuoto', { voce: voiceName, lingua: lang2, caratteri: trimmed.length });
      return NextResponse.json({ error: 'Failed to generate audio' }, { status: 503 });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch (e) {
    // b.363 — stessa fuga della riga sopra, e qui era anche peggio: usciva
    // per QUALUNQUE errore imprevisto, insieme al messaggio grezzo (che di
    // solito contiene indirizzi e nomi di variabili d'ambiente).
    log.error('Top-level error:', e.message, e.stack);
    return NextResponse.json({ error: 'Sintesi vocale non riuscita' }, { status: 500 });
  }
}

// GET /api/tts-edge?test=1 — diagnostic endpoint
//
// b.381 — CHIUSO IN PRODUZIONE. Questa rotta importa la libreria,
// elenca i suoi export e i suoi metodi, e SINTETIZZA DAVVERO una frase.
// Era pubblica e senza il guard che protegge la POST: chiunque poteva
// chiamarla a ripetizione e farci lavorare gratis, e leggere come siamo
// fatti dentro.
//
// Serve, ma serve a NOI e quando qualcosa non va. Fuori da produzione
// resta intera; in produzione risponde solo se sa la parola d'ordine
// dell'amministratore — e altrimenti dice quel poco che puo dire un
// controllo di salute, senza sintetizzare niente.
export async function GET(req) {
  const inProduzione = process.env.VERCEL_ENV === 'production';
  if (inProduzione) {
    const atteso = process.env.ADMIN_SECRET || process.env.SESAMO_SECRET || '';
    const dato = req.headers.get('x-admin-secret') || '';
    if (!atteso || dato !== atteso) {
      // niente elenco di moduli, niente sintesi: solo "sono viva".
      return NextResponse.json({ ok: true, servizio: 'tts-edge' });
    }
  }
  const checks = {
    timestamp: new Date().toISOString(),
    cryptoSubtle: typeof globalThis?.crypto?.subtle !== 'undefined',
    cryptoAvailable: typeof globalThis?.crypto !== 'undefined',
  };

  try {
    const mod = await import('@andresaya/edge-tts');
    checks.importOk = true;
    checks.exports = Object.keys(mod);
    const EdgeTTS = mod.EdgeTTS || mod.default?.EdgeTTS || mod.default;
    checks.edgeTTSClass = !!EdgeTTS;
    checks.edgeTTSType = typeof EdgeTTS;

    if (EdgeTTS) {
      const tts = new EdgeTTS();
      checks.instanceOk = true;
      checks.methods = Object.getOwnPropertyNames(Object.getPrototypeOf(tts)).filter(m => m !== 'constructor');

      // Quick synth test
      try {
        await tts.synthesize('test', 'en-US-AriaNeural', { rate: '+0%', volume: '+0%', pitch: '+0Hz' });
        const buf = tts.toBuffer();
        checks.synthOk = true;
        checks.audioBytes = buf?.length || 0;
      } catch (synthErr) {
        // b.363 — anche questa rotta diagnostica, che e' pubblica,
        // rimandava la traccia dello stack. Il dettaglio va nel registro.
        checks.synthOk = false;
        log.error('Diagnostica: sintesi fallita:', synthErr.message, '| Stack:', synthErr.stack);
      }
    }
  } catch (importErr) {
    // b.363 — idem: nomi di moduli e percorsi del server fuori dalla
    // risposta pubblica, dentro il registro.
    checks.importOk = false;
    log.error('Diagnostica: import fallito:', importErr.message, '| Stack:', importErr.stack);
  }

  return NextResponse.json(checks, { status: checks.synthOk ? 200 : 503 });
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'tts-edge' });

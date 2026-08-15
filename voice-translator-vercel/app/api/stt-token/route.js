import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { getSession } from '../../lib/users.js';
import { getRoom, resolveRoomIdentity } from '../../lib/store.js';
import { creditoFinito } from '../../wallet/addebita.js';

const log = createLogger('sttToken');

// ═══════════════════════════════════════════════
// STT Token endpoint — generates temporary Deepgram API key
// for client-side WebSocket streaming transcription
//
// Requires: DEEPGRAM_API_KEY env var
// Rate limit: 10 req/min (one per recording session)
//
// b.157 — audit pagamenti, DUE difetti confermati leggendo il codice:
//
// 1. Nessun client di questa app manda MAI un corpo nella richiesta
//    (i 5 punti che la chiamano: SpeakerView.js x2, useDeepgramSTT.js,
//    useStreamingInterpreter.js x2 — tutti `fetch(..., {method:'POST'})`
//    senza body). Il controllo sotto rispondeva quindi SEMPRE 401: il
//    ramo Deepgram (STT "di livello server", piu preciso) non si
//    attivava MAI, in produzione, per nessuno — si ripiegava sempre
//    e solo sul riconoscimento del browser o su Whisper, in silenzio.
//    Corretto qui E in tutti e 5 i punti che chiamano questa rotta.
//
// 2. Anche a chiamata corretta, questa rotta non guardava il wallet:
//    chiunque avesse un token (di sessione o di stanza) riceveva una
//    chiave Deepgram vera, fatturata a BarTalk, senza nessun controllo
//    di credito — e Deepgram, a differenza di OpenAI/ElevenLabs, non
//    ha qui un percorso "chiave propria": ogni streaming costa alla
//    piattaforma, sempre. Aggiunto lo stesso gate delle altre rotte
//    (fail-closed: un guasto nella lettura del saldo blocca, non
//    procede gratis — stessa scelta della voce premium).
//
// NON RISOLTO qui, e serve una decisione di prodotto: questo e un
// GATE (blocca se il saldo e a zero), non un CONTATORE — il client
// parla direttamente con Deepgram via WebSocket, il server non vede
// mai quanti secondi vengono davvero trasmessi, quindi non puo
// scalare il wallet in proporzione all'uso reale (a differenza di
// TTS/traduzione, dove il server calcola il costo dopo il fatto).
// Misurare per-secondo richiederebbe o un proxy audio lato server o
// un resoconto del client di cui fidarsi — entrambe scelte
// architetturali, non un difetto da correggere qui.
// ═══════════════════════════════════════════════

// b.159 — CONFERMATO: se userToken era presente ma getSession falliva
// (token scaduto/falso), la funzione precedente cadeva silenziosamente
// al ramo successivo (roomId, poi null) invece di respingere — un
// gettone invalido finiva trattato come "nessun gettone", e il gate
// del wallet subito sotto (billingEmail && creditoFinito) diventava un
// no-op perche billingEmail restava null: chiave Deepgram vera, gratis,
// a chiunque mandasse un gettone qualsiasi (anche scaduto o inventato).
// Ora un gettone/stanza PRESENTE ma non risolvibile e' un 401, non un
// fallthrough verso l'anonimato.
// b.161 — CONFERMATO (quarto audit esterno, punto 2, stessa classe di
// difetto delle rotte translate/tts/transcribe): il ramo roomId fatturava
// all'host fidandosi del solo roomId, senza verificare che chi chiama
// abbia davvero un roomSessionToken valido per QUELLA stanza — un roomId
// indovinato (8 esadecimali, 32 bit) bastava per farsi consegnare una
// chiave Deepgram vera, con il gate di credito controllato sul wallet
// dell'host. Stessa correzione delle altre rotte a pagamento: resolveRoomIdentity.
async function risolviEmailDaFatturare(userToken, roomId, roomSessionToken) {
  if (userToken) {
    const session = await getSession(userToken);
    if (session?.email) return session.email;
    return { invalido: true };
  }
  if (roomId) {
    const identita = await resolveRoomIdentity(roomSessionToken, null, roomId);
    if (!identita) return { invalido: true };
    const room = await getRoom(roomId);
    if (room?.hostEmail) return room.hostEmail;
    return { invalido: true };
  }
  return null;
}

async function handler(req) {
  // ── b.111 · la falla piu grande, e non era nemmeno nell'elenco ──
  // Questa rotta consegna al telefono un gettone per aprire un flusso
  // audio DIRETTO verso Deepgram. In modalita Diretta significa la
  // voce, dal vivo, verso un terzo — mentre all'utente si prometteva
  // che niente lasciava il telefono. Non aveva la guardia e non era
  // fra le rotte vietate: due dimenticanze sullo stesso punto.
  try { assertCloudProcessingAllowed(req); } catch (e) {
    if (e instanceof DirectModeError) {
      return NextResponse.json({ error: e.message, direct: true }, { status: 403 });
    }
    throw e;
  }

  // Auth guard: require room id or user token
  const body = await req.clone().json().catch(() => ({}));
  const userToken = body.userToken || null;
  const roomId = body.roomId || null;
  const roomSessionToken = body.roomSessionToken || null;
  if (!userToken && !roomId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ── Wallet: chi paga? (stesso fail-closed della voce premium — vedi nota sopra) ──
  const risoltoFatturazione = await risolviEmailDaFatturare(userToken, roomId, roomSessionToken);
  if (risoltoFatturazione?.invalido) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const billingEmail = risoltoFatturazione;
  if (billingEmail && await creditoFinito(billingEmail, { failClosed: true })) {
    return NextResponse.json({ error: 'Credito esaurito', creditoEsaurito: true }, { status: 402 });
  }

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

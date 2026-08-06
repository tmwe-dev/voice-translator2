import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getRoom } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName, getClientIP } from '../../lib/validate.js';
import {
  resolveIdentity,
  handleCreate, handleJoin, handleHeartbeat, handleSpeaking,
  handleChangeMode, handleChangeLang, handleWebrtcSignal, handleWebrtcPoll, handleCheck,
  handleRaiseHand, handleGrantSpeak
} from '../../lib/roomActions.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('room');

// b.107 — l'unico modo lecito di sapere chi paga: la sessione.
// Restituisce null per gli ospiti non autenticati, che e giusto: una
// stanza senza host registrato non ha un portafoglio a cui attingere.
async function emailDallaSessione(userToken) {
  if (!userToken || typeof userToken !== 'string') return null;
  try {
    const { getSession } = await import('../../lib/users.js');
    const sessione = await getSession(userToken);
    return sessione?.email || null;
  } catch {
    return null;
  }
}

// POST /api/room - Create, join, or manage a room
async function handlePostRoom(req) {
  try {
    // ── b.106 · qui c'era un SECONDO limitatore sulla STESSA chiave ──
    // withApiGuard (in fondo al file) conta gia su "room:IP" con tetto 420.
    // Questa riga contava di nuovo sulla stessa identica chiave con tetto
    // 60: ogni richiesta valeva DUE gettoni e il tetto vero diventava 30
    // al minuto per indirizzo IP.
    //
    // Il battito della stanza fa 40 richieste al minuto: 429 dopo ventitre
    // secondi di conversazione. E la chiave e per IP, quindi due telefoni
    // sullo stesso WiFi — il caso del bar — se ne dividevano 30.
    //
    // Il commento qui sotto dice che il tetto fu alzato a 420 proprio per
    // questo motivo. Questa riga annullava quella correzione.

    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';
    const roomId = sanitizeRoomId(body.roomId || '');
    const name = sanitizeName(body.name || '');
    const lang = typeof body.lang === 'string' ? body.lang.slice(0, 10) : '';
    const roomSessionToken = typeof body.roomSessionToken === 'string' ? body.roomSessionToken : null;

    // For actions that require identity, resolve once
    const needsIdentity = ['heartbeat', 'speaking', 'changeMode', 'changeLang', 'webrtc-signal', 'webrtc-poll', 'raiseHand', 'grantSpeak'];
    let identity = null;
    if (needsIdentity.includes(action)) {
      identity = await resolveIdentity(roomSessionToken, name, roomId);
    }

    switch (action) {
      case 'create':
        return handleCreate({
          name, lang, mode: body.mode, avatar: body.avatar,
          context: body.context, contextPrompt: body.contextPrompt,
          description: body.description, hostTier: body.hostTier,
          // b.113 — Stanza Diretta: viaggia con la stanza, cosi chi entra
          // dopo lo sa senza doverlo indovinare.
          diretta: body.diretta,
          // ── b.107 · l'email di chi paga NON arriva piu dal client ──
          // Prima era `hostEmail: body.hostEmail` e il server si fidava.
          // apiAuth:160 usa quel campo come `billingEmail`, cioe come il
          // portafoglio da cui scalare tutti i consumi della stanza:
          // bastava scriverci l'indirizzo di un altro per farlo pagare
          // al posto proprio.
          //
          // Ora si ricava dalla sessione: si puo far pagare solo se stessi.
          hostEmail: await emailDallaSessione(body.userToken),
        });

      case 'join':
        return handleJoin({ roomId, name, lang, avatar: body.avatar });

      case 'heartbeat':
        return handleHeartbeat({ roomId, identity });

      case 'speaking':
        return handleSpeaking({
          roomId, identity, speaking: body.speaking,
          liveText: body.liveText, typing: body.typing,
        });

      case 'changeMode':
        return handleChangeMode({ roomId, mode: body.mode, identity });

      case 'changeLang':
        return handleChangeLang({ roomId, lang, identity });

      case 'webrtc-signal':
        return handleWebrtcSignal({ roomId, signal: body.signal, identity });

      case 'webrtc-poll':
        return handleWebrtcPoll({ roomId, identity });

      case 'raiseHand':
        return handleRaiseHand({ roomId, identity, raised: body.raised });

      case 'grantSpeak':
        return handleGrantSpeak({ roomId, identity, targetMember: body.targetMember });

      case 'check':
        return handleCheck({ roomId });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e) {
    log.error('Room error:', e);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', source: 'api' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/room?id=XXX - Get room info
async function handleGetRoom(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const room = await getRoom(id);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ room });
  } catch (e) {
    log.error('Room GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 420/min: il presence fa più POST per ciclo di poll (1,5s) e più tab/persone
// possono condividere lo stesso IP (NAT, famiglie). 120 causava 429 già con 2 tab.
export const POST = withApiGuard(handlePostRoom, { maxRequests: 420, prefix: 'room' });
export const GET = withApiGuard(handleGetRoom, { maxRequests: 420, prefix: 'room' });

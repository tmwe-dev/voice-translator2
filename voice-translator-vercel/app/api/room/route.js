import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { getRoom } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName, rateLimit, getClientIP } from '../../lib/validate.js';
import {
  resolveIdentity,
  handleCreate, handleJoin, handleHeartbeat, handleSpeaking,
  handleChangeMode, handleChangeLang, handleWebrtcSignal, handleWebrtcPoll, handleCheck,
  handleRaiseHand, handleGrantSpeak
} from '../../lib/roomActions.js';

// POST /api/room - Create, join, or manage a room
async function handlePostRoom(req) {
  try {
    const ip = getClientIP(req);
    const rl = rateLimit(ip, { maxRequests: 60, windowMs: 60000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

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
          description: body.description, hostTier: body.hostTier, hostEmail: body.hostEmail,
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
    console.error('Room error:', e);
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
    console.error('Room GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePostRoom, { maxRequests: 120, prefix: 'room' });
export const GET = withApiGuard(handleGetRoom, { maxRequests: 120, prefix: 'room' });

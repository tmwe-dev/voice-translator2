import { NextResponse } from 'next/server';
import { createRoom, getRoom, joinRoom, updateHeartbeat, setSpeaking, updateRoomMode, changeMemberLang, createRoomSession, resolveRoomIdentity } from '../../lib/store.js';
import { redis } from '../../lib/redis.js';
import { sanitizeRoomId, sanitizeName, sanitize, rateLimit, getClientIP } from '../../lib/validate.js';

// POST /api/room - Create or join a room
export async function POST(req) {
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
    const { speaking, mode, avatar, context, contextPrompt, description, liveText, typing, hostTier, hostEmail, signal } = body;

    // ── Helper: resolve identity from token or fallback to name ──
    async function resolveIdentity(rid) {
      const identity = await resolveRoomIdentity(roomSessionToken, name, rid);
      if (!identity) return null;
      return identity;
    }

    if (action === 'create') {
      if (!name || !lang) return NextResponse.json({ error: 'name and lang required' }, { status: 400 });
      const room = await createRoom(name, lang, mode || 'conversation', avatar || null, context || null, contextPrompt || null, description || null, hostTier || 'FREE', hostEmail || null);
      // Issue a session token for the host
      const { token } = await createRoomSession(room.id, name, 'host');
      return NextResponse.json({ room, roomSessionToken: token });
    }

    if (action === 'join') {
      if (!roomId || !name || !lang) return NextResponse.json({ error: 'roomId, name, lang required' }, { status: 400 });
      const room = await joinRoom(roomId, name, lang, avatar || null);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      // Determine role from the room member list
      const member = room.members.find(m => m.name === name);
      const role = member?.role || 'guest';
      const { token } = await createRoomSession(room.id, name, role);
      return NextResponse.json({ room, roomSessionToken: token });
    }

    if (action === 'heartbeat') {
      if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      const identity = await resolveIdentity(roomId);
      if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const room = await updateHeartbeat(roomId, identity.name);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    if (action === 'speaking') {
      if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      const identity = await resolveIdentity(roomId);
      if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      // Verify membership
      const speakRoom = await getRoom(roomId);
      if (!speakRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (!speakRoom.members.some(m => m.name === identity.name)) {
        return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
      }
      const safeLiveText = liveText ? sanitize(liveText, 500) : null;
      const room = await setSpeaking(roomId, identity.name, !!speaking, safeLiveText, !!typing);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    if (action === 'changeMode') {
      if (!roomId || !mode) return NextResponse.json({ error: 'roomId and mode required' }, { status: 400 });
      const identity = await resolveIdentity(roomId);
      if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      // Only host can change room mode (verified identity preferred)
      const currentRoom = await getRoom(roomId);
      if (!currentRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (identity.verified && identity.role !== 'host') {
        return NextResponse.json({ error: 'Only the host can change room mode' }, { status: 403 });
      }
      if (!identity.verified && currentRoom.host !== identity.name) {
        return NextResponse.json({ error: 'Only the host can change room mode' }, { status: 403 });
      }
      const room = await updateRoomMode(roomId, mode);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    // ── Change member language (synced to all participants) ──
    if (action === 'changeLang') {
      if (!roomId || !lang) return NextResponse.json({ error: 'roomId and lang required' }, { status: 400 });
      const identity = await resolveIdentity(roomId);
      if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      // Verify requester is actually a room member
      const langRoom = await getRoom(roomId);
      if (!langRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (!langRoom.members.some(m => m.name === identity.name)) {
        return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
      }
      const room = await changeMemberLang(roomId, identity.name, lang);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    // ── WebRTC Signaling ──
    if (action === 'webrtc-signal') {
      if (!roomId || !signal) return NextResponse.json({ error: 'roomId and signal required' }, { status: 400 });
      // Verify sender via session token or signal.from membership
      const identity = await resolveIdentity(roomId);
      if (identity) {
        const sigRoom = await getRoom(roomId);
        if (!sigRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        if (!sigRoom.members.some(m => m.name === identity.name)) {
          return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
        }
      } else {
        // Fallback: verify signal.from
        const senderName = signal?.from;
        if (senderName) {
          const sigRoom = await getRoom(roomId);
          if (!sigRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
          if (!sigRoom.members.some(m => m.name === senderName)) {
            return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
          }
        }
      }
      const key = `rtc:${roomId}`;
      try {
        await redis('RPUSH', key, JSON.stringify(signal));
        await redis('LTRIM', key, -50, -1);
        await redis('EXPIRE', key, 300);
      } catch (e) {
        console.error('[WebRTC] Signal store error:', e);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'webrtc-poll') {
      if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      const identity = await resolveIdentity(roomId);
      if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      // Verify requester is a room member
      const pollRoom = await getRoom(roomId);
      if (!pollRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (!pollRoom.members.some(m => m.name === identity.name)) {
        return NextResponse.json({ error: 'Not a room member' }, { status: 403 });
      }
      const key = `rtc:${roomId}`;
      try {
        const raw = await redis('LRANGE', key, 0, -1);
        const signals = (raw || [])
          .map(s => { try { return JSON.parse(s); } catch { return null; } })
          .filter(s => s && s.from !== identity.name);
        return NextResponse.json({ signals });
      } catch {
        return NextResponse.json({ signals: [] });
      }
    }

    if (action === 'check') {
      if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      const room = await getRoom(roomId);
      return NextResponse.json({ exists: !!room, ended: room?.ended || false });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Room error:', e);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'room', source: 'api' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/room?id=XXX - Get room info
export async function GET(req) {
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

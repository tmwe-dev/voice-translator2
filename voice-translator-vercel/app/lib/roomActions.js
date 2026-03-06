import { NextResponse } from 'next/server';
import { createRoom, getRoom, joinRoom, updateHeartbeat, setSpeaking, updateRoomMode, changeMemberLang, createRoomSession, resolveRoomIdentity } from './store.js';
import { redis } from './redis.js';
import { sanitizeRoomId, sanitizeName, sanitize } from './validate.js';

// ── Helper: resolve identity from token or fallback to name ──
export async function resolveIdentity(roomSessionToken, name, roomId) {
  return resolveRoomIdentity(roomSessionToken, name, roomId);
}

// ── Helper: verify membership ──
async function verifyMembership(roomId, identity) {
  const room = await getRoom(roomId);
  if (!room) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) };
  if (!room.members.some(m => m.name === identity.name)) {
    return { error: NextResponse.json({ error: 'Not a room member' }, { status: 403 }) };
  }
  return { room };
}

// ── Action: create ──
export async function handleCreate({ name, lang, mode, avatar, context, contextPrompt, description, hostTier, hostEmail }) {
  if (!name || !lang) return NextResponse.json({ error: 'name and lang required' }, { status: 400 });
  const room = await createRoom(name, lang, mode || 'conversation', avatar || null, context || null, contextPrompt || null, description || null, hostTier || 'FREE', hostEmail || null);
  const { token } = await createRoomSession(room.id, name, 'host');
  return NextResponse.json({ room, roomSessionToken: token });
}

// ── Action: join ──
export async function handleJoin({ roomId, name, lang, avatar }) {
  if (!roomId || !name || !lang) return NextResponse.json({ error: 'roomId, name, lang required' }, { status: 400 });
  const room = await joinRoom(roomId, name, lang, avatar || null);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const member = room.members.find(m => m.name === name);
  const role = member?.role || 'guest';
  const { token } = await createRoomSession(room.id, name, role);
  return NextResponse.json({ room, roomSessionToken: token });
}

// ── Action: heartbeat ──
export async function handleHeartbeat({ roomId, identity }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const room = await updateHeartbeat(roomId, identity.name);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: speaking ──
export async function handleSpeaking({ roomId, identity, speaking, liveText, typing }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { room: speakRoom, error } = await verifyMembership(roomId, identity);
  if (error) return error;
  const safeLiveText = liveText ? sanitize(liveText, 500) : null;
  const room = await setSpeaking(roomId, identity.name, !!speaking, safeLiveText, !!typing);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: changeMode ──
export async function handleChangeMode({ roomId, mode, identity }) {
  if (!roomId || !mode) return NextResponse.json({ error: 'roomId and mode required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const currentRoom = await getRoom(roomId);
  if (!currentRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  // Token-verified: check role; unverified: check name
  const isHost = identity.verified
    ? identity.role === 'host'
    : currentRoom.host === identity.name;
  if (!isHost) {
    return NextResponse.json({ error: 'Only the host can change room mode' }, { status: 403 });
  }
  const room = await updateRoomMode(roomId, mode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: changeLang ──
export async function handleChangeLang({ roomId, lang, identity }) {
  if (!roomId || !lang) return NextResponse.json({ error: 'roomId and lang required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { error } = await verifyMembership(roomId, identity);
  if (error) return error;
  const room = await changeMemberLang(roomId, identity.name, lang);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: webrtc-signal ──
export async function handleWebrtcSignal({ roomId, signal, identity }) {
  if (!roomId || !signal) return NextResponse.json({ error: 'roomId and signal required' }, { status: 400 });
  // Verify sender via session token or signal.from membership
  if (identity) {
    const { error } = await verifyMembership(roomId, identity);
    if (error) return error;
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

// ── Action: webrtc-poll ──
export async function handleWebrtcPoll({ roomId, identity }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { error } = await verifyMembership(roomId, identity);
  if (error) return error;
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

// ── Action: check ──
export async function handleCheck({ roomId }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  const room = await getRoom(roomId);
  return NextResponse.json({ exists: !!room, ended: room?.ended || false });
}

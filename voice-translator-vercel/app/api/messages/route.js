import { NextResponse } from 'next/server';
import { addMessage, getMessages, getRoom, resolveRoomIdentity } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName, sanitizeText, sanitizeTranslations, rateLimit, getClientIP } from '../../lib/validate.js';

// POST /api/messages - Send a translation to the room
// Supports multi-language: `translations` field contains per-language translations
// Backward compatible: also accepts single `translated` + `targetLang`
export async function POST(req) {
  try {
    const ip = getClientIP(req);
    const rl = rateLimit(ip, { maxRequests: 120, windowMs: 60000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const body = await req.json();
    const roomId = sanitizeRoomId(body.roomId);
    const sender = sanitizeName(body.sender);
    const original = sanitizeText(body.original, 10000);
    const roomSessionToken = typeof body.roomSessionToken === 'string' ? body.roomSessionToken : null;

    if (!roomId || !original) {
      return NextResponse.json({ error: 'roomId and original required' }, { status: 400 });
    }

    // Resolve identity: prefer session token, fall back to sender name
    const identity = await resolveRoomIdentity(roomSessionToken, sender, roomId);
    if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Verify sender is actually a member of this room
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const isMember = room.members.some(m => m.name === identity.name);
    if (!isMember) return NextResponse.json({ error: 'Sender is not a room member' }, { status: 403 });

    const translated = sanitizeText(body.translated || '', 10000);
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang.slice(0, 10) : '';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang.slice(0, 10) : '';
    const translations = sanitizeTranslations(body.translations);

    const msg = await addMessage(roomId, {
      sender: identity.name, original, sourceLang,
      translated,
      targetLang,
      translations,
    });
    if (!msg) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('Messages error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/messages?room=XXX&name=YYY&after=TIMESTAMP&rst=TOKEN - Poll for new messages
// Supports room session token (rst) for server-verified identity, falls back to name
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = sanitizeRoomId(searchParams.get('room') || '');
    const name = sanitizeName(searchParams.get('name') || '');
    const roomSessionToken = searchParams.get('rst') || null;
    const after = parseInt(searchParams.get('after') || '0', 10);
    if (!roomId) return NextResponse.json({ error: 'room required' }, { status: 400 });
    if (isNaN(after) || after < 0) return NextResponse.json({ error: 'invalid after' }, { status: 400 });

    // Resolve identity: prefer session token, fall back to name
    const identity = await resolveRoomIdentity(roomSessionToken, name, roomId);
    if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Verify requester is a member of this room
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const isMember = room.members.some(m => m.name === identity.name);
    if (!isMember) return NextResponse.json({ error: 'Not a room member' }, { status: 403 });

    const msgs = await getMessages(roomId, after);
    return NextResponse.json({ messages: msgs });
  } catch (e) {
    console.error('Messages GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'messages', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

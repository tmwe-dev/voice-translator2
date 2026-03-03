import { NextResponse } from 'next/server';
import { addMessage, getMessages } from '../../lib/store.js';
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

    if (!roomId || !sender || !original) {
      return NextResponse.json({ error: 'roomId, sender, original required' }, { status: 400 });
    }

    const translated = sanitizeText(body.translated || '', 10000);
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang.slice(0, 10) : '';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang.slice(0, 10) : '';
    const translations = sanitizeTranslations(body.translations);

    const msg = await addMessage(roomId, {
      sender, original, sourceLang,
      translated,
      targetLang,
      translations,
    });
    if (!msg) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ message: msg });
  } catch (e) {
    console.error('Messages error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/messages?room=XXX&after=TIMESTAMP - Poll for new messages
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const room = sanitizeRoomId(searchParams.get('room') || '');
    const after = parseInt(searchParams.get('after') || '0', 10);
    if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
    if (isNaN(after) || after < 0) return NextResponse.json({ error: 'invalid after' }, { status: 400 });
    const msgs = await getMessages(room, after);
    return NextResponse.json({ messages: msgs });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

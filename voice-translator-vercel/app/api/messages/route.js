import { NextResponse } from 'next/server';
import { addMessage, getMessages } from '../../lib/store.js';

// POST /api/messages - Send a translation to the room
export async function POST(req) {
  try {
    const { roomId, sender, original, translated, sourceLang, targetLang } = await req.json();
    if (!roomId || !sender || !original) {
      return NextResponse.json({ error: 'roomId, sender, original required' }, { status: 400 });
    }
    const msg = addMessage(roomId, { sender, original, translated, sourceLang, targetLang });
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
    const room = searchParams.get('room');
    const after = parseInt(searchParams.get('after') || '0', 10);
    if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
    const msgs = getMessages(room, after);
    return NextResponse.json({ messages: msgs });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

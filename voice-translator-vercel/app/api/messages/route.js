import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

// POST: send a message to the room
export async function POST(req) {
  try {
    const { roomId, original, translated, fromRole } = await req.json();
    const key = `room:${roomId.toUpperCase()}`;
    const data = await kv.get(key);
    if (!data) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const room = typeof data === 'string' ? JSON.parse(data) : data;
    room.messages.push({ original, translated, fromRole, ts: Date.now() });
    // Keep only last 50 messages
    if (room.messages.length > 50) room.messages = room.messages.slice(-50);
    await kv.set(key, JSON.stringify(room), { ex: 3600 });
    return NextResponse.json({ ok: true, count: room.messages.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: poll messages  ?roomId=XXX&since=INDEX
export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams;
    const roomId = params.get('roomId')?.toUpperCase();
    const since = parseInt(params.get('since') || '0');
    if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    const data = await kv.get(`room:${roomId}`);
    if (!data) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const room = typeof data === 'string' ? JSON.parse(data) : data;
    const newMessages = room.messages.slice(since);
    return NextResponse.json({ messages: newMessages, total: room.messages.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createRoom, getRoom, joinRoom, updateHeartbeat, setSpeaking, updateRoomMode } from '../../lib/store.js';

// POST /api/room - Create or join a room
export async function POST(req) {
  try {
    const { action, roomId, name, lang, speaking, mode, avatar, context, contextPrompt, description, liveText, typing } = await req.json();

    if (action === 'create') {
      if (!name || !lang) return NextResponse.json({ error: 'name and lang required' }, { status: 400 });
      const room = await createRoom(name, lang, mode || 'conversation', avatar || null, context || null, contextPrompt || null, description || null);
      return NextResponse.json({ room });
    }

    if (action === 'join') {
      if (!roomId || !name || !lang) return NextResponse.json({ error: 'roomId, name, lang required' }, { status: 400 });
      const room = await joinRoom(roomId, name, lang, avatar || null);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    if (action === 'heartbeat') {
      if (!roomId || !name) return NextResponse.json({ error: 'roomId, name required' }, { status: 400 });
      const room = await updateHeartbeat(roomId, name);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    if (action === 'speaking') {
      if (!roomId || !name) return NextResponse.json({ error: 'roomId, name required' }, { status: 400 });
      const room = await setSpeaking(roomId, name, !!speaking, liveText || null, !!typing);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    if (action === 'changeMode') {
      if (!roomId || !mode) return NextResponse.json({ error: 'roomId, mode required' }, { status: 400 });
      const room = await updateRoomMode(roomId, mode);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ room });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Room error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

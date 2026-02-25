import { NextResponse } from 'next/server';
import { saveConversation, getConversation, getUserConversations } from '../../lib/store.js';

// POST /api/conversation - End room and save conversation
export async function POST(req) {
  try {
    const { action, roomId, userName } = await req.json();

    if (action === 'end') {
      if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      const conv = await saveConversation(roomId);
      if (!conv) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      return NextResponse.json({ conversation: conv });
    }

    if (action === 'list') {
      if (!userName) return NextResponse.json({ error: 'userName required' }, { status: 400 });
      const convs = await getUserConversations(userName);
      return NextResponse.json({ conversations: convs });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Conversation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/conversation?id=XXX - Get full conversation with messages
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const conv = await getConversation(id);
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    return NextResponse.json({ conversation: conv });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

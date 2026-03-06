import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { saveConversation, getConversation, getUserConversations, getRoom } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName } from '../../lib/validate.js';

// POST /api/conversation - End room and save conversation
async function handlePost(req) {
  try {
    const { action, roomId, userName } = await req.json();

    if (action === 'end') {
      const rid = sanitizeRoomId(roomId);
      const name = sanitizeName(userName);
      if (!rid) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
      if (!name) return NextResponse.json({ error: 'userName required' }, { status: 400 });

      // Verify requester is the host (only host can end a room)
      const room = await getRoom(rid);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.host !== name) {
        return NextResponse.json({ error: 'Only the host can end the room' }, { status: 403 });
      }

      const conv = await saveConversation(rid);
      if (!conv) return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
      return NextResponse.json({ conversation: conv });
    }

    if (action === 'list') {
      const name = sanitizeName(userName);
      if (!name) return NextResponse.json({ error: 'userName required' }, { status: 400 });
      const convs = await getUserConversations(name);
      return NextResponse.json({ conversations: convs });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    console.error('Conversation error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/conversation?id=XXX&name=YYY - Get full conversation with messages
// Requires name param to verify the requester was a participant
async function handleGet(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const name = sanitizeName(searchParams.get('name') || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const conv = await getConversation(id);
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    // Verify requester was a participant in this conversation
    const wasParticipant = conv.members?.some(m => m.name === name);
    if (!wasParticipant) {
      return NextResponse.json({ error: 'Not a participant of this conversation' }, { status: 403 });
    }

    return NextResponse.json({ conversation: conv });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'conversation' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'conversation', skipBodyCheck: true });

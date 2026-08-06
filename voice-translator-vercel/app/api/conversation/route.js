import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { saveConversation, getConversation, getUserConversations, getRoom, resolveRoomIdentity, verifyRoomSession } from '../../lib/store.js';
import { getSession } from '../../lib/users.js';
import { sanitizeRoomId, sanitizeName } from '../../lib/validate.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';

const log = createLogger('conversation');

// POST /api/conversation - End room and save conversation
async function handlePost(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { action, roomId, userName, roomSessionToken, userToken } = await req.json();

    if (action === 'end') {
      const rid = sanitizeRoomId(roomId);
      if (!rid) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

      // Resolve identity via session token first, fallback to name
      const identity = await resolveRoomIdentity(roomSessionToken, sanitizeName(userName), rid);
      if (!identity) return NextResponse.json({ error: 'Identity required' }, { status: 401 });

      // Verify requester is the host (only host can end a room)
      const room = await getRoom(rid);
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

      // Token-verified: check role directly; unverified: check name match
      const isHost = identity.verified
        ? identity.role === 'host'
        : room.host === identity.name;
      if (!isHost) {
        return NextResponse.json({ error: 'Only the host can end the room' }, { status: 403 });
      }

      const conv = await saveConversation(rid);
      if (!conv) return NextResponse.json({ error: 'Failed to save conversation' }, { status: 500 });
      return NextResponse.json({ conversation: conv });
    }

    if (action === 'list') {
      // Prefer userToken (account-level identity) for listing conversations
      // b.110 — l'elenco e archiviato sotto il NOME visualizzato
      // (store.js: `convlist:${member.name}`). getSession ora restituisce
      // anche il nome, preso dal profilo: prima c'era solo l'email e si
      // cercava una chiave che non esiste, cosi l'archivio di chi era
      // entrato con l'account appariva sempre vuoto.
      let resolvedName = null;
      if (userToken) {
        const session = await getSession(userToken);
        if (session) resolvedName = session.name || session.email;
      }
      if (!resolvedName) resolvedName = sanitizeName(userName);
      if (!resolvedName) return NextResponse.json({ error: 'Identity required' }, { status: 401 });

      const convs = await getUserConversations(resolvedName);
      return NextResponse.json({ conversations: convs });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e) {
    log.error('Conversation error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'conversation', action: 'post' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/conversation?id=XXX - Get full conversation with messages
// Tokens ONLY via headers: Authorization (Bearer) or X-Room-Session
async function handleGet(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    // SECURITY: tokens ONLY via headers — never from query string
    const authHeader = req.headers.get('authorization');
    const ut = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const rst = req.headers.get('x-room-session') || '';
    const nameParam = sanitizeName(searchParams.get('name') || '');

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Resolve identity: prefer userToken, then room session token, then name
    let resolvedName = null;
    if (ut) {
      const session = await getSession(ut);
      if (session) resolvedName = session.name || session.email;
    }
    if (!resolvedName && rst) {
      // For conversation retrieval, verify the token is valid but don't check room ID
      // (the conversation may be from an archived room). Participant check below handles access control.
      const session = await verifyRoomSession(rst);
      if (session?.name) resolvedName = session.name;
    }
    // SECURITY: name-only access removed — conversations require a verified session
    // (userToken from login or room session token). Name parameter alone is not sufficient.
    if (!resolvedName) return NextResponse.json({ error: 'Verified session required' }, { status: 401 });

    const conv = await getConversation(id);
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    // Verify requester was a participant in this conversation
    const wasParticipant = conv.members?.some(m => m.name === resolvedName);
    if (!wasParticipant) {
      return NextResponse.json({ error: 'Not a participant of this conversation' }, { status: 403 });
    }

    return NextResponse.json({ conversation: conv });
  } catch (e) {
    log.error('Conversation GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'conversation', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'conversation' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'conversation', skipBodyCheck: true });

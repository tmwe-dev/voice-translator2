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
      // ── b.123 · BASTAVA SAPERE UN NOME ──
      //
      // Prima c'era, sotto:
      //
      //     if (!resolvedName) resolvedName = sanitizeName(userName);
      //     const convs = await getUserConversations(resolvedName);
      //
      // Cioe: nessun gettone, solo `userName: "Mario"` nel corpo, e si
      // riceveva l'elenco delle conversazioni di Mario. Gli identificativi
      // che ne uscivano erano poi la chiave per aprirle una per una.
      //
      // L'archivio e indicizzato sotto il NOME VISUALIZZATO
      // (store.js: `convlist:${member.name}`), e un nome visualizzato se
      // lo sceglie chiunque. Non e un'identita: e un'etichetta.
      //
      // ── PERCHE SI PUO CHIUDERE SENZA TOGLIERE NIENTE A NESSUNO ──
      //
      // Un ospite senza account non ha, lato server, niente a cui legare
      // quell'elenco: qualunque controllo si inventi, si riduce di nuovo
      // a credergli sulla parola. Ma la sua cronologia non si perde —
      // sta sul suo dispositivo, in IndexedDB (`chatStorage.js`), ed e
      // il posto giusto: e roba sua e resta sua.
      //
      // Quindi l'elenco lato server esiste solo per chi ha un account,
      // perche solo li c'e qualcosa di verificabile.
      if (!userToken) {
        return NextResponse.json(
          { error: 'Serve un account per consultare l\'archivio sul server. Le conversazioni restano sul tuo dispositivo.' },
          { status: 401 }
        );
      }
      const session = await getSession(userToken);
      const resolvedName = session ? (session.name || session.email) : null;
      if (!resolvedName) return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });

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

    // ── b.123 · IL GETTONE DI STANZA NON ERA LEGATO A QUESTA STANZA ──
    //
    // Prima, qui sopra, c'era scritto per esteso:
    //
    //     "verify the token is valid but don't check room ID
    //      (the conversation may be from an archived room)"
    //
    // Era una scelta consapevole, con un buon motivo — la stanza non
    // esiste piu — e apriva comunque la porta. Perche subito dopo
    // l'unico controllo rimasto era:
    //
    //     conv.members.some(m => m.name === resolvedName)
    //
    // e un gettone di stanza si ottiene creando UNA STANZA QUALSIASI e
    // scegliendosi il nome che si vuole. Quindi:
    //
    //   so che Mario ha parlato in una conversazione
    //     → mi creo una mia stanza e mi chiamo "Mario"
    //     → ottengo un gettone valido, con name: "Mario"
    //     → il gettone non viene confrontato con QUESTA conversazione
    //     → leggo la conversazione di Mario
    //
    // ── COSA LO CHIUDE, SENZA MIGRARE NIENTE ──
    //
    // In `saveConversation` l'identificativo della conversazione E il
    // codice della stanza: `const id = roomId.toUpperCase()`. Quindi il
    // gettone si puo legare eccome: deve essere stato emesso PER QUESTA
    // stanza. Il gettone della stanza che si e appena creata ha un altro
    // codice, e non passa.
    //
    // ── Ma prima ancora: senza NESSUNA credenziale non si tocca nulla ──
    //
    // Spostare la lettura della conversazione prima dell'identita mi ha
    // creato un difetto nuovo: un anonimo riceveva 404 per un id
    // inesistente e 401 per uno esistente. Cioe poteva scoprire quali
    // identificativi esistono provandoli, senza avere niente in mano.
    //
    // Chi non presenta alcuna credenziale si ferma qui, e riceve sempre
    // la stessa risposta: non impara niente.
    if (!ut && !rst) {
      return NextResponse.json({ error: 'Verified session required' }, { status: 401 });
    }

    // Serve la conversazione per sapere a cosa confrontare il gettone.
    const conv = await getConversation(id);
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    let resolvedName = null;

    // 1. Un account: l'identita e verificata a monte, dal login.
    if (ut) {
      const session = await getSession(ut);
      if (session) resolvedName = session.name || session.email;
    }

    // 2. Un gettone di stanza: vale solo per la stanza da cui e nato.
    if (!resolvedName && rst) {
      const session = await verifyRoomSession(rst);
      if (session?.name && String(session.roomId || '').toUpperCase() === String(conv.id || '').toUpperCase()) {
        resolvedName = session.name;
      }
    }

    if (!resolvedName) return NextResponse.json({ error: 'Verified session required' }, { status: 401 });

    // Il controllo sui partecipanti resta: e la seconda rete. Da solo
    // non bastava, insieme al vincolo sopra si tengono.
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

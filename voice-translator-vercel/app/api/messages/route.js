import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { addMessage, getMessages, updateMessage, getRoom, resolveRoomIdentity } from '../../lib/store.js';
import { sanitizeRoomId, sanitizeName, sanitizeText, sanitizeTranslations, getClientIP } from '../../lib/validate.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';
import { createLogger } from '../../lib/logger.js';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
import { puoPartire } from '../../lib/reati.js';

const log = createLogger('messages');

// POST /api/messages - Send a translation to the room
// BLOCKED in Direct mode — no server-side message storage
async function handlePost(req) {
  try {
    // ── Direct mode guard: no message storage ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    // b.106 — secondo limitatore sulla stessa chiave "messages:IP" del
    // guard in fondo al file: ogni richiesta contava due volte e il tetto
    // vero era 60, non 120.

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

    // clientId: l'id temporaneo del mittente. Salvarlo permette al ricevente
    // di riconoscere che broadcast istantaneo e polling sono LO STESSO messaggio
    // (il confronto sul testo fallisce quando la sanitizzazione lo modifica → doppioni).
    const clientId = (typeof body.clientId === 'string' && /^tmp_[\w-]{1,60}$/.test(body.clientId))
      ? body.clientId : null;

    // ── b.111 · il confine, anche qui ──
    // Lo stesso controllo c'e gia sul telefono, prima dell'invio: quello
    // e il solo che funziona in modalita Direct, dove qui non arriva
    // niente. Ma un client si puo modificare, e chi vuole mandare una
    // minaccia e esattamente il tipo di persona disposta a farlo.
    // Quindi si ripete: il divieto vale in ogni stanza, hot comprese.
    const confine = puoPartire(original);
    if (!confine.ok) {
      log.warn('messaggio fermato al confine:', confine.categoria);
      return NextResponse.json(
        { error: confine.motivo, categoria: confine.categoria, bloccato: true },
        { status: 422 }
      );
    }

    // ── b.126 · un doppione si riconosce dal SUO IDENTIFICATIVO ──
    //
    // Prima era: stesso mittente + stesso testo entro 8 secondi =
    // duplicato. Ma in una conversazione vera questo e normalissimo:
    //
    //     A: si
    //     B: sei sicuro?
    //     A: si
    //
    // Il secondo "si" spariva. E nessuno poteva capirlo: non compariva
    // un errore, il messaggio semplicemente non c'era.
    //
    // Un doppio invio e la STESSA spedizione ripetuta — un doppio tocco,
    // un ritentativo di rete. Il client la marca con un identificativo
    // suo: due spedizioni diverse hanno identificativi diversi, anche se
    // dicono la stessa cosa. Il contenuto non identifica niente.
    //
    // Il ripiego su mittente+testo resta solo per i client vecchi che
    // non mandano ancora `clientMessageId`, e con una finestra molto
    // piu stretta (1,5 s): abbastanza per un doppio tocco, troppo poco
    // per due risposte vere.
    try {
      const recenti = await getMessages(roomId, Date.now() - 8000);
      let gemello = null;
      if (clientId) {
        // `clientId` esisteva gia (formato `tmp_...`): e l'identificativo
        // che il mittente assegna alla spedizione. Serviva solo smettere
        // di ignorarlo qui. Inventarne un altro avrebbe aggiunto un
        // quinto concetto per la stessa cosa.
        gemello = recenti.find((m) => m.clientId === clientId);
      } else {
        const soglia = Date.now() - 1500;
        gemello = recenti.find((m) =>
          m.sender === identity.name && m.original === original && (m.timestamp || 0) >= soglia);
      }
      if (gemello) {
        return NextResponse.json({ message: gemello, duplicato: true });
      }
    } catch { /* se la verifica fallisce, meglio salvare che perdere */ }

    const msg = await addMessage(roomId, {
      sender: identity.name, original, sourceLang,
      translated,
      targetLang,
      translations,
      ...(clientId && { clientId }),
    });
    if (!msg) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    return NextResponse.json({ message: msg });
  } catch (e) {
    log.error('Messages error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/messages - Update existing message with translation (Phase 2 of two-phase send)
async function handlePatch(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const rl = await checkRateLimit(getRateLimitKey(req, 'messages-patch'), 120);
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

    // Verify sender is a member of this room
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const isMember = room.members.some(m => m.name === identity.name);
    if (!isMember) return NextResponse.json({ error: 'Not a room member' }, { status: 403 });

    const translated = sanitizeText(body.translated || '', 10000);
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang.slice(0, 10) : '';
    const translations = sanitizeTranslations(body.translations);

    // b.126 — l'identificativo del messaggio, se il client lo manda.
    // Senza, si ricadeva su `sender + testo`: due "si" di fila dello
    // stesso utente sono indistinguibili, e la traduzione del primo, se
    // arrivava tardi, finiva sul secondo.
    const messageId = (typeof body.clientId === 'string' && /^tmp_[\w-]{1,60}$/.test(body.clientId))
      ? body.clientId : '';
    const updated = await updateMessage(roomId, identity.name, original, {
      translated, targetLang, translations,
    }, messageId);
    if (!updated) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

    return NextResponse.json({ message: updated });
  } catch (e) {
    log.error('Messages PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/messages?room=XXX&name=YYY&after=TIMESTAMP - Poll for new messages
// Room session token via X-Room-Session header (NEVER in query string)
async function handleGet(req) {
  try {
    // ── Direct mode guard ──
    try { assertCloudProcessingAllowed(req); } catch (e) {
      if (e instanceof DirectModeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { searchParams } = new URL(req.url);
    const roomId = sanitizeRoomId(searchParams.get('room') || '');
    const name = sanitizeName(searchParams.get('name') || '');
    const roomSessionToken = req.headers.get('x-room-session') || null;
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
    log.error('Messages GET error:', e.message);
    import('@sentry/nextjs').then(S => {
      S.captureException(e, { tags: { endpoint: 'messages', action: 'get' } });
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 120, prefix: 'messages' });
export const PATCH = withApiGuard(handlePatch, { maxRequests: 120, prefix: 'messages' });
export const GET = withApiGuard(handleGet, { maxRequests: 120, prefix: 'messages' });

import { NextResponse } from 'next/server';
import { createRoom, getRoom, joinRoom, updateHeartbeat, setSpeaking, updateRoomMode, changeMemberLang, createRoomSession, resolveRoomIdentity, setHandRaised, grantSpeaking } from './store.js';
import { redis } from './redis.js';
import { sanitizeRoomId, sanitizeName, sanitize } from './validate.js';
import { createLogger } from './logger.js';
const log = createLogger('roomActions');

// ── Helper: resolve identity from token or fallback to name ──
export async function resolveIdentity(roomSessionToken, name, roomId) {
  return resolveRoomIdentity(roomSessionToken, name, roomId);
}

// ── Helper: verify membership ──
async function verifyMembership(roomId, identity) {
  const room = await getRoom(roomId);
  if (!room) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) };
  if (!room.members.some(m => m.name === identity.name)) {
    return { error: NextResponse.json({ error: 'Not a room member' }, { status: 403 }) };
  }
  return { room };
}

// ── Action: create ──
export async function handleCreate({ name, lang, mode, avatar, context, contextPrompt, description, hostTier, hostEmail, diretta }) {
  if (!name || !lang) return NextResponse.json({ error: 'name and lang required' }, { status: 400 });
  const room = await createRoom(name, lang, mode || 'conversation', avatar || null, context || null, contextPrompt || null, description || null, hostTier || 'FREE', hostEmail || null, !!diretta);
  const { token } = await createRoomSession(room.id, name, 'host');
  return NextResponse.json({ room, roomSessionToken: token });
}

// ── Action: join ──
export async function handleJoin({ roomId, name, lang, avatar }) {
  if (!roomId || !name || !lang) return NextResponse.json({ error: 'roomId, name, lang required' }, { status: 400 });

  // ── Moderazione: si controlla PRIMA di far entrare ──
  // Un blocco che si applica dopo l'ingresso non e un blocco: la persona
  // e gia dentro, ha gia scritto, e la si deve ributtare fuori a mano.
  const { puoEntrare } = await import('./moderazione.js');
  const varco = await puoEntrare(roomId, name);
  if (!varco.ok) {
    if (varco.motivo === 'bloccato') {
      return NextResponse.json({ error: 'bloccato', motivo: 'bloccato' }, { status: 403 });
    }
    // Su approvazione: si bussa e si aspetta. Non e un errore, e un'attesa,
    // e il client deve poterla raccontare invece di dire "non funziona".
    const { richiediIngresso } = await import('./moderazione.js');
    const stato = varco.motivo === 'rifiutato' ? 'rifiutato' : await richiediIngresso(roomId, name);
    return NextResponse.json({ inAttesa: stato === 'in-attesa', stato, motivo: varco.motivo }, { status: 403 });
  }

  const room = await joinRoom(roomId, name, lang, avatar || null);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  // b.126 — stanza piena: si rifiuta CHI ARRIVA, non si butta fuori chi
  // c'e gia. Prima l'undicesimo prendeva il posto di un partecipante,
  // che restava col suo gettone ma fuori da room.members — e scopriva di
  // essere stato espulso solo dai 403 che cominciava a ricevere.
  if (room.piena) {
    return NextResponse.json(
      { error: 'La stanza e al completo', piena: true },
      { status: 409 }
    );
  }
  const member = room.members.find(m => m.name === name);
  const role = member?.role || 'guest';
  const { token } = await createRoomSession(room.id, name, role);
  return NextResponse.json({ room, roomSessionToken: token });
}

// ── Action: heartbeat ──
export async function handleHeartbeat({ roomId, identity }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const room = await updateHeartbeat(roomId, identity.name);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  // Attach verified identity info so client doesn't need name-based guessing
  const isHost = identity.verified
    ? identity.role === 'host'
    : room.host === identity.name;
  return NextResponse.json({ room, verifiedName: identity.name, isHost });
}

// ── Action: speaking ──
export async function handleSpeaking({ roomId, identity, speaking, liveText, typing }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { room: speakRoom, error } = await verifyMembership(roomId, identity);
  if (error) return error;
  const safeLiveText = liveText ? sanitize(liveText, 500) : null;
  const room = await setSpeaking(roomId, identity.name, !!speaking, safeLiveText, !!typing);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: changeMode ──
export async function handleChangeMode({ roomId, mode, identity }) {
  if (!roomId || !mode) return NextResponse.json({ error: 'roomId and mode required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const currentRoom = await getRoom(roomId);
  if (!currentRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  // Token-verified: check role; unverified: check name
  const isHost = identity.verified
    ? identity.role === 'host'
    : currentRoom.host === identity.name;
  if (!isHost) {
    return NextResponse.json({ error: 'Only the host can change room mode' }, { status: 403 });
  }
  const room = await updateRoomMode(roomId, mode);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: raiseHand (classroom mode) ──
export async function handleRaiseHand({ roomId, identity, raised }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { error } = await verifyMembership(roomId, identity);
  if (error) return error;
  const room = await setHandRaised(roomId, identity.name, raised !== false);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: grantSpeak (classroom mode — host only) ──
export async function handleGrantSpeak({ roomId, identity, targetMember }) {
  if (!roomId || !targetMember) return NextResponse.json({ error: 'roomId and targetMember required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const currentRoom = await getRoom(roomId);
  if (!currentRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  const isHost = identity.verified ? identity.role === 'host' : currentRoom.host === identity.name;
  if (!isHost) return NextResponse.json({ error: 'Only the host can grant speaking' }, { status: 403 });
  const room = await grantSpeaking(roomId, targetMember);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}

// ── Action: changeLang ──
export async function handleChangeLang({ roomId, lang, identity }) {
  if (!roomId || !lang) return NextResponse.json({ error: 'roomId and lang required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { error } = await verifyMembership(roomId, identity);
  if (error) return error;
  const room = await changeMemberLang(roomId, identity.name, lang);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  return NextResponse.json({ room });
}
// ── b.126 · qui c'erano handleWebrtcSignal e handleWebrtcPoll ──
//
// Erano una SECONDA implementazione del signalling WebRTC, via
// /api/room, accanto a quella vera che passa da Supabase Realtime
// (useWebRTC.js: `channel.on('broadcast', { event: 'webrtc-signal' })`).
//
// Nessun client le chiamava piu: verificato cercando
// `action: 'webrtc-signal'` in tutto app/ — zero occorrenze fuori da
// qui. Ed erano il percorso MENO protetto dei due: in mancanza di un
// gettone si accontentavano di `signal.from`, cioe di un nome
// dichiarato dal chiamante. Esattamente la classe di difetto chiusa in
// b.123 su archivio e riassunto.
//
// Un secondo ingresso dimenticato e peggio di un ingresso in piu: non
// viene aggiornato quando si irrobustisce il primo, e resta aperto
// mentre tutti credono che la porta sia una sola.
//
// Se un giorno servisse un ripiego al Realtime, va riscritto con la
// stessa verifica del percorso principale — non resuscitato.
// ── Action: check ──
export async function handleCheck({ roomId }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  const room = await getRoom(roomId);
  return NextResponse.json({ exists: !!room, ended: room?.ended || false });
}

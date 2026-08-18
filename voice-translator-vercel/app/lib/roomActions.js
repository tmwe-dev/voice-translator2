import { NextResponse } from 'next/server';
import { createRoom, getRoom, joinRoom, updateHeartbeat, setSpeaking, updateRoomMode, changeMemberLang, createRoomSession, resolveRoomIdentity, setHandRaised, grantSpeaking, creaSegretoHost, verificaSegretoHost, potaMembriAssenti } from './store.js';
import { redis } from './redis.js';
import { sanitizeRoomId, sanitizeName, sanitize } from './validate.js';
import { createLogger } from './logger.js';
import { puoModerare, eMembro, ruoloDi } from './decisioni.js';
import { MODES } from './constants.js';
const log = createLogger('roomActions');

// b.155 — audit dei setting di conversazione: handleChangeMode
// scriveva QUALSIASI stringa arrivasse dal client come modalita della
// stanza, senza controllare che fosse una delle 4 esistenti
// (conversation/classroom/freetalk/simultaneous). Non e uno sfruttamento
// (solo l'host puo chiamarla, vedi puoModerare sotto), ma un valore
// non valido finiva comunque nel database e nessun ramo della UI lo
// riconosce — la stanza resta silenziosamente senza controlli vocali
// per chiunque la apra dopo. Whitelist esplicita.
const MODE_IDS = new Set(MODES.map(m => m.id));

// ── Helper: resolve identity from token or fallback to name ──
export async function resolveIdentity(roomSessionToken, name, roomId) {
  return resolveRoomIdentity(roomSessionToken, name, roomId);
}

// ── Helper: verify membership ──
async function verifyMembership(roomId, identity) {
  const room = await getRoom(roomId);
  if (!room) return { error: NextResponse.json({ error: 'Room not found' }, { status: 404 }) };
  // b.139-bis — questo confronto era ricopiato in cinque punti (qui,
  // il ruolo qui sotto, e tre volte in /api/messages). Ora la domanda
  // "fa parte della stanza?" ha una risposta sola, in decisioni.js.
  if (!eMembro(room, identity.name)) {
    return { error: NextResponse.json({ error: 'Not a room member' }, { status: 403 }) };
  }
  return { room };
}

// b.166 — CONFERMATO (caccia al tesoro): a differenza di quasi ogni altro
// campo testuale del repo (che passa da sanitizeText/sanitize con un
// maxLen esplicito), avatar/context/contextPrompt/description arrivavano
// qui senza alcun limite di lunghezza — solo il tetto generico di 256KB
// del body in withApiGuard. L'intero oggetto stanza (con TUTTI i membri)
// viene letto/riscritto per intero ad ogni heartbeat/speaking/join via
// script Lua sincroni su Redis (single-thread): valori sovradimensionati
// per membro, moltiplicati fino a CAPIENZA.MAX partecipanti, degradano le
// performance di TUTTA l'istanza Redis condivisa. Limiti coerenti con
// quelli gia usati altrove per campi simili (schemas.js: domainContext
// 100, description 200).
const MAXLEN_AVATAR = 300;
const MAXLEN_CONTEXT = 200;
const MAXLEN_CONTEXT_PROMPT = 500;
const MAXLEN_DESCRIPTION = 200;

// ── Action: create ──
export async function handleCreate({ name, lang, mode, avatar, context, contextPrompt, description, hostTier, hostEmail, diretta, maxPartecipanti }) {
  if (!name || !lang) return NextResponse.json({ error: 'name and lang required' }, { status: 400 });
  const room = await createRoom(
    name, lang, mode || 'conversation',
    avatar ? sanitize(avatar, MAXLEN_AVATAR) : null,
    context ? sanitize(context, MAXLEN_CONTEXT) : null,
    contextPrompt ? sanitize(contextPrompt, MAXLEN_CONTEXT_PROMPT) : null,
    description ? sanitize(description, MAXLEN_DESCRIPTION) : null,
    hostTier || 'FREE', hostEmail || null, !!diretta, maxPartecipanti ?? null
  );
  const { token } = await createRoomSession(room.id, name, 'host');
  // b.169 — vedi la nota su creaSegretoHost in store.js: e la sola
  // occasione in cui questo segreto esce dal server. Il client lo tiene
  // per se (localStorage) e lo ripresenta a `join` per rientrare come
  // host dopo aver perso roomSessionTokenRef (che vive solo in memoria).
  const hostSecret = await creaSegretoHost(room.id);
  return NextResponse.json({ room, roomSessionToken: token, hostSecret });
}

// ── Action: join ──
export async function handleJoin({ roomId, name, lang, avatar, hostSecret }) {
  if (!roomId || !name || !lang) return NextResponse.json({ error: 'roomId, name, lang required' }, { status: 400 });
  avatar = avatar ? sanitize(avatar, MAXLEN_AVATAR) : avatar;

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
  // b.169 — CONFERMATO (audit esterno 15/8, P0-3): qui si chiedeva a
  // ruoloDi() che ruolo scrivere sul NUOVO gettone e ci si fidava alla
  // lettera. Se `name` combacia con un membro segnato come host in
  // room.members, ora serve ANCHE il segreto host (creaSegretoHost in
  // store.js, dato solo a chi ha creato la stanza) per ottenere
  // davvero il ruolo host sul nuovo gettone. Senza segreto valido si
  // rientra come guest — anche scrivendo il nome giusto. Vedi la nota
  // estesa su creaSegretoHost in store.js per il perche e per l'effetto
  // collaterale dichiarato (host che perde il segreto non rientra piu
  // come host da solo).
  const ruoloRichiesto = ruoloDi(room, name);
  const ruoloFinale = (ruoloRichiesto === 'host' && !(await verificaSegretoHost(roomId, hostSecret)))
    ? 'guest'
    : ruoloRichiesto;
  const { token } = await createRoomSession(room.id, name, ruoloFinale);
  return NextResponse.json({ room, roomSessionToken: token });
}

// ── Action: heartbeat ──
export async function handleHeartbeat({ roomId, identity }) {
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const room = await updateHeartbeat(roomId, identity.name);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  // Attach verified identity info so client doesn't need name-based guessing
  // b.139 — la stessa domanda ("e l'host?") era scritta a mano qui, in
  // handleChangeMode, in handleGrantSpeak, in /api/conversation e in
  // /api/moderazione: cinque copie, e non tutte uguali (chi confrontava i
  // nomi alla lettera, chi normalizzati, chi guardava le regole di vetrina).
  // Ora la risposta e una sola.
  const isHost = puoModerare({ identita: identity, stanza: room });
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
  if (!MODE_IDS.has(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  if (!identity) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const currentRoom = await getRoom(roomId);
  if (!currentRoom) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (!puoModerare({ identita: identity, stanza: currentRoom })) {
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
  if (!puoModerare({ identita: identity, stanza: currentRoom })) {
    return NextResponse.json({ error: 'Only the host can grant speaking' }, { status: 403 });
  }
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
  // b.248 — anche questa lettura fa pulizia dei membri muti oltre
  // soglia (vedi potaMembriAssenti in store.js): HomeView chiama
  // `check` a ogni avvio, ed e un'occasione in piu per far sparire i
  // fantasmi anche quando dentro non batte piu nessuno. La risposta
  // NON cambia forma (exists/ended, come sempre) e la potatura ingoia
  // da sola ogni suo errore: al peggio il fantasma resta un giro in piu.
  if (room && !room.ended) await potaMembriAssenti(roomId, room);
  return NextResponse.json({ exists: !!room, ended: room?.ended || false });
}

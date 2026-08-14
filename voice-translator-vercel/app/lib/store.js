// Upstash Redis store for rooms, messages, and conversation history
// Uses shared Redis client from redis.js
// All read-modify-write operations use Lua scripts for atomicity (no race conditions)

import { createLogger } from './logger.js';
import { redis } from './redis.js';
import { normalizzaCapienza, normalizzaTipoStanza } from './decisioni.js';
import { randomUUID, randomBytes } from 'crypto';

const log = createLogger('store');
import {
  JOIN_ROOM, SET_SPEAKING, ADD_COST, UPDATE_ROOM_MODE, AGGIORNA_POLITICA_PUBBLICA,
  CHANGE_MEMBER_LANG, SET_HAND_RAISED, GRANT_SPEAKING,
  UPDATE_MESSAGE, ADD_MESSAGE, UPDATE_CONV_SUMMARY
} from './redisLua.js';

// =============================================
// ROOM SESSION TOKENS — server-verified identity
// Replaces trust-the-client name-based identity
// =============================================

/**
 * Create a room session token for a member.
 * Called on room create and join. Token proves identity for all room operations.
 * @returns {{ token: string }} The session token
 */
export async function createRoomSession(roomId, memberName, role) {
  const token = randomUUID();
  const session = { roomId: roomId.toUpperCase(), name: memberName, role, created: Date.now() };
  // 24 hour TTL for room sessions
  await redis('SET', `rsess:${token}`, JSON.stringify(session), 'EX', 86400);
  return { token };
}

/**
 * Verify a room session token. Returns the session data or null.
 * @returns {{ roomId: string, name: string, role: string, created: number } | null}
 */
export async function verifyRoomSession(token) {
  if (!token || typeof token !== 'string') return null;
  const data = await redis('GET', `rsess:${token}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse room session:', e.message); return null; } return parsed;
}

/**
 * Resolve identity from request: REQUIRES valid room session token.
 * Name-only fallback has been REMOVED (security: prevents impersonation).
 * @param {string} token - Room session token (from header or body)
 * @param {string} name - Ignored (kept for API compat, not used)
 * @param {string} roomId - Expected room ID
 * @returns {{ name: string, role: string, verified: boolean } | null}
 */
export async function resolveRoomIdentity(token, name, roomId) {
  if (!token) return null;
  const session = await verifyRoomSession(token);
  if (session && session.roomId === roomId.toUpperCase()) {
    return { name: session.name, role: session.role, verified: true };
  }
  return null;
}

// =============================================
// ROOMS
// =============================================

export async function createRoom(creatorName, creatorLang, mode = 'conversation', avatar = null, context = null, contextPrompt = null, description = null, hostTier = 'FREE', hostEmail = null, diretta = false, maxPartecipanti = null) {
  const id = randomBytes(4).toString('hex').toUpperCase();
  const room = {
    id,
    created: Date.now(),
    mode,
    host: creatorName,
    hostTier: hostTier, // FREE, PRO, or TOP PRO - guests inherit this
    hostEmail: hostEmail || null, // for billing guest usage to host
    members: [{ name: creatorName, lang: creatorLang, joined: Date.now(), role: 'host', avatar }],
    context: context || 'general',
    contextPrompt: contextPrompt || '',
    description: description || '',
    totalCost: 0,
    msgCount: 0,
    // b.113 — Stanza Diretta: la scelta la fa l'host, ma DEVE viaggiare
    // con la stanza. Chi entra dopo, da un invito o dalla vetrina, non
    // ha modo di saperlo altrimenti: si ritroverebbe in una stanza
    // senza traduzione senza capire perche, oppure — molto peggio —
    // continuerebbe a mandare la propria voce alla nuvola credendo di
    // essere in una conversazione riservata.
    diretta: !!diretta,
    // ── b.139-bis · IL TETTO SI SCRIVE ALLA NASCITA ──
    //
    // Non veniva scritto affatto. L'unico punto che lo metteva sulla
    // stanza era `aggiornaPoliticaPubblica`, chiamata solo da /api/mondo:
    // cioe SOLO per le stanze pubblicate in vetrina. In una stanza
    // privata il campo restava assente e il tetto vero diventava il
    // ripiego dello script Lua — che valeva DIECI, mentre il modulo di
    // creazione ne aveva promessi venti e disegnato i bottoni fino a 50.
    //
    // L'undicesimo si sentiva dire "La stanza e al completo" in una
    // stanza creata per venti, senza che nessuno dei due potesse capire
    // perche. Ora il numero c'e da subito, e viene dalla stessa
    // funzione che usa la vetrina.
    maxPartecipanti: normalizzaCapienza(maxPartecipanti, { diretta: !!diretta }),
    ended: false
  };
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 3600); // 1 hour TTL (privacy-first)
  return room;
}

export async function getRoom(id) {
  if (!id) return null;
  const data = await redis('GET', `room:${id.toUpperCase()}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse room:', e.message); return null; } return parsed;
}

export async function joinRoom(id, name, lang, avatar = null) {
  const key = `room:${id.toUpperCase()}`;
  const result = await redis('EVAL', JOIN_ROOM, 1, key, name, lang, avatar || '', Date.now().toString());
  if (!result) return null;
  // b.126 — la stanza piena ora si dichiara, invece di far fuori qualcuno
  // per fare posto. Chi chiama deve poterlo distinguere da "non esiste".
  if (result === 'PIENA') return { piena: true };
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse joinRoom result:', e.message); return null; }
}

export async function setSpeaking(roomId, memberName, speaking, liveText = null, typing = false) {
  const key = `room:${roomId.toUpperCase()}`;
  const now = Date.now().toString();
  const result = await redis('EVAL', SET_SPEAKING, 1, key,
    memberName, speaking ? '1' : '0', liveText || '', typing ? '1' : '0', now, liveText !== null ? '1' : '0');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse setSpeaking result:', e.message); return null; }
}

export async function updateHeartbeat(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  let room; try { room = JSON.parse(data); } catch (e) { log.warn('Failed to parse room in updateHeartbeat:', e.message); return null; }
  // READ-ONLY heartbeat: just refresh TTL without writing room data back.
  // This prevents race conditions where heartbeat overwrites a concurrent
  // joinRoom operation, effectively removing the guest from the room.
  await redis('EXPIRE', key, 3600);
  return room;
}

export async function addCost(roomId, amount) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', ADD_COST, 1, key, amount.toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse addCost result:', e.message); return null; }
}

export async function updateRoomMode(roomId, newMode) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', UPDATE_ROOM_MODE, 1, key, newMode);
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateRoomMode result:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
// LA POLITICA PUBBLICA VIVE SULLA STANZA (b.125)
//
// Prima `hot`, `roomType`, `maxPartecipanti` e `suApprovazione`
// stavano solo nella voce della vetrina (/api/mondo) e, in parte,
// nelle regole di moderazione. La stanza vera non li conosceva.
//
// Ma MessageList decide se velare le parole pesanti cosi:
//
//     <ForseVelato hot={!!roomInfo?.hot} ...>
//
// e `roomInfo` E la stanza. Quindi leggeva sempre `undefined`, il velo
// si applicava sempre, e le stanze "litigio libero" non lo sono mai
// state — pur essendo la casella nella UI, il campo nel database della
// vetrina e la regola di moderazione tutti al loro posto.
//
// Tre sistemi che descrivono la stessa stanza, e quello che l'utente
// guarda non parla con quello che l'utente ha scelto.
//
// Qui la politica torna dove serve leggerla. Non risolve tutta
// l'ambiguita — la vetrina tiene ancora una sua copia per l'elenco —
// ma toglie il disallineamento sul campo che decide cosa si vede.
// ═══════════════════════════════════════════════════════════════
export async function aggiornaPoliticaPubblica(roomId, { hot, roomType, maxPartecipanti, suApprovazione }) {
  if (!roomId) return null;
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', AGGIORNA_POLITICA_PUBBLICA, 1, key,
    hot ? '1' : '0',
    normalizzaTipoStanza(roomType),
    String(normalizzaCapienza(maxPartecipanti)),
    suApprovazione ? '1' : '0');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('politica pubblica non rileggibile:', e.message); return null; }
}

export async function changeMemberLang(roomId, memberName, newLang) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', CHANGE_MEMBER_LANG, 1, key, memberName, newLang, Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse changeMemberLang result:', e.message); return null; }
}

// =============================================
// CLASSROOM MODE — Hand Raise & Grant Speaking
// =============================================

/**
 * Toggle hand raised state for a member (classroom mode).
 * @param {string} roomId
 * @param {string} memberName
 * @param {boolean} raised
 * @returns {object|null} Updated room
 */
export async function setHandRaised(roomId, memberName, raised) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', SET_HAND_RAISED, 1, key, memberName, raised ? '1' : '0', Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse setHandRaised result:', e.message); return null; }
}

/**
 * Host grants speaking permission to a member (classroom mode).
 * Automatically lowers all other hands and sets the granted member as speaking.
 * @param {string} roomId
 * @param {string} memberName - Member to grant speaking
 * @returns {object|null} Updated room
 */
export async function grantSpeaking(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  const result = await redis('EVAL', GRANT_SPEAKING, 1, key, memberName, Date.now().toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse grantSpeaking result:', e.message); return null; }
}

// =============================================
// MESSAGES
// =============================================

export async function addMessage(roomId, msg) {
  const id = roomId.toUpperCase();
  const now = Date.now();
  const msgId = now.toString(36) + randomBytes(3).toString('hex');
  const msgJson = JSON.stringify(msg);
  const result = await redis('EVAL', ADD_MESSAGE, 2, `room:${id}`, `msgs:${id}`, msgJson, msgId, now.toString());
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse addMessage result:', e.message); return null; }
}

/**
 * Update an existing message with translation data (Phase 2 of two-phase send).
 * Finds message by sender + original text, updates translated/targetLang/translations.
 */
// b.126 — `messageId` e il modo giusto di dire QUALE messaggio. `sender`
// e `original` restano come ripiego per i client vecchi, che non lo
// mandano ancora: senza, la fase 2 delle loro traduzioni smetterebbe di
// funzionare al primo deploy.
export async function updateMessage(roomId, sender, original, updates, messageId = '') {
  const id = roomId.toUpperCase();
  const key = `msgs:${id}`;
  const result = await redis('EVAL', UPDATE_MESSAGE, 1, key,
    sender, original,
    updates.translated || '', updates.targetLang || '',
    updates.translations ? JSON.stringify(updates.translations) : '',
    messageId || '');
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateMessage result:', e.message); return null; }
}

// b.111 — quante righe si leggono quando si chiede "cosa e successo
// da un secondo a questa parte". La lista ne tiene 200 (LTRIM in
// ADD_MESSAGE): prima si leggevano e si interpretavano TUTTE E 200 a
// ogni giro, cioe ogni secondo e mezzo, per tenerne quasi sempre zero
// o una. In una stanza di quattro persone erano 32.000 letture al
// minuto per consegnare qualche frase.
//
// Sessanta e abbondante: in un secondo e mezzo non arrivano sessanta
// messaggi. Se pero la coda pescata comincia gia dopo il momento
// richiesto, vuol dire che qualcosa e rimasto indietro (il telefono
// era in tasca, la rete era caduta) e allora si rilegge tutto. Meglio
// una lettura in piu ogni tanto che un messaggio perso.
const CODA_MESSAGGI = 60;

export async function getMessages(roomId, after = 0) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const interpreta = (righe) => righe
    .map(m => { try { return JSON.parse(m); } catch (e) { log.warn('Failed to parse message in getMessages:', e.message); return null; } })
    .filter(Boolean)
    // FASE 6A: Use >= to avoid missing messages at exact timestamp boundary
    // Client-side dedup by message ID handles duplicates
    .filter(m => m.timestamp >= after);

  // Primo caricamento: serve tutta la conversazione, non c'e scorciatoia.
  if (!after) {
    const tutti = await redis('LRANGE', key, 0, -1);
    return Array.isArray(tutti) ? interpreta(tutti) : [];
  }

  const coda = await redis('LRANGE', key, -CODA_MESSAGGI, -1);
  if (!coda || !Array.isArray(coda)) return [];
  const recenti = interpreta(coda);

  // Se TUTTI i sessanta pescati sono nuovi, il piu vecchio dei nuovi
  // potrebbe non essere il piu vecchio che serviva: si rilegge tutto.
  if (coda.length >= CODA_MESSAGGI && recenti.length === coda.length) {
    const tutti = await redis('LRANGE', key, 0, -1);
    return Array.isArray(tutti) ? interpreta(tutti) : recenti;
  }
  return recenti;
}

export async function getAllMessages(roomId) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const allMsgs = await redis('LRANGE', key, 0, -1);
  if (!allMsgs || !Array.isArray(allMsgs)) return [];
  return allMsgs.map(m => { try { return JSON.parse(m); } catch (e) { log.warn('Failed to parse message in getAllMessages:', e.message); return null; } }).filter(Boolean);
}

// =============================================
// CONVERSATION HISTORY - persists after room ends
// =============================================

export async function saveConversation(roomId) {
  const id = roomId.toUpperCase();
  const room = await getRoom(id);
  if (!room) return null;
  const messages = await getAllMessages(id);

  const conv = {
    id,
    created: room.created,
    ended: Date.now(),
    mode: room.mode,
    host: room.host,
    members: room.members.map(m => ({ name: m.name, lang: m.lang, role: m.role, avatar: m.avatar })),
    totalCost: room.totalCost || 0,
    msgCount: messages.length,
    messages,
    summary: null // filled later by AI
  };

  // b.110 — il commento diceva sette giorni e il codice ne dava UNO
  // (86400). L'elenco invece scade davvero a sette (604800, sotto):
  // dopo un giorno la conversazione compariva ancora nell'archivio ma
  // aprirla dava "non trovata". Dati dell'utente persi senza un avviso.
  await redis('SET', `conv:${id}`, JSON.stringify(conv), 'EX', 604800);

  // Add to each member's conversation list
  for (const member of room.members) {
    const listKey = `convlist:${member.name}`;
    const entry = JSON.stringify({
      id,
      created: room.created,
      ended: conv.ended,
      host: room.host,
      members: conv.members.map(m => m.name),
      msgCount: conv.msgCount,
      hasSummary: false
    });
    await redis('RPUSH', listKey, entry);
    await redis('LTRIM', listKey, -20, -1); // keep last 20 conversations (device has full history)
    await redis('EXPIRE', listKey, 604800); // 7 days
  }

  // Mark room as ended
  room.ended = true;
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 3600);

  return conv;
}

export async function getConversation(convId) {
  const data = await redis('GET', `conv:${convId.toUpperCase()}`);
  if (!data) return null;
  let parsed; try { parsed = JSON.parse(data); } catch (e) { log.warn('Failed to parse conversation:', e.message); return null; } return parsed;
}

export async function updateConversationSummary(convId, summary) {
  const key = `conv:${convId.toUpperCase()}`;
  const result = await redis('EVAL', UPDATE_CONV_SUMMARY, 1, key, typeof summary === 'string' ? summary : JSON.stringify(summary));
  if (!result) return null;
  try { return JSON.parse(result); } catch (e) { log.warn('Failed to parse updateConversationSummary result:', e.message); return null; }
}

// ═══════════════════════════════════════════════════════════════
// ELIMINARE UNA CONVERSAZIONE (b.126)
//
// L'azione non esisteva. Il pulsante c'era, il client la mandava, e
// /api/conversation rispondeva "Invalid action" — ma il client non
// guardava `res.ok` e tornava all'elenco come se fosse andata bene.
//
// Il dato dell'utente restava sul server per sette giorni, e lui era
// convinto di averlo cancellato. Non e un difetto di comodita.
//
// Si toglie da due posti: la conversazione (`conv:ID`) e la riga
// nell'elenco di OGNI partecipante (`convlist:NOME`) — altrimenti
// resterebbe visibile e aprirebbe su "non trovata".
// ═══════════════════════════════════════════════════════════════
export async function deleteConversation(convId, richiedente) {
  const id = String(convId || '').toUpperCase();
  if (!id || !richiedente) return { esito: 'dati-mancanti' };

  const conv = await getConversation(id);
  if (!conv) return { esito: 'non-trovata' };

  // Solo chi c'era puo cancellarla. Senza questo controllo sarebbe lo
  // stesso buco che b.123 ha appena chiuso su lettura e riassunto.
  const eraPresente = conv.members?.some((m) => m.name === richiedente);
  if (!eraPresente) return { esito: 'non-partecipante' };

  await redis('DEL', `conv:${id}`);

  // La riga va tolta dall'elenco di tutti, non solo di chi cancella:
  // lasciarla agli altri vorrebbe dire mostrare loro una conversazione
  // che non si apre piu.
  for (const membro of conv.members || []) {
    const listKey = `convlist:${membro.name}`;
    try {
      const righe = await redis('LRANGE', listKey, 0, -1);
      if (!Array.isArray(righe)) continue;
      for (const riga of righe) {
        let voce; try { voce = JSON.parse(riga); } catch { continue; }
        if (voce?.id === id) await redis('LREM', listKey, 0, riga);
      }
    } catch (e) {
      // Se un elenco non si ripulisce, la conversazione e comunque
      // sparita: resta una riga che aprira su "non trovata". Meglio
      // saperlo che fallire tutta la cancellazione.
      log.warn(`elenco di ${membro.name} non ripulito:`, e.message);
    }
  }
  return { esito: 'eliminata' };
}

export async function getUserConversations(userName) {
  const listKey = `convlist:${userName}`;
  const entries = await redis('LRANGE', listKey, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => { try { return JSON.parse(e); } catch (err) { log.warn('Failed to parse conversation entry:', err.message); return null; } }).filter(Boolean).reverse(); // newest first
}

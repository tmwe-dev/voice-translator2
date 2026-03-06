// Upstash Redis store for rooms, messages, and conversation history
// Uses shared Redis client from redis.js

import { redis } from './redis.js';
import { randomUUID } from 'crypto';

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
  // Same TTL as room (2 hours)
  await redis('SET', `rsess:${token}`, JSON.stringify(session), 'EX', 7200);
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
  return JSON.parse(data);
}

/**
 * Resolve identity from request: prefer room session token, fall back to name.
 * @param {string} token - Room session token (from header or body)
 * @param {string} name - Fallback name
 * @param {string} roomId - Expected room ID
 * @returns {{ name: string, role: string, verified: boolean } | null}
 */
export async function resolveRoomIdentity(token, name, roomId) {
  // Try token first (strong identity)
  if (token) {
    const session = await verifyRoomSession(token);
    if (session && session.roomId === roomId.toUpperCase()) {
      return { name: session.name, role: session.role, verified: true };
    }
  }
  // Fall back to name (weak identity, backward compatible)
  if (name) {
    return { name, role: 'unknown', verified: false };
  }
  return null;
}

// =============================================
// ROOMS
// =============================================

export async function createRoom(creatorName, creatorLang, mode = 'conversation', avatar = null, context = null, contextPrompt = null, description = null, hostTier = 'FREE', hostEmail = null) {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
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
    ended: false
  };
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 7200); // 2 hour TTL
  return room;
}

export async function getRoom(id) {
  if (!id) return null;
  const data = await redis('GET', `room:${id.toUpperCase()}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function joinRoom(id, name, lang, avatar = null) {
  const key = `room:${id.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);

  const existing = room.members.findIndex(m => m.name === name);
  if (existing >= 0) {
    room.members[existing].lang = lang;
    room.members[existing].joined = Date.now();
    room.members[existing].avatar = avatar;
  } else {
    // Allow up to 10 members for multi-language group chat
    if (room.members.length < 10) {
      room.members.push({ name, lang, joined: Date.now(), role: 'guest', avatar });
    } else {
      // Room full — replace oldest non-host member
      const oldestGuest = room.members.findIndex(m => m.role !== 'host');
      if (oldestGuest >= 0) {
        room.members[oldestGuest] = { name, lang, joined: Date.now(), role: 'guest', avatar };
      }
    }
  }

  await redis('SET', key, JSON.stringify(room), 'EX', 7200);
  return room;
}

export async function setSpeaking(roomId, memberName, speaking, liveText = null, typing = false) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  const member = room.members.find(m => m.name === memberName);
  if (member) {
    member.speaking = speaking;
    member.speakingAt = speaking ? Date.now() : 0;
    if (liveText !== null) member.liveText = liveText;
    else if (!speaking) member.liveText = '';
    member.typing = typing;
    member.typingAt = typing ? Date.now() : 0;
  }
  await redis('SET', key, JSON.stringify(room), 'EX', 7200);
  return room;
}

export async function updateHeartbeat(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  // READ-ONLY heartbeat: just refresh TTL without writing room data back.
  // This prevents race conditions where heartbeat overwrites a concurrent
  // joinRoom operation, effectively removing the guest from the room.
  await redis('EXPIRE', key, 7200);
  return room;
}

export async function addCost(roomId, amount) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  room.totalCost = (room.totalCost || 0) + amount;
  room.msgCount = (room.msgCount || 0) + 1;
  await redis('SET', key, JSON.stringify(room), 'EX', 7200);
  return room;
}

export async function updateRoomMode(roomId, newMode) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  room.mode = newMode;
  await redis('SET', key, JSON.stringify(room), 'EX', 7200);
  return room;
}

export async function changeMemberLang(roomId, memberName, newLang) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  const member = room.members.find(m => m.name === memberName);
  if (member) {
    member.lang = newLang;
    member.langChangedAt = Date.now(); // timestamp for sync detection
  }
  await redis('SET', key, JSON.stringify(room), 'EX', 7200);
  return room;
}

// =============================================
// MESSAGES
// =============================================

export async function addMessage(roomId, msg) {
  const id = roomId.toUpperCase();
  const roomData = await redis('GET', `room:${id}`);
  if (!roomData) return null;

  const m = {
    ...msg,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    timestamp: Date.now()
  };

  const key = `msgs:${id}`;
  await redis('RPUSH', key, JSON.stringify(m));
  await redis('LTRIM', key, -200, -1);
  await redis('EXPIRE', key, 7200);
  return m;
}

export async function getMessages(roomId, after = 0) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const allMsgs = await redis('LRANGE', key, 0, -1);
  if (!allMsgs || !Array.isArray(allMsgs)) return [];
  // FASE 6A: Use >= to avoid missing messages at exact timestamp boundary
  // Client-side dedup by message ID handles duplicates
  return allMsgs
    .map(m => JSON.parse(m))
    .filter(m => m.timestamp >= after);
}

export async function getAllMessages(roomId) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const allMsgs = await redis('LRANGE', key, 0, -1);
  if (!allMsgs || !Array.isArray(allMsgs)) return [];
  return allMsgs.map(m => JSON.parse(m));
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

  // Save conversation with 7-day TTL
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
    await redis('LTRIM', listKey, -50, -1); // keep last 50 conversations
    await redis('EXPIRE', listKey, 604800); // 7 days
  }

  // Mark room as ended
  room.ended = true;
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 7200);

  return conv;
}

export async function getConversation(convId) {
  const data = await redis('GET', `conv:${convId.toUpperCase()}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function updateConversationSummary(convId, summary) {
  const key = `conv:${convId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const conv = JSON.parse(data);
  conv.summary = summary;
  await redis('SET', key, JSON.stringify(conv), 'EX', 604800);
  return conv;
}

export async function getUserConversations(userName) {
  const listKey = `convlist:${userName}`;
  const entries = await redis('LRANGE', listKey, 0, -1);
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => JSON.parse(e)).reverse(); // newest first
}

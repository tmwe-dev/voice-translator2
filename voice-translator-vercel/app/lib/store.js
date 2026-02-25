// Upstash Redis store for rooms and messages
// Uses REST API - no npm package needed, works perfectly with Vercel serverless

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command, ...args]),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function createRoom(creatorName, creatorLang, mode = 'conversation') {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = {
    id,
    created: Date.now(),
    mode, // 'conversation', 'classroom', 'freetalk'
    host: creatorName, // creator is always host
    members: [{ name: creatorName, lang: creatorLang, joined: Date.now(), role: 'host' }]
  };
  // Store room with 1 hour TTL
  await redis('SET', `room:${id}`, JSON.stringify(room), 'EX', 3600);
  return room;
}

export async function getRoom(id) {
  if (!id) return null;
  const data = await redis('GET', `room:${id.toUpperCase()}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function joinRoom(id, name, lang) {
  const key = `room:${id.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);

  const existing = room.members.findIndex(m => m.name === name);
  if (existing >= 0) {
    room.members[existing].lang = lang;
    room.members[existing].joined = Date.now();
  } else if (room.members.length < 2) {
    room.members.push({ name, lang, joined: Date.now(), role: 'guest' });
  } else {
    room.members[1] = { name, lang, joined: Date.now(), role: 'guest' };
  }

  // Update with refreshed TTL
  await redis('SET', key, JSON.stringify(room), 'EX', 3600);
  return room;
}

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
  // Keep only last 200 messages
  await redis('LTRIM', key, -200, -1);
  // Set TTL on messages list
  await redis('EXPIRE', key, 3600);
  return m;
}

export async function getMessages(roomId, after = 0) {
  const key = `msgs:${roomId.toUpperCase()}`;
  const allMsgs = await redis('LRANGE', key, 0, -1);
  if (!allMsgs || !Array.isArray(allMsgs)) return [];
  return allMsgs
    .map(m => JSON.parse(m))
    .filter(m => m.timestamp > after);
}

export async function setSpeaking(roomId, memberName, speaking) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  const member = room.members.find(m => m.name === memberName);
  if (member) {
    member.speaking = speaking;
    member.speakingAt = speaking ? Date.now() : 0;
  }
  await redis('SET', key, JSON.stringify(room), 'EX', 3600);
  return room;
}

export async function updateHeartbeat(roomId, memberName) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  const member = room.members.find(m => m.name === memberName);
  if (member) member.lastSeen = Date.now();
  await redis('SET', key, JSON.stringify(room), 'EX', 3600);
  return room;
}

// Add cost to room's running total
export async function addCost(roomId, amount) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  room.totalCost = (room.totalCost || 0) + amount;
  room.msgCount = (room.msgCount || 0) + 1;
  await redis('SET', key, JSON.stringify(room), 'EX', 3600);
  return room;
}

// Update room mode (host only - validated on frontend)
export async function updateRoomMode(roomId, newMode) {
  const key = `room:${roomId.toUpperCase()}`;
  const data = await redis('GET', key);
  if (!data) return null;
  const room = JSON.parse(data);
  room.mode = newMode;
  await redis('SET', key, JSON.stringify(room), 'EX', 3600);
  return room;
}

// In-memory store for rooms and messages
// Persists across warm serverless invocations on the same instance
// For production, replace with Upstash Redis

const rooms = globalThis.__VT_ROOMS__ || (globalThis.__VT_ROOMS__ = new Map());
const messages = globalThis.__VT_MESSAGES__ || (globalThis.__VT_MESSAGES__ = new Map());

export function createRoom(creatorName, creatorLang) {
  cleanup();
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = {
    id,
    created: Date.now(),
    members: [{ name: creatorName, lang: creatorLang, joined: Date.now() }]
  };
  rooms.set(id, room);
  messages.set(id, []);
  return room;
}

export function getRoom(id) {
  if (!id) return null;
  return rooms.get(id.toUpperCase()) || null;
}

export function joinRoom(id, name, lang) {
  const room = rooms.get(id.toUpperCase());
  if (!room) return null;
  // Check if already joined by name
  const existing = room.members.findIndex(m => m.name === name);
  if (existing >= 0) {
    room.members[existing].lang = lang;
    room.members[existing].joined = Date.now();
  } else if (room.members.length < 2) {
    room.members.push({ name, lang, joined: Date.now() });
  } else {
    // Replace second member
    room.members[1] = { name, lang, joined: Date.now() };
  }
  return room;
}

export function addMessage(roomId, msg) {
  const id = roomId.toUpperCase();
  if (!messages.has(id)) messages.set(id, []);
  const msgs = messages.get(id);
  const m = {
    ...msg,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    timestamp: Date.now()
  };
  msgs.push(m);
  if (msgs.length > 200) msgs.splice(0, msgs.length - 200);
  return m;
}

export function getMessages(roomId, after = 0) {
  const msgs = messages.get(roomId.toUpperCase());
  if (!msgs) return [];
  return msgs.filter(m => m.timestamp > after);
}

export function updateHeartbeat(roomId, memberName) {
  const room = rooms.get(roomId.toUpperCase());
  if (!room) return null;
  const member = room.members.find(m => m.name === memberName);
  if (member) member.lastSeen = Date.now();
  return room;
}

function cleanup() {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  for (const [id, room] of rooms) {
    if (now - room.created > maxAge) {
      rooms.delete(id);
      messages.delete(id);
    }
  }
}

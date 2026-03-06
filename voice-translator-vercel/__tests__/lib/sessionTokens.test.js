import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis with in-memory store
const redisStore = {};
const mockRedis = vi.fn(async (cmd, ...args) => {
  const key = args[0];
  switch (cmd) {
    case 'SET':
      redisStore[key] = args[1];
      return 'OK';
    case 'GET':
      return redisStore[key] || null;
    case 'RPUSH':
      if (!redisStore[key]) redisStore[key] = [];
      redisStore[key].push(args[1]);
      return redisStore[key].length;
    case 'LRANGE':
      return redisStore[key] || [];
    case 'LTRIM':
      return 'OK';
    case 'EXPIRE':
      return 1;
    default:
      return null;
  }
});

vi.mock('../../app/lib/redis.js', () => ({
  redis: (...args) => mockRedis(...args),
}));

const {
  createRoomSession,
  verifyRoomSession,
  resolveRoomIdentity,
  createRoom,
  saveConversation,
  getConversation,
  getUserConversations,
  getAllMessages,
  addMessage,
} = await import('../../app/lib/store.js');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(redisStore).forEach(k => delete redisStore[k]);
});

// =============================================
// Room Session Tokens
// =============================================

describe('createRoomSession', () => {
  it('creates a session token with correct data', async () => {
    const { token } = await createRoomSession('ROOM1', 'Luca', 'host');
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10); // UUID format
    // Verify it was stored in Redis
    expect(mockRedis).toHaveBeenCalledWith(
      'SET',
      `rsess:${token}`,
      expect.any(String),
      'EX',
      7200
    );
  });

  it('stores roomId, name, role in session', async () => {
    const { token } = await createRoomSession('room1', 'Luca', 'host');
    const stored = JSON.parse(redisStore[`rsess:${token}`]);
    expect(stored.roomId).toBe('ROOM1'); // uppercased
    expect(stored.name).toBe('Luca');
    expect(stored.role).toBe('host');
    expect(stored.created).toBeGreaterThan(0);
  });

  it('generates unique tokens for different sessions', async () => {
    const { token: t1 } = await createRoomSession('ROOM1', 'Luca', 'host');
    const { token: t2 } = await createRoomSession('ROOM1', 'Guest', 'guest');
    expect(t1).not.toBe(t2);
  });
});

describe('verifyRoomSession', () => {
  it('returns session data for valid token', async () => {
    const { token } = await createRoomSession('ROOM1', 'Luca', 'host');
    const session = await verifyRoomSession(token);
    expect(session).toBeTruthy();
    expect(session.roomId).toBe('ROOM1');
    expect(session.name).toBe('Luca');
    expect(session.role).toBe('host');
  });

  it('returns null for invalid token', async () => {
    const session = await verifyRoomSession('nonexistent-token');
    expect(session).toBeNull();
  });

  it('returns null for null/undefined token', async () => {
    expect(await verifyRoomSession(null)).toBeNull();
    expect(await verifyRoomSession(undefined)).toBeNull();
    expect(await verifyRoomSession('')).toBeNull();
  });

  it('returns null for non-string token', async () => {
    expect(await verifyRoomSession(123)).toBeNull();
    expect(await verifyRoomSession({})).toBeNull();
  });
});

describe('resolveRoomIdentity', () => {
  it('prefers token-based identity when valid', async () => {
    const { token } = await createRoomSession('ROOM1', 'Luca', 'host');
    const identity = await resolveRoomIdentity(token, 'FakeName', 'ROOM1');
    expect(identity.name).toBe('Luca'); // from token, not from fallback
    expect(identity.role).toBe('host');
    expect(identity.verified).toBe(true);
  });

  it('rejects token for wrong room', async () => {
    const { token } = await createRoomSession('ROOM1', 'Luca', 'host');
    // Using token for a different room should fall back to name
    const identity = await resolveRoomIdentity(token, 'Luca', 'ROOM2');
    expect(identity.verified).toBe(false);
    expect(identity.role).toBe('unknown');
  });

  it('falls back to name when no token', async () => {
    const identity = await resolveRoomIdentity(null, 'Luca', 'ROOM1');
    expect(identity.name).toBe('Luca');
    expect(identity.role).toBe('unknown');
    expect(identity.verified).toBe(false);
  });

  it('returns null when no token and no name', async () => {
    const identity = await resolveRoomIdentity(null, null, 'ROOM1');
    expect(identity).toBeNull();
  });

  it('falls back to name when token is invalid', async () => {
    const identity = await resolveRoomIdentity('bad-token', 'Luca', 'ROOM1');
    expect(identity.name).toBe('Luca');
    expect(identity.verified).toBe(false);
  });

  it('is case-insensitive on roomId', async () => {
    const { token } = await createRoomSession('room1', 'Luca', 'host');
    const identity = await resolveRoomIdentity(token, null, 'Room1');
    expect(identity.name).toBe('Luca');
    expect(identity.verified).toBe(true);
  });
});

// =============================================
// Conversation History
// =============================================

describe('Conversation History', () => {
  it('saves conversation with messages and members', async () => {
    const room = await createRoom('Luca', 'it');
    await addMessage(room.id, { sender: 'Luca', original: 'Ciao', translated: 'Hello', sourceLang: 'it', targetLang: 'en' });
    await addMessage(room.id, { sender: 'Guest', original: 'Hello', translated: 'Ciao', sourceLang: 'en', targetLang: 'it' });

    const conv = await saveConversation(room.id);
    expect(conv).toBeTruthy();
    expect(conv.id).toBe(room.id);
    expect(conv.host).toBe('Luca');
    expect(conv.members).toHaveLength(1);
    expect(conv.messages).toHaveLength(2);
    expect(conv.ended).toBeGreaterThan(0);
    expect(conv.summary).toBeNull();
  });

  it('retrieves saved conversation', async () => {
    const room = await createRoom('Luca', 'it');
    await addMessage(room.id, { sender: 'Luca', original: 'Test' });
    await saveConversation(room.id);

    const conv = await getConversation(room.id);
    expect(conv).toBeTruthy();
    expect(conv.host).toBe('Luca');
  });

  it('returns null for nonexistent conversation', async () => {
    const conv = await getConversation('NONEXISTENT');
    expect(conv).toBeNull();
  });

  it('marks room as ended after saving conversation', async () => {
    const room = await createRoom('Luca', 'it');
    await saveConversation(room.id);

    // Room should be marked as ended
    const key = `room:${room.id}`;
    const roomData = JSON.parse(redisStore[key]);
    expect(roomData.ended).toBe(true);
  });

  it('adds to user conversation list', async () => {
    const room = await createRoom('Luca', 'it');
    await addMessage(room.id, { sender: 'Luca', original: 'Test' });
    await saveConversation(room.id);

    const list = await getUserConversations('Luca');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(room.id);
    expect(list[0].host).toBe('Luca');
  });

  it('returns empty list for user with no conversations', async () => {
    const list = await getUserConversations('NewUser');
    expect(list).toEqual([]);
  });

  it('returns null when saving nonexistent room', async () => {
    const conv = await saveConversation('NONEXISTENT');
    expect(conv).toBeNull();
  });
});

// =============================================
// getAllMessages
// =============================================

describe('getAllMessages', () => {
  it('returns all messages regardless of timestamp', async () => {
    const room = await createRoom('Luca', 'it');
    await addMessage(room.id, { sender: 'Luca', original: 'First' });
    await addMessage(room.id, { sender: 'Guest', original: 'Second' });

    const msgs = await getAllMessages(room.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].original).toBe('First');
    expect(msgs[1].original).toBe('Second');
  });

  it('returns empty array for nonexistent room', async () => {
    const msgs = await getAllMessages('NOPE');
    expect(msgs).toEqual([]);
  });
});

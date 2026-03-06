import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
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

const { createRoom, getRoom, joinRoom, setSpeaking, updateHeartbeat, addCost, updateRoomMode, changeMemberLang, addMessage, getMessages } = await import('../../app/lib/store.js');

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(redisStore).forEach(k => delete redisStore[k]);
});

describe('Room Management', () => {
  it('creates a room with correct structure', async () => {
    const room = await createRoom('Luca', 'it', 'conversation', null, null, null, null, 'PRO', 'luca@test.com');
    expect(room.id).toHaveLength(6);
    expect(room.host).toBe('Luca');
    expect(room.mode).toBe('conversation');
    expect(room.hostTier).toBe('PRO');
    expect(room.hostEmail).toBe('luca@test.com');
    expect(room.members).toHaveLength(1);
    expect(room.members[0].name).toBe('Luca');
    expect(room.members[0].role).toBe('host');
    expect(room.members[0].lang).toBe('it');
    expect(room.ended).toBe(false);
    expect(room.totalCost).toBe(0);
  });

  it('getRoom retrieves stored room', async () => {
    const created = await createRoom('Luca', 'it');
    const retrieved = await getRoom(created.id);
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.host).toBe('Luca');
  });

  it('getRoom returns null for missing room', async () => {
    const result = await getRoom('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('getRoom returns null for empty id', async () => {
    const result = await getRoom('');
    expect(result).toBeNull();
  });

  it('getRoom is case-insensitive', async () => {
    const room = await createRoom('Luca', 'it');
    const retrieved = await getRoom(room.id.toLowerCase());
    expect(retrieved).toBeTruthy();
  });
});

describe('Join Room', () => {
  it('adds new member to room', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await joinRoom(room.id, 'Guest', 'en', null);
    expect(updated.members).toHaveLength(2);
    expect(updated.members[1].name).toBe('Guest');
    expect(updated.members[1].role).toBe('guest');
  });

  it('updates existing member on rejoin', async () => {
    const room = await createRoom('Luca', 'it');
    await joinRoom(room.id, 'Guest', 'en');
    const updated = await joinRoom(room.id, 'Guest', 'fr');
    expect(updated.members).toHaveLength(2);
    expect(updated.members[1].lang).toBe('fr');
  });

  it('returns null for nonexistent room', async () => {
    const result = await joinRoom('NOPE', 'Guest', 'en');
    expect(result).toBeNull();
  });

  it('caps members at 10', async () => {
    const room = await createRoom('Host', 'it');
    for (let i = 1; i <= 9; i++) {
      await joinRoom(room.id, `Guest${i}`, 'en');
    }
    // 10th member should replace oldest guest
    const updated = await joinRoom(room.id, 'Guest10', 'en');
    expect(updated.members.length).toBeLessThanOrEqual(10);
    // Host should still be there
    expect(updated.members.some(m => m.name === 'Host')).toBe(true);
  });
});

describe('Room Operations', () => {
  it('setSpeaking updates member state', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await setSpeaking(room.id, 'Luca', true, 'Ciao');
    const member = updated.members[0];
    expect(member.speaking).toBe(true);
    expect(member.liveText).toBe('Ciao');
  });

  it('setSpeaking clears liveText on stop', async () => {
    const room = await createRoom('Luca', 'it');
    await setSpeaking(room.id, 'Luca', true, 'Speaking...');
    const updated = await setSpeaking(room.id, 'Luca', false);
    expect(updated.members[0].speaking).toBe(false);
    expect(updated.members[0].liveText).toBe('');
  });

  it('updateHeartbeat returns room and refreshes TTL', async () => {
    const room = await createRoom('Luca', 'it');
    const result = await updateHeartbeat(room.id, 'Luca');
    expect(result).toBeTruthy();
    expect(mockRedis).toHaveBeenCalledWith('EXPIRE', expect.any(String), 7200);
  });

  it('addCost increments totalCost and msgCount', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await addCost(room.id, 0.05);
    expect(updated.totalCost).toBeCloseTo(0.05);
    expect(updated.msgCount).toBe(1);
  });

  it('updateRoomMode changes mode', async () => {
    const room = await createRoom('Luca', 'it', 'conversation');
    const updated = await updateRoomMode(room.id, 'freetalk');
    expect(updated.mode).toBe('freetalk');
  });

  it('changeMemberLang updates language', async () => {
    const room = await createRoom('Luca', 'it');
    const updated = await changeMemberLang(room.id, 'Luca', 'fr');
    expect(updated.members[0].lang).toBe('fr');
    expect(updated.members[0].langChangedAt).toBeGreaterThan(0);
  });
});

describe('Messages', () => {
  it('adds message to room', async () => {
    const room = await createRoom('Luca', 'it');
    const msg = await addMessage(room.id, {
      sender: 'Luca', original: 'Ciao', translated: 'Hello',
      sourceLang: 'it', targetLang: 'en'
    });
    expect(msg).toBeTruthy();
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeGreaterThan(0);
    expect(msg.sender).toBe('Luca');
  });

  it('returns null for nonexistent room', async () => {
    const msg = await addMessage('NOPE', { sender: 'Luca', original: 'Test' });
    expect(msg).toBeNull();
  });

  it('getMessages returns messages after timestamp', async () => {
    const room = await createRoom('Luca', 'it');
    const before = Date.now() - 1000;
    await addMessage(room.id, { sender: 'Luca', original: 'First' });
    const msgs = await getMessages(room.id, before);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('getMessages returns empty for nonexistent room', async () => {
    const msgs = await getMessages('NOPE', 0);
    expect(msgs).toEqual([]);
  });
});

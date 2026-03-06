import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = vi.fn();
vi.mock('../../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

// Mock store
const mockCreateRoom = vi.fn();
const mockGetRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockUpdateHeartbeat = vi.fn();
const mockSetSpeaking = vi.fn();
const mockUpdateRoomMode = vi.fn();
const mockChangeMemberLang = vi.fn();
const mockCreateRoomSession = vi.fn().mockResolvedValue({ token: 'test-token' });
const mockResolveRoomIdentity = vi.fn(async (token, name, roomId) => {
  if (token === 'host-token') return { name: 'Host', role: 'host', verified: true };
  if (token === 'guest-token') return { name: 'Guest', role: 'guest', verified: true };
  if (name) return { name, role: 'unknown', verified: false };
  return null;
});

vi.mock('../../app/lib/store.js', () => ({
  createRoom: (...args) => mockCreateRoom(...args),
  getRoom: (...args) => mockGetRoom(...args),
  joinRoom: (...args) => mockJoinRoom(...args),
  updateHeartbeat: (...args) => mockUpdateHeartbeat(...args),
  setSpeaking: (...args) => mockSetSpeaking(...args),
  updateRoomMode: (...args) => mockUpdateRoomMode(...args),
  changeMemberLang: (...args) => mockChangeMemberLang(...args),
  createRoomSession: (...args) => mockCreateRoomSession(...args),
  resolveRoomIdentity: (...args) => mockResolveRoomIdentity(...args),
}));

// Mock validate
vi.mock('../../app/lib/validate.js', () => ({
  sanitize: (str, max = 500) => (typeof str === 'string' ? str.slice(0, max) : ''),
}));

const {
  resolveIdentity, handleCreate, handleJoin, handleHeartbeat,
  handleSpeaking, handleChangeMode, handleChangeLang,
  handleWebrtcSignal, handleWebrtcPoll, handleCheck,
} = await import('../../app/lib/roomActions.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveIdentity', () => {
  it('resolves host identity from token', async () => {
    const id = await resolveIdentity('host-token', 'Host', 'ABC');
    expect(id).toEqual({ name: 'Host', role: 'host', verified: true });
  });

  it('falls back to name when no token', async () => {
    const id = await resolveIdentity(null, 'Guest', 'ABC');
    expect(id).toEqual({ name: 'Guest', role: 'unknown', verified: false });
  });

  it('returns null when no token and no name', async () => {
    const id = await resolveIdentity(null, null, 'ABC');
    expect(id).toBeNull();
  });
});

describe('handleCreate', () => {
  it('creates room and returns session token', async () => {
    mockCreateRoom.mockResolvedValue({ id: 'XYZ', host: 'Host', members: [{ name: 'Host' }] });
    const res = await handleCreate({ name: 'Host', lang: 'it' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.room.id).toBe('XYZ');
    expect(data.roomSessionToken).toBe('test-token');
  });

  it('rejects without name', async () => {
    const res = await handleCreate({ lang: 'it' });
    expect(res.status).toBe(400);
  });

  it('rejects without lang', async () => {
    const res = await handleCreate({ name: 'Host' });
    expect(res.status).toBe(400);
  });
});

describe('handleJoin', () => {
  it('joins room and returns session token', async () => {
    mockJoinRoom.mockResolvedValue({ id: 'XYZ', members: [{ name: 'Host', role: 'host' }, { name: 'Guest', role: 'guest' }] });
    const res = await handleJoin({ roomId: 'XYZ', name: 'Guest', lang: 'en' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.roomSessionToken).toBe('test-token');
  });

  it('returns 404 for nonexistent room', async () => {
    mockJoinRoom.mockResolvedValue(null);
    const res = await handleJoin({ roomId: 'NOPE', name: 'Guest', lang: 'en' });
    expect(res.status).toBe(404);
  });

  it('rejects without required fields', async () => {
    const res = await handleJoin({ roomId: 'XYZ' });
    expect(res.status).toBe(400);
  });
});

describe('handleHeartbeat', () => {
  it('accepts heartbeat with identity', async () => {
    mockUpdateHeartbeat.mockResolvedValue({ id: 'ABC' });
    const res = await handleHeartbeat({ roomId: 'ABC', identity: { name: 'Host', role: 'host', verified: true } });
    expect(res.status).toBe(200);
  });

  it('returns 401 without identity', async () => {
    const res = await handleHeartbeat({ roomId: 'ABC', identity: null });
    expect(res.status).toBe(401);
  });

  it('returns 400 without roomId', async () => {
    const res = await handleHeartbeat({ roomId: '', identity: { name: 'Host' } });
    expect(res.status).toBe(400);
  });
});

describe('handleSpeaking', () => {
  it('sets speaking state for member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    mockSetSpeaking.mockResolvedValue({ id: 'ABC' });
    const res = await handleSpeaking({
      roomId: 'ABC', identity: { name: 'Host', verified: true }, speaking: true, liveText: 'Hello'
    });
    expect(res.status).toBe(200);
  });

  it('rejects non-member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    const res = await handleSpeaking({
      roomId: 'ABC', identity: { name: 'Hacker', verified: false }, speaking: true
    });
    expect(res.status).toBe(403);
  });
});

describe('handleChangeMode', () => {
  it('allows host to change mode (verified)', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Host', members: [{ name: 'Host' }] });
    mockUpdateRoomMode.mockResolvedValue({ id: 'ABC', mode: 'freetalk' });
    const res = await handleChangeMode({
      roomId: 'ABC', mode: 'freetalk', identity: { name: 'Host', role: 'host', verified: true }
    });
    expect(res.status).toBe(200);
  });

  it('rejects guest from changing mode (verified)', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Host', members: [{ name: 'Guest' }] });
    const res = await handleChangeMode({
      roomId: 'ABC', mode: 'freetalk', identity: { name: 'Guest', role: 'guest', verified: true }
    });
    expect(res.status).toBe(403);
  });

  it('rejects non-host (name fallback)', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Host', members: [{ name: 'Guest' }] });
    const res = await handleChangeMode({
      roomId: 'ABC', mode: 'freetalk', identity: { name: 'Guest', role: 'unknown', verified: false }
    });
    expect(res.status).toBe(403);
  });

  it('returns 401 without identity', async () => {
    const res = await handleChangeMode({ roomId: 'ABC', mode: 'freetalk', identity: null });
    expect(res.status).toBe(401);
  });
});

describe('handleChangeLang', () => {
  it('changes language for member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Guest' }] });
    mockChangeMemberLang.mockResolvedValue({ id: 'ABC' });
    const res = await handleChangeLang({
      roomId: 'ABC', lang: 'fr', identity: { name: 'Guest', verified: false }
    });
    expect(res.status).toBe(200);
  });

  it('rejects non-member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    const res = await handleChangeLang({
      roomId: 'ABC', lang: 'fr', identity: { name: 'Hacker', verified: false }
    });
    expect(res.status).toBe(403);
  });
});

describe('handleWebrtcSignal', () => {
  it('stores signal from verified member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    mockRedis.mockResolvedValue('OK');
    const res = await handleWebrtcSignal({
      roomId: 'ABC', signal: { type: 'offer', from: 'Host' },
      identity: { name: 'Host', verified: true }
    });
    expect(res.status).toBe(200);
    expect(mockRedis).toHaveBeenCalledWith('RPUSH', 'rtc:ABC', expect.any(String));
  });

  it('stores signal with signal.from fallback (no identity)', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    mockRedis.mockResolvedValue('OK');
    const res = await handleWebrtcSignal({
      roomId: 'ABC', signal: { type: 'offer', from: 'Host' }, identity: null
    });
    expect(res.status).toBe(200);
  });

  it('rejects signal from non-member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    const res = await handleWebrtcSignal({
      roomId: 'ABC', signal: { type: 'offer', from: 'Hacker' }, identity: null
    });
    expect(res.status).toBe(403);
  });
});

describe('handleWebrtcPoll', () => {
  it('returns filtered signals for member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }, { name: 'Guest' }] });
    mockRedis.mockResolvedValue([
      JSON.stringify({ from: 'Guest', type: 'offer' }),
      JSON.stringify({ from: 'Host', type: 'answer' }),
    ]);
    const res = await handleWebrtcPoll({
      roomId: 'ABC', identity: { name: 'Host', verified: true }
    });
    const data = await res.json();
    expect(data.signals).toHaveLength(1);
    expect(data.signals[0].from).toBe('Guest');
  });

  it('returns 401 without identity', async () => {
    const res = await handleWebrtcPoll({ roomId: 'ABC', identity: null });
    expect(res.status).toBe(401);
  });

  it('rejects non-member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
    const res = await handleWebrtcPoll({
      roomId: 'ABC', identity: { name: 'Hacker', verified: false }
    });
    expect(res.status).toBe(403);
  });
});

describe('handleCheck', () => {
  it('returns room existence', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', ended: false });
    const res = await handleCheck({ roomId: 'ABC' });
    const data = await res.json();
    expect(data.exists).toBe(true);
    expect(data.ended).toBe(false);
  });

  it('returns not found for missing room', async () => {
    mockGetRoom.mockResolvedValue(null);
    const res = await handleCheck({ roomId: 'NOPE' });
    const data = await res.json();
    expect(data.exists).toBe(false);
  });

  it('returns 400 without roomId', async () => {
    const res = await handleCheck({ roomId: '' });
    expect(res.status).toBe(400);
  });
});

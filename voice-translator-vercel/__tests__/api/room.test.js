import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = vi.fn();
vi.mock('../../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

// Mock store functions (used by room route)
const mockCreateRoom = vi.fn();
const mockGetRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockUpdateHeartbeat = vi.fn();
const mockSetSpeaking = vi.fn();
const mockUpdateRoomMode = vi.fn();
const mockChangeMemberLang = vi.fn();

vi.mock('../../app/lib/store.js', () => ({
  createRoom: (...args) => mockCreateRoom(...args),
  getRoom: (...args) => mockGetRoom(...args),
  joinRoom: (...args) => mockJoinRoom(...args),
  updateHeartbeat: (...args) => mockUpdateHeartbeat(...args),
  setSpeaking: (...args) => mockSetSpeaking(...args),
  updateRoomMode: (...args) => mockUpdateRoomMode(...args),
  changeMemberLang: (...args) => mockChangeMemberLang(...args),
}));

// Mock validate
vi.mock('../../app/lib/validate.js', () => ({
  sanitizeRoomId: (id) => (typeof id === 'string' ? id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) : ''),
  sanitizeName: (name) => (typeof name === 'string' ? name.slice(0, 50) : ''),
  sanitize: (str, max = 500) => (typeof str === 'string' ? str.slice(0, max) : ''),
  rateLimit: () => ({ allowed: true }),
  getClientIP: () => '127.0.0.1',
}));

const { POST, GET } = await import('../../app/api/room/route.js');

function makeReq(body) {
  return { json: async () => body, headers: new Headers() };
}
function makeGetReq(params) {
  const url = new URL('http://localhost/api/room');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/room', () => {
  describe('create', () => {
    it('creates a room with valid params', async () => {
      const room = { id: 'ABC123', host: 'Luca', members: [{ name: 'Luca', lang: 'it', role: 'host' }] };
      mockCreateRoom.mockResolvedValue(room);
      const res = await POST(makeReq({ action: 'create', name: 'Luca', lang: 'it' }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.room.id).toBe('ABC123');
      expect(mockCreateRoom).toHaveBeenCalledWith('Luca', 'it', 'conversation', null, null, null, null, 'FREE', null);
    });

    it('rejects create without name', async () => {
      const res = await POST(makeReq({ action: 'create', lang: 'it' }));
      expect(res.status).toBe(400);
    });

    it('rejects create without lang', async () => {
      const res = await POST(makeReq({ action: 'create', name: 'Test' }));
      expect(res.status).toBe(400);
    });
  });

  describe('join', () => {
    it('joins an existing room', async () => {
      const room = { id: 'ABC', members: [{ name: 'Host' }, { name: 'Guest' }] };
      mockJoinRoom.mockResolvedValue(room);
      const res = await POST(makeReq({ action: 'join', roomId: 'ABC', name: 'Guest', lang: 'en' }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.room).toBeTruthy();
    });

    it('returns 404 for nonexistent room', async () => {
      mockJoinRoom.mockResolvedValue(null);
      const res = await POST(makeReq({ action: 'join', roomId: 'NOPE', name: 'Guest', lang: 'en' }));
      expect(res.status).toBe(404);
    });

    it('rejects join without required fields', async () => {
      const res = await POST(makeReq({ action: 'join', roomId: 'ABC' }));
      expect(res.status).toBe(400);
    });
  });

  describe('heartbeat', () => {
    it('refreshes heartbeat', async () => {
      mockUpdateHeartbeat.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({ action: 'heartbeat', roomId: 'ABC', name: 'Luca' }));
      expect(res.status).toBe(200);
    });
  });

  describe('speaking', () => {
    it('sets speaking state for room member', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
      mockSetSpeaking.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({ action: 'speaking', roomId: 'ABC', name: 'Luca', speaking: true }));
      expect(res.status).toBe(200);
    });

    it('rejects speaking from non-member', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
      const res = await POST(makeReq({ action: 'speaking', roomId: 'ABC', name: 'Hacker', speaking: true }));
      expect(res.status).toBe(403);
    });
  });

  describe('changeMode', () => {
    it('allows host to change mode', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Luca', role: 'host' }] });
      mockUpdateRoomMode.mockResolvedValue({ id: 'ABC', mode: 'freetalk' });
      const res = await POST(makeReq({ action: 'changeMode', roomId: 'ABC', mode: 'freetalk', name: 'Luca' }));
      expect(res.status).toBe(200);
    });

    it('rejects non-host from changing mode', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Luca' }, { name: 'Guest' }] });
      const res = await POST(makeReq({ action: 'changeMode', roomId: 'ABC', mode: 'freetalk', name: 'Guest' }));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('host');
    });

    it('rejects changeMode without name', async () => {
      const res = await POST(makeReq({ action: 'changeMode', roomId: 'ABC', mode: 'freetalk' }));
      expect(res.status).toBe(400);
    });
  });

  describe('changeLang', () => {
    it('changes member language', async () => {
      mockChangeMemberLang.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({ action: 'changeLang', roomId: 'ABC', name: 'Guest', lang: 'fr' }));
      expect(res.status).toBe(200);
    });
  });

  describe('webrtc-signal', () => {
    it('stores signal from room member', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }, { name: 'Guest' }] });
      mockRedis.mockResolvedValue('OK');
      const res = await POST(makeReq({ action: 'webrtc-signal', roomId: 'ABC', signal: { from: 'Luca', type: 'offer' } }));
      expect(res.status).toBe(200);
    });

    it('rejects signal from non-member', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
      const res = await POST(makeReq({ action: 'webrtc-signal', roomId: 'ABC', signal: { from: 'Hacker', type: 'offer' } }));
      expect(res.status).toBe(403);
    });
  });

  describe('webrtc-poll', () => {
    it('returns filtered signals', async () => {
      mockRedis.mockResolvedValue([
        JSON.stringify({ from: 'Guest', type: 'offer' }),
        JSON.stringify({ from: 'Luca', type: 'answer' }),
      ]);
      const res = await POST(makeReq({ action: 'webrtc-poll', roomId: 'ABC', name: 'Luca' }));
      const data = await res.json();
      // Should exclude own signals
      expect(data.signals).toHaveLength(1);
      expect(data.signals[0].from).toBe('Guest');
    });
  });

  describe('check', () => {
    it('returns room existence', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', ended: false });
      const res = await POST(makeReq({ action: 'check', roomId: 'ABC' }));
      const data = await res.json();
      expect(data.exists).toBe(true);
      expect(data.ended).toBe(false);
    });
  });

  it('returns 400 for invalid action', async () => {
    const res = await POST(makeReq({ action: 'unknown' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/room', () => {
  it('returns room by id', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca' });
    const res = await GET(makeGetReq({ id: 'ABC' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.room.host).toBe('Luca');
  });

  it('returns 404 for missing room', async () => {
    mockGetRoom.mockResolvedValue(null);
    const res = await GET(makeGetReq({ id: 'NOPE' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 without id', async () => {
    const res = await GET(makeGetReq({}));
    expect(res.status).toBe(400);
  });
});

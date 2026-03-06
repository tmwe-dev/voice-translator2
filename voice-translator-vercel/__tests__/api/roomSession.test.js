import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = vi.fn();
vi.mock('../../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));

// Mock store functions
const mockCreateRoom = vi.fn();
const mockGetRoom = vi.fn();
const mockJoinRoom = vi.fn();
const mockUpdateHeartbeat = vi.fn();
const mockSetSpeaking = vi.fn();
const mockUpdateRoomMode = vi.fn();
const mockChangeMemberLang = vi.fn();
const mockCreateRoomSession = vi.fn().mockResolvedValue({ token: 'session-token-abc' });

// Track calls to resolveRoomIdentity for verification
const mockResolveRoomIdentity = vi.fn(async (token, name, roomId) => {
  if (token === 'valid-host-token') return { name: 'Host', role: 'host', verified: true };
  if (token === 'valid-guest-token') return { name: 'Guest', role: 'guest', verified: true };
  if (token === 'wrong-room-token') return null; // token for different room
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

vi.mock('../../app/lib/validate.js', () => ({
  sanitizeRoomId: (id) => (typeof id === 'string' ? id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) : ''),
  sanitizeName: (name) => (typeof name === 'string' ? name.slice(0, 50) : ''),
  sanitize: (str, max = 500) => (typeof str === 'string' ? str.slice(0, max) : ''),
  rateLimit: () => ({ allowed: true }),
  getClientIP: () => '127.0.0.1',
}));

const { POST } = await import('../../app/api/room/route.js');

function makeReq(body) {
  return { json: async () => body, headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Room Session Token Auth Flow', () => {
  describe('token-based heartbeat', () => {
    it('accepts heartbeat with valid session token', async () => {
      mockUpdateHeartbeat.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
      const res = await POST(makeReq({
        action: 'heartbeat',
        roomId: 'ABC',
        roomSessionToken: 'valid-host-token'
      }));
      expect(res.status).toBe(200);
      // Should use the name from the token, not from body
      expect(mockUpdateHeartbeat).toHaveBeenCalledWith('ABC', 'Host');
    });

    it('rejects heartbeat without any identity', async () => {
      const res = await POST(makeReq({ action: 'heartbeat', roomId: 'ABC' }));
      expect(res.status).toBe(401);
    });
  });

  describe('token-based speaking', () => {
    it('accepts speaking with valid session token', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }] });
      mockSetSpeaking.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({
        action: 'speaking',
        roomId: 'ABC',
        roomSessionToken: 'valid-host-token',
        speaking: true
      }));
      expect(res.status).toBe(200);
      // Should use the identity name from the token
      expect(mockSetSpeaking).toHaveBeenCalledWith('ABC', 'Host', true, null, false);
    });

    it('rejects speaking without identity', async () => {
      const res = await POST(makeReq({ action: 'speaking', roomId: 'ABC', speaking: true }));
      expect(res.status).toBe(401);
    });
  });

  describe('token-based changeMode', () => {
    it('allows host via verified token to change mode', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Host', members: [{ name: 'Host', role: 'host' }] });
      mockUpdateRoomMode.mockResolvedValue({ id: 'ABC', mode: 'freetalk' });
      const res = await POST(makeReq({
        action: 'changeMode',
        roomId: 'ABC',
        mode: 'freetalk',
        roomSessionToken: 'valid-host-token'
      }));
      expect(res.status).toBe(200);
    });

    it('rejects guest via verified token from changing mode', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Host', members: [{ name: 'Host' }, { name: 'Guest' }] });
      const res = await POST(makeReq({
        action: 'changeMode',
        roomId: 'ABC',
        mode: 'freetalk',
        roomSessionToken: 'valid-guest-token'
      }));
      expect(res.status).toBe(403);
    });
  });

  describe('token-based changeLang', () => {
    it('changes language using session token identity', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Guest' }] });
      mockChangeMemberLang.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({
        action: 'changeLang',
        roomId: 'ABC',
        lang: 'fr',
        roomSessionToken: 'valid-guest-token'
      }));
      expect(res.status).toBe(200);
      expect(mockChangeMemberLang).toHaveBeenCalledWith('ABC', 'Guest', 'fr');
    });
  });

  describe('token-based webrtc-poll', () => {
    it('accepts poll with valid session token', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Host' }, { name: 'Guest' }] });
      mockRedis.mockResolvedValue([
        JSON.stringify({ from: 'Guest', type: 'offer' }),
      ]);
      const res = await POST(makeReq({
        action: 'webrtc-poll',
        roomId: 'ABC',
        roomSessionToken: 'valid-host-token'
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.signals).toHaveLength(1);
    });

    it('rejects poll without identity', async () => {
      const res = await POST(makeReq({ action: 'webrtc-poll', roomId: 'ABC' }));
      expect(res.status).toBe(401);
    });
  });

  describe('backward compatibility (name-only)', () => {
    it('heartbeat still works with name fallback', async () => {
      mockUpdateHeartbeat.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({
        action: 'heartbeat',
        roomId: 'ABC',
        name: 'Luca'
        // no roomSessionToken
      }));
      expect(res.status).toBe(200);
    });

    it('speaking still works with name fallback', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
      mockSetSpeaking.mockResolvedValue({ id: 'ABC' });
      const res = await POST(makeReq({
        action: 'speaking',
        roomId: 'ABC',
        name: 'Luca',
        speaking: true
      }));
      expect(res.status).toBe(200);
    });
  });
});

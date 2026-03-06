import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock store
const mockSaveConversation = vi.fn();
const mockGetConversation = vi.fn();
const mockGetUserConversations = vi.fn();
const mockGetRoom = vi.fn();
const mockResolveRoomIdentity = vi.fn(async (token, name, roomId) => {
  if (token === 'valid-host-token') return { name: 'Luca', role: 'host', verified: true };
  if (token === 'valid-guest-token') return { name: 'Guest', role: 'guest', verified: true };
  if (token) return null; // invalid token
  if (name) return { name, role: 'unknown', verified: false };
  return null;
});

vi.mock('../../app/lib/store.js', () => ({
  saveConversation: (...args) => mockSaveConversation(...args),
  getConversation: (...args) => mockGetConversation(...args),
  getUserConversations: (...args) => mockGetUserConversations(...args),
  getRoom: (...args) => mockGetRoom(...args),
  resolveRoomIdentity: (...args) => mockResolveRoomIdentity(...args),
}));

// Mock users (for userToken-based identity)
const mockGetSession = vi.fn();
vi.mock('../../app/lib/users.js', () => ({
  getSession: (...args) => mockGetSession(...args),
}));

// Mock validate
vi.mock('../../app/lib/validate.js', () => ({
  sanitizeRoomId: (id) => (typeof id === 'string' ? id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) : ''),
  sanitizeName: (name) => (typeof name === 'string' ? name.slice(0, 50) : ''),
  rateLimit: () => ({ allowed: true }),
  getClientIP: () => '127.0.0.1',
}));

// Mock apiGuard
vi.mock('../../app/lib/apiGuard.js', () => ({
  withApiGuard: (fn) => fn,
}));

const { POST, GET } = await import('../../app/api/conversation/route.js');

function makeReq(body) {
  return { json: async () => body, headers: new Headers() };
}
function makeGetReq(params) {
  const url = new URL('http://localhost/api/conversation');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/conversation', () => {
  describe('end action', () => {
    it('ends room with verified host token', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Luca' }] });
      mockSaveConversation.mockResolvedValue({ id: 'conv1', roomId: 'ABC' });
      const res = await POST(makeReq({
        action: 'end', roomId: 'ABC', roomSessionToken: 'valid-host-token'
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.conversation).toBeTruthy();
    });

    it('ends room with name-based identity (backward compat)', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Luca' }] });
      mockSaveConversation.mockResolvedValue({ id: 'conv1' });
      const res = await POST(makeReq({
        action: 'end', roomId: 'ABC', userName: 'Luca'
      }));
      expect(res.status).toBe(200);
    });

    it('rejects end from non-host (verified guest token)', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Guest' }] });
      const res = await POST(makeReq({
        action: 'end', roomId: 'ABC', roomSessionToken: 'valid-guest-token'
      }));
      expect(res.status).toBe(403);
    });

    it('rejects end from non-host (name fallback)', async () => {
      mockGetRoom.mockResolvedValue({ id: 'ABC', host: 'Luca', members: [{ name: 'Hacker' }] });
      const res = await POST(makeReq({
        action: 'end', roomId: 'ABC', userName: 'Hacker'
      }));
      expect(res.status).toBe(403);
    });

    it('returns 401 without any identity', async () => {
      const res = await POST(makeReq({ action: 'end', roomId: 'ABC' }));
      expect(res.status).toBe(401);
    });

    it('returns 404 for nonexistent room', async () => {
      mockGetRoom.mockResolvedValue(null);
      const res = await POST(makeReq({
        action: 'end', roomId: 'NOPE', userName: 'Luca'
      }));
      expect(res.status).toBe(404);
    });

    it('returns 400 without roomId', async () => {
      const res = await POST(makeReq({ action: 'end', userName: 'Luca' }));
      expect(res.status).toBe(400);
    });
  });

  describe('list action', () => {
    it('lists conversations with userToken', async () => {
      mockGetSession.mockResolvedValue({ email: 'luca@test.com', name: 'Luca' });
      mockGetUserConversations.mockResolvedValue([{ id: 'conv1' }]);
      const res = await POST(makeReq({
        action: 'list', userToken: 'valid-user-token'
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.conversations).toHaveLength(1);
      expect(mockGetUserConversations).toHaveBeenCalledWith('Luca');
    });

    it('lists conversations with name fallback', async () => {
      mockGetUserConversations.mockResolvedValue([]);
      const res = await POST(makeReq({
        action: 'list', userName: 'Luca'
      }));
      expect(res.status).toBe(200);
      expect(mockGetUserConversations).toHaveBeenCalledWith('Luca');
    });

    it('returns 401 without any identity', async () => {
      const res = await POST(makeReq({ action: 'list' }));
      expect(res.status).toBe(401);
    });
  });

  it('returns 400 for invalid action', async () => {
    const res = await POST(makeReq({ action: 'invalid' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/conversation', () => {
  it('returns conversation for participant (name param)', async () => {
    mockGetConversation.mockResolvedValue({
      id: 'conv1', members: [{ name: 'Luca' }, { name: 'Guest' }]
    });
    const res = await GET(makeGetReq({ id: 'conv1', name: 'Luca' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.conversation.id).toBe('conv1');
  });

  it('returns conversation with userToken', async () => {
    mockGetSession.mockResolvedValue({ email: 'luca@test.com', name: 'Luca' });
    mockGetConversation.mockResolvedValue({
      id: 'conv1', members: [{ name: 'Luca' }]
    });
    const res = await GET(makeGetReq({ id: 'conv1', userToken: 'valid-token' }));
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-participant', async () => {
    mockGetConversation.mockResolvedValue({
      id: 'conv1', members: [{ name: 'Luca' }]
    });
    const res = await GET(makeGetReq({ id: 'conv1', name: 'Hacker' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 for nonexistent conversation', async () => {
    mockGetConversation.mockResolvedValue(null);
    const res = await GET(makeGetReq({ id: 'nope', name: 'Luca' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 without id', async () => {
    const res = await GET(makeGetReq({ name: 'Luca' }));
    expect(res.status).toBe(400);
  });

  it('returns 401 without any identity', async () => {
    const res = await GET(makeGetReq({ id: 'conv1' }));
    expect(res.status).toBe(401);
  });
});

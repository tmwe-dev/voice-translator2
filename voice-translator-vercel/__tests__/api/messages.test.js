import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock store
const mockAddMessage = vi.fn();
const mockGetMessages = vi.fn();
const mockGetRoom = vi.fn();

vi.mock('../../app/lib/store.js', () => ({
  addMessage: (...args) => mockAddMessage(...args),
  getMessages: (...args) => mockGetMessages(...args),
  getRoom: (...args) => mockGetRoom(...args),
}));

// Mock validate
vi.mock('../../app/lib/validate.js', () => ({
  sanitizeRoomId: (id) => (typeof id === 'string' ? id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20) : ''),
  sanitizeName: (name) => (typeof name === 'string' ? name.slice(0, 50) : ''),
  sanitizeText: (text, max = 10000) => (typeof text === 'string' ? text.slice(0, max) : ''),
  sanitizeTranslations: (t) => t || null,
  rateLimit: () => ({ allowed: true }),
  getClientIP: () => '127.0.0.1',
}));

const { POST, GET } = await import('../../app/api/messages/route.js');

function makeReq(body) {
  return { json: async () => body, headers: new Headers() };
}
function makeGetReq(params) {
  const url = new URL('http://localhost/api/messages');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), headers: new Headers() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/messages', () => {
  it('sends a message from a room member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }, { name: 'Guest' }] });
    mockAddMessage.mockResolvedValue({
      id: 'msg1', sender: 'Luca', original: 'Ciao', translated: 'Hello', timestamp: Date.now()
    });
    const res = await POST(makeReq({
      roomId: 'ABC', sender: 'Luca', original: 'Ciao', translated: 'Hello',
      sourceLang: 'it', targetLang: 'en'
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message.sender).toBe('Luca');
  });

  it('rejects messages from non-members', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    const res = await POST(makeReq({
      roomId: 'ABC', sender: 'Hacker', original: 'Evil message'
    }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('not a room member');
  });

  it('returns 404 if room not found', async () => {
    mockGetRoom.mockResolvedValue(null);
    const res = await POST(makeReq({
      roomId: 'NOPE', sender: 'Luca', original: 'Ciao'
    }));
    expect(res.status).toBe(404);
  });

  it('rejects without required fields', async () => {
    const res = await POST(makeReq({ roomId: 'ABC' }));
    expect(res.status).toBe(400);
  });

  it('rejects without sender', async () => {
    const res = await POST(makeReq({ roomId: 'ABC', original: 'Ciao' }));
    expect(res.status).toBe(400);
  });

  it('rejects without original text', async () => {
    const res = await POST(makeReq({ roomId: 'ABC', sender: 'Luca' }));
    expect(res.status).toBe(400);
  });

  it('supports multi-language translations', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    mockAddMessage.mockResolvedValue({
      id: 'msg2', sender: 'Luca', original: 'Ciao',
      translations: { en: 'Hello', fr: 'Salut' }, timestamp: Date.now()
    });
    const res = await POST(makeReq({
      roomId: 'ABC', sender: 'Luca', original: 'Ciao',
      translations: { en: 'Hello', fr: 'Salut' }
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message.translations.en).toBe('Hello');
  });
});

describe('GET /api/messages', () => {
  it('returns messages after timestamp', async () => {
    const now = Date.now();
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    mockGetMessages.mockResolvedValue([
      { id: 'msg1', original: 'Ciao', timestamp: now }
    ]);
    const res = await GET(makeGetReq({ room: 'ABC', name: 'Luca', after: String(now - 1000) }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.messages).toHaveLength(1);
  });

  it('returns 400 without room id', async () => {
    const res = await GET(makeGetReq({ name: 'Luca', after: '0' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 without name', async () => {
    const res = await GET(makeGetReq({ room: 'ABC', after: '0' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-member', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    const res = await GET(makeGetReq({ room: 'ABC', name: 'Hacker', after: '0' }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid after param', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    const res = await GET(makeGetReq({ room: 'ABC', name: 'Luca', after: 'notanumber' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative after', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    const res = await GET(makeGetReq({ room: 'ABC', name: 'Luca', after: '-5' }));
    expect(res.status).toBe(400);
  });

  it('defaults after to 0', async () => {
    mockGetRoom.mockResolvedValue({ id: 'ABC', members: [{ name: 'Luca' }] });
    mockGetMessages.mockResolvedValue([]);
    const res = await GET(makeGetReq({ room: 'ABC', name: 'Luca' }));
    expect(res.status).toBe(200);
    expect(mockGetMessages).toHaveBeenCalledWith('ABC', 0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server — need to handle both NextResponse.json() and new NextResponse(buffer)
vi.mock('next/server', () => {
  class MockNextResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this._headers = new Map(Object.entries(init.headers || {}));
    }
    get headers() {
      return { get: (k) => this._headers.get(k) };
    }
    async json() { return JSON.parse(typeof this._body === 'string' ? this._body : this._body.toString()); }
    static json(data, init = {}) {
      const r = new MockNextResponse(JSON.stringify(data), init);
      r.json = () => Promise.resolve(data);
      return r;
    }
  }
  return { NextResponse: MockNextResponse };
});

// Mock OpenAI
const mockSpeechCreate = vi.fn();
vi.mock('openai', () => ({
  default: class {
    constructor() {}
    audio = { speech: { create: mockSpeechCreate } }
  }
}));

// Mock edgeVoices
vi.mock('../../app/lib/edgeVoices.js', () => ({
  getEdgeVoice: vi.fn((lang, gender) => `${lang}-${gender}-voice`),
}));

// Mock edge-tts-universal
vi.mock('edge-tts-universal', () => ({
  default: class {
    constructor() {}
    async synthesize() {}
    async toBuffer() { return Buffer.from('fake-audio-data'); }
  }
}));

const { POST } = await import('../../app/api/tts-test/route.js');

function makeRequest(body, headers = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: new Map(Object.entries({
      'x-forwarded-for': '10.0.0.1',
      'content-type': 'application/json',
      ...headers,
    })),
    url: 'http://localhost:3000/api/tts-test',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';
  delete process.env.ADMIN_PASS;
  delete process.env.NODE_ENV;
});

describe('POST /api/tts-test', () => {
  it('returns 400 when no text provided', async () => {
    const res = await POST(makeRequest({ text: '', engine: 'openai' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No text');
  });

  it('returns 400 for invalid engine', async () => {
    const res = await POST(makeRequest({ text: 'Hello', engine: 'invalid' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid engine');
  });

  it('handles OpenAI TTS engine', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const res = await POST(makeRequest({
      text: 'Hello world',
      langCode: 'en',
      engine: 'openai',
      voiceId: 'nova',
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        response_format: 'mp3',
      })
    );
  });

  it('defaults to nova voice for OpenAI when invalid voiceId', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });

    await POST(makeRequest({
      text: 'Test', langCode: 'en', engine: 'openai', voiceId: 'invalid-voice',
    }));

    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'nova' })
    );
  });

  it('handles Edge TTS engine', async () => {
    const res = await POST(makeRequest({
      text: 'Test audio',
      langCode: 'en',
      engine: 'edge',
      gender: 'female',
    }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('returns 400 when ElevenLabs key missing', async () => {
    delete process.env.ELEVENLABS_API_KEY;

    const res = await POST(makeRequest({
      text: 'Hello', engine: 'elevenlabs',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('ELEVENLABS_API_KEY');
  });

  it('returns 400 when OpenAI key missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await POST(makeRequest({
      text: 'Hello', engine: 'openai',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('OPENAI_API_KEY');
  });

  it('truncates text to 500 chars for safety', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });

    const longText = 'A'.repeat(1000);
    await POST(makeRequest({ text: longText, engine: 'openai' }));

    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.any(String),
      })
    );
    // Verify the input was truncated
    const callArgs = mockSpeechCreate.mock.calls[0][0];
    expect(callArgs.input.length).toBeLessThanOrEqual(500);
  });

  it('includes language-specific TTS instructions for OpenAI', async () => {
    mockSpeechCreate.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(50)),
    });

    await POST(makeRequest({ text: 'Ciao', langCode: 'it', engine: 'openai' }));

    expect(mockSpeechCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('Italian'),
      })
    );
  });
});

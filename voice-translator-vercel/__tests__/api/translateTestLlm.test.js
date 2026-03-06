import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared modules
vi.mock('../../app/lib/translatePrompt.js', () => ({
  buildSystemPrompt: vi.fn(() => 'mocked system prompt'),
}));

const mockCallLLM = vi.fn();
vi.mock('../../app/lib/llmCaller.js', () => ({
  callLLM: (...args) => mockCallLLM(...args),
}));

vi.mock('../../app/lib/translateValidation.js', () => ({
  validateOutput: vi.fn((input, output, lang) => {
    if (!output) return { valid: false, reason: 'empty' };
    if (output.startsWith('Translation:')) return { valid: false, reason: 'meta_text' };
    return { valid: true };
  }),
  MODEL_MAP: {
    'gpt-4o-mini': { provider: 'openai', actual: 'gpt-4o-mini' },
    'claude-haiku': { provider: 'anthropic', actual: 'claude-3-haiku-20240307' },
    'gemini-flash': { provider: 'gemini', actual: 'gemini-1.5-flash' },
  },
}));

const { POST } = await import('../../app/api/translate-test-llm/route.js');

function makeRequest(body, headers = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: new Map(Object.entries({
      'x-forwarded-for': '127.0.0.1',
      'content-type': 'application/json',
      ...headers,
    })),
    url: 'http://localhost:3000/api/translate-test-llm',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Set env keys
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.GEMINI_API_KEY = 'test-gemini';
  delete process.env.ADMIN_PASS;
  delete process.env.NODE_ENV;
});

describe('POST /api/translate-test-llm', () => {
  it('returns 400 when no text provided', async () => {
    const res = await POST(makeRequest({ text: '', sourceLang: 'en', targetLang: 'it' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No text');
  });

  it('runs selected models in parallel and returns results', async () => {
    mockCallLLM.mockResolvedValue({
      translated: 'Ciao mondo',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const res = await POST(makeRequest({
      text: 'Hello world',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toHaveLength(1);
    expect(data.results[0].model).toBe('gpt-4o-mini');
    expect(data.results[0].provider).toBe('openai');
    expect(data.results[0].text).toBe('Ciao mondo');
    expect(data.results[0].valid).toBe(true);
    expect(data.results[0].tokens).toBe(15);
    expect(data.sourceText).toBe('Hello world');
  });

  it('handles multiple models in parallel', async () => {
    mockCallLLM.mockResolvedValue({
      translated: 'Traduzione',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const res = await POST(makeRequest({
      text: 'Test',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini', 'claude-haiku', 'gemini-flash'],
    }));

    const data = await res.json();
    expect(data.results).toHaveLength(3);
    expect(mockCallLLM).toHaveBeenCalledTimes(3);
  });

  it('handles LLM call failure gracefully', async () => {
    mockCallLLM.mockRejectedValue(new Error('API quota exceeded'));

    const res = await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    const data = await res.json();
    expect(data.results[0].valid).toBe(false);
    expect(data.results[0].reason).toContain('API quota exceeded');
    expect(data.results[0].text).toBeNull();
  });

  it('cleans meta-text from translations', async () => {
    mockCallLLM.mockResolvedValue({
      translated: 'Translation: Ciao mondo',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    const res = await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    const data = await res.json();
    // After meta-text cleanup, should be valid
    expect(data.results[0].text).toBe('Ciao mondo');
    expect(data.results[0].valid).toBe(true);
  });

  it('returns unknown_model for invalid model IDs', async () => {
    const res = await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['nonexistent-model'],
    }));

    const data = await res.json();
    expect(data.results[0].valid).toBe(false);
    expect(data.results[0].reason).toBe('unknown_model');
  });

  it('reports missing API key for provider', async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    const data = await res.json();
    expect(data.results[0].valid).toBe(false);
    expect(data.results[0].reason).toContain('not configured');
  });

  it('uses shared buildSystemPrompt for identical production prompts', async () => {
    mockCallLLM.mockResolvedValue({
      translated: 'Test',
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    });

    await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    // Verify callLLM was called with the mocked system prompt
    expect(mockCallLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'mocked system prompt',
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
    );
  });

  it('includes elapsed time in results', async () => {
    mockCallLLM.mockImplementation(() => new Promise(resolve =>
      setTimeout(() => resolve({
        translated: 'Done',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }), 10)
    ));

    const res = await POST(makeRequest({
      text: 'Hello',
      sourceLang: 'en',
      targetLang: 'it',
      models: ['gpt-4o-mini'],
    }));

    const data = await res.json();
    expect(data.results[0].elapsed).toBeGreaterThanOrEqual(5);
  });
});

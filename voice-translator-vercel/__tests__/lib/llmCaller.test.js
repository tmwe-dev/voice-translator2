import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock circuit breaker to pass through
vi.mock('../../app/lib/circuitBreaker.js', () => ({
  apiCircuitBreaker: {
    execute: (key, fn) => fn(),
    canExecute: () => true,
    getState: () => 'CLOSED',
  },
}));

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class {
    constructor() {}
    chat = { completions: { create: mockCreate } }
  }
}));

// Mock Anthropic
const mockAnthropicCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    constructor() {}
    messages = { create: mockAnthropicCreate }
  }
}));

// Mock Gemini
const mockGenerate = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return { generateContent: mockGenerate };
    }
  }
}));

const { callLLM, callLLMWithFallback } = await import('../../app/lib/llmCaller.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('callLLM', () => {
  it('calls OpenAI provider', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Ciao mondo' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    });

    const result = await callLLM({
      provider: 'openai', model: 'gpt-4o-mini', apiKey: 'test-key',
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'Hello world' }],
      systemPrompt: 'sys', text: 'Hello world'
    });

    expect(result.translated).toBe('Ciao mondo');
    expect(result.usage.total_tokens).toBe(15);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('calls Anthropic provider', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ text: 'Ciao mondo' }],
      usage: { input_tokens: 10, output_tokens: 5 }
    });

    const result = await callLLM({
      provider: 'anthropic', model: 'claude-3-haiku', apiKey: 'test-key',
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'Hello' }],
      systemPrompt: 'sys', text: 'Hello'
    });

    expect(result.translated).toBe('Ciao mondo');
    expect(result.usage.total_tokens).toBe(15);
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
  });

  it('calls Gemini with native systemInstruction', async () => {
    mockGenerate.mockResolvedValue({
      response: {
        text: () => 'Ciao mondo',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
      }
    });

    const result = await callLLM({
      provider: 'gemini', model: 'gemini-pro', apiKey: 'test-key',
      messages: [], systemPrompt: 'sys', text: 'Hello', context: null
    });

    expect(result.translated).toBe('Ciao mondo');
    expect(result.usage.total_tokens).toBe(15);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it('calls Gemini with context', async () => {
    mockGenerate.mockResolvedValue({
      response: {
        text: () => 'Continuo...',
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, totalTokenCount: 25 }
      }
    });

    const result = await callLLM({
      provider: 'gemini', model: 'gemini-pro', apiKey: 'test-key',
      messages: [], systemPrompt: 'sys', text: 'more text', context: 'previous translation'
    });

    expect(result.translated).toBe('Continuo...');
    const callArgs = mockGenerate.mock.calls[0][0];
    expect(callArgs.contents[0].parts[0].text).toContain('previous translation');
  });

  it('defaults to OpenAI for unknown provider', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Result' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
    });

    const result = await callLLM({
      provider: 'unknown', model: 'model', apiKey: 'key',
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'sys', text: 'test'
    });

    expect(result.translated).toBe('Result');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('times out after specified ms', async () => {
    mockCreate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000)));

    await expect(callLLM({
      provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key',
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'sys', text: 'test',
      timeoutMs: 50, // 50ms timeout
    })).rejects.toThrow(/timed out/);
  });
});

describe('callLLMWithFallback', () => {
  it('returns primary result on success', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Primary result' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
    });

    const result = await callLLMWithFallback({
      provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key',
      messages: [{ role: 'user', content: 'test' }],
      systemPrompt: 'sys', text: 'test',
    }, [{ provider: 'anthropic', model: 'fallback', apiKey: 'key2' }]);

    expect(result.translated).toBe('Primary result');
    expect(result.wasFallback).toBe(false);
  });

  it('falls back on primary failure', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI down'));
    mockAnthropicCreate.mockResolvedValue({
      content: [{ text: 'Fallback result' }],
      usage: { input_tokens: 5, output_tokens: 3 }
    });

    const result = await callLLMWithFallback({
      provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key',
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'test' }],
      systemPrompt: 'sys', text: 'test',
    }, [{ provider: 'anthropic', model: 'claude-3-haiku', apiKey: 'key2' }]);

    expect(result.translated).toBe('Fallback result');
    expect(result.wasFallback).toBe(true);
    expect(result.provider).toBe('anthropic');
  });

  it('throws when all providers fail', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI down'));
    mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

    await expect(callLLMWithFallback({
      provider: 'openai', model: 'gpt-4o-mini', apiKey: 'key',
      messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'test' }],
      systemPrompt: 'sys', text: 'test',
    }, [{ provider: 'anthropic', model: 'claude-3-haiku', apiKey: 'key2' }])).rejects.toThrow(/All LLM providers failed/);
  });
});

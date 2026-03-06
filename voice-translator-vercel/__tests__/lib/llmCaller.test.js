import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { callLLM } = await import('../../app/lib/llmCaller.js');

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

  it('calls Gemini provider', async () => {
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
    // Verify context was included in the prompt
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
});

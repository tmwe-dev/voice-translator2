import { describe, it, expect, vi } from 'vitest';

// Mock ttsPreprocessor
vi.mock('../../app/lib/ttsPreprocessor.js', () => ({
  buildTTSKnowledgeBase: () => '\n\n[TTS]'
}));

const { buildSystemPrompt, buildMessages } = await import('../../app/lib/translatePrompt.js');

describe('buildSystemPrompt', () => {
  it('builds standard translation prompt', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'it',
      sourceLangName: 'English', targetLangName: 'Italian',
      roomMode: 'conversation'
    });
    expect(prompt).toContain('real-time voice interpreter');
    expect(prompt).toContain('English');
    expect(prompt).toContain('Italian');
    expect(prompt).toContain('[TTS]');
  });

  it('builds classroom mode prompt', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'it',
      sourceLangName: 'English', targetLangName: 'Italian',
      roomMode: 'classroom', nativeLang: 'it'
    });
    expect(prompt).toContain('language teaching assistant');
    expect(prompt).toContain('Italian');
  });

  it('adds tonal note for target language', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'th',
      sourceLangName: 'English', targetLangName: 'Thai',
      roomMode: 'conversation'
    });
    expect(prompt).toContain('Thai (tonal');
    expect(prompt).toContain('diacritics');
  });

  it('adds tonal note for source language', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'zh', targetLang: 'en',
      sourceLangName: 'Chinese', targetLangName: 'English',
      roomMode: 'conversation'
    });
    expect(prompt).toContain('Chinese (Simplified');
  });

  it('includes domain context', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'it',
      sourceLangName: 'English', targetLangName: 'Italian',
      roomMode: 'conversation', domainContext: 'medical'
    });
    expect(prompt).toContain('Domain: medical');
  });

  it('includes description', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'it',
      sourceLangName: 'English', targetLangName: 'Italian',
      roomMode: 'conversation', description: 'hotel booking'
    });
    expect(prompt).toContain('Topic: hotel booking');
  });

  it('includes review instruction', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'it',
      sourceLangName: 'English', targetLangName: 'Italian',
      roomMode: 'conversation', isReview: true
    });
    expect(prompt).toContain('Refine the translation');
  });

  it('includes language pair notes for known pairs', () => {
    const prompt = buildSystemPrompt({
      sourceLang: 'en', targetLang: 'th',
      sourceLangName: 'English', targetLangName: 'Thai',
      roomMode: 'conversation'
    });
    expect(prompt).toContain('Language pair note');
  });
});

describe('buildMessages', () => {
  it('builds basic message array', () => {
    const msgs = buildMessages('sys prompt', 'Hello', null);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('Hello');
  });

  it('builds context-aware message array', () => {
    const msgs = buildMessages('sys prompt', 'more text', 'previous translation');
    expect(msgs).toHaveLength(3);
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toBe('previous translation');
    expect(msgs[2].content).toContain('continuation fragment');
  });
});

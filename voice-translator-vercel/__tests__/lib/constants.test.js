import { describe, it, expect } from 'vitest';
import {
  LANGS, VOICES, AI_MODELS, AVATARS, AVATAR_NAMES,
  MODES, CONTEXTS, THEMES, THEME_LIST,
  FREE_DAILY_LIMIT, CREDIT_PACKAGES,
  SILENCE_DELAY, VAD_THRESHOLD, WHISPER_PRIMARY_LANGS,
  STT_CONFIDENCE_THRESHOLD, STT_LOW_CONFIDENCE_COUNT,
  getLang, isWhisperPrimaryLang, formatCredits,
} from '../../app/lib/constants.js';

describe('LANGS', () => {
  it('has at least 20 languages', () => {
    expect(LANGS.length).toBeGreaterThanOrEqual(20);
  });

  it('each lang has required fields', () => {
    for (const lang of LANGS) {
      expect(lang).toHaveProperty('code');
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('flag');
      expect(lang).toHaveProperty('speech');
      expect(lang.code).toMatch(/^[a-z]{2}$/);
      expect(lang.speech).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it('has no duplicate codes', () => {
    const codes = LANGS.map(l => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('includes core languages', () => {
    const codes = LANGS.map(l => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('it');
    expect(codes).toContain('es');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
    expect(codes).toContain('th');
  });
});

describe('getLang', () => {
  it('returns correct lang object', () => {
    const en = getLang('en');
    expect(en.code).toBe('en');
    expect(en.name).toBe('English');
    expect(en.speech).toBe('en-US');
  });

  it('returns Italian (first) for unknown code', () => {
    const unknown = getLang('xx');
    expect(unknown.code).toBe('it');
  });

  it('returns Italian for undefined', () => {
    const undef = getLang(undefined);
    expect(undef.code).toBe('it');
  });
});

describe('isWhisperPrimaryLang', () => {
  it('returns true for Thai', () => {
    expect(isWhisperPrimaryLang('th')).toBe(true);
  });

  it('returns true for Chinese', () => {
    expect(isWhisperPrimaryLang('zh')).toBe(true);
  });

  it('returns true for Japanese', () => {
    expect(isWhisperPrimaryLang('ja')).toBe(true);
  });

  it('returns false for English', () => {
    expect(isWhisperPrimaryLang('en')).toBe(false);
  });

  it('returns false for Italian', () => {
    expect(isWhisperPrimaryLang('it')).toBe(false);
  });

  it('returns false for unknown code', () => {
    expect(isWhisperPrimaryLang('xx')).toBe(false);
  });
});

describe('formatCredits', () => {
  it('formats cents to euros', () => {
    expect(formatCredits(100)).toBe('€1.00');
    expect(formatCredits(250)).toBe('€2.50');
    expect(formatCredits(50)).toBe('€0.50');
    expect(formatCredits(0)).toBe('€0.00');
  });
});

describe('AI_MODELS', () => {
  it('has 6 models', () => {
    expect(AI_MODELS).toHaveLength(6);
  });

  it('has exactly one default model', () => {
    const defaults = AI_MODELS.filter(m => m.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('gpt-4o-mini');
  });

  it('each model has required fields', () => {
    for (const model of AI_MODELS) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(['openai', 'anthropic', 'gemini']).toContain(model.provider);
    }
  });
});

describe('VOICES', () => {
  it('has 6 OpenAI voices', () => {
    expect(VOICES).toHaveLength(6);
    expect(VOICES).toContain('nova');
    expect(VOICES).toContain('alloy');
  });
});

describe('AVATARS & AVATAR_NAMES', () => {
  it('have same length', () => {
    expect(AVATARS.length).toBe(AVATAR_NAMES.length);
    expect(AVATARS.length).toBe(9);
  });
});

describe('MODES', () => {
  it('includes conversation and freetalk', () => {
    const ids = MODES.map(m => m.id);
    expect(ids).toContain('conversation');
    expect(ids).toContain('freetalk');
    expect(ids).toContain('classroom');
  });
});

describe('CONTEXTS', () => {
  it('has general as first with empty prompt', () => {
    expect(CONTEXTS[0].id).toBe('general');
    expect(CONTEXTS[0].prompt).toBe('');
  });

  it('all non-general contexts have prompts', () => {
    for (const ctx of CONTEXTS.slice(1)) {
      expect(ctx.prompt.length).toBeGreaterThan(10);
    }
  });
});

describe('CREDIT_PACKAGES', () => {
  it('has starter package', () => {
    const starter = CREDIT_PACKAGES.find(p => p.starter);
    expect(starter).toBeDefined();
    expect(starter.euros).toBeLessThan(1);
  });

  it('credits increase with price', () => {
    for (let i = 1; i < CREDIT_PACKAGES.length; i++) {
      expect(CREDIT_PACKAGES[i].credits).toBeGreaterThan(CREDIT_PACKAGES[i - 1].credits);
    }
  });
});

describe('timing constants', () => {
  it('SILENCE_DELAY is reasonable (1-3 seconds)', () => {
    expect(SILENCE_DELAY).toBeGreaterThanOrEqual(1000);
    expect(SILENCE_DELAY).toBeLessThanOrEqual(3000);
  });

  it('VAD_THRESHOLD is a positive number', () => {
    expect(VAD_THRESHOLD).toBeGreaterThan(0);
    expect(VAD_THRESHOLD).toBeLessThan(256);
  });

  it('STT confidence threshold is between 0 and 1', () => {
    expect(STT_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(STT_CONFIDENCE_THRESHOLD).toBeLessThan(1);
  });

  it('STT low confidence count is a small positive integer', () => {
    expect(STT_LOW_CONFIDENCE_COUNT).toBeGreaterThanOrEqual(2);
    expect(STT_LOW_CONFIDENCE_COUNT).toBeLessThanOrEqual(10);
  });
});

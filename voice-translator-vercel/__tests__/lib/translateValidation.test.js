import { describe, it, expect } from 'vitest';
import { validateOutput, calcConfidence, getSimpleHash, MODEL_MAP, PAIR_NOTES } from '../../app/lib/translateValidation.js';

describe('validateOutput', () => {
  it('accepts valid Latin translations', () => {
    const result = validateOutput('Ciao come stai', 'Hello how are you', 'en');
    expect(result.valid).toBe(true);
  });

  it('rejects empty translations', () => {
    expect(validateOutput('Ciao', '', 'en').valid).toBe(false);
    expect(validateOutput('Ciao', '', 'en').reason).toBe('empty');
    expect(validateOutput('Ciao', null, 'en').valid).toBe(false);
    expect(validateOutput('Ciao', '   ', 'en').valid).toBe(false);
  });

  it('rejects LLM meta-text leaking', () => {
    expect(validateOutput('Ciao', 'Translation: Hello', 'en').reason).toBe('meta_text');
    expect(validateOutput('Ciao', 'Here is the translation', 'en').reason).toBe('meta_text');
    expect(validateOutput('Ciao', 'Note: this means hello', 'en').reason).toBe('meta_text');
  });

  it('rejects extreme length ratios', () => {
    // Too long (>8x)
    const longOutput = 'a'.repeat(100);
    expect(validateOutput('Hi', longOutput, 'en').reason).toBe('length_ratio');
    // Too short (<0.05x)
    expect(validateOutput('This is a very long sentence with many words', 'a', 'en').reason).toBe('length_ratio');
  });

  it('validates Thai script output', () => {
    expect(validateOutput('Hello', 'สวัสดี', 'th').valid).toBe(true);
    expect(validateOutput('Hello', 'Sawadee', 'th').valid).toBe(false);
    expect(validateOutput('Hello', 'Sawadee', 'th').reason).toBe('wrong_script');
  });

  it('validates Chinese script output', () => {
    expect(validateOutput('Hello', '你好', 'zh').valid).toBe(true);
    expect(validateOutput('Hello', 'Ni hao', 'zh').valid).toBe(false);
  });

  it('validates Japanese script output', () => {
    expect(validateOutput('Hello', 'こんにちは', 'ja').valid).toBe(true);
  });

  it('validates Korean script output', () => {
    expect(validateOutput('Hello', '안녕하세요', 'ko').valid).toBe(true);
  });

  it('validates Arabic script output', () => {
    expect(validateOutput('Hello', 'مرحبا', 'ar').valid).toBe(true);
  });

  it('validates Russian (Cyrillic) output', () => {
    expect(validateOutput('Hello', 'Привет', 'ru').valid).toBe(true);
  });

  it('skips script check for Latin-script languages', () => {
    // French, German etc. should pass with Latin chars
    expect(validateOutput('Hello', 'Bonjour', 'fr').valid).toBe(true);
    expect(validateOutput('Hello', 'Hallo', 'de').valid).toBe(true);
  });
});

describe('calcConfidence', () => {
  it('returns base confidence for normal translations', () => {
    const conf = calcConfidence('Hello world', 'Ciao mondo', 'en', 'it');
    expect(conf).toBeGreaterThanOrEqual(0.85);
    expect(conf).toBeLessThanOrEqual(1.0);
  });

  it('boosts confidence for well-supported language pairs', () => {
    const wellSupported = calcConfidence('Hello world', 'Ciao mondo', 'en', 'it');
    const lesSupported = calcConfidence('Hello world', 'Kumusta mundo', 'en', 'tl');
    expect(wellSupported).toBeGreaterThan(lesSupported);
  });

  it('penalizes very short text', () => {
    const shortConf = calcConfidence('Hi', 'Ciao', 'en', 'it');
    const longConf = calcConfidence('Hello how are you doing today', 'Ciao come stai oggi', 'en', 'it');
    expect(shortConf).toBeLessThan(longConf);
  });

  it('penalizes identical source and translation', () => {
    const conf = calcConfidence('Hello', 'Hello', 'en', 'it');
    expect(conf).toBeLessThan(0.7);
  });

  it('penalizes empty translation', () => {
    const conf = calcConfidence('Hello world', '', 'en', 'it');
    expect(conf).toBeLessThanOrEqual(0.5);
  });

  it('clamps between 0 and 1', () => {
    const conf = calcConfidence('a', '', 'en', 'it');
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(1);
  });
});

describe('getSimpleHash', () => {
  it('returns a string of up to 32 characters', () => {
    const hash = getSimpleHash('Hello world');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeLessThanOrEqual(32);
  });

  it('returns consistent hashes', () => {
    expect(getSimpleHash('Ciao')).toBe(getSimpleHash('Ciao'));
  });

  it('returns different hashes for different text', () => {
    expect(getSimpleHash('Hello')).not.toBe(getSimpleHash('World'));
  });
});

describe('MODEL_MAP', () => {
  it('contains all 6 expected models', () => {
    expect(Object.keys(MODEL_MAP)).toHaveLength(6);
    expect(MODEL_MAP['gpt-4o-mini']).toBeTruthy();
    expect(MODEL_MAP['gpt-4o']).toBeTruthy();
    expect(MODEL_MAP['claude-sonnet']).toBeTruthy();
    expect(MODEL_MAP['claude-haiku']).toBeTruthy();
    expect(MODEL_MAP['gemini-flash']).toBeTruthy();
    expect(MODEL_MAP['gemini-pro']).toBeTruthy();
  });

  it('each model has actual and provider fields', () => {
    for (const [key, model] of Object.entries(MODEL_MAP)) {
      expect(model.actual).toBeTruthy();
      expect(['openai', 'anthropic', 'gemini']).toContain(model.provider);
    }
  });
});

describe('PAIR_NOTES', () => {
  it('contains key language pair notes', () => {
    expect(PAIR_NOTES['it->th']).toBeTruthy();
    expect(PAIR_NOTES['en->th']).toBeTruthy();
    expect(PAIR_NOTES['ja->en']).toBeTruthy();
  });
});

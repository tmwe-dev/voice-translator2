import { describe, it, expect } from 'vitest';
import {
  PRICING, MIN_CREDITS, MIN_CHARGE, DAILY_LIMITS, ERRORS,
  calcGptCost, calcTtsCost, calcWhisperCost, calcElevenLabsCost,
  usdToEurCents, roundCost, roundEurCents
} from '../../app/lib/config.js';

describe('config constants', () => {
  it('PRICING has all required fields', () => {
    expect(PRICING.GPT4OMINI_INPUT_PER_TOKEN).toBeGreaterThan(0);
    expect(PRICING.GPT4OMINI_OUTPUT_PER_TOKEN).toBeGreaterThan(0);
    expect(PRICING.WHISPER_PER_MINUTE).toBeGreaterThan(0);
    expect(PRICING.TTS_PER_CHAR).toBeGreaterThan(0);
    expect(PRICING.ELEVENLABS_PER_CHAR).toBeGreaterThan(0);
    expect(PRICING.USD_TO_EUR_CENTS).toBeGreaterThan(0);
  });

  it('MIN_CREDITS covers all operation types', () => {
    expect(MIN_CREDITS.TRANSLATE).toBeDefined();
    expect(MIN_CREDITS.PROCESS).toBeDefined();
    expect(MIN_CREDITS.TTS_OPENAI).toBeDefined();
    expect(MIN_CREDITS.TTS_ELEVENLABS).toBeDefined();
    expect(MIN_CREDITS.SUMMARY).toBeDefined();
  });

  it('MIN_CHARGE covers all operation types', () => {
    expect(MIN_CHARGE.TRANSLATE).toBeDefined();
    expect(MIN_CHARGE.PROCESS).toBeDefined();
    expect(MIN_CHARGE.TTS_OPENAI).toBeDefined();
    expect(MIN_CHARGE.TTS_ELEVENLABS).toBeDefined();
    expect(MIN_CHARGE.SUMMARY).toBeDefined();
  });

  it('DAILY_LIMITS are reasonable', () => {
    expect(DAILY_LIMITS.PER_USER).toBeGreaterThan(0);
    expect(DAILY_LIMITS.PLATFORM_TOTAL).toBeGreaterThan(DAILY_LIMITS.PER_USER);
  });

  it('ERRORS has all standard messages', () => {
    expect(ERRORS.NO_CREDITS).toBeTruthy();
    expect(ERRORS.AUTH_REQUIRED).toBeTruthy();
    expect(ERRORS.UNAUTHORIZED).toBeTruthy();
    expect(ERRORS.DAILY_LIMIT).toBeTruthy();
  });
});

describe('calcGptCost', () => {
  it('computes cost from token usage', () => {
    const usage = { prompt_tokens: 100, completion_tokens: 50 };
    const cost = calcGptCost(usage);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01); // should be tiny for 150 tokens
  });

  it('handles null/undefined usage gracefully', () => {
    expect(calcGptCost(null)).toBe(0);
    expect(calcGptCost(undefined)).toBe(0);
    expect(calcGptCost({})).toBe(0);
  });

  it('scales linearly with tokens', () => {
    const small = calcGptCost({ prompt_tokens: 100, completion_tokens: 100 });
    const large = calcGptCost({ prompt_tokens: 1000, completion_tokens: 1000 });
    expect(large / small).toBeCloseTo(10, 0);
  });
});

describe('calcTtsCost', () => {
  it('computes cost from character count', () => {
    expect(calcTtsCost(1000)).toBeCloseTo(0.015, 5);
  });

  it('returns 0 for 0 chars', () => {
    expect(calcTtsCost(0)).toBe(0);
  });
});

describe('calcWhisperCost', () => {
  it('computes cost from buffer size', () => {
    const cost = calcWhisperCost(16000 * 60); // 60 seconds
    expect(cost).toBeCloseTo(0.006, 4); // 1 minute = $0.006
  });

  it('has minimum 1 second', () => {
    const tiny = calcWhisperCost(1);
    expect(tiny).toBeGreaterThan(0);
  });
});

describe('calcElevenLabsCost', () => {
  it('computes cost from character count', () => {
    const cost = calcElevenLabsCost(1000);
    expect(cost).toBeCloseTo(0.30, 2);
  });
});

describe('usdToEurCents', () => {
  it('converts USD to euro cents', () => {
    const cents = usdToEurCents(1.0);
    expect(cents).toBeCloseTo(PRICING.USD_TO_EUR_CENTS, 0);
  });
});

describe('roundCost', () => {
  it('rounds to 6 decimal places', () => {
    expect(roundCost(0.1234567890)).toBe(0.123457);
  });
});

describe('roundEurCents', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundEurCents(1.2345)).toBe(1.23);
    expect(roundEurCents(1.999)).toBe(2);
  });
});

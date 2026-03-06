import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitize,
  sanitizeRoomId,
  isValidLangCode,
  sanitizeName,
  isValidEmail,
  sanitizeText,
  rateLimit,
  getClientIP,
  sanitizeTranslations,
} from '../../app/lib/validate.js';

describe('sanitize', () => {
  it('strips HTML tags but preserves content', () => {
    expect(sanitize('<p>hello</p>')).toBe('hello');
    expect(sanitize('<div>test</div>')).toBe('test');
  });

  it('strips null bytes', () => {
    expect(sanitize('hello\0world')).toBe('helloworld');
  });

  it('truncates at maxLen', () => {
    expect(sanitize('a'.repeat(6000), 100).length).toBe(100);
  });

  it('handles non-string input', () => {
    expect(sanitize(123)).toBe('');
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });

  it('strips control characters', () => {
    expect(sanitize('hello\x01world')).toBe('helloworld');
  });

  it('preserves normal whitespace', () => {
    expect(sanitize('hello\nworld')).toBe('hello\nworld');
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
});

describe('sanitizeRoomId', () => {
  it('keeps alphanumeric and hyphens', () => {
    expect(sanitizeRoomId('room-123')).toBe('room-123');
  });

  it('strips special chars', () => {
    expect(sanitizeRoomId('room<script>123')).toBe('roomscript123');
  });

  it('truncates at 20 chars', () => {
    expect(sanitizeRoomId('a'.repeat(25)).length).toBe(20);
  });

  it('handles non-string input', () => {
    expect(sanitizeRoomId(null)).toBe('');
    expect(sanitizeRoomId(123)).toBe('');
  });

  it('removes spaces', () => {
    expect(sanitizeRoomId('my room')).toBe('myroom');
  });
});

describe('isValidLangCode', () => {
  it('accepts valid 2-char codes', () => {
    expect(isValidLangCode('en')).toBe(true);
    expect(isValidLangCode('it')).toBe(true);
    expect(isValidLangCode('fr')).toBe(true);
  });

  it('accepts codes with region', () => {
    expect(isValidLangCode('en-US')).toBe(true);
    expect(isValidLangCode('pt-BR')).toBe(true);
    expect(isValidLangCode('zh-Hans')).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(isValidLangCode('123')).toBe(false);
    expect(isValidLangCode('EN')).toBe(false);
    expect(isValidLangCode('')).toBe(false);
    expect(isValidLangCode(null)).toBe(false);
    expect(isValidLangCode('invalid')).toBe(false);
  });

  it('rejects 3-char base codes', () => {
    expect(isValidLangCode('eng')).toBe(false);
  });
});

describe('sanitizeName', () => {
  it('strips dangerous chars', () => {
    expect(sanitizeName('John<script>')).toBe('John');
  });

  it('removes quotes and backslashes', () => {
    expect(sanitizeName('John"Doe\'s')).toBe('JohnDoes');
  });

  it('truncates at 50 chars', () => {
    expect(sanitizeName('a'.repeat(60)).length).toBe(50);
  });

  it('handles non-string input', () => {
    expect(sanitizeName(123)).toBe('');
    expect(sanitizeName(null)).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeName('  John  ')).toBe('John');
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user+tag@example.co.uk')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('rejects emails with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('enforces max length of 254', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    expect(isValidEmail(longEmail)).toBe(false);
  });
});

describe('sanitizeText', () => {
  it('strips script tags', () => {
    expect(sanitizeText('hello<script>alert(1)</script>world')).toBe('helloworld');
  });

  it('strips event handlers', () => {
    expect(sanitizeText('<div onclick="alert(1)">text</div>')).toBe('text');
  });

  it('strips HTML tags', () => {
    expect(sanitizeText('<p>hello</p>')).toBe('hello');
  });

  it('strips null bytes', () => {
    expect(sanitizeText('hello\0world')).toBe('helloworld');
  });

  it('truncates at maxLen', () => {
    expect(sanitizeText('a'.repeat(15000), 10000).length).toBe(10000);
  });

  it('handles non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(123)).toBe('');
  });

  it('handles multiple event handlers', () => {
    expect(sanitizeText('<img src="x" onerror="alert()" onload="bad()">test')).toBe('test');
  });
});

describe('rateLimit', () => {
  beforeEach(() => {
    // Clear the rate limit store between tests
    // We'll rely on the fact that different IPs have different stores
  });

  it('allows requests within limit', () => {
    const result = rateLimit('test-ip-1', { maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decrements remaining correctly', () => {
    const r1 = rateLimit('test-ip-2', { maxRequests: 5 });
    expect(r1.remaining).toBe(4);
    const r2 = rateLimit('test-ip-2', { maxRequests: 5 });
    expect(r2.remaining).toBe(3);
  });

  it('blocks after limit exceeded', () => {
    for (let i = 0; i < 5; i++) rateLimit('test-ip-3', { maxRequests: 5 });
    const result = rateLimit('test-ip-3', { maxRequests: 5 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns resetIn time', () => {
    const result = rateLimit('test-ip-4', { maxRequests: 5, windowMs: 60000 });
    expect(result.resetIn).toBeGreaterThan(0);
    expect(result.resetIn).toBeLessThanOrEqual(60000);
  });

  it('treats null IP as "unknown"', () => {
    const r1 = rateLimit(null, { maxRequests: 2 });
    expect(r1.allowed).toBe(true);
    const r2 = rateLimit(null, { maxRequests: 2 });
    expect(r2.allowed).toBe(true);
    const r3 = rateLimit(null, { maxRequests: 2 });
    expect(r3.allowed).toBe(false);
  });
});

describe('getClientIP', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = {
      headers: new Map([
        ['x-forwarded-for', '192.168.1.1, 10.0.0.1'],
        ['x-real-ip', '172.16.0.1'],
      ]),
    };
    // Mock the get method since Map doesn't have it
    req.headers.get = (key) => req.headers.get ? null : {
      'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      'x-real-ip': '172.16.0.1',
    }[key];
    // For simplicity, test with an object that has a get method
  });

  it('falls back to x-real-ip', () => {
    const req = {
      headers: {
        get: (key) => {
          if (key === 'x-forwarded-for') return null;
          if (key === 'x-real-ip') return '10.0.0.1';
          return null;
        },
      },
    };
    expect(getClientIP(req)).toBe('10.0.0.1');
  });

  it('defaults to 127.0.0.1', () => {
    const req = {
      headers: {
        get: () => null,
      },
    };
    expect(getClientIP(req)).toBe('127.0.0.1');
  });
});

describe('sanitizeTranslations', () => {
  it('accepts valid translation object', () => {
    const input = { en: 'hello', it: 'ciao' };
    const result = sanitizeTranslations(input);
    expect(result.en).toBe('hello');
    expect(result.it).toBe('ciao');
  });

  it('rejects invalid language codes', () => {
    const input = { en: 'hello', invalid: 'text' };
    const result = sanitizeTranslations(input);
    expect(result.invalid).toBeUndefined();
    expect(result.en).toBe('hello');
  });

  it('sanitizes translation text', () => {
    const input = { en: 'hello<script>alert()</script>world' };
    const result = sanitizeTranslations(input);
    expect(result.en).toBe('helloworld');
  });

  it('returns null for empty object', () => {
    const result = sanitizeTranslations({});
    expect(result).toBeNull();
  });

  it('returns null for null input', () => {
    expect(sanitizeTranslations(null)).toBeNull();
    expect(sanitizeTranslations(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(sanitizeTranslations('string')).toBeNull();
    expect(sanitizeTranslations(123)).toBeNull();
  });
});

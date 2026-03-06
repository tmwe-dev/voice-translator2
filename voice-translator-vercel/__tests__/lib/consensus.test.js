import { describe, it, expect } from 'vitest';
import { levenshteinDistance, similarity, findConsensus } from '../../app/lib/consensus.js';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('returns 0 for two empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('calculates single character difference', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
  });

  it('calculates insertion distance', () => {
    expect(levenshteinDistance('abc', 'abcd')).toBe(1);
  });

  it('calculates deletion distance', () => {
    expect(levenshteinDistance('abcd', 'abc')).toBe(1);
  });

  it('calculates complex edit distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(similarity('hello', 'hello')).toBe(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('returns 0 for one empty string', () => {
    expect(similarity('hello', '')).toBe(0);
    expect(similarity('', 'hello')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(similarity(null, 'hello')).toBe(0);
    expect(similarity('hello', null)).toBe(0);
  });

  it('returns 1 for both null', () => {
    expect(similarity(null, null)).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(similarity('Hello', 'hello')).toBe(1);
  });

  it('trims whitespace', () => {
    expect(similarity('  hello  ', 'hello')).toBe(1);
  });

  it('returns high similarity for similar strings', () => {
    const sim = similarity('Ciao mondo', 'Ciao mondo!');
    expect(sim).toBeGreaterThan(0.9);
  });

  it('returns low similarity for different strings', () => {
    const sim = similarity('Hello world', 'Goodbye universe');
    expect(sim).toBeLessThan(0.5);
  });
});

describe('findConsensus', () => {
  it('returns null text for empty results', () => {
    const result = findConsensus([]);
    expect(result.text).toBeNull();
    expect(result.guaranteed).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns single result as non-guaranteed', () => {
    const result = findConsensus([
      { text: 'Ciao mondo', provider: 'google', score: 1 },
    ]);
    expect(result.text).toBe('Ciao mondo');
    expect(result.guaranteed).toBe(false);
    expect(result.confidence).toBe(0.5);
  });

  it('finds consensus when 2 of 3 agree', () => {
    const result = findConsensus([
      { text: 'Ciao mondo', provider: 'google', score: 1 },
      { text: 'Ciao mondo', provider: 'microsoft', score: 1 },
      { text: 'Salve mondo', provider: 'mymemory', score: 1 },
    ]);
    expect(result.guaranteed).toBe(true);
    expect(result.text).toBe('Ciao mondo');
    expect(result.agreedProviders).toContain('google');
    expect(result.agreedProviders).toContain('microsoft');
  });

  it('finds consensus when all 3 agree', () => {
    const result = findConsensus([
      { text: 'Hello world', provider: 'google', score: 1 },
      { text: 'Hello world!', provider: 'microsoft', score: 1 },
      { text: 'Hello world', provider: 'mymemory', score: 1 },
    ]);
    expect(result.guaranteed).toBe(true);
    expect(result.agreedProviders.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no consensus when all differ', () => {
    const result = findConsensus([
      { text: 'Bonjour le monde', provider: 'google', score: 3 },
      { text: 'Salut tout le monde', provider: 'microsoft', score: 2 },
      { text: 'Coucou la terre', provider: 'mymemory', score: 1 },
    ]);
    expect(result.guaranteed).toBe(false);
    // Should pick highest scored
    expect(result.text).toBe('Bonjour le monde');
  });

  it('filters out empty/null results', () => {
    const result = findConsensus([
      { text: '', provider: 'google', score: 1 },
      { text: null, provider: 'microsoft', score: 1 },
      { text: 'Valid result', provider: 'mymemory', score: 1 },
    ]);
    expect(result.text).toBe('Valid result');
    expect(result.guaranteed).toBe(false);
  });

  it('uses higher score text when two agree', () => {
    const result = findConsensus([
      { text: 'Ciao mondo', provider: 'google', score: 5 },
      { text: 'Ciao mondo!', provider: 'microsoft', score: 1 },
    ], 0.8);
    expect(result.guaranteed).toBe(true);
    expect(result.text).toBe('Ciao mondo'); // higher score
  });

  it('respects custom threshold', () => {
    // With very high threshold, similar but not identical should not agree
    const result = findConsensus([
      { text: 'Hello world', provider: 'google', score: 1 },
      { text: 'Hello worlds', provider: 'microsoft', score: 1 },
    ], 0.99);
    expect(result.guaranteed).toBe(false);
  });
});

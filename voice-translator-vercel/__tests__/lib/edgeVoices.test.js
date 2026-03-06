import { describe, it, expect } from 'vitest';
import { EDGE_VOICES, getEdgeVoice, getAvailableEdgeVoices } from '../../app/lib/edgeVoices.js';

describe('EDGE_VOICES', () => {
  it('has voices for all supported languages', () => {
    const expectedLangs = ['it', 'th', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru', 'tr', 'vi'];
    for (const lang of expectedLangs) {
      expect(EDGE_VOICES[lang]).toBeDefined();
      expect(EDGE_VOICES[lang].female).toBeDefined();
      expect(EDGE_VOICES[lang].male).toBeDefined();
    }
  });

  it('all voice names end with Neural', () => {
    for (const [lang, voices] of Object.entries(EDGE_VOICES)) {
      expect(voices.female).toMatch(/Neural$/);
      expect(voices.male).toMatch(/Neural$/);
    }
  });

  it('voice names match their language prefix', () => {
    for (const [lang, voices] of Object.entries(EDGE_VOICES)) {
      expect(voices.female).toMatch(new RegExp(`^${lang}`));
      expect(voices.male).toMatch(new RegExp(`^${lang}`));
    }
  });
});

describe('getEdgeVoice', () => {
  it('returns female voice by default', () => {
    const voice = getEdgeVoice('it');
    expect(voice).toBe('it-IT-ElsaNeural');
  });

  it('returns male voice when specified', () => {
    const voice = getEdgeVoice('it', 'male');
    expect(voice).toBe('it-IT-DiegoNeural');
  });

  it('handles full locale codes (e.g. th-TH)', () => {
    const voice = getEdgeVoice('th-TH');
    expect(voice).toBe('th-TH-PremwadeeNeural');
  });

  it('falls back to English for unknown language', () => {
    const voice = getEdgeVoice('xx');
    expect(voice).toBe('en-US-JennyNeural');
  });

  it('falls back to female for invalid gender', () => {
    const voice = getEdgeVoice('en', 'nonexistent');
    expect(voice).toBe('en-US-JennyNeural');
  });
});

describe('getAvailableEdgeVoices', () => {
  it('returns both genders for known language', () => {
    const voices = getAvailableEdgeVoices('fr');
    expect(voices.female).toBe('fr-FR-DeniseNeural');
    expect(voices.male).toBe('fr-FR-HenriNeural');
  });

  it('handles locale codes', () => {
    const voices = getAvailableEdgeVoices('ja-JP');
    expect(voices.female).toBe('ja-JP-NanamiNeural');
  });

  it('falls back to English for unknown language', () => {
    const voices = getAvailableEdgeVoices('zz');
    expect(voices).toEqual(EDGE_VOICES['en']);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { savePrefs, loadPrefs, clearPrefs } from '../../app/lib/dualPersistence.js';

describe('dualPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('savePrefs', () => {
    it('saves to localStorage', () => {
      savePrefs({ lang: 'en', name: 'Test' });
      const stored = JSON.parse(localStorage.getItem('vt-prefs'));
      expect(stored.lang).toBe('en');
      expect(stored.name).toBe('Test');
    });

    it('sets sync timestamp', () => {
      savePrefs({ lang: 'it' });
      const timestamp = localStorage.getItem('vt-last-sync');
      expect(timestamp).toBeTruthy();
      // Verify it's a valid ISO string
      expect(new Date(timestamp).toISOString()).toBeDefined();
    });

    it('saves all preference fields', () => {
      const prefs = {
        lang: 'fr',
        name: 'Alice',
        avatar: 'avatar1',
        tier: 'pro',
        voice: 'voice1',
        ttsEngine: 'edge',
        autoSpeak: true,
        provider: 'openai',
        model: 'gpt-4',
        theme: 'dark',
      };
      savePrefs(prefs);
      const stored = JSON.parse(localStorage.getItem('vt-prefs'));
      expect(stored).toEqual(prefs);
    });

    it('handles null input gracefully', () => {
      expect(() => savePrefs(null)).not.toThrow();
      expect(localStorage.getItem('vt-prefs')).toBeNull();
    });

    it('handles undefined input gracefully', () => {
      expect(() => savePrefs(undefined)).not.toThrow();
      expect(localStorage.getItem('vt-prefs')).toBeNull();
    });

    it('handles non-object input gracefully', () => {
      expect(() => savePrefs('string')).not.toThrow();
      expect(() => savePrefs(123)).not.toThrow();
      expect(localStorage.getItem('vt-prefs')).toBeNull();
    });

    it('overwrites previous preferences', () => {
      savePrefs({ lang: 'en' });
      savePrefs({ lang: 'it', name: 'New' });
      const stored = JSON.parse(localStorage.getItem('vt-prefs'));
      expect(stored.lang).toBe('it');
      expect(stored.name).toBe('New');
    });

    it('preserves partial preference updates', () => {
      savePrefs({ lang: 'en', name: 'Alice' });
      savePrefs({ lang: 'fr' });
      const stored = JSON.parse(localStorage.getItem('vt-prefs'));
      // Note: savePrefs replaces entirely, doesn't merge
      expect(stored.lang).toBe('fr');
      expect(stored.name).toBeUndefined();
    });
  });

  describe('loadPrefs', () => {
    it('returns saved prefs', () => {
      localStorage.setItem('vt-prefs', JSON.stringify({ lang: 'fr', name: 'Bob' }));
      const prefs = loadPrefs();
      expect(prefs.lang).toBe('fr');
      expect(prefs.name).toBe('Bob');
    });

    it('returns null when nothing saved', () => {
      expect(loadPrefs()).toBeNull();
    });

    it('returns null on corrupted JSON', () => {
      localStorage.setItem('vt-prefs', 'not-valid-json{]');
      expect(loadPrefs()).toBeNull();
    });

    it('handles missing PREFS_KEY', () => {
      expect(loadPrefs()).toBeNull();
    });

    it('returns parsed object with all fields', () => {
      const prefs = {
        lang: 'de',
        name: 'Charlie',
        tier: 'free',
        theme: 'light',
      };
      localStorage.setItem('vt-prefs', JSON.stringify(prefs));
      const loaded = loadPrefs();
      expect(loaded).toEqual(prefs);
    });
  });

  describe('clearPrefs', () => {
    it('removes all preference data', () => {
      savePrefs({ lang: 'de', name: 'Diana' });
      clearPrefs();
      expect(loadPrefs()).toBeNull();
      expect(localStorage.getItem('vt-last-sync')).toBeNull();
    });

    it('removes only preference keys', () => {
      localStorage.setItem('vt-prefs', JSON.stringify({ lang: 'en' }));
      localStorage.setItem('vt-last-sync', new Date().toISOString());
      localStorage.setItem('other-key', 'value');
      clearPrefs();
      expect(localStorage.getItem('vt-prefs')).toBeNull();
      expect(localStorage.getItem('vt-last-sync')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('value');
    });

    it('handles clearing when nothing is saved', () => {
      expect(() => clearPrefs()).not.toThrow();
    });

    it('can be called multiple times', () => {
      savePrefs({ lang: 'es' });
      clearPrefs();
      expect(() => clearPrefs()).not.toThrow();
      expect(loadPrefs()).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('save then load cycle', () => {
      const original = { lang: 'it', name: 'Emma', tier: 'pro' };
      savePrefs(original);
      const loaded = loadPrefs();
      expect(loaded).toEqual(original);
    });

    it('multiple saves and load', () => {
      savePrefs({ lang: 'en' });
      savePrefs({ lang: 'en', name: 'Frank' });
      savePrefs({ lang: 'en', name: 'Frank', tier: 'paid' });
      const loaded = loadPrefs();
      expect(loaded.lang).toBe('en');
      expect(loaded.name).toBe('Frank');
      expect(loaded.tier).toBe('paid');
    });

    it('save, clear, load', () => {
      savePrefs({ lang: 'pt', name: 'Grace' });
      clearPrefs();
      const loaded = loadPrefs();
      expect(loaded).toBeNull();
    });

    it('saves timestamp on each save', () => {
      savePrefs({ lang: 'ja' });
      const time1 = localStorage.getItem('vt-last-sync');
      // Wait a bit and save again
      savePrefs({ lang: 'ja', name: 'Hank' });
      const time2 = localStorage.getItem('vt-last-sync');
      expect(time1).toBeTruthy();
      expect(time2).toBeTruthy();
      // time2 should be >= time1
      expect(new Date(time2).getTime()).toBeGreaterThanOrEqual(new Date(time1).getTime());
    });
  });
});

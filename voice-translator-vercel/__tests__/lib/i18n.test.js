import { describe, it, expect, vi } from 'vitest';

// Mock dynamic imports to avoid loading all locale files
vi.mock('../../app/lib/locales/es.js', () => ({ default: { welcome: 'Bienvenido' } }));
vi.mock('../../app/lib/locales/fr.js', () => ({ default: { welcome: 'Bienvenue' } }));

const { t, mapLang, preloadLang } = await import('../../app/lib/i18n.js');

describe('t() translation function', () => {
  it('returns English translation for known key', () => {
    const result = t('en', 'welcome');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('returns Italian translation for known key', () => {
    const result = t('it', 'welcome');
    expect(result).toBeTruthy();
  });

  it('falls back to en when key missing in target lang', () => {
    const enValue = t('en', 'welcome');
    // For a language without the key loaded, should fall back to en
    const result = t('nonexistent', 'welcome');
    expect(result).toBe(enValue);
  });

  it('returns the key itself when no translation found', () => {
    const result = t('en', 'this_key_does_not_exist_at_all');
    expect(result).toBe('this_key_does_not_exist_at_all');
  });

  it('handles null language gracefully (defaults to en)', () => {
    const result = t(null, 'welcome');
    expect(result).toBeTruthy();
  });
});

describe('preloadLang', () => {
  it('returns true for already loaded language (en)', async () => {
    expect(await preloadLang('en')).toBe(true);
  });

  it('returns true for already loaded language (it)', async () => {
    expect(await preloadLang('it')).toBe(true);
  });

  it('loads a lazy language (es)', async () => {
    const result = await preloadLang('es');
    expect(result).toBe(true);
    // After loading, t() should return the Spanish value
    expect(t('es', 'welcome')).toBe('Bienvenido');
  });

  it('returns false for unsupported language', async () => {
    expect(await preloadLang('xx')).toBe(false);
  });
});

describe('mapLang', () => {
  it('returns supported languages as-is', () => {
    expect(mapLang('en')).toBe('en');
    expect(mapLang('it')).toBe('it');
    expect(mapLang('ja')).toBe('ja');
    expect(mapLang('th')).toBe('th');
  });

  it('maps unsupported languages to en', () => {
    expect(mapLang('nl')).toBe('en');
    expect(mapLang('pl')).toBe('en');
    expect(mapLang('sv')).toBe('en');
  });

  it('returns en for completely unknown codes', () => {
    expect(mapLang('xx')).toBe('en');
    expect(mapLang('zz')).toBe('en');
  });
});

// Lightweight i18n — loads language packs on demand
// Fallback languages (en, it) are loaded eagerly; others lazy-loaded
// Total: 15 languages, 284 keys each
import en from './locales/en.js';
import it from './locales/it.js';

const SUPPORTED = ['it','en','es','fr','de','pt','zh','ja','ko','th','ar','hi','ru','tr','vi'];

/** Cache of loaded language packs */
const T = { en, it };

/** Dynamic import map for lazy-loaded languages */
const loaders = {
  es: () => import('./locales/es.js'),
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  pt: () => import('./locales/pt.js'),
  zh: () => import('./locales/zh.js'),
  ja: () => import('./locales/ja.js'),
  ko: () => import('./locales/ko.js'),
  th: () => import('./locales/th.js'),
  ar: () => import('./locales/ar.js'),
  hi: () => import('./locales/hi.js'),
  ru: () => import('./locales/ru.js'),
  tr: () => import('./locales/tr.js'),
  vi: () => import('./locales/vi.js'),
};

/**
 * Preload a language pack into cache.
 * Call this when the user selects a language so strings are ready for t().
 * @param {string} code - Language code (e.g. 'es', 'fr')
 * @returns {Promise<boolean>} true if loaded successfully
 */
export async function preloadLang(code) {
  if (T[code]) return true;
  const loader = loaders[code];
  if (!loader) return false;
  try {
    const mod = await loader();
    T[code] = mod.default;
    return true;
  } catch (e) {
    console.warn('[i18n] Failed to load', code, e.message);
    return false;
  }
}

/**
 * Translate a key for the given language.
 * Fallback chain: requested lang -> en -> it -> raw key
 * If the language pack is not loaded yet, falls back to en and triggers async load.
 */
export function t(lang, key) {
  const l = lang || 'en';
  if (!T[l] && loaders[l]) {
    preloadLang(l); // fire-and-forget, next render will have it
  }
  if (T[l] && T[l][key] !== undefined) return T[l][key];
  if (T.en[key] !== undefined) return T.en[key];
  if (T.it[key] !== undefined) return T.it[key];
  return key;
}

/** Map unsupported language codes to the closest supported one */
export function mapLang(code) {
  if (T[code] || SUPPORTED.includes(code)) return code;
  const map = { 'id':'en', 'ms':'en', 'nl':'en', 'pl':'en', 'sv':'en', 'el':'en', 'cs':'en', 'ro':'en', 'hu':'en', 'fi':'en' };
  return map[code] || 'en';
}

export default T;

import { describe, it, expect } from 'vitest';
import { t, preloadLang, mapLang } from '../app/lib/i18n.js';
describe('b260', () => {
  it('pieni', async () => {
    for (const l of ['nl','pl','sv','da','cs','ro','hu']) {
      expect(await preloadLang(l), l).toBe(true);
      expect(t(l,'homeTitle'), l).not.toBe(t('en','homeTitle'));
      expect(t(l,'settings'), l).not.toBe('settings');
    }
  });
  it('mini', async () => {
    for (const l of ['el','fi','uk','nb','he','id','ms','ca','hr','sk','bg','fil','bn','ta','sw','af']) {
      expect(await preloadLang(l), l).toBe(true);
      expect(t(l,'homeTitle'), l).not.toBe(t('en','homeTitle'));
      expect(t(l,'actFaceTitle'), l).not.toBe(t('en','actFaceTitle'));
      // fuori dalla home ripiega sull'inglese, mai la chiave grezza
      expect(t(l,'settings'), l).toBe(t('en','settings'));
    }
  });
  it('mapLang non butta piu nessuno in inglese', () => {
    for (const l of ['nl','da','cs','el','uk','he','sw']) expect(mapLang(l)).toBe(l);
    expect(mapLang('da-DK')).toBe('da');
  });
});

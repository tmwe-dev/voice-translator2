import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGS, ALIAS_LINGUE, lingueTrovate } from '../app/lib/constants.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.516 — RIPRODOTTO DAL VIVO su b.515, interfaccia italiana: nella
// tendina delle lingue della Home, scrivendo «giapponese», «cinese»,
// «inglese», «tedesco» non usciva NIENTE. Si cercava solo dentro il
// nome mostrato (l'endonimo: 日本語, 中文, English, Deutsch) e la sigla.
const trova = (q) => LANGS.filter((l) => lingueTrovate(l, q)).map((l) => l.code);

describe('b.516 — le lingue si trovano anche col loro nome in italiano', () => {
  it('i casi rotti riprodotti in produzione ora rispondono', () => {
    expect(trova('giapponese')).toContain('ja');
    expect(trova('cinese')).toContain('zh');
    expect(trova('inglese')).toContain('en');
    expect(trova('tedesco')).toContain('de');
    expect(trova('greco')).toContain('el');
    expect(trova('ebraico')).toContain('he');
    expect(trova('russo')).toContain('ru');
    expect(trova('coreano')).toContain('ko');
  });

  it('funziona anche in inglese, e non a caso: japanese non porta il coreano', () => {
    expect(trova('japanese')).toEqual(['ja']);
    expect(trova('korean')).toEqual(['ko']);
    expect(trova('german')).toEqual(['de']);
  });

  it('quello che funzionava prima funziona ancora: endonimo e sigla', () => {
    expect(trova('ja')).toContain('ja');
    expect(trova('Deutsch')).toEqual(['de']);
    expect(trova('日本語')).toEqual(['ja']);
    expect(trova('Italiano')).toContain('it');
  });

  it('query vuota = nessun filtro; roba inesistente = zero risultati', () => {
    expect(LANGS.filter((l) => lingueTrovate(l, '')).length).toBe(LANGS.length);
    expect(LANGS.filter((l) => lingueTrovate(l, '   ')).length).toBe(LANGS.length);
    expect(trova('zzzzqq')).toEqual([]);
    expect(lingueTrovate(null, 'it')).toBe(false);
    expect(lingueTrovate(undefined, 'it')).toBe(false);
  });

  it('ogni lingua dell elenco ha almeno un nome alternativo', () => {
    const senza = LANGS.filter((l) => !ALIAS_LINGUE[l.code]);
    expect(senza.map((l) => l.code)).toEqual([]);
  });

  it('le tre tendine usano lo STESSO filtro, non tre filtri diversi', () => {
    for (const f of ['app/components/CarouselLingue.js', 'app/components/LinguettaLingua.js', 'app/components/MondoView.js']) {
      const p = leggi(f);
      expect(p, f).toMatch(/lingueTrovate/);
      expect(p, f).not.toMatch(/l\.name\.toLowerCase\(\)\.includes\(q\)/);
    }
  });
});

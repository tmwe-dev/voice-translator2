// b.508 → b.580 — le preferenze di Mondo restano scelte della persona.
// I vecchi controlli tecnici (modo, ritmo, aggiornamento) sono stati
// assorbiti dal motore Live e non devono tornare nel pannello.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SETTINGS_DEFAULT, NON_PIU_PREFERENZE } from '../app/lib/mondo/settings.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.580 — Preferenze Mondo: solo decisioni dell utente', () => {
  const p = leggi('app/components/ui/PreferenzeMondo.js');

  it('non contiene controlli tecnici del vecchio polling', () => {
    for (const k of ['mondoModo', 'mondoRitmo', 'mondoAggiorna']) {
      expect(NON_PIU_PREFERENZE).toContain(k);
      expect(p).not.toMatch(new RegExp(`key:\\s*['\"]${k}['\"]`));
    }
    expect(p).not.toMatch(/function IconeCiclo\(/);
    expect(p).not.toMatch(/function PassoVerticale\(/);
  });

  it('espone le cinque scelte attuali', () => {
    for (const key of ['contentMix', 'titles', 'breaking', 'autoplayVideo', 'personalization']) {
      expect(p, `manca ${key}`).toMatch(new RegExp(`key:\\s*['\"]${key}['\"]`));
    }
    expect((p.match(/key:\s*'/g) || []).length).toBe(5);
  });

  it('i default sono coerenti con un giornale tradotto e Mondo Live importante', () => {
    expect(SETTINGS_DEFAULT.titles).toBe('translated');
    expect(SETTINGS_DEFAULT.breaking).toBe('important');
    expect(SETTINGS_DEFAULT.contentMix).toBe('balanced');
    expect(SETTINGS_DEFAULT.autoplayVideo).toBe(true);
    expect(SETTINGS_DEFAULT.personalization).toBe(true);
  });

  it('mantiene il ponte legacy solo per i componenti non ancora migrati', () => {
    expect(p).toMatch(/mondoFeedFiltro: legacyMix/);
    expect(p).toMatch(/mondoTitoli: next\.titles === 'original'/);
    expect(p).toMatch(/mondoAutoplayVideo: next\.autoplayVideo/);
    expect(p).toMatch(/mondoPersonalizza: next\.personalization/);
    expect(p).toMatch(/mondoBreaking: next\.breaking/);
  });

  it('il pannello resta leggero: niente grassetti 600 o superiori', () => {
    expect(p).not.toMatch(/fontWeight:\s*(?:600|700|800|900|['\"]bold['\"])/);
  });
});
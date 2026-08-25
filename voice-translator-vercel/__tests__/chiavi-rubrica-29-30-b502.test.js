import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.502 — TAVOLE 29 E 30 ═══
// Tavola 29 (le tue chiavi): ogni chiave dice COSA SBLOCCA e il suo
// stato (attiva con la maschera dal server / non impostata) — mai la
// chiave intera. Tavola 30 (rubrica): la LINGUA A PAROLE accanto alla
// bandiera; pallino verde e ordinamento online c'erano gia. Aa su
// entrambe.

const chiavi = readFileSync(join(process.cwd(), 'app/components/ApiKeysView.js'), 'utf8');
const rubrica = readFileSync(join(process.cwd(), 'app/components/ContactsView.js'), 'utf8');

describe('tavola 29 — le tue chiavi', () => {
  it('ogni chiave dice cosa sblocca', () => {
    expect(chiavi).toMatch(/unlocksTranslateVoice/);
    expect(chiavi).toMatch(/unlocksAltTranslate/);
  });

  it('lo stato viene dalla maschera del server, mai dalla chiave intera', () => {
    expect(chiavi).toMatch(/userAccount\?\.apiKeys/);
    expect(chiavi).toMatch(/keyActiveWord/);
    expect(chiavi).toMatch(/notConfigured/);
  });

  it('Aa sta in testata', () => {
    expect(chiavi).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });
});

describe('tavola 30 — la rubrica', () => {
  it('la lingua sta A PAROLE accanto alla bandiera', () => {
    expect(rubrica).toMatch(/\?\.name/);
  });

  it('Aa sta in testata', () => {
    expect(rubrica).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });
});

describe('le chiavi nuove esistono in tutte le 38 lingue', () => {
  it('keyActiveWord, unlocksTranslateVoice, unlocksAltTranslate', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      for (const k of ['keyActiveWord', 'unlocksTranslateVoice', 'unlocksAltTranslate']) {
        expect(s.includes(`"${k}":"`), `${f}/${k}`).toBe(true);
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.501 — TAVOLE 27 E 28 ═══
// Tavola 27 (Impostazioni): righe col valore a destra, gruppi con
// l'etichetta e interruttori visibili c'erano GIA. Mancava Aa.
// Tavola 28 (le voci): la testata dice «Come ti sentono» (non un nome
// in inglese), la riga in cima spiega il gesto, Aa in testata. Il
// triangolo grande a sinistra e le bandiere c'erano gia (b.309).

const imp = readFileSync(join(process.cwd(), 'app/components/SettingsView.js'), 'utf8');
const voci = readFileSync(join(process.cwd(), 'app/components/VoiceTestView.js'), 'utf8');

describe('tavola 27 — Impostazioni', () => {
  it('Aa sta in testata e ingrandisce le righe', () => {
    expect(imp).toMatch(/aria-label=\{L\('textBigger'\)\}/);
    expect(imp).toMatch(/zoomTesto/);
  });
});

describe('tavola 28 — le voci', () => {
  it('la testata dice «Come ti sentono», non un nome in inglese', () => {
    expect(voci).toMatch(/howTheyHearYou/);
    expect(voci).not.toContain('>Voice Studio<');
  });

  it('la riga in cima spiega il gesto', () => {
    expect(voci).toMatch(/voicesExplain/);
  });

  it('Aa sta in testata', () => {
    expect(voci).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });

  it('le chiavi nuove esistono in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      for (const k of ['howTheyHearYou', 'voicesExplain']) {
        expect(s.includes(`"${k}":"`), `${f}/${k}`).toBe(true);
      }
    }
  });
});

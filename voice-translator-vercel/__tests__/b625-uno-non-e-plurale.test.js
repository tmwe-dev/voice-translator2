import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.625 — «1 termini» non si puo leggere. Il numero e il nome vanno
// d'accordo: uno solo ha il suo.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('b.625 — il contatore del glossario concorda col numero', () => {
  it('AIView sceglie fra singolare e plurale, non ne usa uno solo', () => {
    const vista = leggi('app/components/AIView.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(vista).toContain("glossaryTerms.length === 1 ? L('termCountOne')");
    // e non deve esistere piu il punto in cui il plurale valeva per tutti
    expect(vista).not.toMatch(/\{glossaryTerms\.length\}\s*\{L\('termsCount'\)\}/);
  });

  it('le due parole esistono in italiano e in inglese', () => {
    for (const [file, uno, tanti] of [
      ['app/lib/locales/it.js', 'termine', 'termini'],
      ['app/lib/locales/en.js', 'term', 'terms'],
    ]) {
      const t = leggi(file);
      expect(t).toContain(`"termCountOne":"${uno}"`);
      expect(t).toContain(`"termsCount":"${tanti}"`);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.497 — TAVOLA 23: LA TAVOLA ROTONDA ═══
// «Chi siede al tavolo si sceglie toccando le facce» — pillole con la
// faccia piccola e il nome, accese o spente. «Le due opzioni sono
// righe con la spiegazione», con la spunta tonda a destra — non
// caselle da spuntare al buio. E l'etichetta dice su cosa.

const vista = readFileSync(join(process.cwd(), 'app/components/Life/Tavolo.js'), 'utf8');

describe('tavola 23 — la tavola rotonda', () => {
  it('i compagni sono pillole con la faccia da 24 e il nome', () => {
    expect(vista).toMatch(/width=\{24\} height=\{24\}/);
    expect(vista).toMatch(/borderRadius: 999/);
  });

  it('le opzioni hanno la spunta tonda a destra, non il checkbox', () => {
    const scelta = vista.slice(vista.indexOf('lifeTableSources'), vista.indexOf('avviaTavola'));
    expect(scelta).not.toContain('type="checkbox"');
    expect(vista).toMatch(/aria-pressed=\{r\.on\}/);
    expect(vista).toMatch(/on: conFonti, su:/);
    expect(vista).toMatch(/on: conDocumento, su:/);
  });

  it('l\'etichetta dice su cosa ci si confronta', () => {
    expect(vista).toMatch(/tableOnWhatWord/);
  });

  it('la chiave nuova esiste in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      expect(s.includes('"tableOnWhatWord":"'), f).toBe(true);
    }
  });
});

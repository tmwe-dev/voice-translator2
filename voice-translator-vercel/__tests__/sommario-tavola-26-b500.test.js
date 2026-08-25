import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.500 — TAVOLA 26: IL SOMMARIO ═══
// «Cosa vi siete detti, in dieci righe. E cosa avete deciso.»
// La testata dice CHI e QUANDO; la prima riga porta le lingue e i
// numeri; «In due righe» e un'etichetta col sommario a 15; le
// decisioni sono righe; la trascrizione doppione se ne va — la
// pillola «Leggi tutta la conversazione» porta ai messaggi veri.

const vista = readFileSync(join(process.cwd(), 'app/components/SummaryView.js'), 'utf8');

describe('tavola 26 — il sommario', () => {
  it('la testata dice chi e quando, non una parola generica', () => {
    expect(vista).toMatch(/membriDi\(currentConv\)[\s\S]{0,200}toLocaleDateString/);
  });

  it('la prima riga porta le bandiere delle lingue', () => {
    expect(vista).toMatch(/getLang\(m\.lang\)\.flag/);
  });

  it('«In due righe» e un\'etichetta e il sommario si legge a 15', () => {
    expect(vista).toMatch(/inTwoLinesWord/);
    expect(vista).toMatch(/fontSize:15\*ingr[\s\S]{0,200}s\.summary/);
  });

  it('Aa sta in testata', () => {
    expect(vista).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });

  it('niente trascrizione doppione: ai messaggi si va con la pillola', () => {
    expect(vista).not.toMatch(/transcript/);
    expect(vista).toMatch(/setView\('detail'\)/);
  });

  it('la chiave nuova esiste in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      expect(s.includes('"inTwoLinesWord":"'), f).toBe(true);
    }
  });
});

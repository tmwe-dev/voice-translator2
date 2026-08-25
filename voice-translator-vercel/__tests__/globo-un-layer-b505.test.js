import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.505 — «FAI IN MODO CHE CI SIA UN LAYER SOLO» (Luca, sul Mondo:
// «i comandi tipo la luna, il sole non funzionano») ═══
// Il wrapper del globo in MondoView aveva zIndex: 0 — position +
// z-index creano uno STACKING CONTEXT, una gabbia: la luna e il suo
// menu (zIndex 80/81, position fixed) per quanto alti restavano
// composti DENTRO il contesto a quota zero, sotto la testata (6) e
// sotto gli elenchi. Un fixed non scappa dalla gabbia del suo avo.
// Il fix: il wrapper non dichiara piu z-index (position + auto NON
// crea contesto); a tenere il pianeta sotto basta il contenitore
// interno di GloboMondo, che a quota zero c'e gia.

const vista = readFileSync(join(process.cwd(), 'app/components/MondoView.js'), 'utf8');

describe('un layer solo per i comandi del cielo', () => {
  it('il wrapper del globo non dichiara piu z-index', () => {
    const pezzo = vista.slice(vista.indexOf("tab === 'mondo' && ("), vista.indexOf('<GloboMondo'));
    expect(pezzo).not.toMatch(/zIndex: \d/);
  });

  it('la luna resta a quota alta dentro GloboMondo', () => {
    const globo = readFileSync(join(process.cwd(), 'app/components/GloboMondo.js'), 'utf8');
    expect(globo).toMatch(/zIndex: 80/);
    expect(globo).toMatch(/zIndex: 81/);
  });
});

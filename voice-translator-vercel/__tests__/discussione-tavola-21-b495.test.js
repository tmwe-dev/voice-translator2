import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.495 — TAVOLA 21: LA DISCUSSIONE ═══
// «La notizia in cima, i commenti sotto.» Il titolo pieno sta GRANDE
// nel corpo con la bandiera della sua lingua; i commenti hanno la
// bandiera accanto al nome; un commento tradotto porta l'ORIGINALE
// sotto, piccolo — non lo sostituisce; Aa in testata; e la testata
// di Business lascia l'angolo alla pila (visto a schermo su #782).

const vista = readFileSync(join(process.cwd(), 'app/components/MondoDiscussioni.js'), 'utf8');
const business = readFileSync(join(process.cwd(), 'app/components/BusinessView.js'), 'utf8');

describe('tavola 21 — la discussione', () => {
  it('la notizia sta GRANDE in cima al corpo, con la bandiera', () => {
    expect(vista).toMatch(/fontSize: 17[\s\S]{0,400}tradotti\.title \|\| disc\.title/);
    expect(vista).toMatch(/getLang\(disc\.title_lang/);
  });

  it('i commenti hanno la bandiera accanto al nome', () => {
    expect(vista).toMatch(/getLang\(c\.lang/);
  });

  it('un commento tradotto porta l\'originale sotto, piccolo', () => {
    expect(vista).toMatch(/tradotti\[c\.id\][\s\S]{0,700}c\.text[\s\S]{0,200}fontSize: 11/);
  });

  it('l\'etichetta N COMMENTI sta sopra i commenti', () => {
    expect(vista).toMatch(/commentsWord/);
  });

  it('Aa sta in testata', () => {
    expect(vista).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });
});

describe('correzione vista a schermo su #782', () => {
  it('la testata di Business lascia l\'angolo alla pila', () => {
    expect(business).toMatch(/12px 96px 12px 20px/);
  });
});

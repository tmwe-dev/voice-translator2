import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// b.624 — Il titolo di una sezione non si scrive a mano.
// Chi arriva in «Vita» dalla Home non puo trovarci scritto «Life»:
// e la stessa sezione, e la lingua e quella che ha scelto lui.

const leggi = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('b.624 — i titoli delle sezioni vengono dal dizionario', () => {
  it('LifeView non scrive «Life» a mano nel titolo', () => {
    const vista = leggi('app/components/Life/LifeView.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')      // via i commenti lunghi
      .replace(/^\s*\/\/.*$/gm, '');          // via i commenti di riga
    expect(vista).not.toMatch(/>\s*Life\s*</);
    expect(vista).toContain("{L('lifeEntry')}");
  });

  it('e la parola che usa e la stessa della Home', () => {
    const it = leggi('app/lib/locales/it.js');
    expect(it).toMatch(/"lifeEntry":"Vita"/);
  });
});

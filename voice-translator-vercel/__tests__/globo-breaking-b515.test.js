import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 — il pianeta vola verso la breaking news prima del cartello, e di default e acceso', () => {
  it('FinestraSulMondo: il ritmo di default non e piu "mai"', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/const ritmo = prefs\?\.mondoRitmo \|\| '5';/);
    expect(f).not.toMatch(/const ritmo = prefs\?\.mondoRitmo \|\| 'mai';/);
  });

  it('FinestraSulMondo: prima punta il pianeta (onPuntaGlobo), poi aspetta il volo, poi mostra il cartello', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/onPuntaGlobo/);
    expect(f).toMatch(/ATTESA_VOLO_MS/);
    expect(f).toMatch(/onPuntaGlobo\?\.\(prossimo\.paeseRicerca\)/);
    expect(f).toMatch(/voloRef\.current = setTimeout\(\(\) => \{/);
  });

  it('FinestraSulMondo: mentre si legge (aperta) non parte da sola un nuovo cartello/volo', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/if \(!cartelloRef\.current && !aspettandoRef\.current && !apertaRef\.current\) avanza\(\);/);
  });

  it('GloboMondo: nuovo canale focusEsterno, il paese scelto a mano vince sempre', () => {
    const g = leggi('app/components/GloboMondo.js');
    expect(g).toMatch(/focusEsterno = null/);
    expect(g).toMatch(/code: paese \|\| focusEsterno \|\| null/);
    expect(g).toMatch(/\[paese, focusEsterno\]/);
  });

  it('MondoView: collega FinestraSulMondo -> GloboMondo con un canale separato da paeseScelto', () => {
    const m = leggi('app/components/MondoView.js');
    expect(m).toMatch(/const \[paeseFocusNotizia, setPaeseFocusNotizia\] = useState\(null\);/);
    expect(m).toMatch(/focusEsterno=\{paeseFocusNotizia\}/);
    expect(m).toMatch(/onPuntaGlobo=\{setPaeseFocusNotizia\}/);
  });
});

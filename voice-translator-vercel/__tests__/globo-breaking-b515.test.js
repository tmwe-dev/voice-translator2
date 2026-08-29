import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settingsDaPrefs } from '../app/lib/mondo/settings.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 → b.580 — il pianeta vola verso la breaking news prima del cartello', () => {
  it('Mondo Live e acceso di default senza chiedere un ritmo tecnico', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(settingsDaPrefs({}).breaking).toBe('important');
    expect(f).not.toMatch(/prefs\?\.mondoRitmo/);
    expect(f).toMatch(/settings\.breaking === 'off'/);
  });

  it('FinestraSulMondo: prima punta il pianeta, poi aspetta il volo, poi mostra il cartello', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/onPuntaGlobo/);
    expect(f).toMatch(/ATTESA_VOLO_MS/);
    expect(f).toMatch(/const code = \(prossimo\.countries \|\| \[prossimo\.country\]\)/);
    expect(f).toMatch(/onPuntaGlobo\?\.\(code\)/);
    expect(f).toMatch(/voloRef\.current = setTimeout\(\(\) => \{/);
  });

  it('FinestraSulMondo: mentre si legge o un pannello occupa il mondo non parte un nuovo volo', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/if \(!cartelloRef\.current && !apertaRef\.current && !aspettandoRef\.current && !occupatoRef\.current\) avanza\(\);/);
  });

  it('GloboMondo: il paese scelto a mano vince sul focus temporaneo della notizia', () => {
    const g = leggi('app/components/GloboMondo.js');
    expect(g).toMatch(/focusEsterno = null/);
    expect(g).toMatch(/code: paese \|\| focusEsterno \|\| null/);
    expect(g).toMatch(/\[paese, focusEsterno\]/);
  });

  it('MondoView collega FinestraSulMondo e GloboMondo con un canale separato dal paese scelto', () => {
    const m = leggi('app/components/MondoView.js');
    expect(m).toMatch(/const \[paeseFocusNotizia, setPaeseFocusNotizia\] = useState\(null\);/);
    expect(m).toMatch(/focusEsterno=\{paeseFocusNotizia\}/);
    expect(m).toMatch(/onPuntaGlobo=\{setPaeseFocusNotizia\}/);
  });
});

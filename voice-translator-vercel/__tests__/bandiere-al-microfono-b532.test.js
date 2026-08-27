import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.532 — Luca: «metti le due bandiere al posto di parla ora, solo
// nella home page. parla ora non serve».
describe('b.532 — le due bandiere al posto di «Parla ora», solo in Home', () => {
  const f = leggi('app/components/HomeView.js');
  it('sotto il microfono ci sono le bandiere della coppia, non la scritta', () => {
    const tasto = f.slice(f.indexOf("riapriPrimaProva()"), f.indexOf('FINE b.96'));
    expect(tasto).toMatch(/getLang\(prefs\.lang\)\?\.flag/);
    expect(tasto).toMatch(/getLang\(metaScelta\(prefs\)\)\?\.flag/);
    expect(tasto).not.toMatch(/>\s*\{L\('speakNowTitle'\)\}\s*</);
  });
  it('la scritta resta per chi legge con lo schermo', () => {
    expect(f).toMatch(/aria-label=\{L\('speakNowTitle'\)\}/);
  });
  it('solo in Home: la chiave vive ancora altrove (PrimaProva ecc.)', () => {
    expect(leggi('app/lib/locales/it.js')).toContain('"speakNowTitle"');
  });
});

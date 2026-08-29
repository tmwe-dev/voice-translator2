import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settingsDaPrefs } from '../app/lib/mondo/settings.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 → b.580 — autoplay video breaking news come scelta della persona', () => {
  it('la scelta vive nel pannello Mondo, non come controllo tecnico nella testata', () => {
    const m = leggi('app/components/MondoView.js');
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).toMatch(/key: 'autoplayVideo'/);
    expect(p).toMatch(/mondoAutoplayVideo: next\.autoplayVideo/);
    expect(m).not.toMatch(/savePrefs\(\{ \.\.\.prefs, mondoAutoplayVideo:/);
  });

  it('la migrazione conserva chi aveva gia spento autoplay in b.515', () => {
    expect(settingsDaPrefs({ mondoAutoplayVideo: false }).autoplayVideo).toBe(false);
  });

  it('FinestraSulMondo cerca il video SOLO quando si apre la lettura, mai per la coda Live', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/const \[videoLettura, setVideoLettura\] = useState\(null\);/);
    expect(f).toMatch(/if \(!aperta\?\.title\) return undefined;/);
    expect(f).toMatch(/\/api\/topics\/video\?q=\$\{encodeURIComponent\(aperta\.title\)\}/);
    expect(f).toMatch(/settings\.autoplayVideo \? '\?autoplay=1' : ''/);
    const primaDellApertura = f.slice(0, f.indexOf("if (!aperta?.title) return undefined;"));
    expect(primaDellApertura).not.toMatch(/\/api\/topics\/video\?q=/);
  });

  it('it.js e en.js hanno la chiave newsAutoplayVideo', () => {
    expect(leggi('app/lib/locales/it.js')).toMatch(/"newsAutoplayVideo":"Autoplay video breaking news"/);
    expect(leggi('app/lib/locales/en.js')).toMatch(/"newsAutoplayVideo":"Autoplay breaking news video"/);
  });
});
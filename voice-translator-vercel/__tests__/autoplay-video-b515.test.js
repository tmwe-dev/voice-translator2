import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 — autoplay video breaking news, comandato in alto (non in sidebar)', () => {
  it('MondoView: il toggle vive nella testata, solo nella scheda del pianeta', () => {
    const m = leggi('app/components/MondoView.js');
    expect(m).toMatch(/const \{ L, setView, theme, prefs, savePrefs \} = useApp\(\);/);
    expect(m).toMatch(/\{tab === 'mondo' && \(\s*\n\s*<button onClick=\{\(\) => \{ vibrate\(8\); savePrefs\(\{ \.\.\.prefs, mondoAutoplayVideo: !\(prefs\?\.mondoAutoplayVideo !== false\) \}\); \}\}/);
    expect(m).toMatch(/autoplayVideo=\{prefs\?\.mondoAutoplayVideo !== false\}/);
  });

  it('FinestraSulMondo: cerca il video SOLO quando si apre la lettura, non per ogni cartello in coda', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).toMatch(/autoplayVideo = true/);
    expect(f).toMatch(/const \[videoLettura, setVideoLettura\] = useState\(null\);/);
    expect(f).toMatch(/if \(!aperta\?\.titolo\) return undefined;/);
    expect(f).toMatch(/\/api\/topics\/video\?q=\$\{encodeURIComponent\(aperta\.titolo\)\}/);
    expect(f).toMatch(/autoplayVideo \? '\?autoplay=1' : ''/);
  });

  it('it.js e en.js hanno la chiave newsAutoplayVideo', () => {
    expect(leggi('app/lib/locales/it.js')).toMatch(/"newsAutoplayVideo":"Autoplay video breaking news"/);
    expect(leggi('app/lib/locales/en.js')).toMatch(/"newsAutoplayVideo":"Autoplay breaking news video"/);
  });
});

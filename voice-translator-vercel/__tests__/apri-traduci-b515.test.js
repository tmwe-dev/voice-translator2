import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 — tre porte sullo stesso articolo: apri e traduci / apri / vai al sito', () => {
  it('SchedaArgomento accetta autoGenera e genera la sintesi da sola quando serve', () => {
    const f = leggi('app/components/SchedaArgomento.js');
    expect(f).toMatch(/autoGenera = false/);
    expect(f).toMatch(/if \(autoGenera && vivo\) genera\(\);/);
  });

  it('MondoNews mostra i tre pulsanti e passa autoGenera alla scheda', () => {
    const f = leggi('app/components/MondoNews.js');
    expect(f).toMatch(/const \[schedaAutoGenera, setSchedaAutoGenera\] = useState\(false\);/);
    expect(f).toMatch(/setSchedaAutoGenera\(true\); setScheda\(\{ tipo: 'articolo', dati: t \}\)/);
    expect(f).toMatch(/L\('newsOpenTranslate'\)/);
    expect(f).toMatch(/L\('newsOpenSite'\)/);
    expect(f).toMatch(/autoGenera=\{schedaAutoGenera\}/);
  });

  it('it.js e en.js hanno le nuove chiavi', () => {
    const it_ = leggi('app/lib/locales/it.js');
    const en_ = leggi('app/lib/locales/en.js');
    expect(it_).toMatch(/"newsOpenSite":"Vai al sito"/);
    expect(it_).toMatch(/"newsOpenTranslate":"Apri e traduci"/);
    expect(en_).toMatch(/"newsOpenSite":"Go to site"/);
    expect(en_).toMatch(/"newsOpenTranslate":"Open & translate"/);
  });
});

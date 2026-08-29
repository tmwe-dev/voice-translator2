import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

describe('b.538 — il velo lascia liberi i comandi del player', () => {
  it('il blocco del titolo resta sopra la barra YouTube e non prende i tocchi', () => {
    expect(feed).toMatch(/const BARRA_YT = \d+;/);
    const misura = Number(feed.match(/const BARRA_YT = (\d+);/)[1]);
    expect(misura).toBeGreaterThanOrEqual(48);
    expect(misura).toBeLessThanOrEqual(96);
    const blocco = feed.slice(feed.indexOf('b.538, Luca per la seconda volta'));
    expect(blocco).toMatch(/marginBottom: `calc\(\$\{BARRA_YT\}px \+ env\(safe-area-inset-bottom\)\)`/);
    expect(blocco.slice(0, 1600)).toMatch(/pointerEvents: 'none'/);
  });
});

describe('b.538 → b.580 — ribaltare lo schermo non crea due slide attive', () => {
  const osservatore = feed.slice(feed.indexOf('const oss = new IntersectionObserver'), feed.indexOf('sentinelleRef.current.forEach'));

  it('memorizza le aree e sceglie una sola slide per giro', () => {
    expect(osservatore).toMatch(/visibiliRef\.current\.set\(idx, e\.isIntersecting \? e\.intersectionRatio : 0\)/);
    expect(osservatore).toMatch(/let miglioreIdx = -1/);
    expect(osservatore).toMatch(/if \(area <= miglioreArea\) return/);
    expect((osservatore.match(/setIndiceAttivo\(/g) || []).length).toBe(1);
  });

  it('distingue la slide logicamente attiva da quella realmente visibile', () => {
    expect(osservatore).toMatch(/setIndiceVisibile\(miglioreIdx\)/);
    expect(osservatore).toMatch(/setIndiceVisibile\(null\)/);
    expect(feed).toMatch(/i === indiceAttivo && i === indiceVisibile \? \(/);
  });

  it('una slide gia attiva non genera una catena di ridisegni', () => {
    expect(osservatore).toMatch(/setIndiceAttivo\(\(prima\) => \(prima === miglioreIdx \? prima : miglioreIdx\)\)/);
  });

  it('la rotazione cambia larghezza; la barra del browser no', () => {
    expect(feed).toMatch(/window\.addEventListener\('orientationchange', rimetti\)/);
    expect(feed).toMatch(/if \(larghezzaOra === larghezzaPrima\) return;/);
    expect(feed).toMatch(/scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
    expect(feed).toMatch(/removeEventListener\('orientationchange', rimetti\)/);
    expect(feed).toMatch(/removeEventListener\('resize', rimetti\)/);
  });
});

describe('b.580 — fullscreen dove esiste ancora un player video', () => {
  it('Feed e SchedaArgomento consentono fullscreen al player ufficiale', () => {
    for (const nome of ['FeedNotizieMondo', 'SchedaArgomento']) {
      const src = leggi(`app/components/${nome}.js`);
      expect(src, nome).toMatch(/allow="[^"]*fullscreen[^"]*"/);
      expect(src, nome).toMatch(/allowFullScreen/);
    }
  });

  it('FinestraSulMondo non incorpora piu un video: mostra evento e fonti', () => {
    const f = leggi('app/components/FinestraSulMondo.js');
    expect(f).not.toMatch(/<iframe|youtube-nocookie|\/api\/topics\/video/);
    expect(f).toMatch(/\(aperta\.sources \|\| \[\]\)\.slice\(0, 6\)/);
  });
});
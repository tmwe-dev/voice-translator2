import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

// ═══ b.538 — due collaudi di Luca sullo stesso schermo:
// «i comandi di youtube rimangono nascosti dall'ombreggiatura in basso.
//  devi fare in modo di alzarla»
// «quando ho ribaltato lo schermo, va in errore e si chiude
//  l'applicazione... devo poter ribaltare tranquillamente»

describe('b.538 — il velo si alza sopra i comandi del player', () => {
  it('il blocco del titolo lascia libera la fascia dei comandi', () => {
    expect(feed).toMatch(/const BARRA_YT = \d+;/);
    const misura = Number(feed.match(/const BARRA_YT = (\d+);/)[1]);
    // la barra di YouTube sta fra i 48 (telefono) e i 60 (schermo grande):
    // meno di 48 la coprirebbe di nuovo, piu di 96 sarebbe un buco.
    expect(misura).toBeGreaterThanOrEqual(48);
    expect(misura).toBeLessThanOrEqual(96);
    const blocco = feed.slice(feed.indexOf('b.538, Luca per la seconda volta'));
    expect(blocco).toMatch(/marginBottom: `calc\(\$\{BARRA_YT\}px \+ env\(safe-area-inset-bottom\)\)`/);
    // e resta pittura: da b.535 non ruba i tocchi
    expect(blocco.slice(0, 1400)).toMatch(/pointerEvents: 'none'/);
  });
});

describe('b.538 — ribaltare lo schermo non fa piu cadere l\'applicazione', () => {
  const osservatore = feed.slice(feed.indexOf('const oss = new IntersectionObserver'), feed.indexOf('sentinelleRef.current.forEach'));

  it('per ogni giro si sceglie UNA slide sola, quella che si vede di piu', () => {
    // il difetto era obbedire a TUTTE le voci: ruotando, piu slide
    // superano la soglia insieme e ognuna faceva ridisegnare.
    expect(osservatore).toMatch(/let miglioreIdx = -1/);
    expect(osservatore).toMatch(/if \(e\.intersectionRatio <= miglioreArea\) return/);
    // una sola chiamata, fuori dal ciclo
    expect((osservatore.match(/setIndiceAttivo\(/g) || []).length).toBe(1);
    expect(osservatore).not.toMatch(/entries\.forEach\([\s\S]{0,200}setIndiceAttivo/);
  });

  it('e se e gia lei l\'attiva non si tocca niente (niente catena di ridisegni)', () => {
    expect(osservatore).toMatch(/setIndiceAttivo\(\(prima\) => \(prima === miglioreIdx \? prima : miglioreIdx\)\)/);
  });

  it('la regola di scelta, provata sui RISULTATI', () => {
    // la stessa logica del componente, isolata: da un lotto di voci
    // (come quelle che arrivano tutte insieme quando lo schermo gira)
    // deve uscire un indice solo, il piu visibile.
    const scegli = (entries) => {
      let miglioreIdx = -1, miglioreArea = 0;
      entries.forEach((e) => {
        if (!e.isIntersecting || e.intersectionRatio < 0.6) return;
        if (e.intersectionRatio <= miglioreArea) return;
        const idx = Number(e.target.dataset.indice);
        if (!Number.isFinite(idx)) return;
        miglioreArea = e.intersectionRatio; miglioreIdx = idx;
      });
      return miglioreIdx;
    };
    const voce = (i, ratio, dentro = true) => ({ isIntersecting: dentro, intersectionRatio: ratio, target: { dataset: { indice: String(i) } } });
    // tre slide sopra soglia insieme: vince la piu visibile, una sola
    expect(scegli([voce(2, 0.7), voce(3, 0.95), voce(4, 0.61)])).toBe(3);
    // nessuna sopra soglia: non si cambia niente (-1 = si resta dov'era)
    expect(scegli([voce(1, 0.2), voce(2, 0.59)])).toBe(-1);
    // fuori vista, anche con area alta, non conta
    expect(scegli([voce(5, 0.99, false)])).toBe(-1);
    // indice illeggibile: si ignora, non si esplode
    expect(scegli([{ isIntersecting: true, intersectionRatio: 0.9, target: { dataset: {} } }])).toBe(-1);
  });

  it('dopo il ribaltamento la slide attiva torna al suo posto', () => {
    expect(feed).toMatch(/window\.addEventListener\('orientationchange', rimetti\)/);
    expect(feed).toMatch(/scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
    // e si smonta l'ascolto: un ascoltatore lasciato acceso e' l'altra
    // meta di questa stessa malattia
    expect(feed).toMatch(/removeEventListener\('orientationchange', rimetti\)/);
    expect(feed).toMatch(/removeEventListener\('resize', rimetti\)/);
  });

  it('e il video si puo vedere a tutto schermo davvero', () => {
    // allowFullScreen da solo non basta su alcuni browser: serve anche
    // il permesso «fullscreen» nell'elenco allow.
    for (const f of ['FeedNotizieMondo', 'FinestraSulMondo', 'SchedaArgomento']) {
      const src = leggi(`app/components/${f}.js`);
      expect(src, f).toMatch(/allow="[^"]*fullscreen[^"]*"/);
      expect(src, f).toMatch(/allowFullScreen/);
    }
  });
});

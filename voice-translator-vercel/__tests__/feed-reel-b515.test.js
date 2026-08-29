import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 → b.580 — feed a tutta pagina, autoplay sequenziale, filtro a 3 stati', () => {
  it('usa osservatore, scroll snap e i tre filtri', () => {
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/new IntersectionObserver/);
    expect(f).toMatch(/scrollSnapType: 'y mandatory'/);
    expect(f).toMatch(/id: 'video', labelKey: 'feedSoloVideo'/);
    expect(f).toMatch(/id: 'articoli', labelKey: 'feedSoloArticoli'/);
    expect(f).toMatch(/id: 'entrambi', labelKey: 'feedEntrambi'/);
  });

  it('il player esiste solo se la slide e sia logica sia realmente visibile', () => {
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/i === indiceAttivo && i === indiceVisibile \? \(/);
    expect(f).toMatch(/autoplay=1&playsinline=1&enablejsapi=1/);
    expect(f).toMatch(/setIndiceVisibile\(miglioreIdx\)/);
    expect(f).toMatch(/setIndiceVisibile\(null\)/);
  });

  it('MondoNews collega il feed e un cambio filtro cerca subito se manca quel tipo', () => {
    const m = leggi('app/components/MondoNews.js');
    expect(m).toMatch(/import FeedNotizieMondo from '\.\/FeedNotizieMondo\.js';/);
    expect(m).toMatch(/const feedFiltro = prefs\?\.mondoFeedFiltro \|\| 'video';/);
    expect(m).toMatch(/<FeedNotizieMondo aperto=\{feedAperto\}/);
    expect(m).toMatch(/onFiltro=\{\(id\) => \{/);
    expect(m).toMatch(/if \(manca && !cercandoRef\.current\) cresci\(\)/);
  });

  it('le chiavi base del feed esistono in italiano e inglese', () => {
    const it_ = leggi('app/lib/locales/it.js');
    const en_ = leggi('app/lib/locales/en.js');
    for (const k of ['feedSoloVideo', 'feedSoloArticoli', 'feedEntrambi', 'feedFiltroLabel', 'feedVuoto', 'feedApri']) {
      expect(it_).toMatch(new RegExp(`"${k}":`));
      expect(en_).toMatch(new RegExp(`"${k}":`));
    }
  });
});
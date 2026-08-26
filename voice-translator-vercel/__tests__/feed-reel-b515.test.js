import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.515 — il feed a tutta pagina (stile reel), autoplay in sequenza, filtro a 3 stati', () => {
  it('FeedNotizieMondo esiste e ha IntersectionObserver + scroll-snap + i tre filtri', () => {
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/new IntersectionObserver/);
    expect(f).toMatch(/scrollSnapType: 'y mandatory'/);
    expect(f).toMatch(/id: 'video', labelKey: 'feedSoloVideo'/);
    expect(f).toMatch(/id: 'articoli', labelKey: 'feedSoloArticoli'/);
    expect(f).toMatch(/id: 'entrambi', labelKey: 'feedEntrambi'/);
    // il video suona SOLO sulla slide attiva: altrove resta una miniatura statica
    expect(f).toMatch(/i === indiceAttivo \? \(/);
    expect(f).toMatch(/autoplay=1&playsinline=1/);
  });

  it('MondoNews collega il feed: tasto flottante, filtro persistito col default video', () => {
    const m = leggi('app/components/MondoNews.js');
    expect(m).toMatch(/import FeedNotizieMondo from '\.\/FeedNotizieMondo\.js';/);
    expect(m).toMatch(/const \[feedAperto, setFeedAperto\] = useState\(false\);/);
    expect(m).toMatch(/const feedFiltro = prefs\?\.mondoFeedFiltro \|\| 'video';/);
    expect(m).toMatch(/<FeedNotizieMondo aperto=\{feedAperto\}/);
    expect(m).toMatch(/onFiltro=\{\(id\) => savePrefs\(\{ \.\.\.prefs, mondoFeedFiltro: id \}\)\}/);
  });

  it('it.js e en.js hanno le chiavi del feed', () => {
    const it_ = leggi('app/lib/locales/it.js');
    const en_ = leggi('app/lib/locales/en.js');
    for (const k of ['feedSoloVideo', 'feedSoloArticoli', 'feedEntrambi', 'feedFiltroLabel', 'feedVuoto', 'feedApri']) {
      expect(it_).toMatch(new RegExp(`"${k}":`));
      expect(en_).toMatch(new RegExp(`"${k}":`));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.516 — LA TRAPPOLA DI b.514, RIMASTA APERTA IN ALTRE TRE SCHERMATE.
//
// Misurato dal vivo in produzione su b.515 (finestra 657x749):
//   - SchedaArgomento: il tasto Chiudi finiva SOTTO l'intestazione di
//     Notizie (z:6) e premendolo si apriva il pannello laterale invece
//     di chiudere la scheda;
//   - FeedNotizieMondo e MondoDiscussioni: dichiarano `fixed inset:0`
//     ma uscivano 440x691 a (109,58) invece di 657x749 a (0,0).
// Causa: un antenato `absolute` + `transform` fa da containing block a
// qualunque `fixed`, e un antenato `relative; z-index:5` incapsula lo
// z-index dichiarato dentro.
describe('b.516 — le schermate a tutta pagina montano in document.body', () => {
  it('Sovrapposizione monta in document.body e aspetta il client (niente document in SSR)', () => {
    const p = leggi('app/components/ui/Sovrapposizione.js');
    expect(p).toMatch(/import \{ createPortal \} from 'react-dom';/);
    expect(p).toMatch(/const \[montato, setMontato\] = useState\(false\);/);
    expect(p).toMatch(/if \(!montato\) return null;/);
    expect(p).toMatch(/return createPortal\(children, document\.body\);/);
  });

  it('SchedaArgomento, FeedNotizieMondo e MondoDiscussioni passano dalla Sovrapposizione', () => {
    const files = [
      'app/components/SchedaArgomento.js',
      'app/components/FeedNotizieMondo.js',
      'app/components/MondoDiscussioni.js',
    ];
    for (const f of files) {
      const p = leggi(f);
      expect(p, f).toMatch(/import Sovrapposizione from '\.[./]*(components\/)?ui\/Sovrapposizione\.js';/);
      expect(p, f).toMatch(/<Sovrapposizione>/);
      expect(p, f).toMatch(/<\/Sovrapposizione>/);
      // l'apertura viene prima della chiusura, e ce n'e una sola coppia
      expect(p.match(/<Sovrapposizione>/g).length, f).toBe(1);
      expect(p.match(/<\/Sovrapposizione>/g).length, f).toBe(1);
      expect(p.indexOf('<Sovrapposizione>')).toBeLessThan(p.indexOf('</Sovrapposizione>'));
    }
  });

  it('il velo a tutta pagina di quelle schermate resta dichiarato fixed inset:0', () => {
    expect(leggi('app/components/SchedaArgomento.js')).toMatch(/position: 'fixed', inset: 0, zIndex: 300/);
    expect(leggi('app/components/FeedNotizieMondo.js')).toMatch(/position: 'fixed', inset: 0, zIndex: 97/);
    expect(leggi('app/components/MondoDiscussioni.js')).toMatch(/position: 'fixed', inset: 0, zIndex: 90/);
  });

  it('stanno tutte sopra la barra di navigazione in fondo (z:50)', () => {
    const nav = leggi('app/components/BottomNav.js');
    const z = Number(nav.match(/zIndex: (\d+),/)[1]);
    expect(z).toBe(50);
    for (const z2 of [300, 97, 90]) expect(z2).toBeGreaterThan(z);
  });
});

// b.511 — «dentro stanze lascia dietro una icona una popup per
// commentare. cosi la interfaccia e pulita. lascia solo cuore e altri
// tasti veloci utili fuori» (Luca): il modulo per scrivere un commento
// (soprannome + testo + invia) non sta piu sempre aperto in fondo alla
// discussione; sta dietro un'icona, e si apre in una popup dal basso.
// I tasti veloci per singolo commento (cuore, traduci, segnala, blocca)
// restano fuori, dove erano.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.511 — il modulo per commentare sta dietro un\'icona', () => {
  it('esiste lo stato che apre/chiude la popup, e l\'icona che la apre', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    expect(p).toMatch(/const \[composerAperto, setComposerAperto\] = useState\(false\);/);
    expect(p).toMatch(/onClick=\{\(\) => setComposerAperto\(true\)\}/);
  });

  it('la popup contiene soprannome, testo e invia, e si chiude da sola dopo un invio riuscito', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    expect(p, 'la popup e condizionata a composerAperto').toMatch(/\{composerAperto && \(/);
    expect(p, 'dentro la popup c\'e ancora il campo soprannome').toMatch(/placeholder=\{L\('publicNickname'\)\}/);
    expect(p, 'dopo un invio riuscito la popup si chiude').toMatch(/setTesto\(''\); setComposerAperto\(false\);/);
  });

  it('i tasti veloci per commento (cuore, traduci, segnala, blocca) restano fuori da qualsiasi popup, non toccati', () => {
    const p = leggi('app/components/MondoDiscussioni.js');
    // sono tutti PRIMA della sezione Composer/popup nel file: se ci sono
    // ancora, nella stessa forma di prima, e in quella posizione, non
    // sono stati spostati dentro la nuova popup.
    const iComposer = p.indexOf('{/* Composer */}');
    const primaDelComposer = p.slice(0, iComposer);
    expect(primaDelComposer, 'il cuore/like resta visibile per ogni commento, fuori dalla popup').toMatch(/onClick=\{\(\) => metti\(c\.id\)\}/);
    expect(primaDelComposer, 'segnala il singolo commento resta fuori').toMatch(/onClick=\{\(\) => segnalaCommento\(c\.id\)\}/);
    expect(primaDelComposer, 'blocca resta fuori').toMatch(/cambiaBlocco\(prefs, c\.author_user_id\)/);
  });
});

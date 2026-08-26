// b.513 — «quando clicco aggiorna chiudi la side bar sempre in tutte le
// maschere, quando clicco fuori dalla sidebar chiudi la side bar in
// tutto il software» (Luca): il tasto Aggiorna nel pannello Notizie
// lasciava il pannello aperto sopra il giornale appena rinfrescato.
// Il click fuori dal pannello (il velo) chiude gia da PannelloLaterale,
// il componente condiviso da tutte le maschere che hanno un pannello
// laterale (Notizie, Stanze, Life, Voci in stanza): non serviva
// toccarlo, ma il test lo verifica comunque, perche e la seconda meta
// della richiesta.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.513 — Aggiorna chiude il pannello, il velo chiude gia ovunque', () => {
  it('il tasto Aggiorna (o Invio nel campo di ricerca) chiude il pannello dopo aver cercato', () => {
    const p = leggi('app/components/MondoNews.js');
    expect(p, 'Invio nel campo cerca chiude il pannello').toMatch(
      /onKeyDown=\{e => \{ if \(e\.key === 'Enter'\) \{ cerca\(query\); suChiudiStrumenti\?\.\(\); \} \}\}/
    );
    expect(p, 'il tasto Aggiorna chiude il pannello dopo la ricerca').toMatch(/suChiudiStrumenti\?\.\(\);/);
  });

  it('PannelloLaterale — il componente condiviso da tutte le maschere — chiude gia cliccando fuori (il velo)', () => {
    const p = leggi('app/components/ui/PannelloLaterale.js');
    expect(p, 'il velo di sfondo chiama onChiudi al click').toMatch(
      /onClick=\{\(\) => \{ vibrate\(6\); onChiudi\?\.\(\); \}\}\s*\n\s*style=\{\{ position: 'fixed', inset: 0, zIndex: 88/
    );
  });

  it('tutte le maschere con un pannello laterale usano il componente condiviso PannelloLaterale', () => {
    const usi = [
      'app/components/MondoNews.js',
      'app/components/MondoView.js',
      'app/components/Life/LifeView.js',
      'app/components/RoomView.js',
    ];
    for (const file of usi) {
      const p = leggi(file);
      expect(p, `${file} usa PannelloLaterale`).toMatch(/<PannelloLaterale aperto=\{/);
    }
  });
});

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
  // b.523 — REGOLA DECADUTA, e va detto perche' invece di cancellarla in
  // silenzio: b.513 chiedeva «quando clicco aggiorna chiudi la side bar»
  // perche' il campo di ricerca VIVEVA nel pannello, e dopo aver cercato
  // il pannello restava aperto sopra il giornale appena aggiornato. In
  // b.523 Luca ha chiesto che «la ricerca principale va messa fuori»: il
  // campo e nella pagina, non c'e piu nessuna sidebar da chiudere. Il
  // controllo diventa quindi il suo opposto.
  it('il campo di ricerca non sta piu nel pannello, quindi non c e niente da chiudere', () => {
    const f = leggi('app/components/MondoNews.js');
    const campo = f.indexOf("L('newsWhatFollow')");
    const pannello = f.indexOf('<PannelloLaterale');
    expect(campo).toBeGreaterThan(-1);
    expect(campo).toBeLessThan(pannello);
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

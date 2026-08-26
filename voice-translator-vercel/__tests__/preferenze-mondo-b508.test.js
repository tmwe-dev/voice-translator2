// b.508 — SECONDO GIRO CON LUCA sul pannello preferenze di Mondo/Notizie:
// via i grassetti rimasti (600 nel codice nonostante il commento di
// b.482 dicesse gia il contrario), via la preferenza "da dove parto"
// (tendina di quaranta paesi), preferenze rimaste compresse in una riga
// sola ciascuna, e la pillola del Paese in testata ridotta a bandiera.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.508 — niente piu grassetti nel pannello preferenze', () => {
  it('nessun fontWeight 600 o 700 in PreferenzeMondo.js', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p, 'il peso 600 non deve piu comparire').not.toMatch(/fontWeight:\s*600/);
    expect(p, 'e nemmeno 700 o 800').not.toMatch(/fontWeight:\s*[78]00/);
  });
});

describe('b.508 — via la preferenza "da dove parto" (mondoPaese)', () => {
  it('la tendina dei paesi e sparita dal pannello', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).not.toMatch(/chiave: 'mondoPaese'/);
    expect(p).not.toMatch(/opzioniPaese/);
    expect(p).not.toMatch(/const PAESI = /);
    expect(p, "Scelta (la tendina) non serve piu qui").not.toMatch(/import Scelta from/);
    expect(p, 'il prop bandieraMia non serve piu').not.toMatch(/bandieraMia/);
  });

  it('restano esattamente le quattro preferenze compatte', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    for (const chiave of ['mondoTitoli', 'mondoModo', 'mondoRitmo', 'mondoAggiorna']) {
      expect(p, `manca ${chiave}`).toMatch(new RegExp(`chiave: '${chiave}'`));
    }
    const conto = (p.match(/chiave: '/g) || []).length;
    expect(conto, 'quattro preferenze, non una di piu').toBe(4);
  });

  it("chi chiama PreferenzeMondo non passa piu bandieraMia", () => {
    const v = leggi('app/components/MondoView.js');
    const n = leggi('app/components/MondoNews.js');
    expect(v).toMatch(/<PreferenzeMondo C=\{C\} \/>/);
    expect(n).toMatch(/<PreferenzeMondo C=\{C\} \/>/);
  });
});

describe('b.508 — ogni preferenza sta in una riga sola', () => {
  it('titoli, modo e aggiorna usano un\'icona sola che cicla (IconeCiclo)', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).toMatch(/function IconeCiclo\(/);
    expect(p).toMatch(/tipo: 'ciclo'/);
  });

  it('il ritmo usa la rotellina verticale (PassoVerticale), non piu quattro tasti', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).toMatch(/function PassoVerticale\(/);
    expect(p).toMatch(/tipo: 'passo'/);
    expect(p, 'chevUp e chevDown per il piu/meno').toMatch(/chevUp/);
    expect(p).toMatch(/chevDown/);
  });
});

describe('b.508 — la pillola del Paese in testata e solo bandiera', () => {
  it('niente piu nome del paese scritto accanto alla bandiera nella pillola', () => {
    const v = leggi('app/components/MondoView.js');
    const inizio = v.indexOf('paeseScelto ? (');
    const blocco = v.slice(inizio, inizio + 1100);
    expect(blocco, 'la bandiera resta').toMatch(/bandieraPaese\(paeseScelto\)/);
    expect(blocco, 'il nome resta per lo screen reader').toMatch(/aria-label=\{nomePaese\(paeseScelto\)\}/);
    expect(blocco, 'ma non piu scritto a schermo in un secondo span')
      .not.toMatch(/<span[^>]*>\{nomePaese\(paeseScelto\)\}<\/span>/);
  });
});

describe('b.508 — il pianeta apre di default sul Paese dedotto dalla lingua', () => {
  it('l\'effetto di ingresso non dipende piu da mondoPaese', () => {
    const v = leggi('app/components/MondoView.js');
    expect(v).toMatch(/const mio = paeseDaLingua\(prefs\?\.lang\);\s*\n\s*if \(mio\) setPaeseScelto\(mio\);/);
  });
});

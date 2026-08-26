import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.504 — IL MONDO, guardato con Luca: tavole 02/M1/M2 ═══
// M1: la RICERCA sta NELLA PAGINA, sotto le linguette — non dietro la
// porta del pannello; il Paese e una pillola SENZA la freccia «Cambia»
// (si tocca e si apre il pannello); l'aggiornamento e un'icona in
// testata; «Aperte adesso» e l'etichetta dell'elenco.
// M2: il pannello e SOLO preferenze — via la ricerca (e in pagina) e
// via il filtro lingua (l'app traduce tutto: filtrare per lingua
// rimette la barriera; il posto da cui guardare e mondoPaese, che nel
// pannello c'era gia).

const vista = readFileSync(join(process.cwd(), 'app/components/MondoView.js'), 'utf8');

describe('M1 — le stanze', () => {
  it('la ricerca sta nella pagina, non nel pannello', () => {
    const pannello = vista.slice(vista.indexOf('<PannelloLaterale'), vista.indexOf('</PannelloLaterale>'));
    expect(pannello).not.toMatch(/setSearch/);
    // b.507 — la prova precedente si accontentava di un setSearch
    // qualunque dopo la testata (lo trovava nei risultati) e non si e
    // accorta che il CAMPO non esisteva: ora si pretende l'input vero,
    // col suo placeholder, nel corpo della pagina.
    const pagina = vista.slice(vista.indexOf('</header>'));
    expect(pagina).toMatch(/placeholder=\{L\('searchRooms'\)\}/);
    expect(pagina).toMatch(/<input type="text" value=\{search\}/);
  });

  it('il Paese e una pillola senza la freccia, e apre il pannello', () => {
    expect(vista).not.toMatch(/\{L\('changeWord'\)\}/);
    expect(vista).toMatch(/paeseScelto[\s\S]{0,900}setStrumenti\(true\)/);
  });

  it('aggiornare e un\'icona in testata', () => {
    const testata = vista.slice(vista.indexOf('<header'), vista.indexOf('</header>'));
    expect(testata).toMatch(/handleRefresh/);
  });

  it('«Aperte adesso» e l\'etichetta dell\'elenco', () => {
    expect(vista).toMatch(/openNowWord/);
  });
});

describe('M2 — il pannello, ripulito', () => {
  it('via il filtro lingua: il posto da cui guardare e mondoPaese', () => {
    const pannello = vista.slice(vista.indexOf('<PannelloLaterale'), vista.indexOf('</PannelloLaterale>'));
    expect(pannello).not.toMatch(/langFilter/);
    expect(pannello).toMatch(/PreferenzeMondo/);
  });
});

describe('la chiave nuova esiste in tutte le 38 lingue', () => {
  it('openNowWord', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      expect(s.includes('"openNowWord":"'), f).toBe(true);
    }
  });
});

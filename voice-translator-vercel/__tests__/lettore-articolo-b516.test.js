import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.516 — PannelloLaterale: scroll fix + layout', () => {
  const f = leggi('app/components/ui/PannelloLaterale.js');
  it('la lista scorrevole ha minHeight:0', () => expect(f).toMatch(/minHeight: 0/));
  it('il pannello usa il viewport dinamico', () => {
    expect(f).toMatch(/height: '100dvh'/);
    expect(f).toMatch(/maxHeight: '100dvh'/);
  });
  it('il pannello resta largo', () => expect(f).toMatch(/min\(460px, 92vw\)/));
});

describe('b.516 → b.580 — PreferenzeMondo: lo stato attuale resta visibile', () => {
  const f = leggi('app/components/ui/PreferenzeMondo.js');
  it('ogni riga calcola e mostra il valore attuale', () => {
    expect(f).toMatch(/const attuale = o\.values\.find/);
    expect(f).toMatch(/const valore = attuale\.labelKey \? L\(attuale\.labelKey\) : attuale\.label/);
    expect(f).toMatch(/\{valore\}<\/span>/);
  });
  it('il valore non sposta l icona: cella fissa e testo elastico', () => {
    expect(f).toMatch(/width: 38, height: 38/);
    expect(f).toMatch(/flex: 1, minWidth: 0/);
  });
});

describe('b.516 — LettoreArticolo: sintesi/traduci dentro la pagina reale', () => {
  const f = leggi('app/components/ui/LettoreArticolo.js');
  it('accetta dati/prefs/userToken', () => expect(f).toMatch(/dati, prefs, userToken/));
  it('ha generaSintesi e usa le chiavi errore esistenti', () => {
    expect(f).toMatch(/generaSintesi/);
    expect(f).toMatch(/L\('schedaAccedi'\)/);
    expect(f).toMatch(/L\('genericError'\)/);
    expect(f).not.toMatch(/needAccountForSummary|summaryError/);
  });
});

describe('b.516 — MondoNews apre il lettore vero', () => {
  const f = leggi('app/components/MondoNews.js');
  it('non usa piu schedaAutoGenera', () => expect(f).not.toMatch(/schedaAutoGenera/));
  it('usa Apri e traduci e Parlane', () => {
    expect(f).toMatch(/L\('newsOpenTranslate'\)/);
    expect(f).toMatch(/L\('newsTalkAbout'\)/);
  });
  it('LettoreArticolo riceve contenuto e preferenze', () => {
    expect(f).toMatch(/<LettoreArticolo/);
    expect(f).toMatch(/dati=\{lettura\.dati\} prefs=\{prefs\} userToken=\{userToken\}/);
  });
});

describe('b.516 → b.535 — il feed usa Apri e traduci', () => {
  it('usa newsOpenTranslate', () => expect(leggi('app/components/FeedNotizieMondo.js')).toMatch(/L\('newsOpenTranslate'\)/));
});
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.516 — risposta diretta al feedback live di Luca su b.515:
// «preferenze senza stato visibile» / «lo scroll non va» / «container sotto
// il menu» / «troppo margine laterale» / «il riassunto non lo voglio,
// voglio aprire dentro la pagina l'articolo» / «icone per leggi e parlane
// sotto immagine».

describe('b.516 — PannelloLaterale: scroll fix + layout', () => {
  const f = leggi('app/components/ui/PannelloLaterale.js');
  it('la lista scorrevole ha minHeight:0 (fix bug flexbox min-height:auto)', () => {
    expect(f).toMatch(/minHeight: 0/);
  });
  it('il pannello usa 100dvh invece di top:0;bottom:0 (niente piu sotto al menu)', () => {
    expect(f).toMatch(/height: '100dvh'/);
    expect(f).toMatch(/maxHeight: '100dvh'/);
  });
  it('il pannello e piu largo (meno margine laterale)', () => {
    expect(f).toMatch(/min\(460px, 92vw\)/);
  });
});

describe('b.516 — PreferenzeMondo: stato visibile sui pulsanti ciclo', () => {
  const f = leggi('app/components/ui/PreferenzeMondo.js');
  // b.523 — lo stato NON sta piu dentro il comando (allargava la
  // scatola e spostava l'icona: «la disposizione delle icone non deve
  // essere influenzata dal testo mai»). Sta in un badge bruno sotto il
  // titolo, a sinistra. Il requisito di b.516 — «deve evidenziare il
  // modo in cui lo fa in quel momento» — resta soddisfatto, altrove.
  it('lo stato attuale si legge ancora, ora nel badge a sinistra', () => {
    expect(f).toMatch(/<BadgeStato testo=\{sceltaAttiva\./);
    expect(f).toMatch(/L\(sceltaAttiva\.etichettaKey\)/);
  });
  it('il comando e rimasto senza testo, cosi non puo allargarsi', () => {
    expect(f).toMatch(/function IconeCiclo\(\{ scelte, valore, onCambia, C, etichettaAria \}\)/);
  });
});

describe('b.516 — LettoreArticolo: sintesi/traduci dentro la pagina reale', () => {
  const f = leggi('app/components/ui/LettoreArticolo.js');
  it('accetta dati/prefs/userToken', () => {
    expect(f).toMatch(/dati, prefs, userToken/);
  });
  it('ha generaSintesi e usa le chiavi errore esistenti (non inventate)', () => {
    expect(f).toMatch(/generaSintesi/);
    expect(f).toMatch(/L\('schedaAccedi'\)/);
    expect(f).toMatch(/L\('genericError'\)/);
    expect(f).not.toMatch(/needAccountForSummary/);
    expect(f).not.toMatch(/summaryError/);
  });
});

describe('b.516 — MondoNews: articoli aprono LettoreArticolo, icone leggi/parlane sotto immagine', () => {
  const f = leggi('app/components/MondoNews.js');
  it('niente piu schedaAutoGenera', () => {
    expect(f).not.toMatch(/schedaAutoGenera/);
  });
  it('immagine e titolo aprono setLettura con dati', () => {
    // b.517 — la chiamata ora porta anche su quale faccia atterrare
    expect(f).toMatch(/setLettura\(\{ url: t\.url, titolo: t\.titolo, fonte: t\.fonti\?\.\[0\]\?\.fonte, dati: t, faccia: 'articolo' \}\)/);
  });
  it('la riga icone leggi/parlane esiste subito dopo il blocco immagine', () => {
    expect(f).toMatch(/L\('readWord'\)/);
    expect(f).toMatch(/L\('newsTalkAbout'\)/);
  });
  it('onApriArticolo dal feed apre LettoreArticolo (non piu SchedaArgomento)', () => {
    expect(f).toMatch(/onApriArticolo=\{\(d\) => \{ setLettura\(\{ url: d\.url, titolo: d\.titolo, fonte: d\.fonti\?\.\[0\]\?\.fonte, dati: d \}\); \}\}/);
  });
  it('LettoreArticolo riceve dati/prefs/userToken', () => {
    expect(f).toMatch(/<LettoreArticolo url=\{lettura\.url\} titolo=\{lettura\.titolo\} fonte=\{lettura\.fonte\}/);
    expect(f).toMatch(/dati=\{lettura\.dati\} prefs=\{prefs\} userToken=\{userToken\}/);
  });
});

describe('b.516 — FeedNotizieMondo: bottone articolo dice "Leggi", non "Apri e traduci"', () => {
  it('usa readWord', () => {
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/L\('readWord'\)/);
  });
});

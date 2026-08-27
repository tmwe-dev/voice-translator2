import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.524 — Luca: «le side bar delle tre pagine stanze, notizie e mondo
// hanno la stessa selezione campi?????» — non l'avevano. Ora lo
// scheletro e uno solo: Preferiti, Paese, filtri propri, Preferenze.

describe('b.524 — lo scheletro del pannello e lo stesso su tutte le schede', () => {
  const vista = leggi('app/components/MondoView.js');
  const news = leggi('app/components/MondoNews.js');

  it('tutti e due i pannelli hanno i Preferiti', () => {
    expect(vista).toMatch(/<PreferitiTemi temi=\{schedaPaese\?\.temiCaldi\}/);
    expect(news).toMatch(/<PreferitiTemi nudo temi=\{argomentiVeri\.map/ /* b.535: dentro la card di vetro i Preferiti vanno nudi (il titolo lo da la card) */);
  });

  it('tutti e due i pannelli hanno la tendina Paese, con Mondo intero in testa', () => {
    // b.535 — in Notizie il titolo «Paese» lo porta la CARD di vetro
    // (sbWhereTitle + icona globe); in Stanze/Mondo resta l'etichetta
    // classica. La tendina sotto e' la stessa Scelta, con «Mondo
    // intero» in testa in entrambi.
    expect(vista).toMatch(/etichetta=\{L\('countryLabel'\)\}/);
    expect(news).toMatch(/icona="globe" titolo=\{L\('sbWhereTitle'\)\}/);
    for (const f of [vista, news]) {
      expect(f).toMatch(/etichetta: L\('wholeWorld'\)/);
    }
  });

  it('tutti e due chiudono con le stesse quattro Preferenze', () => {
    expect(vista).toMatch(/<PreferenzeMondo C=\{C\} \/>/);
    expect(news).toMatch(/<PreferenzeMondo C=\{C\} \/>/);
  });

  it('l ordine e Preferiti -> Paese -> filtri propri -> Preferenze, in entrambi', () => {
    for (const f of [vista, news]) {
      const pannello = f.slice(f.indexOf('<PannelloLaterale'));
      const iPref = pannello.indexOf('<PreferitiTemi');
      // b.535 — il segnaposto del Paese cambia veste per scheda: card
      // di vetro in Notizie, etichetta classica in Stanze/Mondo.
      const iPaese = pannello.indexOf("L('countryLabel')") !== -1
        ? pannello.indexOf("L('countryLabel')")
        : pannello.indexOf("L('sbWhereTitle')");
      const iPreferenze = pannello.indexOf('<PreferenzeMondo');
      expect(iPref).toBeGreaterThan(-1);
      expect(iPref).toBeLessThan(iPaese);
      expect(iPaese).toBeLessThan(iPreferenze);
    }
  });

  it('nelle Notizie il Paese passa da scegliPaese: un filtro solo, condiviso col globo', () => {
    // b.529 — il tocco scrive la bozza; scegliPaese parte dal tasto Applica
    expect(news).toMatch(/onCambia=\{\(v\) => setBozzaPaese\(v === 'tutto' \? null : v\)\}/);
    expect(news).toMatch(/scegliPaese\(bozzaPaese\)/);
  });

  it('il pannello aperto dal globo non si intitola piu «Stanze»', () => {
    expect(vista).toMatch(/titolo=\{tab === 'mondo' \? L\('worldNowTitle'\) : L\('tabRooms'\)\}/);
  });
});

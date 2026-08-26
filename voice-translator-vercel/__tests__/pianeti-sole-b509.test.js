// b.509 — ORDINE DIRETTO DI LUCA: «ripristina tutto e correggi quel
// problema grafico [...] altrimenti elimini semplicemente quel
// pianeta. Non tutto.»
//
// In b.508 avevo riportato (non deciso: era gia cosi da un commit di
// Luca del 21/8, b4416df) che sole e i tre pianeti decorativi erano
// spenti per un difetto grafico su Saturno (l'anello senza la sua
// sfera, che sembra un buco). Luca ha chiesto di riaccendere TUTTO e
// risolvere il difetto vero, non di lasciarli spenti.
//
// DIAGNOSI: la sfera di ogni pianeta usava meshStandardMaterial (segue
// la luce direzionale della scena: sul lato non illuminato diventa
// quasi nera, invisibile contro il nero dello spazio), mentre l'anello
// di Saturno usa meshBasicMaterial (colore pieno, non risente di
// nessuna luce, sempre visibile). A certi angoli la sfera si "spegne"
// e resta solo l'anello — il buco descritto da Luca.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.509 — sole e pianeti sono di nuovo accesi', () => {
  it('showPlanets e showSun sono tornati true (la luna era gia true)', () => {
    const g = leggi('public/mondo-globo.html');
    expect(g).toMatch(/showStarfield:!0,showPlanets:!0,showMoon:!0,showSun:!0,earthVariant:t/);
    expect(g, 'niente piu spento').not.toMatch(/showPlanets:!1/);
    expect(g).not.toMatch(/showSun:!1/);
  });
});

describe('b.509 — la sfera dei pianeti non sparisce piu contro la luce', () => {
  it('Mars/Venus/Saturn usano meshBasicMaterial per la sfera, non meshStandardMaterial', () => {
    const g = leggi('public/mondo-globo.html');
    const inizio = g.indexOf('U6.map(r=>');
    expect(inizio, 'il blocco dei pianeti decorativi deve esistere').toBeGreaterThan(-1);
    const blocco = g.slice(inizio, inizio + 600);
    expect(blocco, 'la sfera adesso e sempre visibile, come l\'anello').toMatch(/"sphereGeometry"[\s\S]{0,40}"meshBasicMaterial",\{color:r\.color\}/);
    expect(blocco, 'niente piu materiale che segue la luce per la sfera').not.toMatch(/meshStandardMaterial/);
  });

  it('Saturno tiene ancora il suo anello (torusGeometry)', () => {
    const g = leggi('public/mondo-globo.html');
    expect(g).toMatch(/hasRing:!0/);
    expect(g).toMatch(/torusGeometry/);
  });
});

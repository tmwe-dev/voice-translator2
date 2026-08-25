import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.503 — TAVOLE F E 32 ═══
// Tavola F: «le sette sezioni non stanno piu in fila sopra la
// conversazione» — vivono nel pannello laterale, in colonna, e sopra
// la conversazione si recupera una riga intera.
// Tavola 32 (pagina del tassista): «la lingua si sceglie in cima e
// subito» — pillole scorrevoli, non un bottone che apre un altro
// schermo; la destinazione e ENORME (28).

const vita = readFileSync(join(process.cwd(), 'app/components/Life/LifeView.js'), 'utf8');
const taxi = readFileSync(join(process.cwd(), 'app/components/TaxiDriverView.js'), 'utf8');

describe('tavola F — il pannello di Vita', () => {
  it('le sezioni vivono nel pannello laterale, non in fila', () => {
    expect(vita).toMatch(/PannelloLaterale/);
    expect(vita).toMatch(/LinguettaPannello/);
  });

  it('tutte e sette le sezioni restano raggiungibili', () => {
    for (const id of ['podcast', 'amico', 'tavolo', 'impara', 'obiettivi', 'compiti', 'compagni']) {
      expect(vita).toMatch(new RegExp(`id: '${id}'`));
    }
  });

  it('la testata dice dove sei (la sezione attiva)', () => {
    expect(vita).toMatch(/schedaAttiva/);
  });
});

describe('tavola 32 — la pagina del tassista', () => {
  it('la lingua si sceglie in cima e subito, con le pillole', () => {
    expect(taxi).toMatch(/overflowX: 'auto'[\s\S]{0,600}DRIVER_LANGS\.map/);
  });

  it('la destinazione e enorme', () => {
    expect(taxi).toMatch(/fontSize: 28[\s\S]{0,200}translatedAddress/);
  });
});

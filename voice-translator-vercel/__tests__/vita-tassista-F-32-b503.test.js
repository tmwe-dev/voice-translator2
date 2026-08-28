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

// ═══ b.550 — LO SCOSTAMENTO DI b.503 E' CHIUSO ═══
// b.503 aveva dichiarato: «niente conteggi (2 obiettivi, 3 compiti) sulle
// voci — i numeri veri li sapremo quando le fonti saranno esposte in
// elenco». Le fonti c'erano gia tutte, ed erano quelle che le schede
// usano: elencoObiettivi (memoria del dispositivo) e /api/compiti con le
// azioni elenca e materiali. Nessuna rotta nuova.
describe('b.550 — le voci del pannello di Vita portano il loro numero', () => {
  it('i numeri arrivano dalle fonti che esistono gia, non da rotte nuove', () => {
    expect(vita).toMatch(/import \{ elencoObiettivi \} from/);
    expect(vita).toMatch(/azione, userToken/);
    expect(vita).toMatch(/chiedi\('elenca'\)/);
    expect(vita).toMatch(/chiedi\('materiali'\)/);
    // nessuna porta inventata: si passa dalla stessa di Compiti
    const rotte = vita.match(/'\/api\/compiti'/g) || [];
    expect(rotte.length).toBeGreaterThan(0);
  });

  it('Obiettivi e Compiti portano il conteggio, i Compiti anche i materiali', () => {
    expect(vita).toMatch(/id: 'obiettivi'[^}]*numero: conteggi\.obiettivi/);
    expect(vita).toMatch(/id: 'compiti'[^}]*numero: conteggi\.compiti[^}]*materiali: conteggi\.materiali/);
    expect(vita).toMatch(/L\('lifeHomeworkMaterials'\)/);
  });

  it('un numero che non sappiamo NON diventa uno zero', () => {
    // regola di Luca (la stessa dei «N ricordi» di b.498): un numero falso
    // e peggio di nessun numero. Finche non e arrivato resta null e non si
    // disegna niente — mai uno zero di comodo.
    expect(vita).toMatch(/\{ obiettivi: null, compiti: null, materiali: null \}/);
    expect(vita).toMatch(/t\.numero > 0/);
    expect(vita).toMatch(/t\.materiali > 0/);
  });
});

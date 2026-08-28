import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.494 — TAVOLA 10: OBIETTIVI ═══
// «Poche cose, con quanto manca. Aggiungerne una e una riga sola.»
// I compiti di oggi (e in ritardo) sono RIGHE dentro Obiettivi, non
// un'altra sezione da aprire; «Nuovo obiettivo» e la pillola grande in
// fondo, come sulla tavola; toccare una riga porta ai Compiti.

const vista = readFileSync(join(process.cwd(), 'app/components/Life/GestioneObiettivi.js'), 'utf8');
const life = readFileSync(join(process.cwd(), 'app/components/Life/LifeView.js'), 'utf8');

describe('tavola 10 — Obiettivi', () => {
  it('i compiti di oggi stanno qui come righe (PER OGGI)', () => {
    expect(vista).toMatch(/forTodayWord/);
    expect(vista).toMatch(/azione: 'elenca'/);
  });

  it('toccare una riga porta ai Compiti, senza doppioni di gestione', () => {
    expect(vista).toMatch(/cambiaScheda\('compiti'\)/);
    expect(life).toMatch(/scheda === 'obiettivi'[\s\S]{0,200}cambiaScheda=\{setScheda\}/);
  });

  it('«Nuovo obiettivo» e la pillola grande in fondo', () => {
    const posElenco = vista.indexOf('lifeGoalEmpty');
    const posNuovo = vista.lastIndexOf('lifeGoalNew');
    expect(posElenco).toBeGreaterThan(-1);
    expect(posNuovo).toBeGreaterThan(posElenco);
  });

  it('la chiave nuova esiste in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      expect(s.includes('"forTodayWord":"'), f).toBe(true);
    }
  });
});

// ═══ b.550 — LO SCOSTAMENTO DI b.494 E' CHIUSO ═══
// b.494 aveva dichiarato: «le matite e le X sulle card degli obiettivi
// restano (il template non le mostra ma sono funzioni vive: toglierle
// senza un posto nuovo e perdere funzioni)». Il posto nuovo adesso c'e —
// un menu «⋯» in alto a destra della card — quindi la card torna com'e
// sulla tavola di Luca E le due funzioni restano tutte e due vive.
describe('b.550 — le matite e le X vivono nel menu «⋯»', () => {
  it('la card non porta piu i due tasti sempre accesi', () => {
    // la matita e la X stavano nella riga del titolo, una accanto all'altra
    expect(vista).not.toMatch(/aria-label=\{L\('lifeGoalEdit'\)\}[\s\S]{0,120}Icon name="settings"/);
    expect(vista).not.toMatch(/onClick=\{\(\) => elimina\(o\.id\)\} aria-label/);
  });

  it('c\'e un menu che si apre al tocco, uno per card', () => {
    expect(vista).toMatch(/setMenuAperto\(\(m\) => \(m === o\.id \? null : o\.id\)\)/);
    expect(vista).toMatch(/aria-haspopup="menu"/);
    expect(vista).toMatch(/role="menu"/);
    expect(vista).toMatch(/⋯/);
  });

  it('e dentro ci sono le STESSE due funzioni di prima', () => {
    expect(vista, 'Modifica apre la stessa bozza').toMatch(/setMenuAperto\(null\); setBozza\(\{ \.\.\.o \}\)/);
    expect(vista, 'Elimina chiama la stessa elimina').toMatch(/setMenuAperto\(null\); elimina\(o\.id\)/);
    expect(vista).toMatch(/L\('lifeGoalEdit'\)/);
    expect(vista).toMatch(/L\('lifeGoalDelete'\)/);
  });

  it('si chiude toccando fuori e con Escape', () => {
    expect(vista).toMatch(/onClick=\{\(\) => setMenuAperto\(null\)\}/);
    expect(vista).toMatch(/e\.key === 'Escape'/);
  });
});

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

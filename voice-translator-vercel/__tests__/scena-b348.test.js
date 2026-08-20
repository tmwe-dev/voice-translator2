import { describe, it, expect } from 'vitest';
import { staccaScena, ambientePer, promptScena, promptIcona, AMBIENTI, STILE_LIVELLO } from '../app/lib/compagni/corsi/scena.js';
import { promptLezione } from '../app/lib/compagni/corsi/generatore.js';

describe('b.348 — il libro di lingue ha le sue tavole', () => {
  it('il tag [SCENA:] si stacca dal testo e porta ambiente + oggetti', () => {
    const { testo, scena } = staccaScena('[SCENA: bar | coffee, cup, menu, table]\nCiao, oggi ordiniamo al bar.');
    expect(testo).not.toContain('[SCENA');
    expect(testo).toContain('ordiniamo al bar');
    expect(scena.ambienteId).toBe('bar');
    expect(scena.elementi).toEqual(['coffee', 'cup', 'menu', 'table']);
  });
  it('senza tag il testo resta intatto e la scena e nulla', () => {
    const { testo, scena } = staccaScena('Una lezione senza scena.');
    expect(testo).toBe('Una lezione senza scena.');
    expect(scena).toBeNull();
  });
  it('ambientePer capisce il contesto dal titolo, e senza indizi resta STABILE', () => {
    expect(ambientePer('Ordinare al ristorante').id).toBe('ristorante');
    expect(ambientePer('Chiedere indicazioni per strada').id).toBe('strada');
    const a = ambientePer('Lezione 7', 'inglese');
    const b = ambientePer('Lezione 7', 'inglese');
    expect(a.id).toBe(b.id); // stessa lezione, stessa scena, sempre
  });
  it('la tavola cambia stile col livello, vieta il testo, e ogni livello ha uno stile', () => {
    const bimbo = promptScena({ titolo: 'Al bar', livello: 'bambino' });
    const uni = promptScena({ titolo: 'Al bar', livello: 'universitario' });
    expect(bimbo).toContain('picture-book');
    expect(uni).toContain('academic');
    expect(bimbo).toContain('NO TEXT');
    for (const l of ['bambino', 'base', 'intermedio', 'avanzato', 'universitario', 'ricercatore']) {
      expect(STILE_LIVELLO[l], `stile mancante per ${l}`).toBeTruthy();
    }
  });
  it("l'icona del corso e un emblema, non una scena", () => {
    const p = promptIcona({ argomento: 'inglese', livello: 'base' });
    expect(p).toContain('emblem');
    expect(p).toContain('NO TEXT');
  });
  it('il prompt di una lezione di lingua CHIEDE la scena nel formato fisso', () => {
    const p = promptLezione({ argomento: 'inglese', lezione: { titolo: 'Al bar', obiettivi: ['ordinare'] }, livello: 'base', lingua: 'it' });
    expect(p.system).toContain('[SCENA:');
    expect(p.system).toContain(AMBIENTI[0].id);
  });
  it('una materia normale NON riceve l\'istruzione della scena', () => {
    const p = promptLezione({ argomento: 'Storia di Roma', lezione: { titolo: 'Le origini', obiettivi: ['fondazione'] }, livello: 'base', lingua: 'it' });
    expect(p.system).not.toContain('[SCENA:');
  });
});

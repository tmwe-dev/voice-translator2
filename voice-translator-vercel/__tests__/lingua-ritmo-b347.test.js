import { describe, it, expect } from 'vitest';
import { promptLezione } from '../app/lib/compagni/corsi/generatore.js';

describe('b.347 — una lezione di lingua insegna la lingua', () => {
  it('per un corso di inglese usa il ritmo da INSEGNANTE, non da documentario', () => {
    const p = promptLezione({ argomento: 'inglese', lezione: { titolo: "Introduzione all'inglese quotidiano", obiettivi: ['salutare'] }, livello: 'base', lingua: 'it' });
    expect(p.prompt).toContain('SEI UN INSEGNANTE DI LINGUA');
    expect(p.prompt).not.toContain('VOCE DA DOCUMENTARIO');
    expect(p.system).toContain('[L2:');
  });
  it('per una materia normale resta il ritmo da documentario', () => {
    const p = promptLezione({ argomento: 'Storia di Roma', lezione: { titolo: 'Le origini', obiettivi: ['fondazione'] }, livello: 'base', lingua: 'it' });
    expect(p.prompt).toContain('VOCE DA DOCUMENTARIO');
    expect(p.prompt).not.toContain('SEI UN INSEGNANTE DI LINGUA');
  });
});

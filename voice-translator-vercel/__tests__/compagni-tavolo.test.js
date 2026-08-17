import { describe, it, expect } from 'vitest';
import { promptTavolo, TAVOLO_MAX } from '../app/lib/compagni/tavolo.js';

describe('promptTavolo (puro)', () => {
  const c = { nome: 'Archimede', personalita: 'Sei un filosofo.' };

  it('mette personalità, nome e lingua nel system', () => {
    const { system } = promptTavolo({ compagno: c, ultimoUmano: 'ciao', lingua: 'en' });
    expect(system).toContain('Sei un filosofo.');
    expect(system).toContain('Archimede');
    expect(system).toContain('en');
  });

  it('include l\'ultimo messaggio della persona', () => {
    const { prompt } = promptTavolo({ compagno: c, ultimoUmano: 'che ne pensate?' });
    expect(prompt).toContain('che ne pensate?');
    expect(prompt).toContain('Rispondi come Archimede');
  });

  it('vede cosa hanno già detto gli altri in questo giro', () => {
    const { prompt } = promptTavolo({ compagno: c, ultimoUmano: 'x', altriQuestoGiro: [{ nome: 'Alex', testo: 'io dico A' }] });
    expect(prompt).toContain('hanno già detto');
    expect(prompt).toContain('Alex: io dico A');
  });

  it('massimo quattro al tavolo', () => {
    expect(TAVOLO_MAX).toBe(4);
  });
});

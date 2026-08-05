// Il glossario: prima raccoglieva parole e non le usava nessuno.
// Qui si verifica che faccia davvero il suo mestiere.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  leggiGlossario, salvaGlossario, terminiPertinenti, istruzioneGlossario,
} from '../app/lib/glossario.js';

beforeEach(() => localStorage.clear());

describe('glossario', () => {
  it('salva e rilegge i termini', () => {
    salvaGlossario([{ from: 'polizza', to: 'policy', note: 'assicurazioni' }]);
    const letti = leggiGlossario();
    expect(letti).toHaveLength(1);
    expect(letti[0].to).toBe('policy');
  });

  it('scarta le voci incomplete invece di rompersi', () => {
    salvaGlossario([
      { from: 'valido', to: 'valid' },
      { from: '', to: 'niente' },
      { from: 'senza traduzione', to: '   ' },
      null,
    ]);
    expect(leggiGlossario()).toHaveLength(1);
  });

  it('regge un contenuto corrotto senza lanciare', () => {
    localStorage.setItem('vt-glossario', 'non è json');
    expect(() => leggiGlossario()).not.toThrow();
    expect(leggiGlossario()).toEqual([]);
  });

  it('manda solo i termini che compaiono nella frase', () => {
    const g = [
      { from: 'polizza', to: 'policy' },
      { from: 'franchigia', to: 'deductible' },
    ];
    const usati = terminiPertinenti('Vorrei rinnovare la polizza', g);
    expect(usati).toHaveLength(1);
    expect(usati[0].from).toBe('polizza');
  });

  it('non distingue maiuscole e minuscole', () => {
    const g = [{ from: 'Polizza', to: 'policy' }];
    expect(terminiPertinenti('la POLIZZA scade', g)).toHaveLength(1);
  });

  it('senza termini pertinenti non aggiunge nulla al prompt', () => {
    expect(istruzioneGlossario([])).toBe('');
    expect(terminiPertinenti('ciao come stai', [{ from: 'polizza', to: 'policy' }])).toEqual([]);
  });

  it('l\'istruzione dice che i termini sono obbligatori', () => {
    const testo = istruzioneGlossario([{ from: 'polizza', to: 'policy', note: 'assicurazioni' }]);
    expect(testo).toMatch(/MANDATORY/);
    expect(testo).toMatch(/"polizza" → "policy"/);
    expect(testo).toMatch(/assicurazioni/);
  });

  it('non manda più di 40 termini, per non gonfiare il prompt', () => {
    salvaGlossario(Array.from({ length: 80 }, (_, i) => ({ from: 't' + i, to: 'x' + i })));
    expect(leggiGlossario().length).toBeLessThanOrEqual(40);
  });
});

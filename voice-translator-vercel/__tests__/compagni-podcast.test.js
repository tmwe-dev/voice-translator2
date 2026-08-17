import { describe, it, expect } from 'vitest';
import { ordineTurni, promptTurno, validaPodcast, PODCAST_LIMITI } from '../app/lib/compagni/podcast.js';

// L'orchestratore del podcast è puro: si prova senza rete né modelli.

const compagni = [
  { id: 'archimede', nome: 'Archimede', personalita: 'Sei un filosofo.' },
  { id: 'alex', nome: 'Alex', personalita: 'Sei un analista.' },
  { id: 'omar', nome: 'Omar', personalita: 'Sei un ricercatore.' },
];

describe('ordineTurni — round-robin', () => {
  it('due round con tre compagni = sei turni, in ordine', () => {
    const t = ordineTurni(compagni, 2);
    expect(t.length).toBe(6);
    expect(t.map(x => x.compagnoId)).toEqual(['archimede', 'alex', 'omar', 'archimede', 'alex', 'omar']);
    expect(t[0].round).toBe(1);
    expect(t[5].round).toBe(2);
    expect(t[5].ordine).toBe(5);
  });

  it('non supera il massimo di compagni', () => {
    const molti = Array.from({ length: 8 }, (_, i) => ({ id: 'c' + i, nome: 'C' + i, personalita: '' }));
    const t = ordineTurni(molti, 1);
    expect(t.length).toBe(PODCAST_LIMITI.MAX_COMPAGNI);
  });

  it('stringe i round fra min e max', () => {
    expect(ordineTurni(compagni, 999).filter(x => x.compagnoId === 'archimede').length).toBe(PODCAST_LIMITI.MAX_ROUND);
    expect(ordineTurni(compagni, 0).length).toBe(compagni.length * PODCAST_LIMITI.MIN_ROUND);
  });
});

describe('promptTurno', () => {
  it('round 1 = posizione iniziale, senza "gli altri"', () => {
    const { system, user } = promptTurno({ compagno: compagni[0], argomento: 'AI e lavoro', round: 1, totaleRound: 3 });
    expect(system).toContain('Sei un filosofo.');
    expect(system).toContain('Archimede');
    expect(user).toContain('AI e lavoro');
    expect(user).toContain('posizione iniziale');
    expect(user).not.toContain('hanno detto finora');
  });

  it('round successivo include cosa hanno detto gli altri', () => {
    const { user } = promptTurno({
      compagno: compagni[1], argomento: 'AI e lavoro', round: 2, totaleRound: 3,
      precedenti: [{ nome: 'Archimede', testo: 'La tecnologia libera tempo.' }],
    });
    expect(user).toContain('round 2');
    expect(user).toContain('hanno detto finora');
    expect(user).toContain('Archimede: La tecnologia libera tempo.');
  });

  it('porta la lingua richiesta nel system', () => {
    const { system } = promptTurno({ compagno: compagni[0], argomento: 'x', lingua: 'en' });
    expect(system).toContain('en');
  });
});

describe('validaPodcast', () => {
  it('serve un argomento', () => {
    expect(validaPodcast({ compagni, argomento: '' }).ok).toBe(false);
    expect(validaPodcast({ compagni, argomento: '   ' }).motivo).toBe('argomento-mancante');
  });
  it('servono almeno due compagni', () => {
    expect(validaPodcast({ compagni: [compagni[0]], argomento: 'x' }).motivo).toBe('pochi-compagni');
  });
  it('ok con due compagni e un argomento', () => {
    expect(validaPodcast({ compagni: compagni.slice(0, 2), argomento: 'x' }).ok).toBe(true);
  });
});

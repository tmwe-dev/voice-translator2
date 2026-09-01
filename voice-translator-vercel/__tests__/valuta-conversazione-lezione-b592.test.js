// ═══════════════════════════════════════════════════════════════
// b.592 — I 5 ASSI ANCHE NEL RUOLO-PLAY DI IMPARA.
//
// Il motore di giudizio (valutaCinqueAssi, /api/compagni/corso azione:
// 'cinqueAssi') e il riquadro del risultato esistevano gia, in
// produzione, dentro Amico (AmicoChat.js) — ma non erano mai stati
// collegati al "Parla con l'Assistente" delle lezioni di lingua, dove
// Luca voleva un modo per "verificare il livello di preparazione".
//
// Qui si prova SOLO il pezzo nuovo e puro: turniDaGiudicare(), che
// trasforma cio che CompagnoLive consegna a onFine (turni grezzi
// {ruolo, testo}, sia dello studente che del Compagno) in cio che
// valutaCinqueAssi si aspetta (solo le battute dello studente, ripulite,
// un tetto di 8). Nessuna rete, nessuno stato — stessa disciplina di
// pronuncia.js: PURO e testabile.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { turniDaGiudicare } from '../app/lib/compagni/corsi/lingua.js';

describe('b.592 — turniDaGiudicare', () => {
  it('tiene solo le battute dello studente, non quelle del Compagno', () => {
    const turni = [
      { ruolo: 'compagno', testo: 'Ciao! Come ti chiami?' },
      { ruolo: 'persona', testo: 'Mi chiamo Luca.' },
      { ruolo: 'compagno', testo: 'Piacere Luca!' },
      { ruolo: 'persona', testo: 'Piacere anche a te.' },
    ];
    expect(turniDaGiudicare(turni)).toEqual(['Mi chiamo Luca.', 'Piacere anche a te.']);
  });

  it('scarta le battute vuote o senza ruolo riconosciuto', () => {
    const turni = [
      { ruolo: 'persona', testo: '  ' },
      { ruolo: 'persona', testo: 'Una frase vera.' },
      { testo: 'senza ruolo, non conta' },
      { ruolo: 'persona', testo: 'Un\'altra frase vera.' },
    ];
    expect(turniDaGiudicare(turni)).toEqual(['Una frase vera.', 'Un\'altra frase vera.']);
  });

  // La stessa cautela della Home ("fa silenzio, aspetta che sia vero"):
  // un campione troppo piccolo non produce un voto — MAI un giudizio
  // su "ciao" e basta.
  it('restituisce null con meno di due battute: niente voto su un campione troppo piccolo', () => {
    expect(turniDaGiudicare([{ ruolo: 'persona', testo: 'Ciao' }])).toBeNull();
    expect(turniDaGiudicare([])).toBeNull();
    expect(turniDaGiudicare(null)).toBeNull();
    expect(turniDaGiudicare(undefined)).toBeNull();
  });

  it('accetta esattamente la soglia minima (due battute vere)', () => {
    const turni = [
      { ruolo: 'persona', testo: 'Prima frase.' },
      { ruolo: 'persona', testo: 'Seconda frase.' },
    ];
    expect(turniDaGiudicare(turni)).toEqual(['Prima frase.', 'Seconda frase.']);
  });

  it('tiene solo le ULTIME 8 battute: una conversazione lunga non gonfia la chiamata', () => {
    const turni = Array.from({ length: 15 }, (_, i) => ({ ruolo: 'persona', testo: `frase ${i}` }));
    const detti = turniDaGiudicare(turni);
    expect(detti).toHaveLength(8);
    expect(detti[0]).toBe('frase 7');
    expect(detti[7]).toBe('frase 14');
  });

  it('la soglia e il tetto sono configurabili (per riuso altrove)', () => {
    const turni = [
      { ruolo: 'persona', testo: 'a' }, { ruolo: 'persona', testo: 'b' }, { ruolo: 'persona', testo: 'c' },
    ];
    expect(turniDaGiudicare(turni, { minimo: 4 })).toBeNull();
    expect(turniDaGiudicare(turni, { massimo: 2 })).toEqual(['b', 'c']);
  });
});

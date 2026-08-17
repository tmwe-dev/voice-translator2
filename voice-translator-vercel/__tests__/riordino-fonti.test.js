import { describe, it, expect } from 'vitest';
import { verticaleDi, dominioNudo, punteggioCard, riordina, VERTICALI } from '../app/lib/topics/riordino.js';

// La Fase 2 della ricerca: riordino per corroborazione + direttorio di
// settore. Puro e deterministico (nowMs passato da fuori).

describe('verticaleDi — indovina la materia dalla domanda', () => {
  it('riconosce la finanza', () => {
    expect(verticaleDi('andamento borsa e mercati oggi')).toBe('finanza');
  });
  it('riconosce la nautica', () => {
    expect(verticaleDi('regata di vela a napoli')).toBe('nautica');
  });
  it('nessun tema noto = null', () => {
    expect(verticaleDi('ricetta della carbonara')).toBe(null);
  });
});

describe('dominioNudo', () => {
  it('toglie www, schema e percorso', () => {
    expect(dominioNudo('https://www.ilsole24ore.com/finanza/x')).toBe('ilsole24ore.com');
  });
  it('gestisce il vuoto', () => {
    expect(dominioNudo('')).toBe('');
    expect(dominioNudo(null)).toBe('');
  });
});

const cardCorroborataDiSettore = {
  titolo: 'Borsa di Milano in rialzo, spread giu',
  tipo: 'notizia',
  pubblicato: 1000,
  fonti: [
    { dominio: 'ilsole24ore.com' },
    { dominio: 'reuters.com' },
    { dominio: 'bloomberg.com' },
    { dominio: 'ansa.it' },
  ],
};
const cardSingolaGenerica = {
  titolo: 'Borsa: parla un analista',
  tipo: 'notizia',
  pubblicato: 2000,
  fonti: [{ dominio: 'blogfinanza.example' }],
};

describe('punteggioCard', () => {
  it('la corroborata di settore batte la singola generica', () => {
    const opts = { paroleQuery: new Set(['borsa', 'milano']), verticale: 'finanza', nowMs: 5000 };
    const a = punteggioCard(cardCorroborataDiSettore, opts);
    const b = punteggioCard(cardSingolaGenerica, opts);
    expect(a.punteggio).toBeGreaterThan(b.punteggio);
  });

  it('e deterministico: stessi input, stesso punteggio', () => {
    const opts = { paroleQuery: new Set(['borsa']), verticale: 'finanza', nowMs: 5000 };
    const p1 = punteggioCard(cardCorroborataDiSettore, opts).punteggio;
    const p2 = punteggioCard(cardCorroborataDiSettore, opts).punteggio;
    expect(p1).toBe(p2);
  });

  it('segnala il perche (corroborata, fonte di settore)', () => {
    const { perche } = punteggioCard(cardCorroborataDiSettore, {
      paroleQuery: new Set(['borsa']), verticale: 'finanza', nowMs: 5000,
    });
    expect(perche).toContain('corroborata');
    expect(perche).toContain('fonte di settore');
  });

  it("l'enciclopedia ha una base di fatto anche con una sola fonte", () => {
    const wiki = { titolo: 'Borsa valori', tipo: 'enciclopedia', pubblicato: null, fonti: [{ dominio: 'wikipedia.org' }] };
    const { punteggio, perche } = punteggioCard(wiki, { paroleQuery: new Set(['borsa']), verticale: 'finanza', nowMs: 5000 });
    expect(punteggio).toBeGreaterThan(0);
    expect(perche).toContain('enciclopedia');
  });
});

describe('riordina', () => {
  it('mette in testa la card piu forte, non la piu recente', () => {
    const dopo = riordina([cardSingolaGenerica, cardCorroborataDiSettore], { query: 'borsa milano', nowMs: 5000 });
    expect(dopo[0].titolo).toBe(cardCorroborataDiSettore.titolo);
  });

  it('attacca punteggio e perche a ogni card', () => {
    const dopo = riordina([cardCorroborataDiSettore, cardSingolaGenerica], { query: 'borsa', nowMs: 5000 });
    expect(typeof dopo[0].punteggio).toBe('number');
    expect(Array.isArray(dopo[0].perche)).toBe(true);
  });

  it('con 0 o 1 card non fa nulla', () => {
    expect(riordina([], { query: 'x' })).toEqual([]);
    const una = [cardSingolaGenerica];
    expect(riordina(una, { query: 'x' })).toBe(una);
  });

  it('non perde nessuna card', () => {
    const dopo = riordina([cardSingolaGenerica, cardCorroborataDiSettore], { query: 'borsa', nowMs: 5000 });
    expect(dopo.length).toBe(2);
  });
});

describe('il direttorio copre le verticali chieste', () => {
  it('nautica e finanza esistono con fonti', () => {
    expect(VERTICALI.nautica.fonti.length).toBeGreaterThan(3);
    expect(VERTICALI.finanza.fonti.length).toBeGreaterThan(3);
  });
});

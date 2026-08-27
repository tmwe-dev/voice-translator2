import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sanaCommento, ordinaCommenti, quantiCommenti, serveStanza,
  MAX_COMMENTO, SOGLIA_STANZA,
} from '../app/lib/commentiContenuto.js';
import { chiaveContenuto } from '../app/lib/gradimento.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.545 — «anche il commento apre una "stanza" di commenti che
// possono susseguirsi... inserirla nell'elenco chat quando uno la
// commenta» (Luca) ═══

describe('b.545 — il testo del commento, ripulito', () => {
  it('un commento vuoto non esiste', () => {
    expect(sanaCommento('')).toBe('');
    expect(sanaCommento(null)).toBe('');
    expect(sanaCommento(undefined)).toBe('');
    expect(sanaCommento(42)).toBe('');
  });

  it('solo spazi non e un commento (e non deve poter aprire una stanza)', () => {
    expect(sanaCommento('   ')).toBe('');
    expect(sanaCommento('\n\n\t  ')).toBe('');
  });

  it('il commento lungo si taglia a cinquecento caratteri', () => {
    const fiume = 'a'.repeat(900);
    const tagliato = sanaCommento(fiume);
    expect(tagliato).toHaveLength(MAX_COMMENTO);
    expect(tagliato).toHaveLength(500);
  });

  it('un commento normale resta com era, senza spazi di troppo ai bordi', () => {
    expect(sanaCommento('  Bella notizia.  ')).toBe('Bella notizia.');
    expect(sanaCommento('due\nrighe')).toBe('due\nrighe');
  });
});

describe('b.545 — i commenti in ordine, dal piu recente', () => {
  it('l ultimo arrivato si legge per primo', () => {
    const messi = ordinaCommenti([
      { id: 'a', testo: 'primo', quando: 100 },
      { id: 'c', testo: 'terzo', quando: 300 },
      { id: 'b', testo: 'secondo', quando: 200 },
    ]);
    expect(messi.map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('quel che e malformato viene scartato, il filo resta in piedi', () => {
    const messi = ordinaCommenti([
      null,
      'non un oggetto',
      { id: 'senza-testo', quando: 500 },
      { id: 'testo-vuoto', testo: '   ', quando: 400 },
      { id: 'buono', testo: 'ci sono', quando: 10 },
      ['array', 'non', 'commento'],
    ]);
    expect(messi).toHaveLength(1);
    expect(messi[0].id).toBe('buono');
    // e una lista che non e una lista non fa cadere niente
    expect(ordinaCommenti(null)).toEqual([]);
    expect(ordinaCommenti('boh')).toEqual([]);
  });

  it('un commento senza data non salta in cima: vale zero, non NaN', () => {
    const messi = ordinaCommenti([
      { id: 'senza', testo: 'x' },
      { id: 'con', testo: 'y', quando: 5 },
    ]);
    expect(messi.map((c) => c.id)).toEqual(['con', 'senza']);
    expect(messi[0].quando).toBe(5);
    expect(messi[1].quando).toBe(0);
  });
});

describe('b.545 — quando il filo diventa stanza', () => {
  it('zero e uno restano un filo, due e cinque sono una stanza', () => {
    expect(serveStanza(0)).toBe(false);
    expect(serveStanza(1)).toBe(false);
    expect(serveStanza(2)).toBe(true);
    expect(serveStanza(5)).toBe(true);
    expect(SOGLIA_STANZA).toBe(2);
  });

  it('la stessa regola vale se le si passa la lista invece del numero', () => {
    const uno = [{ id: 'a', testo: 'solo io', quando: 1 }];
    const due = [...uno, { id: 'b', testo: 'ci sono anch io', quando: 2 }];
    expect(serveStanza([])).toBe(false);
    expect(serveStanza(uno)).toBe(false);
    expect(serveStanza(due)).toBe(true);
    // due righe di cui una malformata NON fanno una stanza
    expect(serveStanza([...uno, { id: 'rotto', quando: 3 }])).toBe(false);
  });

  it('numeri storti non aprono stanze fantasma', () => {
    expect(serveStanza(null)).toBe(false);
    expect(serveStanza(undefined)).toBe(false);
    expect(serveStanza('boh')).toBe(false);
    expect(serveStanza(-7)).toBe(false);
    expect(serveStanza('3')).toBe(true);
  });
});

describe('b.545 — il numero sulla card', () => {
  it('legge il conteggio con la stessa chiave dei cuori', () => {
    const u = 'https://www.ansa.it/x/y/?utm_source=fb&id=3';
    const k = chiaveContenuto(u);
    expect(quantiCommenti({ [k]: 4 }, u)).toBe(4);
    // lo stesso articolo condiviso in due modi ha un filo solo
    expect(quantiCommenti({ [k]: 4 }, 'https://ansa.it/x/y?id=3')).toBe(4);
  });

  it('conteggi mancanti o storti valgono zero, mai NaN', () => {
    const u = 'https://ansa.it/n';
    expect(quantiCommenti(null, u)).toBe(0);
    expect(quantiCommenti(undefined, u)).toBe(0);
    expect(quantiCommenti({}, u)).toBe(0);
    expect(quantiCommenti({ [chiaveContenuto(u)]: 'tre' }, u)).toBe(0);
    expect(quantiCommenti({ [chiaveContenuto(u)]: -2 }, u)).toBe(0);
    expect(quantiCommenti({ x: 9 }, '')).toBe(0);
  });
});

describe('b.545 — le cautele della rotta e la porta della stanza', () => {
  const rotta = leggi('app/api/mondo/commenti/route.js');
  const filo = leggi('app/components/ui/FiloCommenti.js');

  it('la lista non cresce per sempre e le chiavi non restano per sempre', () => {
    expect(rotta).toMatch(/const MAX_LISTA = 200/);
    expect(rotta).toMatch(/const TTL = 90 \* 24 \* 3600/);
    expect(rotta).toMatch(/redis\('LTRIM'/);
    expect(rotta).toMatch(/redis\('EXPIRE', k, TTL\)/);
  });

  it('il testo passa da sanaCommento e un commento vuoto viene respinto', () => {
    expect(rotta).toMatch(/const testo = sanaCommento\(body\?\.testo\)/);
    expect(rotta).toMatch(/commento vuoto/);
    expect(rotta).toMatch(/withApiGuard/);
  });

  it('l invito ad aprire la stanza compare solo quando serveStanza dice di si', () => {
    expect(filo).toMatch(/const stanza = serveStanza\(commenti\)/);
    expect(filo).toMatch(/\{stanza && \(/);
    expect(filo).toMatch(/onApriStanza\?\.\(\)/);
    // il campo per scrivere sta in fondo, non dietro una popup (b.529)
    expect(filo).toMatch(/<textarea/);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  REAZIONI, miaReazione, giraReazione, contaReazioni, reazionePiuUsata,
  chiaveContenuto, mieReazioni, emojiDi,
} from '../app/lib/reazioni.js';
import { chiaveContenuto as chiaveDelCuore } from '../app/lib/gradimento.js';

// ═══ b.545 — «😊 Reazione (tienilo premuto: si apre il ventaglio di
// emoticon come Instagram)» (Luca). Qui si provano i RISULTATI delle
// funzioni vere: metti, cambia, togli, e i numeri che ne escono. ═══

const MEMORIA = 'vt-mie-reazioni';
const U = 'https://ansa.it/notizia-del-giorno';

describe('b.545 — le sei facce', () => {
  beforeEach(() => localStorage.clear());

  it('sono sei, con id diversi e un\'emoji ciascuna', () => {
    expect(REAZIONI).toHaveLength(6);
    const ids = REAZIONI.map((r) => r.id);
    expect(new Set(ids).size, 'nessun id ripetuto').toBe(6);
    for (const r of REAZIONI) {
      expect(typeof r.emoji).toBe('string');
      expect(r.emoji.length, `${r.id} ha un'emoji`).toBeGreaterThan(0);
      expect(emojiDi(r.id)).toBe(r.emoji);
    }
    expect(emojiDi('inventata'), 'una faccia che non esiste non ha emoji').toBeNull();
  });

  it('lo stesso articolo vale la stessa chiave dei cuori', () => {
    // se le due chiavi divergessero, cuori e faccine finirebbero su due
    // contenuti diversi pur essendo lo stesso articolo
    expect(chiaveContenuto('https://www.ansa.it/x/y/?utm_source=fb&id=3'))
      .toBe(chiaveDelCuore('https://ansa.it/x/y?id=3'));
  });
});

describe('b.545 — mettere, cambiare, togliere', () => {
  beforeEach(() => localStorage.clear());

  it('metto: prima non c\'era niente, dopo c\'e la mia faccia', () => {
    expect(miaReazione(U)).toBeNull();
    const esito = giraReazione(U, 'ridere');
    expect(esito.chiave).toBe(chiaveContenuto(U));
    expect(esito.prima).toBeNull();
    expect(esito.dopo).toBe('ridere');
    expect(miaReazione(U), 'e il telefono se lo ricorda').toBe('ridere');
  });

  it('cambio: il server sa cosa scalare e cosa alzare', () => {
    giraReazione(U, 'ridere');
    const esito = giraReazione(U, 'forte');
    expect(esito.prima).toBe('ridere');
    expect(esito.dopo).toBe('forte');
    expect(miaReazione(U)).toBe('forte');
    expect(Object.keys(mieReazioni()), 'una sola voce per contenuto').toHaveLength(1);
  });

  it('ripeto la stessa e la tolgo', () => {
    giraReazione(U, 'stupore');
    const esito = giraReazione(U, 'stupore');
    expect(esito.prima).toBe('stupore');
    expect(esito.dopo).toBeNull();
    expect(miaReazione(U)).toBeNull();
  });

  it('contenuti diversi non si pestano i piedi', () => {
    giraReazione(U, 'cuore');
    giraReazione('https://repubblica.it/altra', 'triste');
    expect(miaReazione(U)).toBe('cuore');
    expect(miaReazione('https://repubblica.it/altra')).toBe('triste');
  });
});

describe('b.545 — i numeri di tutti', () => {
  beforeEach(() => localStorage.clear());

  const k = chiaveContenuto(U);
  const finti = { [k]: { cuore: 4, ridere: 9, triste: 2, inventata: 100, forte: -3 } };

  it('somma solo le facce che esistono, e mai i numeri storti', () => {
    const { perId, totale } = contaReazioni(finti, U);
    expect(perId).toEqual({ cuore: 4, ridere: 9, triste: 2 });
    expect(totale, 'la faccia inventata e il numero negativo non entrano').toBe(15);
  });

  it('la faccia piu votata e quella che va sul tasto chiuso', () => {
    expect(reazionePiuUsata(finti, U)).toBe('ridere');
    // a parita vince chi viene prima nell'elenco: l'ordine non deve
    // ballare ad ogni ricarica del feed
    expect(reazionePiuUsata({ [k]: { forte: 3, ridere: 3 } }, U)).toBe('forte');
    expect(reazionePiuUsata({ [k]: {} }, U), 'nessun voto, nessuna faccia').toBeNull();
  });
});

describe('b.545 — i casi che rompono tutto il resto', () => {
  beforeEach(() => localStorage.clear());

  it('un indirizzo che non c\'e non produce faccine fantasma', () => {
    expect(giraReazione('', 'ridere')).toEqual({ chiave: '', prima: null, dopo: null });
    expect(giraReazione(null, 'ridere').dopo).toBeNull();
    expect(miaReazione('')).toBeNull();
    expect(miaReazione(undefined)).toBeNull();
    expect(contaReazioni({ '': { ridere: 5 } }, '')).toEqual({ perId: {}, totale: 0 });
  });

  it('conteggi assenti o sfasciati: zero, mai NaN e mai un errore', () => {
    for (const brutto of [null, undefined, {}, 'stringa', 42, { [chiaveContenuto(U)]: 'boh' }]) {
      expect(contaReazioni(brutto, U)).toEqual({ perId: {}, totale: 0 });
      expect(reazionePiuUsata(brutto, U)).toBeNull();
    }
  });

  it('una faccia che non e fra le sei non cambia niente', () => {
    giraReazione(U, 'cuore');
    const esito = giraReazione(U, 'esplosione');
    expect(esito.prima).toBe('cuore');
    expect(esito.dopo, 'prima uguale a dopo: il server non scrive nulla').toBe('cuore');
    expect(miaReazione(U), 'e quello che avevo messo resta').toBe('cuore');
  });

  it('memoria illeggibile: si riparte da zero senza schiantarsi', () => {
    localStorage.setItem(MEMORIA, 'questo non e JSON {{{');
    expect(miaReazione(U)).toBeNull();
    expect(mieReazioni()).toEqual({});
    expect(giraReazione(U, 'forte').dopo, 'e da li in poi funziona di nuovo').toBe('forte');
    expect(miaReazione(U)).toBe('forte');
  });

  it('memoria piena di robaccia: si tiene solo cio che ha senso', () => {
    const k = chiaveContenuto(U);
    localStorage.setItem(MEMORIA, JSON.stringify([null, 'ciao', [k, 'ridere'], ['altro', 'inventata'], [123, 'cuore']]));
    expect(miaReazione(U)).toBe('ridere');
    expect(mieReazioni(), 'le righe rotte spariscono').toEqual({ [k]: 'ridere' });
  });
});

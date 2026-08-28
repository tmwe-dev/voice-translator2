// ═══════════════════════════════════════════════════════════════
// b.573 — «MA PERCHE NON PRESENTI NIENTE RANDOM?????»
//
// Ordine di Luca, parola per parola: «se non do preferenze lavora su
// ultime notizie, tendenze, moda, wellness etc, non puoi mantenere solo
// un contesto e non sviluppare alcun ramo includendo le ultime ricerche
// e poi allargando. Devi rendere interessante e dare informazioni e
// curiosita».
//
// Il difetto era grosso e vecchio: senza preferenze il giornale nasceva
// da UNA query sola — «breaking news» del Paese. Con preferenze, restava
// incollato a quelle: una ricerca su Beethoven e il Mondo diventava un
// monumento a Beethoven.
//
// «Random» non si e' tradotto in dadi. Un dado darebbe due volte lo
// stesso ramo e zero volte un altro; una RUOTA garantisce che in pochi
// ingressi hai girato tutto il giardino, non ha bisogno di memoria, e
// si puo provare — cosa che con Math.random sarebbe impossibile.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAMI, ramoParla, ramiDelGiorno, mescolaSemi } from '../app/lib/topics/rami.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.573 — il giardino ha piu di un ramo', () => {
  it('ci sono i rami che Luca ha nominato, non solo le notizie', () => {
    const ids = RAMI.map((r) => r.id);
    for (const atteso of ['ultimora', 'tendenze', 'moda', 'benessere', 'curiosita']) {
      expect(ids).toContain(atteso);
    }
    expect(RAMI.length).toBeGreaterThanOrEqual(12);
  });

  it('ogni ramo parla almeno italiano e inglese', () => {
    for (const r of RAMI) {
      expect(ramoParla(r, 'it')).toBeTruthy();
      expect(ramoParla(r, 'en')).toBeTruthy();
    }
  });

  it('una lingua che non conosciamo cade sull inglese, non nel vuoto', () => {
    expect(ramoParla(RAMI[1], 'sw')).toBe(ramoParla(RAMI[1], 'en'));
  });
});

describe('b.573 — la ruota gira davvero', () => {
  it('due ingressi di fila non danno lo stesso giornale', () => {
    const a = ramiDelGiorno({ lingua: 'it', giro: 1, quanti: 4 }).map((x) => x.id);
    const b = ramiDelGiorno({ lingua: 'it', giro: 2, quanti: 4 }).map((x) => x.id);
    expect(a).not.toEqual(b);
  });

  it('ma l ultima ora c e sempre: un giornale senza oggi non e un giornale', () => {
    for (const giro of [0, 1, 5, 13, 40]) {
      expect(ramiDelGiorno({ lingua: 'it', giro, quanti: 3 })[0].id).toBe('ultimora');
    }
  });

  it('e l ultima ora e quella del posto dove sei, se lo sappiamo', () => {
    const r = ramiDelGiorno({ lingua: 'it', ultimora: 'Thailandia breaking news', giro: 4 });
    expect(r[0].query).toBe('Thailandia breaking news');
  });

  it('in pochi ingressi si e girato tutto il giardino — cosa che un dado non garantisce', () => {
    const visti = new Set();
    for (let giro = 0; giro < 15; giro += 1) {
      for (const r of ramiDelGiorno({ lingua: 'it', giro, quanti: 4 })) visti.add(r.id);
    }
    expect(visti.size).toBeGreaterThanOrEqual(RAMI.length - 1);
  });
});

describe('b.573 — prima tu, poi il mondo', () => {
  const rami = ramiDelGiorno({ lingua: 'it', giro: 3, quanti: 4 });

  it('chi non ha mai cercato niente non resta con una domanda sola in mano', () => {
    const giri = mescolaSemi([], rami, { quanti: 4 });
    expect(giri.length).toBe(4);
    expect(new Set(giri.map((g) => g.query)).size).toBe(4);
  });

  it('chi ha cercato si vede riconosciuto: il suo seme apre il giornale', () => {
    const giri = mescolaSemi([{ query: 'beethoven' }], rami, { quanti: 4 });
    expect(giri[0].query).toBe('beethoven');
  });

  it('ma non si resta rinchiusi: al massimo meta viene da te', () => {
    const miei = [{ query: 'beethoven' }, { query: 'milan' }, { query: 'tesla' }, { query: 'borsa' }];
    const giri = mescolaSemi(miei, rami, { quanti: 4 });
    const dentro = giri.filter((g) => miei.some((m) => m.query === g.query));
    expect(dentro.length).toBeLessThanOrEqual(2);
    expect(giri.length).toBe(4);
  });

  it('niente doppioni: due volte la stessa domanda e una chiamata buttata', () => {
    const giri = mescolaSemi([{ query: 'moda tendenze stile' }], rami, { quanti: 4 });
    expect(new Set(giri.map((g) => g.query.toLowerCase())).size).toBe(giri.length);
  });
});

describe('b.573 — e il Mondo lo usa davvero', () => {
  const news = leggi('app/components/MondoNews.js');

  it('la Gazzetta parte dal mescolo, non piu dai soli semi', () => {
    expect(news).toMatch(/const giri = mescolaSemi\(/);
    expect(news).not.toMatch(/const giri = semiUtente\.length \? semiUtente/);
  });

  it('il contatore del giro nasce PRIMA di chi lo legge (lezione di b.559 e b.568)', () => {
    const dichiara = news.indexOf('let n = 0;');
    const usa = news.indexOf('ramiDelGiorno({ lingua, ultimora, giro: n');
    expect(dichiara).toBeGreaterThan(-1);
    expect(usa).toBeGreaterThan(dichiara);
  });

  it('e l ordine deciso dal mescolo non viene ruotato una seconda volta', () => {
    expect(news).not.toMatch(/giri\[\(n \+ i\) % giri\.length\]/);
  });
});

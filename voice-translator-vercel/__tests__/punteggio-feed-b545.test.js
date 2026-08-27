import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEGNALI, CONTEGGIO, SOGLIA_SALTO_MS, MEZZA_VITA_MS, BASE_NOVITA,
  punteggioContenuto, ordinaPerPunteggio, mescolaConInteresse, sanaSegnale,
  freschezza, eSalto, conteggiDaSegnali, chiaveDi,
} from '../app/lib/punteggioFeed.js';
import { chiaveContenuto } from '../app/lib/gradimento.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.545 — «possiamo misurare il tempo che passano gli utenti a
// vedere un video di un argomento, se commentano, oppure cliccano mi
// piace per determinare piu velocemente cosa proporre nelle sezioni
// mondo quando i materiali selezionati terminano» (Luca) ═══

const ADESSO = 1_800_000_000_000;
const ORA = 3600000;
const GIORNO = 24 * ORA;

describe('b.545 — i pesi dei segnali', () => {
  it('ci sono tutti e cinque, e il salto e l unico negativo', () => {
    expect(Object.keys(SEGNALI).sort()).toEqual(['apertura', 'commento', 'cuore', 'salto', 'visione']);
    expect(SEGNALI.salto.peso).toBeLessThan(0);
    for (const t of ['visione', 'cuore', 'commento', 'apertura']) {
      expect(SEGNALI[t].peso).toBeGreaterThan(0);
    }
  });

  it('un commento costa piu fatica di un cuore, e vale di piu', () => {
    expect(SEGNALI.commento.peso).toBeGreaterThan(SEGNALI.cuore.peso);
    expect(SEGNALI.cuore.peso).toBeGreaterThan(SEGNALI.apertura.peso);
  });

  it('per ogni segnale c e un nome nei conteggi', () => {
    for (const t of Object.keys(SEGNALI)) expect(typeof CONTEGGIO[t]).toBe('string');
  });
});

describe('b.545 — il punteggio di un contenuto', () => {
  it('a parita di eta, piu cuori batte meno cuori', () => {
    const tanti = punteggioContenuto({ cuori: 12, quandoMs: ADESSO }, ADESSO);
    const pochi = punteggioContenuto({ cuori: 2, quandoMs: ADESSO }, ADESSO);
    const nessuno = punteggioContenuto({ cuori: 0, quandoMs: ADESSO }, ADESSO);
    expect(tanti).toBeGreaterThan(pochi);
    expect(pochi).toBeGreaterThan(nessuno);
    expect(nessuno).toBeCloseTo(BASE_NOVITA, 6);
  });

  it('LA PROVA DELLA FRESCHEZZA: una notizia di ieri con 3 cuori non batte una di adesso senza niente', () => {
    const adesso = punteggioContenuto({ quandoMs: ADESSO }, ADESSO);
    const ieri = punteggioContenuto({ cuori: 3, quandoMs: ADESSO - GIORNO }, ADESSO);
    // numeri concreti: 10 appena uscita; ieri vale un quarto (mezza vita
    // 12 ore), e tre cuori saturati non arrivano a nove punti.
    expect(adesso).toBeCloseTo(10, 6);
    expect(ieri).toBeLessThan(5);
    expect(ieri).toBeGreaterThan(4);
    expect(adesso).toBeGreaterThan(ieri);
    expect(freschezza(ADESSO - MEZZA_VITA_MS, ADESSO)).toBeCloseTo(0.5, 6);
    expect(freschezza(ADESSO - GIORNO, ADESSO)).toBeCloseTo(0.25, 6);
  });

  it('la freschezza pesa ma non e un muro: una discussione vera di ieri risale', () => {
    const adesso = punteggioContenuto({ quandoMs: ADESSO }, ADESSO);
    const ieriDiscussa = punteggioContenuto({ commenti: 30, cuori: 20, quandoMs: ADESSO - GIORNO }, ADESSO);
    expect(ieriDiscussa).toBeGreaterThan(adesso);
  });

  it('i salti veloci penalizzano: stessi cuori, chi viene saltato scende', () => {
    const guardato = punteggioContenuto({ cuori: 2, quandoMs: ADESSO }, ADESSO);
    const saltato = punteggioContenuto({ cuori: 2, salti: 10, quandoMs: ADESSO }, ADESSO);
    const saltatissimo = punteggioContenuto({ cuori: 2, salti: 60, quandoMs: ADESSO }, ADESSO);
    expect(saltato).toBeLessThan(guardato);
    expect(saltatissimo).toBeLessThan(saltato);
    // ma non sparisce mai: si ordina, non si filtra.
    expect(saltatissimo).toBeGreaterThan(0);
  });

  it('il salto e cio che succede sotto i due secondi', () => {
    expect(SOGLIA_SALTO_MS).toBe(2000);
    expect(eSalto(400)).toBe(true);
    expect(eSalto(1999)).toBe(true);
    expect(eSalto(2000)).toBe(false);
    expect(eSalto(9000)).toBe(false);
    expect(eSalto('boh')).toBe(false);
  });

  it('il tempo guardato conta: cinque minuti valgono piu di mezzo minuto', () => {
    const lungo = punteggioContenuto({ secondiVisti: 300, quandoMs: ADESSO }, ADESSO);
    const breve = punteggioContenuto({ secondiVisti: 30, quandoMs: ADESSO }, ADESSO);
    expect(lungo).toBeGreaterThan(breve);
    expect(breve).toBeGreaterThan(BASE_NOVITA);
  });

  it('senza data si sta in fondo, non davanti', () => {
    const senzaData = punteggioContenuto({ cuori: 5 }, ADESSO);
    const conData = punteggioContenuto({ cuori: 5, quandoMs: ADESSO }, ADESSO);
    expect(senzaData).toBeLessThan(conData);
    expect(senzaData).toBeGreaterThan(0);
    expect(punteggioContenuto(undefined, ADESSO)).toBeGreaterThan(0);
  });

  it('una data dal futuro non regala niente: vale come adesso', () => {
    const futuro = punteggioContenuto({ quandoMs: ADESSO + 10 * GIORNO }, ADESSO);
    expect(futuro).toBeCloseTo(punteggioContenuto({ quandoMs: ADESSO }, ADESSO), 6);
  });

  it('i numeri si saturano: il cinquantesimo cuore non vale come il primo', () => {
    const p = (n) => punteggioContenuto({ cuori: n, quandoMs: ADESSO }, ADESSO);
    const primo = p(1) - p(0);
    const cinquantesimo = p(50) - p(49);
    expect(primo).toBeGreaterThan(cinquantesimo * 3);
    expect(cinquantesimo).toBeLessThan(1);
    expect(cinquantesimo).toBeGreaterThan(0);   // cresce sempre, non si ferma mai
  });
});

describe('b.545 — l ordine di tutti', () => {
  const conUrl = (u, quandoMs) => ({ url: u, pubblicato: quandoMs });
  const A = conUrl('https://a.it/uno', ADESSO);
  const B = conUrl('https://b.it/due', ADESSO);
  const C = conUrl('https://c.it/tre', ADESSO);
  const conteggi = {
    [chiaveContenuto('https://a.it/uno')]: { cuori: 1 },
    [chiaveContenuto('https://b.it/due')]: { cuori: 9, commenti: 4 },
    [chiaveContenuto('https://c.it/tre')]: { salti: 40 },
  };

  it('davanti chi ha piu segnali, in fondo chi viene saltato', () => {
    const messi = ordinaPerPunteggio([A, C, B], conteggi, ADESSO);
    expect(messi.map((x) => x.url)).toEqual(['https://b.it/due', 'https://a.it/uno', 'https://c.it/tre']);
  });

  it('NON muta l elenco che riceve', () => {
    const dentro = [A, C, B];
    const copia = dentro.slice();
    const fuori = ordinaPerPunteggio(dentro, conteggi, ADESSO);
    expect(dentro).toEqual(copia);
    expect(dentro[0]).toBe(A);
    expect(fuori).not.toBe(dentro);
    expect(fuori).toHaveLength(3);
  });

  it('e stabile: a parita di punteggio non si scambiano di posto', () => {
    const pari = [
      { url: 'https://p.it/1', pubblicato: ADESSO },
      { url: 'https://p.it/2', pubblicato: ADESSO },
      { url: 'https://p.it/3', pubblicato: ADESSO },
      { url: 'https://p.it/4', pubblicato: ADESSO },
    ];
    const uno = ordinaPerPunteggio(pari, {}, ADESSO);
    const due = ordinaPerPunteggio(uno, {}, ADESSO);
    expect(uno.map((x) => x.url)).toEqual(pari.map((x) => x.url));
    expect(due.map((x) => x.url)).toEqual(pari.map((x) => x.url));
  });

  it('nessun contenuto sparisce, nemmeno quello senza indirizzo', () => {
    const strani = [A, { titolo: 'senza indirizzo' }, null, B];
    const fuori = ordinaPerPunteggio(strani, conteggi, ADESSO);
    expect(fuori).toHaveLength(4);
    expect(fuori).toContain(A);
    expect(fuori).toContain(B);
  });

  it('la chiave e quella dei cuori, non una nuova', () => {
    expect(chiaveDi({ url: 'https://a.it/uno?utm_source=x' })).toBe(chiaveContenuto('https://a.it/uno'));
    expect(chiaveDi({ dati: { id: 'abc123' } })).toBe(chiaveContenuto('youtube.com/watch?v=abc123'));
  });
});

describe('b.545 — il mio terzo, mescolato al collettivo', () => {
  const dieci = Array.from({ length: 10 }, (_, i) => ({ url: `https://n.it/${i}`, titolo: `notizia ${i}` }));
  const mio = { url: 'https://m.it/milan', titolo: 'Il Milan vince ancora', seme: 'milan ac' };

  it('non fa sparire niente: escono gli stessi contenuti entrati', () => {
    const dentro = [...dieci, mio];
    const fuori = mescolaConInteresse(dentro, ['milan ac']);
    expect(fuori).toHaveLength(dentro.length);
    for (const x of dentro) expect(fuori).toContain(x);
    expect(fuori).not.toBe(dentro);
    expect(dentro[dentro.length - 1]).toBe(mio);   // l originale intatto
  });

  it('IL MIO SEME NON SPARISCE: ultimo per tutti, resta nella prima meta', () => {
    const dentro = [...dieci, mio];               // il mio e l ultimo di tutti
    const fuori = mescolaConInteresse(dentro, { ricerchePreferite: [{ q: 'milan ac' }] });
    const dove = fuori.indexOf(mio);
    expect(dove).toBeGreaterThanOrEqual(0);
    expect(dove).toBeLessThan(Math.ceil(fuori.length / 2));
  });

  it('ogni mio seme ha un posto, anche quando i semi sono piu di uno', () => {
    const vela = { url: 'https://v.it/regata', titolo: 'La regata di domenica' };
    const dentro = [...dieci, mio, vela];
    const fuori = mescolaConInteresse(dentro, ['milan ac', 'regata']);
    const meta = Math.ceil(fuori.length / 2);
    expect(fuori.indexOf(mio)).toBeLessThan(meta);
    expect(fuori.indexOf(vela)).toBeLessThan(meta);
  });

  it('due terzi restano di tutti: il primo posto non e automaticamente mio', () => {
    const dentro = [...dieci, mio];
    const fuori = mescolaConInteresse(dentro, ['milan ac']);
    expect(fuori[0]).toBe(dieci[0]);              // chi era primo per tutti resta primo
    expect(fuori[0]).not.toBe(mio);
  });

  it('senza semi non si tocca niente', () => {
    const fuori = mescolaConInteresse(dieci, []);
    expect(fuori.map((x) => x.url)).toEqual(dieci.map((x) => x.url));
    expect(mescolaConInteresse(dieci, null).map((x) => x.url)).toEqual(dieci.map((x) => x.url));
  });

  it('un mio seme gia in cima non viene spostato in basso', () => {
    const dentro = [mio, ...dieci];
    const fuori = mescolaConInteresse(dentro, ['milan ac']);
    expect(fuori[0]).toBe(mio);
  });
});

describe('b.545 — un segnale per volta, e credibile', () => {
  it('nessuno puo dichiarare dieci ore di visione', () => {
    expect(sanaSegnale('visione', 36000)).toBeNull();
    expect(sanaSegnale('visione', 3601)).toBeNull();
  });

  it('un po oltre il massimo si taglia, non si butta', () => {
    expect(sanaSegnale('visione', 900)).toEqual({ tipo: 'visione', valore: 600 });
    expect(sanaSegnale('visione', 45)).toEqual({ tipo: 'visione', valore: 45 });
    expect(sanaSegnale('visione', 12.7)).toEqual({ tipo: 'visione', valore: 12 });
  });

  it('per tutto cio che non e tempo il passo e 1', () => {
    expect(sanaSegnale('cuore', 1)).toEqual({ tipo: 'cuore', valore: 1 });
    expect(sanaSegnale('cuore', 3)).toEqual({ tipo: 'cuore', valore: 1 });
    expect(sanaSegnale('commento', 2)).toEqual({ tipo: 'commento', valore: 1 });
    expect(sanaSegnale('apertura', 1)).toEqual({ tipo: 'apertura', valore: 1 });
    expect(sanaSegnale('salto', 1)).toEqual({ tipo: 'salto', valore: 1 });
    expect(sanaSegnale('cuore', 99)).toBeNull();   // non e un errore di misura
  });

  it('valori negativi, nulli e non numerici si scartano', () => {
    for (const v of [0, -1, -600, null, undefined, '', 'tre', NaN, Infinity, {}, []]) {
      expect(sanaSegnale('visione', v)).toBeNull();
    }
    expect(sanaSegnale('visione', 0.4)).toBeNull();   // mezzo secondo non e un secondo
  });

  it('un segnale che non esiste non si accumula', () => {
    expect(sanaSegnale('condivisione', 1)).toBeNull();
    expect(sanaSegnale('', 1)).toBeNull();
    expect(sanaSegnale(null, 1)).toBeNull();
    expect(sanaSegnale('__proto__', 1)).toBeNull();
  });

  it('il tipo si legge senza badare a maiuscole e spazi', () => {
    expect(sanaSegnale(' Visione ', 30)).toEqual({ tipo: 'visione', valore: 30 });
  });
});

describe('b.545 — i conteggi come li tiene Redis', () => {
  it('si legge l hash sia a oggetto sia a lista piatta', () => {
    const atteso = { cuori: 3, commenti: 1, secondiVisti: 120, aperture: 7, salti: 2 };
    expect(conteggiDaSegnali({ cuore: 3, commento: 1, visione: 120, apertura: 7, salto: 2 })).toEqual(atteso);
    expect(conteggiDaSegnali(['cuore', '3', 'commento', '1', 'visione', '120', 'apertura', '7', 'salto', '2'])).toEqual(atteso);
  });

  it('una riga vuota o rotta vale zero, non NaN', () => {
    const zero = { cuori: 0, commenti: 0, secondiVisti: 0, aperture: 0, salti: 0 };
    expect(conteggiDaSegnali(null)).toEqual(zero);
    expect(conteggiDaSegnali('spazzatura')).toEqual(zero);
    expect(conteggiDaSegnali({ inventato: 9, cuore: 'no' })).toEqual(zero);
  });
});

describe('b.545 — la rotta dei segnali', () => {
  const rotta = leggi('app/api/mondo/segnali/route.js');

  it('e protetta da withApiGuard su POST e GET', () => {
    expect(rotta).toMatch(/export const POST = withApiGuard\(/);
    expect(rotta).toMatch(/export const GET = withApiGuard\(/);
  });

  it('accumula su hash con HINCRBY e scade a novanta giorni', () => {
    expect(rotta).toMatch(/HINCRBY/);
    expect(rotta).toMatch(/segnali:\$\{chiave\}/);
    expect(rotta).toMatch(/const TTL = 90 \* 24 \* 3600/);
    expect(rotta).toMatch(/EXPIRE/);
  });

  it('non tocca il gettone di sessione: niente dati personali', () => {
    expect(rotta).not.toMatch(/verifyRoomSession|authorization|token/i);
  });

  it('il tetto sui valori non e riscritto qui: passa da sanaSegnale', () => {
    expect(rotta).toMatch(/sanaSegnale/);
  });
});

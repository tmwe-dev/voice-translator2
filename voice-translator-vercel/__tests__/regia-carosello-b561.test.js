// ═══════════════════════════════════════════════════════════════
// b.561 — LA REGIA DEL CAROSELLO
//
// Ordine di Luca: «se cerco tom cruise mostri tom cruise, ma poi mostri
// anche il resto random, dando priorita ai gusti, la permanenza, le
// interazioni... devi essere curioso, mai monotono, esplorativo».
// E la dottrina, dopo aver guardato come fa Instagram: «cosa possiamo
// integrare per rendere la nostra esperienza migliore».
//
// Loro ottimizzano il tempo sull'app e hanno miliardi di interazioni
// per addestrare i modelli. Noi non abbiamo ne quei dati ne quel
// obiettivo: con dieci utenti una regola scritta bene batte qualunque
// rete neurale, e le regole si possono PROVARE — un modello no.
// Questo file e' la prova che le cinque regole valgono davvero.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  componi, annota, peso, fonteDi, temaDi, eDelMondo,
  PERCHE, PESI, QUOTA_MONDO, SORPRESA_OGNI,
} from '../app/lib/regia.js';

const scheda = (n, extra = {}) => ({
  titolo: `Scheda ${n}`, url: `https://fonte${n}.it/${n}`, seme: `tema${n}`, ...extra,
});
const mondiale = (n, lingua) => scheda(n, { lingua, url: `https://estero${n}.com/${n}` });

describe('prima di tutto: la domanda si rispetta', () => {
  it('cio che hai chiesto viene per primo e nell ordine', () => {
    const fuori = componi([scheda(1), scheda(2), scheda(3)], [scheda(9)], { quantaRichiesta: 3 });
    expect(fuori.slice(0, 3).map((x) => x.titolo)).toEqual(['Scheda 1', 'Scheda 2', 'Scheda 3']);
  });

  it('e sa dire di essere li perche l hai chiesta tu', () => {
    const [prima] = componi([scheda(1)], [], {});
    expect(prima.perche).toBe(PERCHE.cercato);
  });

  it('ma non tutto il mazzo: dopo le prime quattro si allarga', () => {
    const richiesta = Array.from({ length: 10 }, (_, i) => scheda(i));
    const fuori = componi(richiesta, [mondiale(50, 'en')], { miaLingua: 'it' });
    expect(fuori.filter((x) => x.perche === PERCHE.cercato)).toHaveLength(4);
    expect(fuori).toHaveLength(11);
  });
});

describe('regola 1 — la quota di mondo, che e il motivo per cui esistiamo', () => {
  it('almeno una su quattro arriva da un altra lingua', () => {
    const nostre = Array.from({ length: 12 }, (_, i) => scheda(i));
    const altrove = Array.from({ length: 6 }, (_, i) => mondiale(100 + i, ['en', 'fr', 'ja', 'pt', 'de', 'es'][i]));
    const fuori = componi(nostre.slice(0, 4), [...nostre.slice(4), ...altrove], { miaLingua: 'it' });
    const quante = fuori.filter((x) => eDelMondo(x, 'it')).length;
    expect(quante / fuori.length).toBeGreaterThanOrEqual(QUOTA_MONDO * 0.8);
  });

  it('e lo dice: «arriva da un altra lingua»', () => {
    const fuori = componi([scheda(1)], [mondiale(2, 'ja')], { miaLingua: 'it' });
    expect(fuori.find((x) => x.lingua === 'ja').perche).toBe(PERCHE.mondo);
  });

  it('se non c e niente da fuori non si inventa niente', () => {
    const fuori = componi([scheda(1)], [scheda(2), scheda(3)], { miaLingua: 'it' });
    expect(fuori).toHaveLength(3);
    expect(fuori.every((x) => !eDelMondo(x, 'it'))).toBe(true);
  });

  it('la lingua uguale alla mia non e «mondo», anche scritta diversa', () => {
    expect(eDelMondo({ lingua: 'IT' }, 'it')).toBe(false);
    expect(eDelMondo({ lingua: 'it-CH' }, 'it')).toBe(false);
    expect(eDelMondo({ lingua: 'ja' }, 'it')).toBe(true);
  });
});

describe('regola 2 — mai due di fila uguali', () => {
  it('due schede della stessa fonte non si toccano', () => {
    const stessaFonte = (n) => ({ titolo: `T${n}`, url: 'https://ansa.it/' + n, seme: `t${n}` });
    const altre = [stessaFonte(1), stessaFonte(2), scheda(9), stessaFonte(3)];
    const fuori = componi([], altre, { quantaRichiesta: 0 });
    let attaccate = 0;
    for (let i = 1; i < fuori.length; i++) if (fonteDi(fuori[i]) === fonteDi(fuori[i - 1])) attaccate += 1;
    expect(attaccate, 'con una fonte diversa disponibile non devono attaccarsi').toBeLessThanOrEqual(1);
  });

  it('ma se resta solo quella, si mostra lo stesso', () => {
    // meglio due della stessa fonte che un giornale che finisce.
    const stessa = [1, 2, 3].map((n) => ({ titolo: `T${n}`, url: 'https://ansa.it/' + n, seme: 'uguale' }));
    expect(componi([], stessa, { quantaRichiesta: 0 })).toHaveLength(3);
  });
});

describe('regola 3 — la sorpresa ogni sette, che non si spegne mai', () => {
  // il mazzo e' fatto di tre temi molto amati che si possono alternare
  // (se no la regola 2 consumerebbe subito la rarita) piu una cosa
  // lontana dai gusti.
  const amati = (n) => ({ titolo: `amo${n}`, url: `https://a${n}.it/x`, seme: ['rossi', 'verdi', 'blu'][n % 3] });
  const gusti = { rossi: 100, verdi: 90, blu: 80, strano: -30 };

  it('al settimo posto entra la cosa piu LONTANA dai gusti', () => {
    const mazzo = [...Array.from({ length: 9 }, (_, i) => amati(i)), { titolo: 'lontano', url: 'https://z.it/x', seme: 'strano' }];
    const fuori = componi([], mazzo, { gusti, quantaRichiesta: 0 });
    expect(fuori[SORPRESA_OGNI - 1].titolo, 'il settimo posto e della sorpresa').toBe('lontano');
  });

  it('e la sorpresa si dichiara', () => {
    const mazzo = [...Array.from({ length: 9 }, (_, i) => amati(i)), { titolo: 'lontano', url: 'https://z.it/x', seme: 'strano' }];
    const fuori = componi([], mazzo, { gusti, quantaRichiesta: 0 });
    expect(fuori.find((x) => x.titolo === 'lontano').perche).toBe(PERCHE.sorpresa);
  });

  it('l esplorazione non si spegne nemmeno quando il sistema crede di aver capito', () => {
    // e' la riga che evita di vedere Beethoven per sempre solo perche
    // una volta l'hai cercato: e' l'unico punto del file che va CONTRO
    // il gradimento, ed e' apposta.
    const mazzo = [...Array.from({ length: 20 }, (_, i) => amati(i)),
      { titolo: 'l1', url: 'https://z1.it/x', seme: 'strano' },
      { titolo: 'l2', url: 'https://z2.it/x', seme: 'strano' }];
    const fuori = componi([], mazzo, { gusti, quantaRichiesta: 0 });
    const posti = fuori.map((x, i) => (x.perche === PERCHE.sorpresa ? i + 1 : 0)).filter(Boolean);
    expect(posti.length, 'ventidue schede: almeno due sorprese').toBeGreaterThanOrEqual(2);
  });
});

describe('i gusti: contatori, non un modello', () => {
  it('mettere da parte pesa piu di un cuore, e restare pesa piu di niente', () => {
    expect(PESI.bacheca).toBeGreaterThan(PESI.cuore);
    expect(PESI.restato).toBeGreaterThan(0);
  });

  it('il rifiuto pesa piu del gradimento: i rifiuti sono molti di piu', () => {
    expect(Math.abs(PESI.nascosto)).toBeGreaterThan(PESI.bacheca);
    expect(PESI.saltato).toBeLessThan(0);
  });

  it('i gesti si sommano sul tema, e non scappano all infinito', () => {
    let g = {};
    for (let i = 0; i < 100; i++) g = annota(g, 'calcio', 'cuore');
    expect(peso(g, 'calcio')).toBeLessThanOrEqual(120);
    let h = {};
    for (let i = 0; i < 100; i++) h = annota(h, 'calcio', 'nascosto');
    expect(peso(h, 'calcio')).toBeGreaterThanOrEqual(-40);
  });

  it('un gesto che non esiste non cambia niente', () => {
    expect(annota({ a: 3 }, 'a', 'starnuto')).toEqual({ a: 3 });
  });

  it('e il tema di un video e il suo canale, se non c e un seme', () => {
    expect(temaDi({ canale: 'Rai News' })).toBe('rai news');
    expect(temaDi({ seme: 'Terremoto', canale: 'Rai' })).toBe('terremoto');
  });
});

describe('regola 5 — ogni scheda sa dire perche', () => {
  it('nessuna scheda esce senza il suo motivo', () => {
    const fuori = componi([scheda(1)], [scheda(2), mondiale(3, 'en'), scheda(4)], { miaLingua: 'it' });
    expect(fuori.every((x) => !!x.perche)).toBe(true);
  });

  it('e un motivo gia scritto non viene sovrascritto', () => {
    const fuori = componi([], [{ ...scheda(1), perche: PERCHE.ramo }], { quantaRichiesta: 0 });
    expect(fuori[0].perche).toBe(PERCHE.ramo);
  });
});

// ═══════════════════════════════════════════════════════════════
// E la regia collegata davvero: le regole servono a poco se restano
// in un file che nessuno chiama.
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('la regia comanda il carosello vero', () => {
  const news = leggi('app/components/MondoNews.js');
  const feed = leggi('app/components/FeedNotizieMondo.js');

  it('ogni scheda porta il suo seme e la sua lingua: senza, la regia e cieca', () => {
    expect(news).toMatch(/seme: a\.seme \|\| pulita, lingua: a\.lingua \|\| linguaAlt \|\| lingua/);
  });

  it('un giro nuovo lo compone la regia; uno accodato non tocca la testa', () => {
    expect(news).toMatch(/if \(!accoda\) return componi\(puliti, \[\], \{ gusti, miaLingua: lingua \}\)/);
    expect(news, 'chi guarda non deve vedersi spostare niente sotto il dito')
      .toMatch(/return \[\.\.\.testa, \.\.\.componi\(\[\], nuovi, \{ gusti, miaLingua: lingua, quantaRichiesta: 0 \}\)\]/);
  });

  it('il giro del mondo esiste e ruota su lingue diverse dalla mia', () => {
    expect(news).toMatch(/IL GIRO DEL MONDO/);
    expect(news).toMatch(/\['en', 'es', 'fr', 'de', 'pt', 'ja', 'ar'\]\.filter\(\(x\) => x !== mia\)/);
    expect(news, 'e va per ultimo e accodato: prima si risponde a te')
      .toMatch(/await cerca\(domanda, 'notizie', false, true, true, scelta\)/);
  });

  it('la ricerca puo partire in un altra lingua, se no la quota di mondo e vuota', () => {
    expect(news).toMatch(/lingua: linguaAlt \|\| lingua, cat, fresca/);
  });

  it('il «perche» si vede sotto il titolo, su articoli e video', () => {
    expect((feed.match(/<Perche motivo=\{el\.dati\.perche\} L=\{L\} \/>/g) || [])).toHaveLength(2);
    expect(feed).toMatch(/function Perche\(\{ motivo, L \}\)/);
  });

  it('la permanenza si misura davvero: dieci secondi restato, due saltato', () => {
    expect(feed).toMatch(/onGesto\?\.\(el\.dati, 'restato'\), 10000/);
    expect(feed).toMatch(/if \(Date\.now\(\) - entrato < 2000\) onGesto\?\.\(el\.dati, 'saltato'\)/);
  });

  it('i gusti si scrivono sul TEMA e si salvano con calma', () => {
    expect(news).toMatch(/const tema = String\(d\?\.seme \|\| d\?\.canale \|\| ''\)\.toLowerCase\(\)/);
    expect(news, 'le decisioni subito, i passaggi ogni venti secondi')
      .toMatch(/subito \? 0 : 20000/);
  });

  it('e i due gesti forti alimentano il quaderno', () => {
    expect(news).toMatch(/suGesto\(d, 'bacheca'\)/);
    expect(news).toMatch(/suGesto\(d, 'nascosto'\)/);
  });
});

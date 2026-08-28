import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.541 — «le ricerche sono un seme che fa crescere una pianta»
// Il disegno di Luca, provato sui RISULTATI: le regole del giardino
// sono funzioni pure, quindi si interrogano davvero.

describe('b.541 — i semi: le TUE ricerche vengono prima', () => {
  it('preferite, poi recenti, poi predefinite — e niente doppioni', async () => {
    const { semiDi } = await import('../app/lib/giardino.js');
    const prefs = {
      ricerchePreferite: [{ q: 'tom cruise' }],
      ricercheRecenti: [{ q: 'chelsea football' }, { q: 'Tom Cruise' }],  // la stessa, con altre maiuscole
    };
    const semi = semiDi(prefs, [{ query: 'italia breaking news' }]);
    expect(semi.map((s) => s.query)).toEqual(['tom cruise', 'chelsea football', 'italia breaking news']);
    expect(semi.map((s) => s.origine)).toEqual(['preferita', 'recente', 'predefinita']);
    expect(semi[0].peso).toBeGreaterThan(semi[1].peso);
    expect(semi[1].peso).toBeGreaterThan(semi[2].peso);
  });

  it('senza preferenze restano i giri predefiniti: il giardino non e mai vuoto', async () => {
    const { semiDi } = await import('../app/lib/giardino.js');
    expect(semiDi({}, [{ query: 'italia' }]).map((s) => s.query)).toEqual(['italia']);
    expect(semiDi(null, [])).toEqual([]);
  });
});

describe('b.541 — la pianta: cosa si cerca adesso', () => {
  it('prima tutti i semi dell\'utente, per importanza', async () => {
    const { semiDi, prossimaQuery } = await import('../app/lib/giardino.js');
    const semi = semiDi({ ricerchePreferite: [{ q: 'tom cruise' }], ricercheRecenti: [{ q: 'chelsea' }] }, [{ query: 'italia' }]);
    expect(prossimaQuery({ semi }).query).toBe('tom cruise');
    expect(prossimaQuery({ semi, usate: ['tom cruise'] }).query).toBe('chelsea');
    expect(prossimaQuery({ semi, usate: ['tom cruise', 'chelsea'] }).query).toBe('italia');
  });

  it('poi i rami, alternando famiglia e seme: mai sei ricerche di fila sullo stesso', async () => {
    const { prossimaQuery } = await import('../app/lib/giardino.js');
    const semi = [{ query: 'tom cruise', peso: 3 }, { query: 'chelsea', peso: 2 }];
    const rami = [
      { query: 'brad pitt', tipo: 'vicino', seme: 'tom cruise', livello: 1 },
      { query: 'mission impossible', tipo: 'stesso', seme: 'tom cruise', livello: 1 },
      { query: 'cinema hollywood', tipo: 'ambito', seme: 'tom cruise', livello: 1 },
      { query: 'champions league risultati', tipo: 'evento', seme: 'chelsea', livello: 1 },
      { query: 'premier league', tipo: 'ambito', seme: 'chelsea', livello: 1 },
    ];
    const usate = ['tom cruise', 'chelsea'];
    // primo ramo: da tom cruise (seme piu importante), famiglia mai usata
    const primo = prossimaQuery({ semi, rami, usate });
    expect(primo.seme).toBe('tom cruise');
    // dopo averne preso uno da tom cruise, il giardino si sposta
    const dopo = prossimaQuery({ semi, rami, usate: [...usate, primo.query] });
    expect(dopo.query, 'due rami di fila dallo stesso seme e monocultura').not.toBe(primo.query);
    expect(dopo.tipo, 'e nemmeno due volte la stessa famiglia').not.toBe(primo.tipo);
  });

  it('non ripete mai una query gia fatta, e alla fine dice basta', async () => {
    const { prossimaQuery } = await import('../app/lib/giardino.js');
    const semi = [{ query: 'a', peso: 2 }];
    const rami = [{ query: 'b', tipo: 'vicino', seme: 'a', livello: 1 }];
    expect(prossimaQuery({ semi, rami, usate: ['a'] }).query).toBe('b');
    // tutto piantato: null = e il momento di mostrare «semina ancora»
    expect(prossimaQuery({ semi, rami, usate: ['a', 'b'] })).toBeNull();
    expect(prossimaQuery({})).toBeNull();
  });

  it('un ramo che non porta niente di nuovo e esaurito', async () => {
    const { esaurito } = await import('../app/lib/giardino.js');
    expect(esaurito({ trovati: 0, nuovi: 0 }), 'zero risultati').toBe(true);
    expect(esaurito({ trovati: 8, nuovi: 1 }), 'otto risultati ma uno solo nuovo').toBe(true);
    expect(esaurito({ trovati: 8, nuovi: 5 })).toBe(false);
    expect(esaurito()).toBe(true);
  });

  it('i rami che tornano dal giardiniere vengono ripuliti', async () => {
    const { sanaRami } = await import('../app/lib/giardino.js');
    const puliti = sanaRami([
      { query: 'brad pitt', tipo: 'vicino' },
      { query: '  ', tipo: 'stesso' },                     // vuoto: fuori
      { query: 'Brad Pitt', tipo: 'ambito' },              // doppione: fuori
      { query: 'tom cruise', tipo: 'stesso' },             // uguale al seme: girerebbe in tondo
      { query: 'top gun', tipo: 'inventato' },             // famiglia inventata -> vicino
    ], 'Tom Cruise');
    expect(puliti.map((r) => r.query)).toEqual(['brad pitt', 'top gun']);
    expect(puliti[1].tipo).toBe('vicino');
    expect(puliti[0].seme).toBe('Tom Cruise');
    expect(puliti[0].livello).toBe(1);
    expect(sanaRami(null, 'x')).toEqual([]);
    // e non piu di otto per volta
    expect(sanaRami(Array.from({ length: 20 }, (_, i) => ({ query: `q${i}`, tipo: 'vicino' })), 'x')).toHaveLength(8);
  });
});

describe('b.541 — l\'enciclopedia solo dove c\'entra (il bug dei romanzi)', () => {
  it('«ultime notizie» non e un soggetto: niente Wikipedia', async () => {
    const { meritaEnciclopedia, eDiCronaca } = await import('../app/lib/topics/enciclopediaUtile.js');
    // i tre casi VERI visti da Luca: romanzo di Ballard, film del 1935, romanzo di Pennac
    for (const q of ['ultime notizie', 'Ultime Notizie', 'ultime notizie dalla famiglia']) {
      expect(eDiCronaca(q), q).toBe(true);
      expect(meritaEnciclopedia(q), q).toBe(false);
    }
    // e vale in tutte le lingue, non solo in italiano
    for (const q of ['breaking news', 'últimas noticias', 'italia breaking news', '最新ニュース', 'son dakika']) {
      expect(meritaEnciclopedia(q), q).toBe(false);
    }
  });
  it('ma un soggetto vero resta un soggetto', async () => {
    const { meritaEnciclopedia } = await import('../app/lib/topics/enciclopediaUtile.js');
    for (const q of ['tom cruise', 'chelsea football', 'storia di roma', 'intelligenza artificiale']) {
      expect(meritaEnciclopedia(q), q).toBe(true);
    }
  });
  it('e la ricerca ha smesso di chiedere Wikipedia per la cronaca', () => {
    const s = leggi('app/lib/topics/servizio.js');
    expect(s).toMatch(/const wikiSensata = profonda && meritaEnciclopedia\(q\)/);
    expect(s).toMatch(/wikiSensata \? cercaWikipedia/);
  });
});

describe('b.541 — il feed non finisce piu, e parte dai tuoi semi', () => {
  const news = leggi('app/components/MondoNews.js');
  const feed = leggi('app/components/FeedNotizieMondo.js');

  it('cerca() sa ACCODARE invece di sostituire (era questo il bug dei reel)', () => {
    // b.561 — la firma ha un sesto posto, `linguaAlt`: e' la quota di
    // mondo (lo stesso giro chiesto in un'altra lingua). Il patto di
    // b.541 — accoda somma invece di sostituire — resta intatto.
    expect(news).toMatch(/const cerca = useCallback\(async \(q, cat = 'notizie', fresca = false, silenziosa = false, accoda = false, linguaAlt = ''\)/);
    // b.552 — «arrivati» e' diventato «puliti»: cio che arriva passa
    // prima dal setaccio dei contenuti che hai detto di non voler piu
    // vedere (bacheca.js). Il patto di b.541 e' intatto: accoda somma,
    // senza accoda sostituisce.
    // b.561 — fra il mazzo e lo schermo adesso c'e' la REGIA (quota di
    // mondo, mai due di fila uguali, una sorpresa ogni sette). Il patto
    // di b.541 pero e' identico e si vede qui: ACCODA somma alla testa
    // che c'e' gia, senza accoda si sostituisce. Era questo il bug dei
    // reel, e continua a non esserci.
    expect(news).toMatch(/if \(!accoda\) return componi\(puliti, \[\], \{ gusti, miaLingua: lingua \}\)/);
    expect(news).toMatch(/return \[\.\.\.testa, \.\.\.componi\(\[\], nuovi,/);
    expect(news, 'e non ripete cio che hai gia visto').toMatch(/vistiRef\.current\.has\(chiave\)/);
  });

  // b.573 — l'intenzione di b.541 resta («si parte da cio che hai
  // cercato»), la strada e cambiata: i semi tuoi non sono piu TUTTO il
  // giornale, sono la meta che ti riconosce. L'altra meta sono i rami
  // che allargano, ed e' quello che Luca ha chiesto vedendo il Mondo
  // restare incollato a un solo argomento.
  it('all\'apertura si piantano i TUOI semi, e accanto i rami del mondo', () => {
    expect(news).toMatch(/const semiUtente = semiDi\(prefs, \[\]\)/);
    expect(news).toMatch(/const giri = mescolaSemi\(/);
    expect(news).toMatch(/ramiDelGiorno\(\{ lingua, ultimora, giro: n/);
  });

  it('il giardino cresce da solo tre slide prima della fine', () => {
    expect(feed).toMatch(/indiceAttivo >= elementi\.length - 3\) onCresci\(\)/);
    expect(news).toMatch(/const cresci = useCallback/);
    expect(news, 'e quando i rami finiscono se ne chiedono di nuovi').toMatch(/await chiediRami\(\{ seme: senzaFigli\.query/);
  });

  it('e in fondo c\'e la slide per seminare a mano', () => {
    // AGGIORNATA IN b.546. Questa prova era rimasta indietro di due
    // versioni ed era rossa gia prima di toccare il feed: in b.541 la
    // slide finale aveva un titolo (`seedMoreTitle`) e un tasto con la
    // sua parola (`growMoreWord`), ma in b.544 Luca li ha fatti
    // togliere — «mostri sotto l'ultimo contenuto un campo semplice
    // SENZA DESCRIZIONE, e un tasto per avviare una ricerca» — perche'
    // con il feed vuoto quella slide diventava la prima cosa che si
    // vedeva, cioe un compito al posto del giornale. Adesso e nuda:
    // campo e lente, niente parole. Quello che va difeso e che la
    // slide ci sia ancora e che semini davvero.
    expect(feed).toMatch(/\{elementi\.length > 0 && onCerca && \(/);
    expect(feed).toMatch(/const semina = useCallback\(/);
    expect(feed).toMatch(/onCerca\?\.\(q\)/);
    const slide = feed.slice(feed.indexOf('{elementi.length > 0 && onCerca && ('));
    expect(slide, 'nuda: nessuna descrizione da leggere').not.toMatch(/seedMoreTitle|seedMoreDesc|growMoreWord/);
  });

  it('le parole nuove ci sono in tutti e 38 i pacchetti', async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['seedMoreTitle', 'seedMoreDesc', 'growMoreWord', 'growingWord']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});

describe('b.541 — i predefiniti che Luca ha eletto', () => {
  it('titoli tradotti, ricerca approfondita, ritmo 5, aggiorna all\'apertura', () => {
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).toMatch(/chiave: 'mondoTitoli',\n\s*predefinito: 'tradotti'/);
    expect(p).toMatch(/chiave: 'mondoModo',\n\s*predefinito: 'approfondita'/);
    expect(p).toMatch(/chiave: 'mondoRitmo',[\s\S]{0,600}predefinito: '5'/);
    expect(p).toMatch(/chiave: 'mondoAggiorna',\n\s*predefinito: 'apertura'/);
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
  it('e il codice dice lo stesso del pannello (la lezione di b.535)', () => {
    const news = leggi('app/components/MondoNews.js');
    expect(news).toMatch(/prefs\?\.mondoModo \|\| 'approfondita'/);
    expect(news).toMatch(/prefs\?\.mondoAggiorna \|\| 'apertura'/);
    expect(news).toMatch(/useState\(10\); \/\/ b\.541/);
  });
});

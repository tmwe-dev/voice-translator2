// ═══════════════════════════════════════════════════════════════
// b.576 — FASI 2 E 3 DEL DOCUMENTO: NORMALIZZAZIONE E RANKER
//
// FASE 2: articoli, video, discussioni e ultim'ora diventano la stessa
// forma. E' il rimedio strutturale a un guasto vero: in b.568 la regia
// lavorava solo sugli articoli e meta del carosello girava senza
// regole, senza «perche'», senza quota di mondo. Nessuno l'aveva
// deciso — era successo, perche' con due forme e' facile dimenticarne
// una.
//
// FASE 3: un solo Ranker. Dice QUANTO vale un contenuto, non in quale
// ordine mostrarlo (quella e' la Regia, capitolo 20). Le tre promesse
// che questo file verifica una per una:
//   · la domanda scritta comanda sulla personalizzazione (cap. 19);
//   · ogni contenuto esce con almeno un motivo (cap. 24);
//   · qualita e popolarita restano due numeri diversi (cap. 28).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { normalizza, daArgomento, daVideo, daDiscussione, daBreaking, topicsDelGiro } from '../app/lib/mondo/normalize.js';
import { rankMondoCandidates, freschezza, pertinenza, qualita } from '../app/lib/mondo/ranker.js';
import { PESI_RANKING, QUOTE, REGIA } from '../app/lib/mondo/rankingConfig.js';
import { TIPI_MOTIVO, azioniPer, ordinaMotivi, motivo } from '../app/lib/mondo/reasons.js';
import { MEMORY_VUOTA, registraEvento } from '../app/lib/mondo/memory.js';

const ORA = 3600 * 1000;
const oggi = Date.now();

const articolo = (x = {}) => ({
  id: x.id || 'a1', titolo: x.titolo || 'Un titolo abbastanza lungo da contare',
  url: x.url || 'https://ansa.it/uno', sintesi: x.sintesi || '',
  fonti: x.fonti || [{ fonte: 'ANSA', dominio: 'ansa.it' }],
  pubblicato: x.pubblicato ?? oggi - ORA, ...x,
});

describe('b.576 — FASE 2: una forma sola', () => {
  it('articolo, video, discussione e ultim ora escono identici nella forma', () => {
    const out = normalizza({
      argomenti: [articolo()],
      video: [{ id: 'abcdefghijk', titolo: 'Un video', canale: 'Rai', miniatura: 'm.jpg', pubblicato: oggi }],
      discussioni: [{ id: 7, titolo: 'Una discussione', testo: 'testo', creata_il: oggi }],
      breaking: [articolo({ id: 'b1', url: 'https://ansa.it/due' })],
    });
    expect(out.map((c) => c.type)).toEqual(['article', 'video', 'discussion', 'breaking']);
    const chiavi = out.map((c) => Object.keys(c).sort().join(','));
    expect(new Set(chiavi).size, 'quattro forme diverse: e cosi che nasce il guasto di b.568').toBe(1);
  });

  it('la fonte di un video e il canale, non YouTube', () => {
    const v = daVideo({ id: 'abcdefghijk', titolo: 'x', canale: 'Sky Sport', canaleId: 'UC123' });
    expect(v.source).toBe('Sky Sport');
    expect(v.url).toContain('youtube.com/watch?v=abcdefghijk');
  });

  it('i topic vengono dal giro che ha prodotto il contenuto, con la parentela', () => {
    expect(topicsDelGiro('formula1')).toEqual(['formula1', 'motorsport', 'sport']);
    expect(daArgomento(articolo(), { topic: 'formula1' }).topics).toContain('sport');
  });

  it('i topic NON si indovinano dal titolo: un profilo falso non si vede, si subisce', () => {
    const c = daArgomento(articolo({ titolo: 'Grande moda a Milano, sfilate e cucina' }), {});
    expect(c.topics).toEqual([]);
  });

  it('niente da normalizzare non produce candidati fantasma', () => {
    expect(normalizza({})).toEqual([]);
    expect(daVideo({})).toBe(null);
    expect(daDiscussione(null)).toBe(null);
    expect(daBreaking(null)).toBe(null);
  });
});

describe('b.576 — FASE 3: i pesi stanno in un posto solo', () => {
  it('i pesi sono quelli del capitolo 17 e sommano a uno', () => {
    expect(PESI_RANKING.intent).toBe(0.35);
    expect(PESI_RANKING.freshness).toBe(0.20);
    const somma = Object.values(PESI_RANKING).reduce((a, b) => a + b, 0);
    expect(somma).toBeCloseTo(1, 6);
  });

  it('le quote contro la bolla sommano a uno (capitolo 23)', () => {
    expect(Object.values(QUOTE).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(REGIA.maxStessoTopicDiFila).toBe(2);
  });
});

describe('b.576 — la freschezza invecchia col passo del tipo', () => {
  it('l ultim ora invecchia in fretta, un video con calma', () => {
    const br = freschezza({ type: 'breaking', publishedAt: oggi - 3 * ORA }, oggi);
    const vi = freschezza({ type: 'video', publishedAt: oggi - 3 * ORA }, oggi);
    expect(br).toBeCloseTo(0.5, 2);
    expect(vi).toBeGreaterThan(br);
  });

  it('chi non dice quando e nato non e ne fresco ne vecchio', () => {
    expect(freschezza({ type: 'article' }, oggi)).toBe(0.35);
  });
});

describe('b.576 — qualita non e popolarita (capitolo 28)', () => {
  it('quattro testate che raccontano la stessa cosa valgono piu di una', () => {
    const una = qualita({ sources: [{}], summary: 'x'.repeat(100), publishedAt: oggi, sourceId: 'a.it' });
    const quattro = qualita({ sources: [{}, {}, {}, {}], summary: 'x'.repeat(100), publishedAt: oggi, sourceId: 'a.it' });
    expect(quattro).toBeGreaterThan(una);
  });

  it('un contenuto molto cliccato non diventa automaticamente di qualita', () => {
    expect(qualita({ collectiveScore: 9999 })).toBeLessThan(0.3);
  });
});

describe('b.576 — capitolo 19: la domanda scritta comanda', () => {
  const cand = normalizza({
    argomenti: [
      articolo({ id: 'tc', titolo: 'Tom Cruise torna al cinema con un nuovo film', url: 'https://a.it/tc' }),
      articolo({ id: 'f1', titolo: 'Gara di Formula 1 a Monza, tutti i tempi', url: 'https://b.it/f1' }),
    ],
  }, { topic: 'formula1' });

  it('chi cerca Tom Cruise trova Tom Cruise, anche se ama la Formula 1', () => {
    let mem = registraEvento(MEMORY_VUOTA, 'SAVE', { topics: ['formula1'], at: oggi });
    mem = registraEvento(mem, 'SAVE', { topics: ['formula1'], at: oggi });
    const out = rankMondoCandidates({
      candidates: cand,
      profile: { interests: ['formula1'], followedTopics: ['formula1'] },
      memory: mem,
      session: { currentQuery: 'Tom Cruise' },
      now: oggi,
    });
    expect(out[0].content.id).toBe('tc');
    expect(out[0].reasons[0].type).toBe('explicit_query');
  });

  it('e la personalizzazione non riesce a scavalcarla nemmeno con affinita altissima', () => {
    let mem = MEMORY_VUOTA;
    for (let i = 0; i < 12; i += 1) mem = registraEvento(mem, 'SAVE', { topics: ['formula1'], at: oggi });
    const out = rankMondoCandidates({
      candidates: cand,
      profile: { interests: ['formula1'], followedTopics: ['formula1'] },
      memory: mem,
      session: { currentQuery: 'Tom Cruise' },
      now: oggi,
    });
    expect(out[0].content.id).toBe('tc');
  });
});

describe('b.576 — capitolo 24: ogni contenuto sa dire perche lo vedi', () => {
  it('nessun contenuto esce senza motivo', () => {
    const out = rankMondoCandidates({ candidates: normalizza({ argomenti: [articolo()] }), now: oggi });
    expect(out[0].reasons.length).toBeGreaterThan(0);
    for (const m of out[0].reasons) expect(TIPI_MOTIVO).toContain(m.type);
  });

  it('chi segue un argomento se lo sente dire', () => {
    const out = rankMondoCandidates({
      candidates: normalizza({ argomenti: [articolo()] }, { topic: 'formula1' }),
      profile: { followedTopics: ['formula1'] },
      now: oggi,
    });
    expect(out[0].reasons.map((m) => m.type)).toContain('followed_topic');
  });

  it('cio che sta fuori dai tuoi interessi si presenta come scoperta', () => {
    const out = rankMondoCandidates({
      candidates: normalizza({ argomenti: [articolo()] }, { topic: 'food' }),
      profile: { interests: ['formula1'] },
      now: oggi,
    });
    expect(out[0].reasons.map((m) => m.type)).toContain('discovery');
  });

  it('e da ogni motivo si puo agire (capitolo 25)', () => {
    expect(azioniPer(motivo('followed_topic', 'formula1')).map((a) => a.action)).toContain('unfollow_topic');
    expect(azioniPer(motivo('followed_source', 'ansa.it')).map((a) => a.action)).toContain('block_source');
  });

  it('il motivo piu forte va per primo: e quello che la scheda mostra', () => {
    const m = ordinaMotivi([motivo('fresh'), motivo('explicit_query', 'x'), motivo('discovery', 'food')]);
    expect(m[0].type).toBe('explicit_query');
  });

  it('un motivo inventato non entra', () => {
    expect(motivo('perche_si', 'x')).toBe(null);
  });
});

describe('b.576 — capitolo 18: prima si toglie, poi si ordina', () => {
  it('il nascosto sparisce davvero, la fonte bloccata pure', () => {
    const cand = normalizza({ argomenti: [articolo({ id: 'x', url: 'https://uno.it/x' }), articolo({ id: 'y', url: 'https://due.it/y', fonti: [{ fonte: 'D', dominio: 'due.it' }] })] });
    expect(rankMondoCandidates({ candidates: cand, session: { hidden: ['https://uno.it/x'] }, now: oggi })).toHaveLength(1);
    expect(rankMondoCandidates({ candidates: cand, profile: { blockedSources: ['due.it'] }, now: oggi })).toHaveLength(1);
  });

  it('e chi ha spento la personalizzazione non viene profilato lo stesso', () => {
    let mem = registraEvento(MEMORY_VUOTA, 'SAVE', { topics: ['formula1'], at: oggi });
    const out = rankMondoCandidates({
      candidates: normalizza({ argomenti: [articolo()] }, { topic: 'formula1' }),
      profile: { interests: ['formula1'] },
      memory: mem,
      settings: { personalization: false },
      now: oggi,
    });
    expect(out[0].reasons.map((m) => m.type)).not.toContain('declared_interest');
    expect(out[0].reasons.map((m) => m.type)).not.toContain('learned_affinity');
  });
});

// ═══════════════════════════════════════════════════════════════
// b.576 — FASE 4: LA REGIA, SEPARATA DAL RANKER
//
// Il Ranker dice quanto vale un pezzo; la Regia in che ordine
// mostrarlo. Perche' separati, con l'esempio che lo rende ovvio: i
// dieci pezzi piu rilevanti di una giornata di Formula 1 sono dieci
// pezzi di Formula 1, magari otto dalla stessa testata. Ognuno merita
// il suo punteggio — e insieme, in fila, sono un giornale illeggibile.
// La rilevanza non sa niente della noia; la sequenza si.
//
// E c'e' una lezione dentro questo file che vale piu delle regole: la
// prima versione, quando nessun candidato andava bene, cedeva TUTTE le
// regole insieme e tornava all'ordine di classifica. Con dieci pezzi
// dello stesso argomento usciva una fila di quattro video della stessa
// fonte — il caso peggiore, proprio dove la regia serviva di piu.
// Le regole non hanno lo stesso valore: due pezzi di fila sullo stesso
// ARGOMENTO, in una giornata che parla solo di quello, sono la realta;
// due di fila della stessa FONTE sono pigrizia nostra. Si cede in
// ordine.
// ═══════════════════════════════════════════════════════════════
import { mondoDirector, comeEVenuta, stonaQui } from '../app/lib/mondo/director.js';

describe('b.576 — FASE 4: la regia', () => {
  const oggi2 = Date.now();
  const molti = (n, f) => Array.from({ length: n }, (_, i) => f(i));

  it('mai tre di fila della stessa fonte, quando c e un alternativa', () => {
    const cand = normalizza({
      argomenti: molti(6, (i) => articolo({ id: `a${i}`, url: `https://ansa.it/${i}`, titolo: `Notizia numero ${i} di oggi` })),
      video: molti(4, (i) => ({ id: `vvvvvvvvvv${i}`, titolo: `Video ${i}`, canale: 'Sky', pubblicato: oggi2 })),
    }, { topic: 'formula1' });
    const seq = mondoDirector(rankMondoCandidates({ candidates: cand, now: oggi2 }), { quanti: 8 });
    let piuLunga = 1; let corrente = 1;
    for (let i = 1; i < seq.length; i += 1) {
      const stessa = (seq[i].content.sourceId || '') === (seq[i - 1].content.sourceId || '');
      corrente = stessa ? corrente + 1 : 1;
      piuLunga = Math.max(piuLunga, corrente);
    }
    expect(piuLunga, 'una fila di quattro della stessa fonte e il caso che la regia deve impedire').toBeLessThanOrEqual(3);
  });

  it('un formato non prende tutto se esiste un alternativa (capitolo 33)', () => {
    const cand = normalizza({
      argomenti: molti(10, (i) => articolo({ id: `a${i}`, url: `https://s${i}.it/x`, titolo: `Titolo lungo abbastanza ${i}`, fonti: [{ fonte: `S${i}`, dominio: `s${i}.it` }] })),
      video: molti(3, (i) => ({ id: `wwwwwwwwww${i}`, titolo: `Video ${i}`, canale: `Canale${i}`, pubblicato: oggi2 })),
    });
    const m = comeEVenuta(mondoDirector(rankMondoCandidates({ candidates: cand, now: oggi2 }), { quanti: 12 }));
    expect(m.quotaFormatoDominante).toBeLessThanOrEqual(0.8);
  });

  it('un buco resta peggio di una ripetizione: la sequenza non si accorcia', () => {
    // tutto uguale: stesso topic, stessa fonte, stesso formato
    const cand = normalizza({
      argomenti: molti(5, (i) => articolo({ id: `a${i}`, url: `https://ansa.it/${i}`, titolo: `Stessa cosa numero ${i}` })),
    }, { topic: 'formula1' });
    const seq = mondoDirector(rankMondoCandidates({ candidates: cand, now: oggi2 }), { quanti: 5 });
    expect(seq).toHaveLength(5);
  });

  it('la regia non inventa e non perde niente: gli stessi pezzi, in altro ordine', () => {
    const cand = normalizza({ argomenti: molti(6, (i) => articolo({ id: `a${i}`, url: `https://s${i}.it/x` })) });
    const cl = rankMondoCandidates({ candidates: cand, now: oggi2 });
    const seq = mondoDirector(cl, { quanti: 6 });
    expect(new Set(seq.map((x) => x.content.id))).toEqual(new Set(cl.map((x) => x.content.id)));
  });

  it('e sa dire com e venuta, coi numeri: un obiettivo che nessuno misura e un auspicio', () => {
    const cand = normalizza({ argomenti: [articolo({ lingua: 'en' }), articolo({ id: 'a2', url: 'https://b.it/2', lingua: 'it' })] });
    const m = comeEVenuta(mondoDirector(rankMondoCandidates({ candidates: cand, now: oggi2 })), { miaLingua: 'it' });
    expect(m.quotaInternazionale).toBeCloseTo(0.5, 2);
    expect(m.quanti).toBe(2);
  });

  it('stonaQui guarda solo la coda, non tutta la sequenza', () => {
    const x = { content: { topics: ['sport'], sourceId: 'a.it' } };
    const due = [{ content: { topics: ['sport'], sourceId: 'b.it' } }, { content: { topics: ['sport'], sourceId: 'c.it' } }];
    expect(stonaQui(x, due)).toBe(true);
    expect(stonaQui(x, [{ content: { topics: ['food'], sourceId: 'b.it' } }, ...due.slice(0, 1)])).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.575 — FASE 1 DEL DOCUMENTO: I MODELLI
//
// Luca ha scritto il modello di come Mondo deve essere fatto dentro, e
// arriva al momento giusto: quasi tutti i guasti di oggi nascono dallo
// stesso posto. `prefs` e' diventato un sacco dove stanno insieme le
// impostazioni, gli interessi, la memoria di cosa hai fatto e lo stato
// della schermata — e ogni volta che tiro un filo si strappa
// dall'altra parte.
//
// FASE 1 dice: creare i modelli, migrare i dati vecchi, NON toccare
// l'interfaccia. Questo file prova esattamente quello, e in piu le due
// regole che rendono il modello diverso da un riordino di cartelle:
//   · il decadimento (cap. 9): le nostre osservazioni invecchiano,
//     le tue parole no;
//   · gli ID canonici (cap. 4): un identificatore non si traduce.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TASSONOMIA, TOPIC_IDS, catena, discende, canonico, figliDi } from '../app/lib/mondo/taxonomy.js';
import { DOMANDE, domandaPer, domandePer } from '../app/lib/mondo/queries.js';
import { SETTINGS_DEFAULT, normalizzaSettings, settingsDaPrefs, NON_PIU_PREFERENZE } from '../app/lib/mondo/settings.js';
import { PROFILE_VUOTO, normalizzaProfile, profileDaPrefs, seguiTopic, bloccaFonte, topicDichiarati } from '../app/lib/mondo/profile.js';
import { PESI, pesoDi, evento } from '../app/lib/mondo/events.js';
import { MEMORY_VUOTA, registraEvento, affinitaTopic, fattoreDecadimento, memoryDaPrefs, topicPiuForti } from '../app/lib/mondo/memory.js';
import { SESSION_INIZIALE, normalizzaSession, filtroDaVecchio } from '../app/lib/mondo/session.js';
import { candidato, candidati, ammessi, dominioDi } from '../app/lib/mondo/models.js';

const GIORNO = 24 * 3600 * 1000;

describe('b.575 — la tassonomia: nomi propri, non parole', () => {
  it('ogni topic ha un padre valido o e una radice', () => {
    for (const [id, padre] of Object.entries(TASSONOMIA)) {
      if (padre === null) continue;
      expect(TOPIC_IDS, `${id} ha un padre che non esiste`).toContain(padre);
    }
  });

  it('nessun ciclo: ogni catena finisce', () => {
    for (const id of TOPIC_IDS) {
      const c = catena(id);
      expect(c.length).toBeLessThanOrEqual(5);
      expect(new Set(c).size).toBe(c.length);
    }
  });

  it('la parentela e cio che un elenco piatto non puo dare', () => {
    expect(catena('formula1')).toEqual(['formula1', 'motorsport', 'sport']);
    expect(discende('formula1', 'sport')).toBe(true);
    expect(discende('formula1', 'economy')).toBe(false);
    expect(figliDi('motorsport')).toContain('motogp');
  });

  it('chi aveva scelto «economia» ritrova «economy» e non se ne accorge', () => {
    expect(canonico('economia')).toBe('economy');
    expect(canonico('tecnologia')).toBe('technology');
    expect(canonico('soldi')).toBe('economy');       // anche i rami di b.573
    expect(canonico('curiosita')).toBe('curiosities');
  });

  it('un nome che non conosciamo non diventa un interesse inventato', () => {
    expect(canonico('pizza margherita')).toBe('');
  });
});

describe('b.575 — le query non sono le etichette', () => {
  it('ogni topic sa come si chiede, almeno in inglese', () => {
    for (const id of TOPIC_IDS) {
      expect(domandaPer(id, 'en'), `${id} non ha una domanda inglese`).toBeTruthy();
    }
  });

  it('e in italiano, che e la lingua di casa', () => {
    for (const id of TOPIC_IDS) expect(DOMANDE[id]?.it, `${id} senza italiano`).toBeTruthy();
  });

  it('una lingua che non parliamo cade sull inglese, non nel vuoto', () => {
    expect(domandaPer('formula1', 'sw')).toBe(domandaPer('formula1', 'en'));
  });

  it('un topic inventato non produce una domanda', () => {
    expect(domandaPer('pizza', 'it')).toBe('');
    expect(domandePer(['formula1', 'pizza'], 'it')).toHaveLength(1);
  });
});

describe('b.575 — settings: solo cio che una persona puo davvero volere', () => {
  it('un valore inventato non entra: si torna al default', () => {
    expect(normalizzaSettings({ contentMix: 'qualcosa' }).contentMix).toBe('balanced');
    expect(normalizzaSettings({ breaking: 'ogni 2 minuti' }).breaking).toBe('important');
  });

  it('le impostazioni sono sempre complete', () => {
    expect(Object.keys(normalizzaSettings({})).sort()).toEqual(Object.keys(SETTINGS_DEFAULT).sort());
  });

  it('il vecchio filtro video diventa un mix, non una condanna', () => {
    expect(settingsDaPrefs({ mondoFeedFiltro: 'video' }).contentMix).toBe('moreVideo');
    expect(settingsDaPrefs({ mondoFeedFiltro: 'articoli' }).contentMix).toBe('moreArticles');
  });

  it('e le finte preferenze tecniche sono elencate per essere tolte', () => {
    for (const k of ['mondoModo', 'mondoAggiorna']) expect(NON_PIU_PREFERENZE).toContain(k);
  });
});

describe('b.575 — profile: cio che hai detto tu', () => {
  it('gli interessi diventano ID canonici, i nomi ignoti si perdono', () => {
    const p = profileDaPrefs({ interessi: ['economia', 'motori', 'pizza'] });
    expect(p.interests).toEqual(['economy', 'motors']);
  });

  it('le ricerche con la stella diventano topic seguiti quando sono topic', () => {
    const p = profileDaPrefs({ ricerchePreferite: [{ q: 'sport' }, { q: 'zuppa di ceci' }] });
    expect(p.followedTopics).toEqual(['sport']);
  });

  it('bloccare una fonte la toglie anche da quelle seguite', () => {
    const p = bloccaFonte({ ...PROFILE_VUOTO, followedSources: ['ansa.it'] }, 'ANSA.it');
    expect(p.blockedSources).toContain('ansa.it');
    expect(p.followedSources).not.toContain('ansa.it');
  });

  it('seguire due volte lo stesso topic non lo raddoppia', () => {
    const p = seguiTopic(seguiTopic(PROFILE_VUOTO, 'formula1'), 'formula1');
    expect(p.followedTopics).toEqual(['formula1']);
  });

  it('i topic dichiarati sono seguiti piu interessi, senza doppioni', () => {
    const p = normalizzaProfile({ interests: ['sport'], followedTopics: ['sport', 'economy'] });
    expect(topicDichiarati(p)).toEqual(['sport', 'economy']);
  });
});

describe('b.575 — memory: cio che abbiamo notato, e che invecchia', () => {
  it('i pesi sono quelli del documento, in un posto solo', () => {
    expect(PESI.SAVE).toBe(8);
    expect(PESI.HIDE).toBe(-10);
    expect(pesoDi('like')).toBe(4);
    expect(pesoDi('inventato')).toBe(0);
  });

  it('«hai guardato F1 a maggio, a dicembre non sei un fanatico»', () => {
    expect(fattoreDecadimento(Date.now() - 90 * GIORNO)).toBeCloseTo(0.5, 2);
    expect(fattoreDecadimento(Date.now() - 180 * GIORNO)).toBeCloseTo(0.25, 2);
  });

  it('un segnale vecchio pesa meno di uno nuovo, a parita di gesto', () => {
    const oggi = Date.now();
    const vecchia = registraEvento(MEMORY_VUOTA, 'LIKE', { topics: ['formula1'], at: oggi - 180 * GIORNO });
    const fresca = registraEvento(MEMORY_VUOTA, 'LIKE', { topics: ['formula1'], at: oggi });
    expect(affinitaTopic(vecchia, 'formula1', oggi)).toBeLessThan(affinitaTopic(fresca, 'formula1', oggi));
  });

  it('sommare un gesto nuovo non ringiovanisce quelli vecchi', () => {
    const oggi = Date.now();
    let m = registraEvento(MEMORY_VUOTA, 'SAVE', { topics: ['formula1'], at: oggi - 180 * GIORNO });  // 8 → 2
    m = registraEvento(m, 'VIEW', { topics: ['formula1'], at: oggi });                                 // +1
    expect(affinitaTopic(m, 'formula1', oggi)).toBeCloseTo(3, 1);
  });

  it('nascondere pesa piu di qualunque cosa buona', () => {
    const oggi = Date.now();
    let m = registraEvento(MEMORY_VUOTA, 'LIKE', { topics: ['football'], at: oggi });
    m = registraEvento(m, 'HIDE', { topics: ['football'], at: oggi });
    expect(affinitaTopic(m, 'football', oggi)).toBeLessThan(0);
  });

  it('un evento inventato non sporca la memoria', () => {
    expect(evento('QUALCOSA', {})).toBe(null);
    expect(registraEvento(MEMORY_VUOTA, 'QUALCOSA', { topics: ['sport'] }).topicAffinity).toEqual({});
  });

  it('i vecchi «argomentiVisti» e «gusti» si sommano senza perdersi', () => {
    const m = memoryDaPrefs({ argomentiVisti: { sport: 3 }, gusti: { sport: 2, economy: 1 } });
    expect(m.topicAffinity.sport.peso).toBe(5);
    expect(m.topicAffinity.economy.peso).toBe(1);
  });

  it('e i piu forti si leggono gia decaduti', () => {
    const oggi = Date.now();
    let m = registraEvento(MEMORY_VUOTA, 'SAVE', { topics: ['football'], at: oggi - 360 * GIORNO });
    m = registraEvento(m, 'LIKE', { topics: ['space'], at: oggi });
    expect(topicPiuForti(m, { adesso: oggi })[0].topic).toBe('space');
  });
});

describe('b.575 — session: cio che muore quando chiudi', () => {
  it('il filtro contenuti e di sessione, e i nomi vecchi si traducono', () => {
    expect(filtroDaVecchio('video')).toBe('video');
    expect(filtroDaVecchio('articoli')).toBe('articles');
    expect(filtroDaVecchio('entrambi')).toBe('all');
  });

  it('un modo inventato non passa', () => {
    expect(normalizzaSession({ mode: 'magico' }).mode).toBe(SESSION_INIZIALE.mode);
  });

  it('il Paese guardato sulla mappa e due lettere, non un romanzo', () => {
    expect(normalizzaSession({ selectedCountry: 'italia' }).selectedCountry).toBe('IT');
  });
});

describe('b.575 — un solo modello di contenuto', () => {
  it('tutti i campi esistono sempre, anche vuoti (lezione di b.570 e b.572)', () => {
    const c = candidato({});
    for (const campo of ['topics', 'entities', 'sources']) expect(Array.isArray(c[campo])).toBe(true);
    for (const campo of ['title', 'summary', 'url', 'source', 'sourceId']) expect(typeof c[campo]).toBe('string');
  });

  it('un articolo vecchio e un video vecchio diventano la stessa forma', () => {
    const art = candidato({ titolo: 'A', url: 'https://ansa.it/x', fonti: [{ fonte: 'ANSA', dominio: 'ansa.it' }] });
    const vid = candidato({ titolo: 'B', id: 'abc', canale: 'Rai', type: 'video' });
    expect(art.type).toBe('article');
    expect(vid.type).toBe('video');
    expect(Object.keys(art).sort()).toEqual(Object.keys(vid).sort());
  });

  it('il dominio si ricava dall indirizzo, senza www', () => {
    expect(dominioDi('https://www.Corriere.it/sezione/x')).toBe('corriere.it');
  });

  it('gli argomenti diventano canonici anche qui', () => {
    expect(candidato({ argomenti: ['economia', 'pizza'] }).topics).toEqual(['economy']);
  });

  it('prima del ranking si toglie: doppioni, nascosti, fonti bloccate', () => {
    const a = { titolo: 'A', url: 'https://uno.it/x' };
    const b = { titolo: 'B', url: 'https://due.it/y' };
    expect(ammessi([a, a, b])).toHaveLength(2);
    expect(ammessi([a, b], { hidden: ['https://uno.it/x'] })).toHaveLength(1);
    expect(ammessi([a, b], { blockedSources: ['due.it'] })).toHaveLength(1);
  });

  it('e cio che non ha ne titolo ne indirizzo non e un contenuto', () => {
    expect(candidati([{ }, { titolo: 'C', url: 'https://tre.it' }])).toHaveLength(1);
  });
});

// ═══ b.577 — LA REGOLA CAMBIA CON LA FASE, E VA RISCRITTA ═══
// In FASE 1 la regola era «nessun componente tocca i modelli nuovi».
// La FASE 5 li collega: quella prova ha finito il suo lavoro e
// lasciarla in piedi vorrebbe dire mentire su cosa stiamo facendo.
// Al suo posto la regola che vale ADESSO, ed e' piu importante di
// quella di prima: si entra da UNA PORTA SOLA. Se ogni componente
// potesse pescare dentro `lib/mondo/` a piacere, fra un mese avremmo
// di nuovo dieci strade per la stessa decisione — cioe' esattamente il
// sacco da cui stiamo uscendo.
describe('b.577 — FASE 5: si entra da una porta sola', () => {
  it('i componenti conoscono il ponte, e nient altro del motore', () => {
    const dir = join(process.cwd(), 'app/components');
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      const s = readFileSync(join(dir, f), 'utf8');
      const dentro = [...s.matchAll(/from '[^']*lib\/mondo\/([a-zA-Z]+)\.js'/g)].map((m) => m[1]);
      for (const modulo of dentro) {
        expect(['ponte', 'rankingConfig'], `${f} entra dal modulo «${modulo}»: si passa dal ponte`)
          .toContain(modulo);
      }
    }
  });

  it('il motore resta puro; solo il ponte conosce le due rive', () => {
    const base = join(process.cwd(), 'app/lib/mondo');
    for (const f of readdirSync(base)) {
      const s = readFileSync(join(base, f), 'utf8');
      const imports = [...s.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
      for (const i of imports) {
        if (f === 'ponte.js') {
          expect(i, 'nemmeno il ponte esce dalle librerie pure').toMatch(/^\.\.?\//);
          continue;
        }
        expect(i, `${f} importa qualcosa fuori da lib/mondo`).toMatch(/^\.\//);
      }
    }
  });
});

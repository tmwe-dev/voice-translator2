import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TASSONOMIA, TOPIC_IDS, catena, discende, canonico } from '../app/lib/mondo/taxonomy.js';
import { domandaPer } from '../app/lib/mondo/queries.js';
import { SETTINGS_DEFAULT, normalizzaSettings, settingsDaPrefs, NON_PIU_PREFERENZE } from '../app/lib/mondo/settings.js';
import { PROFILE_VUOTO, profileDaPrefs, seguiTopic, bloccaFonte, topicDichiarati } from '../app/lib/mondo/profile.js';
import { PESI, pesoDi } from '../app/lib/mondo/events.js';
import { MEMORY_VUOTA, registraEvento, affinitaTopic, fattoreDecadimento, memoryDaPrefs } from '../app/lib/mondo/memory.js';
import { SESSION_INIZIALE, normalizzaSession, filtroDaVecchio } from '../app/lib/mondo/session.js';
import { candidato, candidati, ammessi, dominioDi } from '../app/lib/mondo/models.js';

const GIORNO = 24 * 3600 * 1000;

describe('b.575 — tassonomia e query canoniche', () => {
  it('ogni padre esiste e nessuna catena cicla', () => {
    for (const [id, padre] of Object.entries(TASSONOMIA)) {
      if (padre !== null) expect(TOPIC_IDS, id).toContain(padre);
      const c = catena(id);
      expect(new Set(c).size).toBe(c.length);
    }
  });
  it('la parentela e canonica, non dipende dalla lingua', () => {
    expect(catena('formula1')).toEqual(['formula1', 'motorsport', 'sport']);
    expect(discende('formula1', 'sport')).toBe(true);
    expect(canonico('economia')).toBe('economy');
    expect(canonico('pizza margherita')).toBe('');
  });
  it('ogni topic ha una query inglese e una lingua ignota cade su inglese', () => {
    for (const id of TOPIC_IDS) expect(domandaPer(id, 'en'), id).toBeTruthy();
    expect(domandaPer('formula1', 'sw')).toBe(domandaPer('formula1', 'en'));
  });
});

describe('b.575 → b.580 — settings sono scelte della persona', () => {
  it('valori inventati tornano ai default e il modello e completo', () => {
    expect(normalizzaSettings({ contentMix: 'magico' }).contentMix).toBe('balanced');
    expect(normalizzaSettings({ breaking: 'ogni 2 minuti' }).breaking).toBe('important');
    expect(Object.keys(normalizzaSettings({})).sort()).toEqual(Object.keys(SETTINGS_DEFAULT).sort());
  });
  it('migra il vecchio filtro senza conservare le finte preferenze tecniche', () => {
    expect(settingsDaPrefs({ mondoFeedFiltro: 'video' }).contentMix).toBe('moreVideo');
    expect(settingsDaPrefs({ mondoAutoplayVideo: false }).autoplayVideo).toBe(false);
    for (const k of ['mondoModo', 'mondoRitmo', 'mondoAggiorna']) expect(NON_PIU_PREFERENZE).toContain(k);
  });
});

describe('b.575 — profile dichiarato dalla persona', () => {
  it('normalizza gli interessi e non inventa topic', () => {
    expect(profileDaPrefs({ interessi: ['economia', 'motori', 'pizza'] }).interests).toEqual(['economy', 'motors']);
  });
  it('seguire non duplica e bloccare una fonte prevale', () => {
    expect(seguiTopic(seguiTopic(PROFILE_VUOTO, 'formula1'), 'formula1').followedTopics).toEqual(['formula1']);
    const p = bloccaFonte({ ...PROFILE_VUOTO, followedSources: ['ansa.it'] }, 'ANSA.it');
    expect(p.blockedSources).toContain('ansa.it');
    expect(p.followedSources).not.toContain('ansa.it');
  });
  it('topic dichiarati uniscono interessi e seguiti', () => {
    expect(topicDichiarati({ ...PROFILE_VUOTO, interests: ['sport'], followedTopics: ['sport', 'economy'] })).toEqual(['sport', 'economy']);
  });
});

describe('b.575 — memoria osservata con decadimento', () => {
  it('i pesi forti restano centralizzati', () => {
    expect(PESI.SAVE).toBe(8);
    expect(PESI.HIDE).toBe(-10);
    expect(pesoDi('like')).toBe(4);
  });
  it('un segnale vecchio pesa meno di uno nuovo', () => {
    const oggi = Date.now();
    expect(fattoreDecadimento(oggi - 90 * GIORNO)).toBeCloseTo(0.5, 2);
    const vecchia = registraEvento(MEMORY_VUOTA, 'LIKE', { topics: ['formula1'], at: oggi - 180 * GIORNO });
    const fresca = registraEvento(MEMORY_VUOTA, 'LIKE', { topics: ['formula1'], at: oggi });
    expect(affinitaTopic(vecchia, 'formula1', oggi)).toBeLessThan(affinitaTopic(fresca, 'formula1', oggi));
  });
  it('migra la memoria storica senza perderla', () => {
    const m = memoryDaPrefs({ argomentiVisti: { sport: 3 }, gusti: { sport: 2, economy: 1 } });
    expect(m.topicAffinity.sport.peso).toBe(5);
    expect(m.topicAffinity.economy.peso).toBe(1);
  });
});

describe('b.575 — sessione e contenuto canonico', () => {
  it('i filtri vecchi diventano valori di sessione', () => {
    expect(filtroDaVecchio('video')).toBe('video');
    expect(filtroDaVecchio('articoli')).toBe('articles');
    expect(normalizzaSession({ mode: 'magico' }).mode).toBe(SESSION_INIZIALE.mode);
  });
  it('articoli e video hanno la stessa forma', () => {
    const art = candidato({ titolo: 'A', url: 'https://ansa.it/x', fonti: [{ fonte: 'ANSA', dominio: 'ansa.it' }] });
    const vid = candidato({ titolo: 'B', id: 'abc', canale: 'Rai', type: 'video' });
    expect(art.type).toBe('article');
    expect(vid.type).toBe('video');
    expect(Object.keys(art).sort()).toEqual(Object.keys(vid).sort());
    expect(dominioDi('https://www.Corriere.it/x')).toBe('corriere.it');
  });
  it('prima del ranking elimina doppioni, nascosti e fonti bloccate', () => {
    const a = { titolo: 'A', url: 'https://uno.it/x' };
    const b = { titolo: 'B', url: 'https://due.it/y' };
    expect(ammessi([a, a, b])).toHaveLength(2);
    expect(ammessi([a, b], { hidden: ['https://uno.it/x'] })).toHaveLength(1);
    expect(ammessi([a, b], { blockedSources: ['due.it'] })).toHaveLength(1);
    expect(candidati([{}, { titolo: 'C', url: 'https://tre.it' }])).toHaveLength(1);
  });
});

describe('b.580 — confine esplicito fra UI, motore e adattatori Live', () => {
  it('i componenti usano solo la superficie Mondo dichiarata', () => {
    const permessi = new Set(['ponte', 'rankingConfig', 'settings', 'profile', 'breaking', 'pushClient']);
    const dir = join(process.cwd(), 'app/components');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const s = readFileSync(join(dir, f), 'utf8');
      const moduli = [...s.matchAll(/from '[^']*lib\/mondo\/([a-zA-Z]+)\.js'/g)].map((m) => m[1]);
      for (const modulo of moduli) expect(permessi.has(modulo), `${f} usa un modulo Mondo non pubblico: ${modulo}`).toBe(true);
    }
  });

  it('il core puro non importa UI o route', () => {
    // b.580: la vecchia regia.js e stata sostituita dal MondoDirector,
    // che mantiene la stessa responsabilita ma dentro il nuovo core.
    const core = ['taxonomy.js', 'queries.js', 'settings.js', 'profile.js', 'events.js', 'memory.js', 'session.js', 'models.js', 'ranker.js', 'director.js'];
    const base = join(process.cwd(), 'app/lib/mondo');
    for (const f of core) {
      const s = readFileSync(join(base, f), 'utf8');
      expect(s, f).not.toMatch(/app\/components|app\/api|\.\.\/\.\.\/components|\.\.\/\.\.\/api/);
    }
  });

  it('gli adattatori Live possono collegare il core alle fonti esterne senza fingersi core puro', () => {
    const base = join(process.cwd(), 'app/lib/mondo');
    expect(readFileSync(join(base, 'liveIngest.js'), 'utf8')).toMatch(/\.\.\/topics\/servizio\.js/);
    expect(readFileSync(join(base, 'pushClient.js'), 'utf8')).toMatch(/export/);
  });
});
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.541 — i semi dell utente vengono prima', () => {
  it('preferite, recenti, predefinite senza doppioni', async () => {
    const { semiDi } = await import('../app/lib/giardino.js');
    const semi = semiDi({ ricerchePreferite: [{ q: 'tom cruise' }], ricercheRecenti: [{ q: 'chelsea football' }, { q: 'Tom Cruise' }] }, [{ query: 'italia breaking news' }]);
    expect(semi.map((s) => s.query)).toEqual(['tom cruise', 'chelsea football', 'italia breaking news']);
    expect(semi.map((s) => s.origine)).toEqual(['preferita', 'recente', 'predefinita']);
  });

  it('Oggi voglio viene prima e scade senza diventare un interesse stabile', async () => {
    const { semiDi, preferenzaOggi } = await import('../app/lib/giardino.js');
    const adesso = 1_800_000_000_000;
    const prefs = {
      mondoOggi: { q: 'musica jazz', scade: adesso + 60_000 },
      ricerchePreferite: [{ q: 'formula 1' }, { q: 'Musica Jazz' }],
    };
    expect(preferenzaOggi(prefs, adesso)).toBe('musica jazz');
    const semi = semiDi(prefs);
    expect(semi[0]).toMatchObject({ query: 'musica jazz', origine: 'oggi', peso: 4 });
    expect(semi.filter((s) => s.query.toLowerCase() === 'musica jazz')).toHaveLength(1);
    expect(preferenzaOggi(prefs, adesso + 120_000)).toBe('');
  });

  it('prossimaQuery non ripete e alla fine si ferma', async () => {
    const { prossimaQuery } = await import('../app/lib/giardino.js');
    const semi = [{ query: 'a', peso: 2 }];
    const rami = [{ query: 'b', tipo: 'vicino', seme: 'a', livello: 1 }];
    expect(prossimaQuery({ semi, rami, usate: ['a'] }).query).toBe('b');
    expect(prossimaQuery({ semi, rami, usate: ['a', 'b'] })).toBeNull();
  });

  it('i rami vuoti, doppi o circolari vengono ripuliti', async () => {
    const { sanaRami } = await import('../app/lib/giardino.js');
    const puliti = sanaRami([
      { query: 'brad pitt', tipo: 'vicino' },
      { query: '  ', tipo: 'stesso' },
      { query: 'Brad Pitt', tipo: 'ambito' },
      { query: 'tom cruise', tipo: 'stesso' },
    ], 'Tom Cruise');
    expect(puliti.map((r) => r.query)).toEqual(['brad pitt']);
  });
});

describe('b.541 — la cronaca non diventa enciclopedia', () => {
  it('news non meritano Wikipedia, i soggetti veri si', async () => {
    const { meritaEnciclopedia } = await import('../app/lib/topics/enciclopediaUtile.js');
    for (const q of ['ultime notizie', 'breaking news', 'últimas noticias']) expect(meritaEnciclopedia(q)).toBe(false);
    for (const q of ['tom cruise', 'chelsea football', 'storia di roma']) expect(meritaEnciclopedia(q)).toBe(true);
  });
});

describe('b.541 → b.580 — il feed cresce senza diventare un compito', () => {
  const news = leggi('app/components/MondoNews.js');
  const feed = leggi('app/components/FeedNotizieMondo.js');

  it('un giro accodato preserva la testa gia visibile', () => {
    expect(news).toMatch(/if \(!accoda\) return componi\(puliti, \[\], \{ gusti, miaLingua: lingua \}\)/);
    expect(news).toMatch(/return \[\.\.\.testa, \.\.\.componi\(\[\], nuovi,/);
  });

  it('parte dai semi dell utente ma allarga il mondo', () => {
    expect(news).toMatch(/const semiUtente = semiDi\(prefs, \[\]\)/);
    expect(news).toMatch(/ramiDelGiorno/);
  });

  it('cresce tre slide prima della fine', () => {
    expect(feed).toMatch(/indiceAttivo >= elementi\.length - 3/);
    expect(news).toMatch(/const cresci = useCallback/);
  });

  it('la semina manuale compare solo dopo che il primo feed e pronto', () => {
    expect(feed).toMatch(/\{pronto && elementi\.length > 0 && onCerca && \(/);
    expect(feed).toMatch(/const semina = useCallback\(/);
    expect(feed).toMatch(/onCerca\?\.\(q\)/);
  });

  it('le parole del Giardino esistono in tutti i 38 pacchetti', async () => {
    const lingue = readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'));
    expect(lingue).toHaveLength(38);
    for (const f of lingue) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['seedMoreTitle', 'seedMoreDesc', 'growMoreWord', 'growingWord']) expect(typeof o[k], `${f}:${k}`).toBe('string');
    }
  }, 30000);
});

describe('b.580 — i predefiniti appartengono alla persona', () => {
  it('settings e pannello non espongono piu i controlli tecnici', async () => {
    const { SETTINGS_DEFAULT, NON_PIU_PREFERENZE } = await import('../app/lib/mondo/settings.js');
    expect(SETTINGS_DEFAULT.titles).toBe('translated');
    expect(SETTINGS_DEFAULT.breaking).toBe('important');
    for (const k of ['mondoModo', 'mondoRitmo', 'mondoAggiorna']) expect(NON_PIU_PREFERENZE).toContain(k);
    const p = leggi('app/components/ui/PreferenzeMondo.js');
    expect(p).not.toMatch(/key:\s*['"]mondo(?:Modo|Ritmo|Aggiorna)['"]/);
  });
});

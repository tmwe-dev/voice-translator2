import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

// ═══ b.544 — «non si puo dare un mi piace a nessuno» + «le persone sono
// pigre e devi mettergli in bocca i contenuti» (Luca) ═══

describe('b.544 — il mi piace (regole vere)', () => {
  beforeEach(() => localStorage.clear());

  it('lo stesso articolo condiviso in due modi conta una volta sola', async () => {
    const { chiaveContenuto } = await import('../app/lib/gradimento.js');
    const a = chiaveContenuto('https://www.ansa.it/x/y/?utm_source=fb&id=3');
    const b = chiaveContenuto('https://ansa.it/x/y?id=3');
    expect(a).toBe(b);
    expect(a).toBe('ansa.it/x/y?id=3');
    expect(chiaveContenuto('')).toBe('');
    expect(chiaveContenuto(null)).toBe('');
  });

  it('metti e togli, e il telefono se lo ricorda', async () => {
    const { giraCuore, hoMessoCuore } = await import('../app/lib/gradimento.js');
    const u = 'https://ansa.it/notizia';
    expect(hoMessoCuore(u)).toBe(false);
    const primo = giraCuore(u);
    expect(primo).toMatchObject({ acceso: true, passo: 1 });
    expect(hoMessoCuore(u)).toBe(true);
    const secondo = giraCuore(u);
    expect(secondo).toMatchObject({ acceso: false, passo: -1 });
    expect(hoMessoCuore(u)).toBe(false);
    // un indirizzo che non c'e non produce cuori fantasma
    expect(giraCuore('')).toMatchObject({ passo: 0 });
  });

  it('il numero mostrato: quello di tutti, piu il mio se il server non lo sa ancora', async () => {
    const { quantiCuori, chiaveContenuto } = await import('../app/lib/gradimento.js');
    const u = 'https://ansa.it/n';
    const k = chiaveContenuto(u);
    expect(quantiCuori({ [k]: 7 }, u, null)).toBe(7);
    expect(quantiCuori({ [k]: 7 }, u, true)).toBe(8);
    expect(quantiCuori({ [k]: 7, [`${k}:io`]: 1 }, u, true), 'se il server mi ha gia contato, non conto due volte').toBe(7);
    expect(quantiCuori({}, u, false)).toBe(0);
    expect(quantiCuori(null, u, null), 'mai NaN').toBe(0);
  });
});

describe('b.544 — il conteggio e di tutti, e non si puo barare', () => {
  const rotta = leggi('app/api/mondo/gradimento/route.js');
  it('il passo puo essere solo +1 o -1', () => {
    expect(rotta).toMatch(/const passo = Number\(body\?\.passo\) === -1 \? -1 : 1/);
  });
  it('non si scende sotto zero e le chiavi non restano per sempre', () => {
    expect(rotta).toMatch(/if \(quanti < 0\) \{ await redis\('SET', k, '0'\)/);
    expect(rotta).toMatch(/const TTL = 90 \* 24 \* 3600/);
  });
  it('non si registra CHI ha messo il cuore', () => {
    expect(rotta).not.toMatch(/userToken|sessione|getSession/);
  });
});

describe('b.544 — il cuore nella colonnina', () => {
  it('c\'e su tutte e due le famiglie, ed e il primo', () => {
    const video = feed.slice(feed.indexOf("{el.tipo === 'video' ?"), feed.indexOf('b.535 — Luca: «il menu di youtube'));
    const articolo = feed.slice(feed.indexOf('le stesse porte dei video'));
    for (const [nome, blocco] of [['video', video], ['articolo', articolo]]) {
      expect(blocco, nome).toMatch(/chiave: 'cuore', icona: 'heart'/);
      const iCuore = blocco.indexOf("chiave: 'cuore'");
      const iAltro = Math.max(blocco.indexOf("chiave: 'parlane'"), blocco.indexOf("chiave: 'leggi'"));
      expect(iCuore, `${nome}: il cuore viene per primo`).toBeLessThan(iAltro);
    }
  });
  it('si accende subito, prima che il server risponda', () => {
    expect(feed).toMatch(/const esito = giraCuore\(url\);/);
    const dentro = feed.slice(feed.indexOf('const cuore = useCallback'));
    expect(dentro.indexOf('setMiei('), 'prima si accende').toBeLessThan(dentro.indexOf("fetch('/api/mondo/gradimento'"));
    expect(dentro).toMatch(/\.catch\(\(\) => \{ \/\* il cuore resta mio anche se la rete non c'e \*\/ \}\)/);
  });
  it('e il tocco sul cuore non fa partire altro', () => {
    expect(feed).toMatch(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); v\.onTocca\(\); \}\}/);
  });
  it('l\'icona cuore esiste e la parola e tradotta ovunque', async () => {
    expect(leggi('app/components/Icon.js')).toMatch(/heart: 'M20\.8 4\.6/);
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      expect(typeof o.likeWord, f).toBe('string');
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});

describe('b.544 — «le persone sono pigre»: i contenuti si mettono in bocca', () => {
  it('il campo per seminare compare SOLO in coda a contenuti che gia ci sono', () => {
    expect(feed).toMatch(/\{elementi\.length > 0 && onCerca && \(/);
    // ed e nudo: niente titolo, niente spiegazione
    const slide = feed.slice(feed.indexOf("{elementi.length > 0 && onCerca && ("));
    expect(slide.slice(0, 1600)).not.toMatch(/seedMoreTitle|seedMoreDesc|growMoreWord/);
  });
  it('seminando si torna in cima, dove arriva il contenuto nuovo', () => {
    expect(feed).toMatch(/const semina = useCallback\(/);
    expect(feed).toMatch(/setIndiceAttivo\(0\)/);
    expect(feed).toMatch(/contenitoreRef\.current\?\.scrollTo\(\{ top: 0/);
  });
  it('il feed corto o vuoto si riempie da solo, senza chiedere niente', () => {
    expect(feed).toMatch(/if \(elementi\.length < 4 \|\| indiceAttivo >= elementi\.length - 3\) onCresci\(\)/);
    // e l'attesa dice che sta lavorando, non da un compito. b.552: quel
    // blocco adesso e' anche la schermata di attesa vera e propria — non
    // si mostra niente finche' il primo giro non ha finito («deve
    // presentare il primo contenuto solo quando e' certo», Luca) — e ha
    // il suo anello che gira.
    const vuoto = feed.slice(feed.indexOf("L'ATTESA HA UNA FACCIA"));
    expect(vuoto.slice(0, 1800)).toMatch(/L\('growingWord'\)/);
    expect(vuoto.slice(0, 1800), 'l icona mentre carica').toMatch(/vtGira/);
  });
});

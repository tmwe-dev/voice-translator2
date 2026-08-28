import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// ═══ b.543 — IL FONTIERE ═══
// Ordine di Luca: «vicino al selettore paese o lingua della sidebar
// aggiungi un tasto... deep search per creare liste sempre aggiornate...
// anche i settori devono riaccendere la icona».

describe('b.543 — le liste di fonti (regole vere)', () => {
  it('la chiave distingue un Paese da un settore, e il settore vince', async () => {
    const { chiaveLista } = await import('../app/lib/topics/fonti.js');
    expect(chiaveLista({ paese: 'it' })).toBe('paese:IT');
    expect(chiaveLista({ settore: 'Medicina' })).toBe('settore:medicina');
    expect(chiaveLista({ paese: 'IT', settore: 'medicina' })).toBe('settore:medicina');
    expect(chiaveLista({})).toBe('');
  });

  it('l\'icona si riaccende dopo trenta giorni — e resta accesa se la lista non c\'e', async () => {
    const { listaVecchia, giorniDiVita } = await import('../app/lib/topics/fonti.js');
    const ora = 1_800_000_000_000;
    const g = (n) => ora - n * 24 * 3600 * 1000;
    expect(listaVecchia(null, ora), 'mai fatta').toBe(true);
    expect(listaVecchia({ fonti: [], quando: ora }, ora), 'vuota').toBe(true);
    expect(listaVecchia({ fonti: [{ dominio: 'a.it' }], quando: g(10) }, ora), 'dieci giorni').toBe(false);
    expect(listaVecchia({ fonti: [{ dominio: 'a.it' }], quando: g(31) }, ora), 'trentuno giorni').toBe(true);
    expect(giorniDiVita({ quando: g(40) }, ora)).toBe(40);
    expect(giorniDiVita(null, ora)).toBeNull();
  });

  it('gli aggregatori e i social non sono testate: fuori', async () => {
    const { sanaFonti } = await import('../app/lib/topics/fonti.js');
    const sane = sanaFonti([
      'https://www.ansa.it/cronaca', 'ANSA.IT', 'news.google.com', 'facebook.com',
      'm.lescienze.it', 'non un dominio', '', { dominio: 'nature.com', nome: 'Nature', viva: true },
    ]);
    expect(sane.map((f) => f.dominio)).toEqual(['ansa.it', 'lescienze.it', 'nature.com']);
    expect(sane[2].viva).toBe(true);
    expect(sane[0].viva, 'chi non e stato verificato non si spaccia per vivo').toBe(false);
  });

  it('la ricerca a piu voci: la stessa domanda, a testate diverse', async () => {
    const { vociDiRicerca } = await import('../app/lib/topics/fonti.js');
    const fonti = [
      { dominio: 'storica.it', viva: false },
      { dominio: 'viva1.it', viva: true },
      { dominio: 'viva2.com', viva: true },
    ];
    const voci = vociDiRicerca('vaccini', fonti, { quante: 2 });
    // prima le verificate vive: sono quelle che rispondono davvero
    expect(voci).toEqual(['vaccini site:viva1.it', 'vaccini site:viva2.com']);
    expect(vociDiRicerca('', fonti)).toEqual([]);
    expect(vociDiRicerca('x', [])).toEqual([]);
  });

  it('il direttorio scritto a mano non si butta: resta il fondo', async () => {
    const { fondiConDirettorio } = await import('../app/lib/topics/fonti.js');
    const fuse = fondiConDirettorio(
      [{ dominio: 'nuova.it', viva: true }, { dominio: 'ansa.it', viva: true }],
      ['nature.com', 'ansa.it'],   // ansa c'e gia: niente doppione
    );
    expect(fuse.map((f) => f.dominio)).toEqual(['nuova.it', 'ansa.it', 'nature.com']);
    expect(fuse[2].storica).toBe(true);
    expect(fuse[0].storica).toBeUndefined();
  });
});

describe('b.543 — il deep search verifica, non si fida', () => {
  const rotta = leggi('app/api/topics/fonti/route.js');
  it('ogni testata proposta viene bussata prima di entrare in lista', () => {
    expect(rotta).toMatch(/async function risponde\(dominio\)/);
    expect(rotta, 'HEAD e poi GET: certi siti rifiutano HEAD').toMatch(/if \(await prova\('HEAD'\)\) return true;\s*\n\s*return prova\('GET'\)/);
    expect(rotta).toMatch(/const buone = vive\.filter\(\(f\) => f\.viva\)/);
    expect(rotta, 'e si dice quante ne sono state scartate').toMatch(/scartate: proposte\.length - buone\.length/);
  });
  it('la lista dura trenta giorni ed e di tutti', () => {
    expect(rotta).toMatch(/const TTL = 30 \* 24 \* 3600/);
    expect(rotta).toMatch(/redis\('SET', kRedis/);
    expect(rotta, 'e si puo rileggere gratis, per sapere se l\'icona va accesa').toMatch(/export const GET = withApiGuard/);
  });
  it('al modello si chiede pluralita, non le solite tre testate', () => {
    expect(rotta).toMatch(/almeno tre\s*\n?\s*fonti di lingua o area diversa/);
    expect(rotta).toMatch(/MAI aggregatori/);
  });
});

describe('b.543 — il tasto, e la ricerca che lo usa', () => {
  const news = leggi('app/components/MondoNews.js');
  it('il tasto sta nella card del Paese e si accende quando serve', () => {
    const card = news.slice(news.indexOf('IL FONTIERE: «MIGLIORA LE FONTI»'));
    expect(card).toMatch(/const vecchia = listaVecchia\(listaFonti, Date\.now\(\)\)/);
    expect(card).toMatch(/L\('sourcesImprove'\)/);
    expect(card, 'e dice quante fonti e da quanti giorni').toMatch(/\$\{quante\} \$\{L\('sourcesCount'\)\}/);
  });
  it('la ricerca porta con se la lista: e cosi che la pluralita entra davvero', () => {
    expect(news).toMatch(/paeseFonti: paeseFiltro \|\| '', settoreFonti: bozzaCategoria \|\| ''/);
    const servizio = leggi('app/lib/topics/servizio.js');
    expect(servizio).toMatch(/voci = vociDiRicerca\(q, lista\?\.fonti \|\| \[\], \{ quante: 4 \}\)/);
    expect(servizio, 'le voci mirate si affiancano alla generale, non la sostituiscono')
      .toMatch(/const generale = await cercaNotizie\(q, lingua, \{ massimo: 20 \}\)/);
    expect(servizio, 'e senza doppioni').toMatch(/if \(!a\?\.url \|\| visti\.has\(a\.url\)\) continue/);
  });
  it('le parole nuove ci sono in tutti e 38 i pacchetti', async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(join(process.cwd(), 'app/lib/locales')).filter((x) => x.endsWith('.js'))) {
      const o = (await import(`../app/lib/locales/${f}`)).default;
      for (const k of ['sourcesImprove', 'sourcesCount', 'sourcesNone', 'sourcesWorking']) {
        expect(typeof o[k], `${f}:${k}`).toBe('string');
      }
    }
    // b.552 — questa prova apre a uno a uno TUTTI e 38 i pacchetti di
    // lingua: mezzo megabyte di traduzioni. Sul portatile mentre lavora
    // i cinque secondi di prammatica non bastano, e un rosso per
    // stanchezza della macchina e' peggio di nessun rosso.
  }, 30000);
});

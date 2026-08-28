// ═══════════════════════════════════════════════════════════════
// b.565 — LE TESTATE SCRITTE A MANO, E IL GUARDIANO DEL REGISTRO
//
// Verso i 90.000, capitolo «fonti vive» — che e' il collo di bottiglia
// di tutto il resto. Misurato prima di scrivere questo codice:
// **71 fonti nel registro, 9 con un flusso trovato, 49 mai nemmeno
// interrogate**, e 2 soli Paesi. Il motore c'era e girava al minimo.
//
// Due mosse, e una delle due non e' codice:
// ① un elenco di testate vere scritto A MANO. Riconoscere una testata
//    seria da un aggregatore e' un giudizio, non un algoritmo — e il
//    registro impara SOPRA queste: una fonte sbagliata in cima insegna
//    male per mesi.
// ② un guardiano che gira ogni ora, le semina e va a caccia dei flussi
//    mancanti. Trovare un flusso costa una visita alla home piu cinque
//    tentativi: troppo mentre qualcuno aspetta il giornale, giusto per
//    un lavoro che gira di notte.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TESTATE, testateDelPaese, testateDellaLingua, perIlRegistro } from '../app/lib/topics/testate.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('l elenco delle testate', () => {
  it('sono piu di cento, e nessuna ripetuta', () => {
    expect(TESTATE.length).toBeGreaterThanOrEqual(110);
    const domini = TESTATE.map((t) => t.d);
    expect(new Set(domini).size, 'nessun doppione').toBe(domini.length);
  });

  it('ognuna ha dominio, nome, paese e lingua — tutti veri', () => {
    for (const t of TESTATE) {
      expect(t.d, JSON.stringify(t)).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}(\/[a-z]+)?$/);
      expect(t.n.length, `${t.d} senza nome`).toBeGreaterThan(1);
      expect(t.p, `${t.d}: paese storto`).toMatch(/^[A-Z]{2}$/);
      expect(t.l, `${t.d}: lingua storta`).toMatch(/^[a-z]{2}$/);
    }
  });

  it('il mondo c e davvero: almeno venti lingue e quaranta paesi', () => {
    // se questo elenco fosse tutto occidentale, la «quota di mondo»
    // della regia pescherebbe da un secchio finto.
    expect(new Set(TESTATE.map((t) => t.l)).size).toBeGreaterThanOrEqual(20);
    expect(new Set(TESTATE.map((t) => t.p)).size).toBeGreaterThanOrEqual(40);
  });

  it('e le lingue non europee pesano davvero', () => {
    for (const l of ['ar', 'ja', 'hi', 'zh', 'ko', 'th', 'vi', 'id', 'he', 'tr']) {
      expect(testateDellaLingua(l).length, `nessuna testata in ${l}`).toBeGreaterThan(0);
    }
  });

  it('nessun paese fa la parte del leone', () => {
    const conti = {};
    for (const t of TESTATE) conti[t.p] = (conti[t.p] || 0) + 1;
    for (const [p, n] of Object.entries(conti)) expect(n, `${p} ha troppe voci`).toBeLessThanOrEqual(10);
  });

  it('nessun aggregatore: ci ridarebbe i contenuti degli altri', () => {
    const vietati = ['news.google', 'bing.com', 'msn.com', 'flipboard', 'yahoo.com', 'reddit'];
    for (const t of TESTATE) {
      for (const v of vietati) expect(t.d.includes(v), `${t.d} e un aggregatore`).toBe(false);
    }
  });

  it('si cercano per paese e per lingua', () => {
    expect(testateDelPaese('IT').length).toBeGreaterThanOrEqual(8);
    expect(testateDelPaese('it')).toEqual(testateDelPaese('IT'));
    expect(testateDellaLingua('fr').some((t) => t.d === 'lemonde.fr')).toBe(true);
  });

  it('entrano nel registro con la dignita di chi si e fatto notare, non di piu', () => {
    // due apparizioni: la stessa soglia di una fonte scoperta da sola
    // (b.553). Il merito se lo devono guadagnare facendosi leggere.
    const voci = perIlRegistro();
    expect(voci).toHaveLength(TESTATE.length);
    expect(voci.every((v) => v.quante === 2)).toBe(true);
    expect(voci[0]).toHaveProperty('nome');
  });
});

describe('il guardiano che gira ogni ora', () => {
  const r = leggi('app/api/mondo/registro/route.js');

  it('non lo apre chi passa di li', () => {
    expect(r).toMatch(/safeCompare\(pass, process\.env\.ADMIN_PASS\) \|\| safeCompare\(pass, process\.env\.CRON_SECRET\)/);
    expect(r, 'e con un tetto ai tentativi, come le altre rotte di servizio').toMatch(/checkRateLimit/);
  });

  it('semina le testate nell elenco generale E nel loro Paese', () => {
    expect(r).toMatch(/perIlRegistro\(\)/);
    expect(r).toMatch(/await fontiViste\(voci, \{ paese, settore: '' \}\)/);
  });

  it('e va a caccia di venti flussi per volta', () => {
    expect(r).toMatch(/const QUANTE_PER_GIRO = 20/);
    expect(r).toMatch(/fontiDaProvare\(\{ quante: QUANTE_PER_GIRO \}\)/);
    expect(r, 'una fonte che fallisce non ferma le altre').toMatch(/feedDelDominio\(f\.dominio\)\.catch\(\(\) => ''\)/);
  });

  it('e dice quanto ha lavorato: senza numeri non si sa se serve', () => {
    expect(r).toMatch(/seminate: 0, provate: 0, trovati: 0, senzaFlusso: 0/);
  });

  it('e registrato fra i lavori periodici', () => {
    const v = JSON.parse(leggi('vercel.json'));
    const nostro = v.crons.find((c) => c.path === '/api/mondo/registro');
    expect(nostro, 'senza questo non gira mai').toBeTruthy();
    expect(nostro.schedule).toBe('30 * * * *');
  });
});

// ═══════════════════════════════════════════════════════════════
// b.566 — LA SECONDA PORTA: LE SITEMAP DELLE NOTIZIE
//
// Molte testate hanno spento l'RSS, ma quasi tutte pubblicano una «news
// sitemap»: uno standard nato per i motori di ricerca che contiene
// esattamente quello che serve a noi — titolo, indirizzo e data delle
// ultime quarantott'ore. Senza questa porta perderemmo tutte le testate
// che l'RSS non ce l'hanno piu, e sono tante: il registro resterebbe
// con nove flussi su settantuno per sempre.
// ═══════════════════════════════════════════════════════════════
describe('la seconda porta: le sitemap delle notizie', () => {
  it('si legge titolo, indirizzo e data', async () => {
    const { leggiSitemap } = await import('../app/lib/topics/registro.js');
    const xml = `<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
      <url><loc>https://testata.it/uno</loc><news:news>
        <news:title>Terremoto in Giappone</news:title>
        <news:publication_date>2026-08-28T10:00:00Z</news:publication_date>
      </news:news></url>
      <url><loc>https://testata.it/due</loc><news:news>
        <news:title>Sciopero dei treni</news:title>
      </news:news></url>
    </urlset>`;
    const voci = leggiSitemap(xml);
    expect(voci.map((v) => v.titolo)).toEqual(['Terremoto in Giappone', 'Sciopero dei treni']);
    expect(voci[0].url).toBe('https://testata.it/uno');
    expect(voci[0].dataPub).toBe('2026-08-28T10:00:00Z');
  });

  it('una sitemap SENZA titoli non ci serve: sono solo indirizzi', () => {
    // la sitemap normale di un sito elenca pagine, non notizie: senza
    // titolo non c'e' niente da mostrare, e tenerla vorrebbe dire
    // riempire il feed di righe vuote.
    return import('../app/lib/topics/registro.js').then(({ leggiSitemap }) => {
      expect(leggiSitemap('<urlset><url><loc>https://a.it/x</loc></url></urlset>')).toEqual([]);
    });
  });

  it('il formato si riconosce dal CONTENUTO, non dall indirizzo', async () => {
    // ci sono testate che servono una sitemap da un percorso che sembra
    // un feed, e viceversa. Guardare cosa c'e' dentro non sbaglia mai.
    const { leggiVoci } = await import('../app/lib/topics/registro.js');
    const sitemap = '<urlset xmlns:news="x"><url><loc>https://a.it/1</loc><news:title>Uno</news:title></url></urlset>';
    const rss = '<rss><channel><item><title>Due</title><link>https://a.it/2</link></item></channel></rss>';
    expect(leggiVoci(sitemap).map((v) => v.titolo)).toEqual(['Uno']);
    expect(leggiVoci(rss).map((v) => v.titolo)).toEqual(['Due']);
  });

  it('e le sitemap si provano DOPO i feed: l RSS resta piu ricco', async () => {
    const { indirizziDaProvare } = await import('../app/lib/topics/registro.js');
    const strade = indirizziDaProvare('testata.it');
    const primaSitemap = strade.findIndex((u) => u.includes('sitemap'));
    const ultimoFeed = strade.map((u) => u.includes('sitemap')).lastIndexOf(false);
    expect(primaSitemap).toBeGreaterThan(ultimoFeed);
    expect(strade.filter((u) => u.includes('sitemap'))).toHaveLength(3);
  });
});

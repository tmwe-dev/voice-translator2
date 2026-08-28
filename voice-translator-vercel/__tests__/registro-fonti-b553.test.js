// ═══════════════════════════════════════════════════════════════
// b.553 — SI SEGUE, NON SI CERCA
//
// Decisione di Luca, presa prima che il sistema crescesse:
//
//   «Il feed Mondo nasce dalle FONTI, non dai motori di ricerca.
//    SEARCH → DISCOVER → FOLLOW → CACHE → PERSONALIZE,
//    non SEARCH → SEARCH → SEARCH → SEARCH.»
//
// Il perche', in due numeri: una ricerca su YouTube costa 100 unita E
// una delle sole 100 chiamate concesse al giorno; seguire un canale che
// gia conosciamo ne costa 1. E il flusso RSS di una testata e'
// pubblicato apposta perche' qualcuno lo legga — nessuna quota, nessun
// contratto forzato, nessun indirizzo da nascondere.
//
// Una ricerca si paga ogni volta e domani non vale piu niente. Una
// fonte si scopre una volta e rende per anni.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  dominioNudo, feedDaHtml, indirizziDaProvare, leggiVoci, parlaDi, paroleVere, daFonte,
} from '../app/lib/topics/registro.js';
import { imparaFonti } from '../app/lib/topics/fonti.js';
import { playlistCaricamenti, daApi, chiaveYouTube } from '../app/lib/topics/videoUfficiale.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('dal dominio al suo flusso', () => {
  it('lo chiede alla pagina, che lo dichiara: e la strada giusta', () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="Feed" href="/feed/">
    </head></html>`;
    expect(feedDaHtml(html, 'https://esempio.it/')).toBe('https://esempio.it/feed/');
  });

  it('legge anche Atom, e risolve gli indirizzi relativi', () => {
    const html = `<link rel="alternate" type="application/atom+xml" href="atom.xml">`;
    expect(feedDaHtml(html, 'https://esempio.it/notizie/')).toBe('https://esempio.it/notizie/atom.xml');
  });

  it('fra piu flussi non prende quello dei commenti', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="/comments/feed">
      <link rel="alternate" type="application/rss+xml" href="/feed">`;
    expect(feedDaHtml(html, 'https://esempio.it/')).toBe('https://esempio.it/feed');
  });

  it('se la pagina non lo dichiara, prova gli indirizzi che usano quasi tutti', () => {
    expect(feedDaHtml('<html><head></head></html>', 'https://esempio.it/')).toBe('');
    // b.566 — dopo i cinque feed ci sono le tre news sitemap: la
    // seconda porta, per le testate che l'RSS l'hanno spento.
    expect(indirizziDaProvare('www.Esempio.it/sezione').slice(0, 5)).toEqual([
      'https://esempio.it/feed',
      'https://esempio.it/rss',
      'https://esempio.it/rss.xml',
      'https://esempio.it/feed.xml',
      'https://esempio.it/index.xml',
    ]);
  });

  it('il dominio si spoglia sempre allo stesso modo', () => {
    expect(dominioNudo('https://www.Corriere.it/esteri/x.html')).toBe('corriere.it');
  });
});

describe('leggere il flusso', () => {
  it('RSS e Atom insieme: senza Atom perderemmo meta delle fonti buone', () => {
    const xml = `<rss><channel>
      <item><title>Uno</title><link>https://a.it/1</link><pubDate>Tue, 01 Sep 2026 08:00:00 GMT</pubDate></item>
    </channel></rss>
    <feed><entry>
      <title>Due</title><link href="https://a.it/2"/><published>2026-09-01T09:00:00Z</published>
      <summary>Racconto del &lt;b&gt;fatto&lt;/b&gt;</summary>
    </entry></feed>`;
    const voci = leggiVoci(xml);
    expect(voci.map((v) => v.titolo)).toEqual(['Uno', 'Due']);
    expect(voci[1].descrizione, 'niente marcatori nel testo').toBe('Racconto del fatto');
  });

  it('e diventa un articolo come tutti gli altri, con la sua data', () => {
    const [a] = daFonte([{ titolo: 'T', url: 'https://a.it/1', dataPub: 'Tue, 01 Sep 2026 08:00:00 GMT', immagine: 'http://a.it/i.jpg' }], 'www.a.it', 'Testata A');
    expect(a).toMatchObject({ titolo: 'T', dominio: 'a.it', fonte: 'Testata A' });
    expect(a.immagine, 'le immagini si alzano a https').toBe('https://a.it/i.jpg');
    expect(typeof a.pubblicato).toBe('number');
  });
});

describe('cio che la fonte pubblica, e cio che c entra con la domanda', () => {
  it('basta una parola vera: nel dubbio si ordina, non si filtra', () => {
    const voce = { titolo: 'Terremoto in Giappone, scuole chiuse', descrizione: '' };
    expect(parlaDi(voce, 'terremoto giappone')).toBe(true);
    expect(parlaDi(voce, 'batterie allo stato solido')).toBe(false);
  });

  it('gli accenti e le maiuscole non contano', () => {
    expect(parlaDi({ titolo: 'La società cambia' }, 'SOCIETA')).toBe(true);
  });

  it('le parole vuote non fanno passare tutto', () => {
    // senza questo, «la crisi del gas» combacerebbe con qualunque cosa
    // contenga «la» o «del».
    expect(paroleVere('la crisi del gas')).toEqual(['crisi', 'gas']);
    expect(parlaDi({ titolo: 'Il derby della citta' }, 'la crisi del gas')).toBe(false);
  });

  it('senza domanda passa tutto: e il giornale della fonte, non una ricerca', () => {
    expect(parlaDi({ titolo: 'Qualunque cosa' }, '')).toBe(true);
  });
});

describe('DISCOVER → FOLLOW: chi si fa notare si comincia a seguirlo', () => {
  it('due comparse fanno una fonte, una sola no', () => {
    // comparire due volte separa il giornale dal blog capitato per caso.
    const nuova = imparaFonti([], [
      { url: 'https://ilpost.it/a' }, { url: 'https://ilpost.it/b' },
      { url: 'https://tizio.blog/x' },
    ]);
    expect(nuova.map((f) => f.dominio)).toEqual(['ilpost.it']);
  });

  it('chi c e gia non si tocca e non perde il posto', () => {
    const prima = [{ dominio: 'corriere.it', nome: 'Corriere', viva: true }];
    const dopo = imparaFonti(prima, [
      { url: 'https://corriere.it/1' }, { url: 'https://corriere.it/2' },
      { url: 'https://repubblica.it/1' }, { url: 'https://repubblica.it/2' },
    ]);
    expect(dopo[0].dominio, 'la lista e ordinata per merito').toBe('corriere.it');
    expect(dopo[0].viva, 'e chi ha dato prova resta segnato vivo').toBe(true);
    expect(dopo.map((f) => f.dominio)).toContain('repubblica.it');
  });

  it('se non c e niente di nuovo non si riscrive niente', () => {
    // chi chiama scrive su Redis solo quando c e davvero un cambiamento.
    expect(imparaFonti([{ dominio: 'ansa.it' }], [{ url: 'https://ansa.it/1' }, { url: 'https://ansa.it/2' }])).toBe(null);
  });
});

describe('YouTube dalla porta principale', () => {
  it('un canale diventa la sua playlist dei caricamenti: una chiamata risparmiata', () => {
    expect(playlistCaricamenti('UCupvZG5koeiXAupbDfxWw12')).toBe('UUupvZG5koeiXAupbDfxWw12');
    expect(playlistCaricamenti('non-un-canale')).toBe('');
  });

  it('le voci dell API diventano video come quelli di sempre', () => {
    const v = daApi([{ snippet: {
      title: 'Prova', channelTitle: 'Nova Lectio', publishedAt: '2026-08-01T10:00:00Z',
      resourceId: { videoId: 'abcdefghijk' }, thumbnails: { high: { url: 'https://i/x.jpg' } },
    } }]);
    expect(v[0]).toMatchObject({ id: 'abcdefghijk', titolo: 'Prova', canale: 'Nova Lectio' });
    expect(typeof v[0].pubblicato).toBe('number');
  });

  it('senza chiave questa strada non esiste, e chi chiama lo sa', () => {
    const prima = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.YT_API_KEY;
    expect(chiaveYouTube()).toBe('');
    if (prima) process.env.YOUTUBE_API_KEY = prima;
  });

  it('quota finita NON vuol dire tornare allo scraper', () => {
    // Regola di Luca: «API ufficiale → cache → fonti gia indicizzate →
    // degradazione controllata», mai «quota finita → scraper».
    const r = leggi('app/api/topics/video/route.js');
    expect(r).toMatch(/if \(e\?\.quotaFinita\) return NextResponse\.json\(\{ disponibile: true, video: \[\], quotaFinita: true \}\)/);
    const conChiave = r.slice(r.indexOf('if (chiaveYouTube())'), r.indexOf('} else {'));
    expect(conChiave, 'con la chiave non si nomina nemmeno la vecchia strada').not.toMatch(/cercaVideo/);
  });
});

describe('il servizio: prima le fonti, il motore come eccezione', () => {
  const s = leggi('app/lib/topics/servizio.js');

  it('le fonti seguite si leggono PRIMA della ricerca', () => {
    expect(s).toMatch(/daSeguite = await leggiFonti\(daSeguire/);
    expect(s.indexOf('await leggiFonti(daSeguire'), 'e prima, non dopo').toBeLessThan(s.indexOf('await cercaNotizie(q, lingua'));
    // b.564 — e ad ogni giro se ne provano due mai interrogate:
    // l'esplorazione non si spegne nemmeno sul registro.
    expect(s).toMatch(/const nuove = await fontiDaProvare\(\{ quante: 2 \}\)/);
    // e chi seguire lo dice il REGISTRO (la storia nel deposito), non
    // piu solo la lista in cache: e' il senso della casa vera.
    // b.564 — venti invece di dodici: 49 fonti su 71 non erano mai
    // state nemmeno interrogate.
    expect(s).toMatch(/const dalRegistro = await fontiDelPosto\(\{ \.\.\.ambito, quante: 20 \}\)/);
    expect(s.indexOf('fontiDelPosto'), 'il registro parla per primo').toBeLessThan(s.indexOf('await leggiFonti(daSeguire'));
  });

  it('se bastano, il motore non si sveglia nemmeno', () => {
    expect(s).toMatch(/const fontiCoprono = daSeguite\.length >= BASTANO;/);
    expect(s).toMatch(/if \(fontiCoprono\) return daSeguite;/);
  });

  it('e quando non bastano, la roba di casa viene prima', () => {
    expect(s).toMatch(/\[\.\.\.daSeguite, \.\.\.generale\.filter/);
  });

  it('ogni ricerca riuscita insegna, e imparare non puo rompere la ricerca', () => {
    expect(s, 'nel deposito entra tutto cio che si e visto').toMatch(/await fontiViste\(articoli, ambito\)/);
    expect(s).toMatch(/const cresciuta = imparaFonti\(seguite, articoli\);/);
    const blocco = s.slice(s.indexOf('DISCOVER → FOLLOW'), s.indexOf('DISCOVER → FOLLOW') + 1400);
    expect(blocco).toMatch(/catch \{ \/\* imparare e un di piu/);
  });

  it('la cache dei video sta a dodici ore, non a mezz ora', () => {
    expect(leggi('app/api/topics/video/route.js')).toMatch(/const TTL = 12 \* 3600;/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.553-bis — LA CASA VERA, e il ponte tolto
//
// Ordine di Luca: «le liste di fonti passino su Supabase — il Source
// Graph ha bisogno di una casa vera con la sua storia». Redis e' una
// cache: roba che si puo perdere senza danno. Ma «chi ci ha dato roba
// buona, dove, quante volte» e' l'unica cosa che il Mondo accumula e
// che i motori non hanno: se scade da sola, ogni mese si ricomincia da
// capo e il patrimonio non esiste.
// ═══════════════════════════════════════════════════════════════
describe('il deposito: la storia non scade', () => {
  const d = leggi('app/lib/topics/deposito.js');

  it('due tavole, perche il merito cambia da posto a posto', () => {
    // una fonte e' una sola al mondo (il dominio), ma Le Monde vale in
    // Francia e sull'estero, non sul calcio italiano.
    expect(d).toMatch(/from\('mondo_fonti_ambito'\)/);
    expect(d).toMatch(/\.eq\('paese', paese \|\| ''\)/);
    expect(d).toMatch(/\.eq\('settore', settore \|\| ''\)/);
  });

  it('l ordine e il merito: prima chi e comparso, poi chi ha reso', () => {
    expect(d).toMatch(/\.order\('apparizioni', \{ ascending: false \}\)/);
    expect(d).toMatch(/\.order\('articoli', \{ ascending: false \}\)/);
  });

  it('la scoperta costa UNA chiamata, non una per fonte', () => {
    // la scoperta non deve costare piu della ricerca che l'ha prodotta.
    expect(d).toMatch(/rpc\('mondo_fonti_viste'/);
    expect(d).toMatch(/\[\.\.\.conti\.values\(\)\]\.slice\(0, 40\)/);
  });

  it('senza Supabase non si rompe niente: il deposito e un vantaggio, non una condizione', () => {
    expect((d.match(/if \(!db/g) || []).length, 'ogni porta controlla').toBe(6);
    expect(d).toMatch(/if \(!db\) return \[\];/);
  });

  it('anche il «questo sito l RSS non ce l ha» si ricorda', () => {
    // se no lo ricercheremmo ogni giorno per tutti i siti che non l'hanno:
    // e' la fatica piu cara del registro (una visita alla home piu cinque
    // tentativi) e va fatta una volta nella vita.
    expect(d).toMatch(/feed_provato_il/);
    const r = leggi('app/lib/topics/registro.js');
    expect(r, 'la memoria non e piu una cache che scade').not.toMatch(/redis\(/);
    expect(r).toMatch(/const gia = await feedRicordato\(d\);\s*\n\s*if \(gia !== null\) return gia;/);
  });

  it('quanto ha reso una fonte si annota dopo averla letta', () => {
    expect(leggi('app/lib/topics/registro.js')).toMatch(/await fonteLetta\(dominio, tutte\.length, ambito\)/);
  });
});

describe('b.553-bis — il ponte e tolto: la pagina di YouTube non si legge piu', () => {
  it('il modulo che la leggeva e uscito dall applicazione', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'app/lib/topics/video.js'))).toBe(false);
  });

  it('e la rotta ha una porta sola', () => {
    const r = leggi('app/api/topics/video/route.js');
    expect(r).not.toMatch(/cercaVideo\b/);
    expect(r).toMatch(/cercaSuYouTube\(q, lang/);
    expect(r, 'quota finita = si mostra cio che si ha, non si torna indietro').toMatch(/quotaFinita: true/);
  });
});

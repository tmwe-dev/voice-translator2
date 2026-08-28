import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');
const news = leggi('app/components/MondoNews.js');

// ═══ b.542 — tre difetti visti da Luca nella stessa schermata ═══

describe('b.542 — la pagina nera', () => {
  it('una slide senza fotografia ha comunque un fondo', () => {
    // il fondo NON e piu dentro un `se c'e l'immagine`: c'e sempre,
    // e dentro cambia solo cosa ci si mette.
    expect(feed).toMatch(/position: 'absolute', inset: 0, background: `linear-gradient\(160deg, \$\{C\.accent\}22/);
    expect(feed).toMatch(/\{el\.dati\.immagine \? \(/);
    expect(feed, 'e senza foto resta l\'iniziale della fonte in filigrana')
      .toMatch(/String\(el\.dati\.fonti\?\.\[0\]\?\.fonte \|\| el\.dati\.titolo \|\| '·'\)\.slice\(0, 1\)/);
    // e non deve tornare la forma vecchia: sfondo solo se c'e l'immagine
    expect(feed).not.toMatch(/\{el\.dati\.immagine && \(\n\s*<div style=\{\{ position: 'absolute', inset: 0 \}\}>/);
  });
});

describe('b.542 — niente doppioni: le porte stanno solo nella colonnina', () => {
  it('i due bottoni in fondo alla slide articolo sono usciti', () => {
    const slideArticolo = feed.slice(feed.indexOf('le stesse porte dei video'));
    expect(slideArticolo).not.toMatch(/display: 'flex', gap: 8, marginTop: 12/);
    // e la colonnina, che resta, ha ancora tutte le sue porte
    expect(slideArticolo).toMatch(/chiave: 'leggi'/);
    expect(slideArticolo).toMatch(/chiave: 'parlane'/);
  });
  it('«Apri e traduci» e «Parlane» compaiono UNA volta sola per slide', () => {
    const slideArticolo = feed.slice(feed.indexOf('le stesse porte dei video'), feed.indexOf('b.541 — L\'ULTIMA SLIDE'));
    expect((slideArticolo.match(/onApriArticolo\?\.\(el\.dati\)/g) || []).length).toBe(1);
    expect((slideArticolo.match(/onParlane\?\.\(el\.dati\)/g) || []).length).toBe(1);
  });
});

describe('b.542 — «il tasto parlane non va»: si apriva dietro il velo', () => {
  it('il feed si chiude prima di aprire la discussione', () => {
    // b.551 — «Parlane» dal feed adesso chiede PRIMA con chi (ParlaneCon:
    // persone / un esperto / il Tavolo / il Podcast — idea di Luca «cosi
    // leghiamo life a una informazione»). Il velo si chiude comunque:
    // dentro `smistaParlane`, su tutte le strade che escono dal feed —
    // che e' cio che b.542 difendeva.
    expect(news).toMatch(/onParlane=\{\(d\) => setParlaneCon\(d\)\}/);
    const smista = news.slice(news.indexOf('const smistaParlane'));
    // il velo si chiude PRIMA di smistare: vale per tutte e quattro le
    // strade, comprese le persone — che erano proprio quelle che in b.542
    // si aprivano dietro.
    const primaRiga = smista.slice(0, smista.indexOf("if (modo === 'persone')"));
    expect(primaRiga, 'il velo si chiude su ogni strada').toMatch(/setFeedAperto\(false\);/);
    expect(smista.slice(0, 900)).toMatch(/onParlane\?\.\(contenuto\)/);
  });
  it('e la stessa cura vale gia per l\'articolo (b.535): nessuna porta resta dietro', () => {
    expect(news).toMatch(/tornaAlFeedRef\.current = true; setFeedAperto\(false\); setLettura/);
    // le due strade che escono dal feed chiudono tutte e due il velo
    const dalFeed = news.slice(news.indexOf('<FeedNotizieMondo'), news.indexOf('<FeedNotizieMondo') + 1800);
    expect((dalFeed.match(/setFeedAperto\(false\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

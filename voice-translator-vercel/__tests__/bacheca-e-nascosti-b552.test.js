// ═══════════════════════════════════════════════════════════════
// b.552 — I DUE POLLICI: METTI DA PARTE / NON MOSTRARMELO PIU
//
// Ordine di Luca: «attiva un tasto non mostrare piu contenuto
// all'utente, perche gia visto e non si desidera rivederlo. Oppure un
// tasto preferito, da tenere in una bacheca che devi mettere nella
// sidebar. Ordinabile e con miniatura».
//
// Sono le due sole cose che si possono dire a un feed senza scrivere
// niente: una butta via, l'altra mette da parte. Senza la prima il
// giornale ripropone in eterno cio che hai gia scartato; senza la
// seconda, cio che ti interessa scorre via e non torna piu.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  giraBacheca, bachecaDi, inBacheca, spostaInBacheca, togliDaBacheca,
  nascondi, eNascosto, rimostra, senzaNascosti, TETTO_BACHECA,
} from '../app/lib/bacheca.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

const scheda = (n) => ({ url: `https://esempio.it/${n}?utm_source=x`, titolo: `Notizia ${n}`, immagine: `img${n}.jpg`, fonti: [{ fonte: 'Esempio' }] });

describe('la bacheca', () => {
  it('mette da parte, e un secondo tocco toglie', () => {
    let p = giraBacheca({}, scheda(1));
    expect(bachecaDi(p)).toHaveLength(1);
    expect(inBacheca(p, 'https://esempio.it/1')).toBe(true);
    p = giraBacheca(p, scheda(1));
    expect(bachecaDi(p)).toHaveLength(0);
  });

  it('lo stesso contenuto con i codici di tracciamento non entra due volte', () => {
    // e' la lezione di gradimento.js: ?utm_source cambia l'indirizzo ma
    // non il contenuto, e in bacheca finirebbe due volte.
    let p = giraBacheca({}, { url: 'https://esempio.it/1?utm_source=fb', titolo: 'A' });
    p = giraBacheca(p, { url: 'https://esempio.it/1?utm_campaign=news', titolo: 'A' });
    expect(bachecaDi(p)).toHaveLength(0);   // il secondo tocco l'ha tolto: e lo stesso
  });

  it('tiene la miniatura e la fonte, che e cio che si vede nella sidebar', () => {
    const p = giraBacheca({}, scheda(2));
    expect(bachecaDi(p)[0].img).toBe('img2.jpg');
    expect(bachecaDi(p)[0].fonte).toBe('Esempio');
    expect(bachecaDi(p)[0].titolo).toBe('Notizia 2');
  });

  it('e ordinabile: su, giu, e ai bordi non si sposta nel vuoto', () => {
    let p = {};
    for (const n of [1, 2, 3]) p = giraBacheca(p, scheda(n));
    // l'ultima messa da parte sta in cima
    expect(bachecaDi(p).map((v) => v.titolo)).toEqual(['Notizia 3', 'Notizia 2', 'Notizia 1']);
    const k = bachecaDi(p)[2].chiave;
    p = spostaInBacheca(p, k, 'su');
    expect(bachecaDi(p).map((v) => v.titolo)).toEqual(['Notizia 3', 'Notizia 1', 'Notizia 2']);
    const cima = bachecaDi(p)[0].chiave;
    expect(bachecaDi(spostaInBacheca(p, cima, 'su'))).toEqual(bachecaDi(p));   // dal primo posto non si sale
  });

  it('la x toglie, e il tetto non fa crescere le preferenze all infinito', () => {
    let p = {};
    for (let n = 0; n < TETTO_BACHECA + 5; n++) p = giraBacheca(p, scheda(n));
    expect(bachecaDi(p)).toHaveLength(TETTO_BACHECA);
    p = togliDaBacheca(p, bachecaDi(p)[0].chiave);
    expect(bachecaDi(p)).toHaveLength(TETTO_BACHECA - 1);
  });
});

describe('«non mostrarmelo piu»', () => {
  it('nasconde, e il mazzo che arriva dopo non lo riporta indietro', () => {
    const p = nascondi({}, 'https://esempio.it/7');
    expect(eNascosto(p, 'https://esempio.it/7?utm_source=x')).toBe(true);
    const arrivati = [{ url: 'https://esempio.it/7' }, { url: 'https://esempio.it/8' }];
    expect(senzaNascosti(arrivati, p)).toEqual([{ url: 'https://esempio.it/8' }]);
  });

  it('vale anche per i video, che non hanno un url ma un id', () => {
    const p = nascondi({}, 'youtube.com/watch?v=abc12345678');
    expect(senzaNascosti([{ id: 'abc12345678' }, { id: 'zzz99999999' }], p)).toEqual([{ id: 'zzz99999999' }]);
  });

  it('se lo nascondi, esce anche dalla bacheca', () => {
    // altrimenti resterebbe appeso in un elenco da cui non si puo piu
    // arrivare al contenuto.
    let p = giraBacheca({}, scheda(9));
    p = nascondi(p, 'https://esempio.it/9');
    expect(bachecaDi(p)).toHaveLength(0);
  });

  it('e ci si puo ripensare', () => {
    let p = nascondi({}, 'https://esempio.it/10');
    p = rimostra(p, Object.values(p.nascosti)[0]);
    expect(eNascosto(p, 'https://esempio.it/10')).toBe(false);
  });

  it('senza nascosti non si tocca niente: stessa lista, nessuna copia inutile', () => {
    const lista = [{ url: 'a' }];
    expect(senzaNascosti(lista, {})).toBe(lista);
  });
});

describe('i due tasti stanno nel feed, la bacheca nella sidebar', () => {
  const feed = leggi('components/FeedNotizieMondo.js');
  const news = leggi('components/MondoNews.js');

  it('le due porte ci sono su tutte e due le diapositive', () => {
    expect((feed.match(/chiave: 'bacheca'/g) || [])).toHaveLength(2);
    expect((feed.match(/chiave: 'basta'/g) || [])).toHaveLength(2);
  });

  it('la stella si accende quando l hai gia messo da parte', () => {
    expect(feed).toMatch(/acceso: inBacheca\(prefs,/);
    expect(feed, 'e non diventa rossa come il cuore: e d oro').toMatch(/v\.caldo \? '#ff5470' : '#ffd479'/);
  });

  it('nascondere toglie SUBITO, non al prossimo giro', () => {
    expect(news).toMatch(/setArgomenti\(\(prima\) => senzaNascosti\(prima, dopo\)\)/);
    expect(news).toMatch(/setVideo\(\(prima\) => senzaNascosti\(prima, dopo\)\)/);
  });

  it('e cio che arriva dalla rete e gia ripulito', () => {
    // b.557/558 — la ripulitura si e' allungata (finestra delle 48 ore,
    // gia visto in fondo) e `puliti` e' diventato `let`, ma il primo
    // passaggio resta questo: cio che hai detto di non voler piu vedere
    // non rientra dalla finestra.
    expect(news).toMatch(/let puliti = senzaNascosti\(arrivati, prefs\)/);
    expect(news, 'anche i video').toMatch(/senzaNascosti\(\[\.\.\.base, \.\.\.nuovi\], prefsRef\.current\)/);
  });

  it('la bacheca in sidebar ha miniatura e frecce, come chiesto', () => {
    const sez = news.slice(news.indexOf('b.552 — LA BACHECA'), news.indexOf('b.529 — le ultime ricerche'));
    expect(sez).toMatch(/L\('boardTitle'\)/);
    expect(sez, 'la miniatura vera del contenuto').toMatch(/<img src=\{v\.img\}/);
    expect(sez, 'ordinabile').toMatch(/spostaInBacheca\(prefs, v\.chiave, 'su'\)/);
    expect(sez).toMatch(/spostaInBacheca\(prefs, v\.chiave, 'giu'\)/);
    expect(sez, 'e la freccia che non serve e spenta').toMatch(/disabled=\{i === 0\}/);
  });
});

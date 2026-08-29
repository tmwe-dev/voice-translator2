// ═══════════════════════════════════════════════════════════════
// b.578 — I BUCHI CHE LA BATTERIA b.577 NON VEDEVA
//
// Queste prove non aggiungono funzioni: fissano quattro invarianti del
// motore Mondo emersi dall'audit del codice reale.
//   1. le query rapide vecchie devono arrivare allo stesso topic canonico;
//   2. una domanda esplicita deve funzionare in qualunque scrittura;
//   3. un nascosto deve uscire PRIMA della Regia, non dopo;
//   4. il ponte deve restituire le stesse istanze, non copie invisibili.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { topicDallaDomanda } from '../app/lib/mondo/queries.js';
import { pertinenza } from '../app/lib/mondo/ranker.js';
import { ordinaArticoli } from '../app/lib/mondo/ponte.js';
import { chiaveContenuto } from '../app/lib/gradimento.js';

const ORA = 3600 * 1000;
const adesso = Date.now();

function scheda(id, {
  fonte = 'ansa.it',
  pubblicato = adesso,
  seme = 'sport risultati',
  titolo = `Notizia ${id} abbastanza lunga da essere una scheda vera`,
} = {}) {
  return {
    id,
    titolo,
    sintesi: 'Una sintesi abbastanza lunga da dare al motore un contenuto reale e confrontabile.',
    url: `https://${fonte}/${id}`,
    immagine: `https://${fonte}/${id}.jpg`,
    fonti: [{ fonte, dominio: fonte }],
    pubblicato,
    seme,
    lingua: 'it',
  };
}

describe('b.578 — query e topic hanno una sola identita', () => {
  it('riconosce le scorciatoie legacy che prima perdevano il topic', () => {
    expect(topicDallaDomanda('sport')).toBe('sport');
    expect(topicDallaDomanda('sports')).toBe('sport');
    expect(topicDallaDomanda('tecnologia')).toBe('technology');
    expect(topicDallaDomanda('economy business')).toBe('economy');
    expect(topicDallaDomanda('scienza')).toBe('science');
    expect(topicDallaDomanda('art culture')).toBe('art');
    expect(topicDallaDomanda('ultime notizie')).toBe('news');
  });

  it('le domande canoniche continuano a funzionare e una libera non viene inventata', () => {
    expect(topicDallaDomanda('economia finanza mercati')).toBe('economy');
    expect(topicDallaDomanda('formula 1 f1')).toBe('formula1');
    expect(topicDallaDomanda('zuppa di ceci della nonna')).toBe('');
  });
});

describe('b.578 — la domanda esplicita e davvero mondiale', () => {
  it('legge il giapponese', () => {
    expect(pertinenza({ title: '東京で人工知能の新しい研究', summary: '' }, '人工知能')).toBeGreaterThan(0);
  });

  it('legge arabo, cirillico e coreano', () => {
    expect(pertinenza({ title: 'آخر أخبار الاقتصاد والأسواق اليوم', summary: '' }, 'الاقتصاد')).toBeGreaterThan(0);
    expect(pertinenza({ title: 'Новые события сегодня в Москве', summary: '' }, 'Москва')).toBeGreaterThan(0);
    expect(pertinenza({ title: '서울 인공지능 연구의 새로운 결과', summary: '' }, '인공지능')).toBeGreaterThan(0);
  });

  it('non rompe la pertinenza latina gia esistente', () => {
    expect(pertinenza({ title: 'Tom Cruise torna al cinema', summary: '' }, 'Tom Cruise')).toBe(1);
  });
});

describe('b.578 — prima si toglie, poi la Regia decide', () => {
  it('un nascosto non puo alterare la sequenza delle schede visibili', () => {
    const a1 = scheda('a1', { fonte: 'stessa.it', pubblicato: adesso });
    const nascosta = scheda('h', { fonte: 'stessa.it', pubblicato: adesso - 1000 });
    const a2 = scheda('a2', { fonte: 'stessa.it', pubblicato: adesso - 2000 });
    const b = scheda('b', { fonte: 'altra.it', pubblicato: adesso - 3000 });

    const prefs = { nascosti: [chiaveContenuto(nascosta.url)] };
    const fuori = ordinaArticoli([a1, nascosta, a2, b], { prefs, miaLingua: 'it', adesso });

    expect(fuori.map((x) => x.id)).toEqual(['a1', 'a2', 'b']);
  });
});

describe('b.578 — il ponte ordina, non riscrive', () => {
  it('le schede uscite sono proprio le stesse istanze entrate', () => {
    const a = scheda('a', { pubblicato: adesso });
    const b = scheda('b', { pubblicato: adesso - ORA });
    const fuori = ordinaArticoli([a, b], { prefs: {}, miaLingua: 'it', adesso });

    expect(fuori.find((x) => x.id === 'a')).toBe(a);
    expect(fuori.find((x) => x.id === 'b')).toBe(b);
    expect(a.reasons?.length).toBeGreaterThan(0);
    expect(b.reasons?.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { ordinaFeed, completezza, fascia } from '../app/lib/ordineFeed.js';

// b.366 — L'ordine di Mondo e una decisione di prodotto, non un
// dettaglio: queste prove tengono ferme le tre regole e soprattutto il
// LORO ORDINE, che e la parte che si rompe per prima quando qualcuno
// tocca il file convinto di migliorarlo.

const ORA = new Date('2026-08-21T12:00:00Z').getTime();
const fa = (ore) => new Date(ORA - ore * 3600000).toISOString();

const voce = (id, extra = {}) => ({
  id, topic: 'sport', created_at: fa(2), comment_count: 0, media: {}, ...extra,
});

describe('quanto e completa una scheda', () => {
  it('la foto pesa piu dei commenti: e quello che si vede', () => {
    expect(completezza(voce('a', { media: { thumb: 'x.jpg' } })))
      .toBeGreaterThan(completezza(voce('b', { comment_count: 50 })));
  });

  it('i commenti hanno un tetto: cinquanta non valgono piu di tre', () => {
    expect(completezza(voce('a', { comment_count: 3 })))
      .toBe(completezza(voce('b', { comment_count: 5000 })));
  });

  it('senza niente vale zero, ma esiste lo stesso', () => {
    expect(completezza(voce('a'))).toBe(0);
  });
});

describe("l'ordine del mondo", () => {
  it('a parita di fascia, chi ha la foto viene prima', () => {
    const dentro = [voce('nuda'), voce('conFoto', { media: { thumb: 'x.jpg' } })];
    expect(ordinaFeed(dentro, {}, ORA).map((x) => x.id)).toEqual(['conFoto', 'nuda']);
  });

  it('NON nasconde niente: quello che manca scende, non sparisce', () => {
    const dentro = [voce('a'), voce('b', { media: { thumb: 'x.jpg' } }), voce('c')];
    expect(ordinaFeed(dentro, {}, ORA)).toHaveLength(3);
  });

  it('la notizia di oggi batte quella di tre settimane fa anche se e nuda', () => {
    const vecchiaRicca = voce('vecchia', {
      created_at: fa(24 * 21), media: { thumb: 'x.jpg', url: 'u' }, comment_count: 99,
    });
    const freschissimaNuda = voce('fresca', { created_at: fa(1) });
    expect(ordinaFeed([vecchiaRicca, freschissimaNuda], {}, ORA).map((x) => x.id))
      .toEqual(['fresca', 'vecchia']);
  });

  it("l'interesse conta piu di tutto il resto", () => {
    const prefs = { interessi: ['economia'], argomentiVisti: {} };
    const dentro = [
      voce('sportRicca', { media: { thumb: 'x.jpg', url: 'u' }, comment_count: 40 }),
      voce('economiaNuda', { topic: 'economia' }),
    ];
    expect(ordinaFeed(dentro, prefs, ORA)[0].id).toBe('economiaNuda');
  });

  it('chi arriva stasera senza preferenze vede comunque le schede complete per prime', () => {
    const dentro = [voce('nuda'), voce('piena', { media: { thumb: 'x.jpg', url: 'u' }, comment_count: 5 })];
    // nessuna preferenza: e proprio il caso di chi si e appena iscritto
    expect(ordinaFeed(dentro, {}, ORA)[0].id).toBe('piena');
  });

  it('a parita di tutto resta l ordine di arrivo, che e la freschezza', () => {
    const dentro = [voce('primo'), voce('secondo'), voce('terzo')];
    expect(ordinaFeed(dentro, {}, ORA).map((x) => x.id)).toEqual(['primo', 'secondo', 'terzo']);
  });

  it('una data mancante non porta in cima', () => {
    expect(fascia(null, ORA)).toBe(2);
  });
});

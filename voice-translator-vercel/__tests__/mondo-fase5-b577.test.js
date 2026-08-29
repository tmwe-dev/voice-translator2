// ═══════════════════════════════════════════════════════════════
// b.577 — FASE 5: IL MOTORE NUOVO ORDINA GLI ARTICOLI
//
// Il documento (cap. 40) vuole la migrazione a pezzi, e questo e' il
// primo pezzo che si vede davvero: gli articoli del Mondo passano dal
// Ranker e dalla Regia nuovi. I video no — quella e' la FASE 6, e le
// fasi non si saltano.
//
// Le due promesse del ponte, che sono anche le due cose che possono
// rovinare una serata a chi usa l'applicazione:
//   · ESCONO LE STESSE SCHEDE CHE SONO ENTRATE. Il motore ordina, non
//     riscrive: non puo perdere una scheda per strada ne inventarne
//     una. Il confronto col vecchio (cap. 40) serve proprio a poterlo
//     DIRE con dei numeri invece di guardare due liste a occhio.
//   · SE SI ROMPE, IL GIORNALE RESTA. Qualunque cosa vada storta si
//     torna alla lista di prima. E' la lezione di oggi, pagata due
//     volte: il nero non e' uno stato.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ordinaArticoli, confronta, motivoVecchio } from '../app/lib/mondo/ponte.js';
import { MOTORE_NUOVO_ARTICOLI } from '../app/lib/mondo/rankingConfig.js';
import { topicDallaDomanda } from '../app/lib/mondo/queries.js';
import { chiaveContenuto } from '../app/lib/gradimento.js';

const oggi = Date.now();
const ORA = 3600 * 1000;

const scheda = (i, x = {}) => ({
  id: `s${i}`,
  titolo: x.titolo || `Notizia numero ${i} di questa giornata`,
  sintesi: x.sintesi || 'Una sintesi abbastanza lunga da somigliare a una vera.',
  url: x.url || `https://fonte${i}.it/articolo-${i}`,
  immagine: `https://fonte${i}.it/foto.jpg`,
  fonti: x.fonti || [{ fonte: `Fonte ${i}`, dominio: `fonte${i}.it` }],
  pubblicato: x.pubblicato ?? oggi - i * ORA,
  seme: x.seme || '',
  lingua: x.lingua || 'it',
  quandoTesto: 'poco fa',
  ...x,
});

const mazzo = (n) => Array.from({ length: n }, (_, i) => scheda(i + 1));

describe('b.577 — il ponte non perde e non inventa', () => {
  it('escono esattamente le schede che sono entrate', () => {
    const dentro = mazzo(12);
    const fuori = ordinaArticoli(dentro, { prefs: {}, miaLingua: 'it', adesso: oggi });
    expect(fuori).toHaveLength(dentro.length);
    expect(new Set(fuori.map((x) => x.id))).toEqual(new Set(dentro.map((x) => x.id)));
  });

  it('e le schede sono quelle VERE, con dentro tutto cio che la pagina disegna', () => {
    const dentro = mazzo(4);
    const fuori = ordinaArticoli(dentro, { prefs: {}, miaLingua: 'it', adesso: oggi });
    const prima = dentro.find((x) => x.id === fuori[0].id);
    for (const campo of ['titolo', 'sintesi', 'url', 'immagine', 'fonti', 'quandoTesto']) {
      expect(fuori[0][campo]).toEqual(prima[campo]);
    }
  });

  it('il confronto col vecchio si dice con i numeri, non a occhio (cap. 40)', () => {
    const dentro = mazzo(10);
    const c = confronta(dentro, ordinaArticoli(dentro, { prefs: {}, miaLingua: 'it', adesso: oggi }));
    expect(c.perse).toBe(0);
    expect(c.inventate).toBe(0);
    expect(c.quante).toBe(10);
  });

  it('ogni scheda esce sapendo dire perche la vedi, nella lingua di prima', () => {
    const fuori = ordinaArticoli(mazzo(6), { prefs: {}, miaLingua: 'it', adesso: oggi });
    for (const s of fuori) {
      expect(['perCercato', 'perSeme', 'perRamo', 'perMondo', 'perSorpresa']).toContain(s.motivo);
    }
  });

  it('se il motore si rompe, il giornale resta: il nero non e uno stato', () => {
    // prefs avvelenate: qualunque cosa succeda dentro, fuori deve
    // uscire la lista di prima
    const dentro = mazzo(5);
    const veleno = { get interessi() { throw new Error('rotto'); } };
    const fuori = ordinaArticoli(dentro, { prefs: veleno, miaLingua: 'it', adesso: oggi });
    expect(fuori).toHaveLength(5);
  });

  it('una lista di una scheda sola torna com era, senza fare giri', () => {
    const una = [scheda(1)];
    expect(ordinaArticoli(una, { prefs: {} })).toEqual(una);
    expect(ordinaArticoli([], { prefs: {} })).toEqual([]);
    expect(ordinaArticoli(null, { prefs: {} })).toEqual([]);
  });
});

describe('b.577 — e ordina come deve', () => {
  it('cio che hai chiesto sta in cima, anche se ami altro', () => {
    const dentro = [
      scheda(1, { titolo: 'Formula 1 a Monza, le prove libere', seme: 'formula 1 f1' }),
      scheda(2, { titolo: 'Tom Cruise torna al cinema a settembre', seme: 'cinema film' }),
    ];
    const fuori = ordinaArticoli(dentro, {
      prefs: { interessi: ['motori'] }, miaLingua: 'it', query: 'Tom Cruise', adesso: oggi,
    });
    expect(fuori[0].id).toBe('s2');
    expect(fuori[0].motivo).toBe('perCercato');
  });

  it('cio che hai dichiarato di seguire si riconosce e lo dice', () => {
    const dentro = [
      scheda(1, { seme: 'ricette cucina piatti' }),
      scheda(2, { seme: 'economia finanza mercati' }),
    ];
    const fuori = ordinaArticoli(dentro, { prefs: { interessi: ['economia'] }, miaLingua: 'it', adesso: oggi });
    expect(fuori[0].id).toBe('s2');
    expect(fuori[0].motivo).toBe('perSeme');
  });

  it('cio che arriva da un altra lingua si presenta come mondo', () => {
    const fuori = ordinaArticoli([
      scheda(1, { lingua: 'en', seme: 'world news' }),
      scheda(2, { lingua: 'it' }),
    ], { prefs: {}, miaLingua: 'it', adesso: oggi });
    expect(fuori.find((x) => x.id === 's1').motivo).toBe('perMondo');
  });

  it('cio che hai nascosto non torna dalla porta di servizio', () => {
    const dentro = mazzo(4);
    const prefs = { nascosti: [] };
    // si nasconde la prima, con la stessa chiave del mondo vecchio
    prefs.nascosti = [chiaveContenuto(dentro[0].url)];
    const fuori = ordinaArticoli(dentro, { prefs, miaLingua: 'it', adesso: oggi });
    expect(fuori.map((x) => x.id)).not.toContain('s1');
  });

  it('mai tre di fila della stessa fonte quando c e un alternativa', () => {
    const dentro = [
      ...Array.from({ length: 5 }, (_, i) => scheda(i + 1, { fonti: [{ fonte: 'ANSA', dominio: 'ansa.it' }], url: `https://ansa.it/${i}` })),
      ...Array.from({ length: 5 }, (_, i) => scheda(i + 10, { fonti: [{ fonte: 'Post', dominio: 'ilpost.it' }], url: `https://ilpost.it/${i}` })),
    ];
    const fuori = ordinaArticoli(dentro, { prefs: {}, miaLingua: 'it', adesso: oggi });
    let piuLunga = 1; let corrente = 1;
    for (let i = 1; i < fuori.length; i += 1) {
      const a = fuori[i].fonti?.[0]?.dominio;
      const b = fuori[i - 1].fonti?.[0]?.dominio;
      corrente = a === b ? corrente + 1 : 1;
      piuLunga = Math.max(piuLunga, corrente);
    }
    expect(piuLunga).toBeLessThanOrEqual(3);
  });
});

describe('b.577 — la strada a ritroso e esatta o tace', () => {
  it('dal seme si risale al topic, senza indovinare', () => {
    expect(topicDallaDomanda('formula 1 f1')).toBe('formula1');
    expect(topicDallaDomanda('economia finanza mercati')).toBe('economy');
  });

  it('una domanda che non e nostra non produce un topic inventato', () => {
    expect(topicDallaDomanda('zuppa di ceci della nonna')).toBe('');
  });
});

describe('b.577 — il Mondo e collegato davvero', () => {
  const news = readFileSync(join(process.cwd(), 'app/components/MondoNews.js'), 'utf8');

  it('gli articoli passano dal ponte', () => {
    expect(news).toMatch(/import \{ ordinaArticoli \} from '\.\.\/lib\/mondo\/ponte\.js'/);
    expect(news).toMatch(/if \(MOTORE_NUOVO_ARTICOLI\)/);
    expect(news).toMatch(/return ordinaArticoli\(puliti, opz\)/);
  });

  it('i video no: e la FASE 6, e le fasi non si saltano', () => {
    expect(news).toMatch(/componi\(\[\], puliti\.map\(\(v\) => \(\{ \.\.\.v/);
  });

  it('tornare indietro costa una riga sola', () => {
    expect(MOTORE_NUOVO_ARTICOLI).toBe(true);
    const cfg = readFileSync(join(process.cwd(), 'app/lib/mondo/rankingConfig.js'), 'utf8');
    expect(cfg).toMatch(/export const MOTORE_NUOVO_ARTICOLI = true;/);
  });

  it('e la testa non si tocca mai quando si accoda (regola di b.552)', () => {
    expect(news).toMatch(/return \[\.\.\.\(prima \|\| \[\]\), \.\.\.ordinaArticoli\(nuovi, opz\)\]/);
  });
});

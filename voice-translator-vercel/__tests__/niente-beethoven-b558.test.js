// ═══════════════════════════════════════════════════════════════
// b.558 — «OGNI VOLTA CHE ENTRO VEDO BEETHOVEN»
//
// Collaudo di Luca: «quando rientro nel sistema mi riproponi in serie
// video. Non devi. Altrimenti ogni volta che entro vedo Beethoven».
//
// LA CAUSA. La memoria dei contenuti gia mostrati viveva DENTRO la
// pagina (`vistiRef`): dentro una sessione funzionava, ma ricaricando
// l'applicazione rinasceva vuota. Stessa ricerca d'ingresso, stessa
// risposta del motore, stesso ordine: Beethoven ogni volta. Non era il
// motore a sbagliare — eravamo noi a chiedergli sempre la stessa cosa
// e a non ricordarci di averla gia ricevuta.
//
// LA DIFFERENZA CON «NON MOSTRARE PIU», che e' la parte da non
// confondere mai:
//   · «non mostrare piu» e' una decisione, vale per sempre, fa sparire;
//   · «gia visto» e' un fatto, dura una settimana, e manda solo in
//     fondo. Fra sette giorni quel video puo tornare, ed e' giusto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ripulisci, primaIlNuovo, chiaveDi, VITA_VISTO, TETTO_VISTI } from '../app/lib/visti.js';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const ADESSO = Date.UTC(2026, 7, 28, 12, 0, 0);
const giorniFa = (n) => ADESSO - n * 24 * 3600 * 1000;

describe('la memoria del gia visto', () => {
  it('dura una settimana, poi il contenuto puo tornare', () => {
    expect(VITA_VISTO).toBe(7 * 24 * 3600 * 1000);
    const dopo = ripulisci({ ieri: giorniFa(1), vecchio: giorniFa(9) }, ADESSO);
    expect(Object.keys(dopo)).toEqual(['ieri']);
  });

  it('non cresce all infinito: oltre il tetto escono i piu vecchi', () => {
    const tanti = {};
    for (let i = 0; i < TETTO_VISTI + 50; i++) tanti[`k${i}`] = ADESSO - i * 1000;
    expect(Object.keys(ripulisci(tanti, ADESSO))).toHaveLength(TETTO_VISTI);
    expect(ripulisci(tanti, ADESSO).k0, 'il piu recente resta').toBeTruthy();
  });

  it('video e articoli hanno la stessa chiave del resto del sistema', () => {
    expect(chiaveDi({ id: 'abcdefghijk' })).toBe(chiaveDi({ url: 'youtube.com/watch?v=abcdefghijk' }));
    // e i codici di tracciamento non fanno di un articolo due articoli
    expect(chiaveDi({ url: 'https://a.it/1?utm_source=x' })).toBe(chiaveDi({ url: 'https://a.it/1' }));
  });
});

describe('in fondo, non fuori', () => {
  const lista = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
  it('il gia visto scivola in coda e il resto tiene il suo ordine', () => {
    const fuori = primaIlNuovo(lista, new Set([chiaveDi({ url: 'a' })]));
    expect(fuori.map((x) => x.url)).toEqual(['b', 'c', 'a']);
  });

  it('se hai visto tutto, rivedi tutto: una pagina vuota e peggio', () => {
    const tutti = new Set(lista.map(chiaveDi));
    expect(primaIlNuovo(lista, tutti).map((x) => x.url)).toEqual(['a', 'b', 'c']);
  });

  it('senza memoria non si tocca niente', () => {
    expect(primaIlNuovo(lista, new Set())).toBe(lista);
  });
});

describe('dove si annota e dove si usa', () => {
  it('si annota la diapositiva ATTIVA, e solo dopo due secondi', () => {
    // scorrere veloce oltre qualcosa non e' averlo visto.
    const f = leggi('app/components/FeedNotizieMondo.js');
    expect(f).toMatch(/const t = setTimeout\(\(\) => segnaVisto\(el\.dati\), 2000\)/);
    expect(f).toMatch(/const el = elementi\[indiceAttivo\];/);
    expect(f, 'e non si annota cio che non e ancora a schermo').toMatch(/if \(!aperto \|\| !pronto\) return undefined;/);
  });

  it('il giornale mette in fondo il gia visto, articoli e video', () => {
    const n = leggi('app/components/MondoNews.js');
    expect(n).toMatch(/puliti = primaIlNuovo\(puliti, vistiDiRecente\(\)\)/);
    // b.568 — anche i video passano dalla regia adesso: il gia visto
    // scende in fondo PRIMA di comporre, non dopo.
    expect(n).toMatch(/const puliti = primaIlNuovo\(senzaNascosti\(\[\.\.\.base, \.\.\.nuovi\], prefsRef\.current\), vistiDiRecente\(\)\)/);
  });

  it('e resta una cosa DIVERSA dal «non mostrare piu»', () => {
    const v = leggi('app/lib/visti.js');
    expect(v, 'il gia visto non cancella niente').not.toMatch(/nascosti/);
    const b = leggi('app/lib/bacheca.js');
    expect(b, 'e il nascosto non ha scadenza').not.toMatch(/VITA_VISTO/);
  });
});

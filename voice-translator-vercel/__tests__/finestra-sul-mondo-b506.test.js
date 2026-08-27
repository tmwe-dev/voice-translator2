import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.506 — LA FINESTRA SUL MONDO (progettata con Luca) ═══
// Il pianeta gira e, al ritmo scelto (mai/2/5/10 minuti), cerca le
// ultime notizie: le nuove compaiono come un cartello con bandiera,
// miniatura e titolo tradotto; toccato si apre a tutto schermo con la
// strada per la fonte; chiuso, il mondo continua a girare.

const fin = readFileSync(join(process.cwd(), 'app/components/FinestraSulMondo.js'), 'utf8');
const pref = readFileSync(join(process.cwd(), 'app/components/ui/PreferenzeMondo.js'), 'utf8');
const mondo = readFileSync(join(process.cwd(), 'app/components/MondoView.js'), 'utf8');

describe('la finestra sul mondo', () => {
  it('il ritmo e una preferenza — e il predefinito dichiarato e quello vero', () => {
    // b.506 nasceva con «mai» (niente spesa non chiesta). Poi il prodotto
    // ha scelto il giornale del viaggiatore: senza preferenza il pianeta
    // si muove piano (5 minuti) — ma questa prova era rimasta alla
    // fotografia del primo giorno ed era ROSSA DA PRIMA di b.535 (bug
    // pre-esistente del registro prove, dichiarato). In piu il pannello
    // dichiarava «mai» come predefinito mentre FinestraSulMondo usava
    // '5': il pannello mentiva. b.535 allinea il pannello al vero e la
    // prova alla regola: predefinito unico '5', «mai» resta una scelta.
    expect(pref).toMatch(/chiave: 'mondoRitmo'/);
    expect(pref).toMatch(/predefinito: '5'/);
    expect(fin).toMatch(/prefs\?\.mondoRitmo \|\| '5'/);
    expect(pref).toMatch(/valore: 'mai'/); // la scelta di fermarlo resta
  });

  it('si ferma quando la pagina e nascosta', () => {
    expect(fin).toMatch(/visibilitychange/);
    expect(fin).toMatch(/document\.hidden/);
  });

  it('cerca dalla cache condivisa; fresca solo con l\'ultimo minuto', () => {
    expect(fin).toMatch(/fresca: ritmo === '2'/);
  });

  it('vere o niente: nessun errore in faccia, nessun cartello inventato', () => {
    expect(fin).toMatch(/catch \{[\s\S]{0,120}vere o niente/);
  });

  it('il cartello si chiude o si apre a tutto schermo, e la scheda porta alla fonte', () => {
    expect(fin).toMatch(/setAperta\(cartello\)/);
    expect(fin).toMatch(/schedaLeggiSu/);
  });

  it('vive nel Mondo come fratello del globo (fuori dalla gabbia b.505)', () => {
    expect(mondo).toMatch(/<FinestraSulMondo/);
  });

  it('le chiavi nuove esistono in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      for (const k of ['prefRhythmTitle', 'rhythmNever', 'minShort', 'breakingWord']) {
        expect(s.includes(`"${k}":"`), `${f}/${k}`).toBe(true);
      }
    }
  });
});

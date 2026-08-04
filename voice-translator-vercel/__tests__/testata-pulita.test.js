// ═══════════════════════════════════════════════════════════════
// GUARDIA SULLA TESTATA — l'errore di idratazione #418
//
// Gli stessi 14 meta erano dichiarati DUE volte: dall'oggetto `metadata`
// (che Next inserisce da solo) e a mano dentro <head>. React 19 sposta
// meta, link e title nella testata per conto suo, e il doppio elenco
// arrivava in ordine diverso fra server e browser: hydration mismatch a
// ogni avvio, con tutto l'albero ridisegnato da capo.
//
// Regola: i meta stanno solo in `metadata`/`viewport`.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const layout = fs.readFileSync(path.join(__dirname, '..', 'app', 'layout.js'), 'utf8');
// Solo il corpo del componente, non l'oggetto metadata.
const corpo = layout.slice(layout.indexOf('export default function RootLayout'));

describe('testata del documento', () => {
  it('nessun <meta> scritto a mano nel head', () => {
    const aMano = [...corpo.matchAll(/<meta\s+(?:name|property)="([^"]+)"/g)].map(m => m[1]);
    expect(aMano, `Spostali nell'oggetto metadata:\n  ${aMano.join('\n  ')}`).toEqual([]);
  });

  it('nessun <title> scritto a mano nel head', () => {
    expect(corpo).not.toMatch(/<title>/);
  });

  it('nessun <link rel="icon"> o "manifest" a mano: sono in metadata.icons', () => {
    const iconeAMano = [...corpo.matchAll(/<link\s+rel="(icon|apple-touch-icon|manifest)"/g)].map(m => m[1]);
    expect(iconeAMano, `Usa metadata.icons:\n  ${iconeAMano.join('\n  ')}`).toEqual([]);
  });

  it('i colori della barra di sistema stanno in viewport.themeColor', () => {
    expect(layout).toMatch(/themeColor:\s*\[/);
    expect(corpo).not.toMatch(/name="theme-color"/);
  });

  it('i dati strutturati non annunciano un piano gratuito inesistente', () => {
    expect(layout).not.toMatch(/Free tier/i);
    expect(layout).toMatch(/Ricariche prepagate/);
  });

  it('la descrizione non mente sul numero di lingue', () => {
    expect(layout, 'diceva "15+ languages"').not.toMatch(/15\+/);
    expect(layout, 'usa LANGS.length').toMatch(/LANGS\.length/);
  });
});

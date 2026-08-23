// b.433 — il layout portato nel programma, seconda e terza pagina.
// Si applica dove RIPARA qualcosa, non si restaura cio che funziona.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
// trappola numero 6: i commenti si tolgono PRIMA di guardare il codice.
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Mondo — due linguette al posto della tendina', () => {
  it('si vedono tutte e due, e si cambia con un tocco', () => {
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    expect(v, 'sono linguette dichiarate come tali').toMatch(/role="tablist"/);
    expect(v, 'e ognuna dice se e accesa').toMatch(/role="tab" aria-selected=\{acceso\}/);
    expect(v, 'la tendina Stanze/Notizie non c\'e piu').not.toMatch(/valore=\{tab\}/);
  });

  it('la linguetta e alta 44, come ogni altro tasto', () => {
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    const blocco = v.slice(v.indexOf('role="tablist"'), v.indexOf('role="tablist"') + 1400);
    expect(blocco).toMatch(/height: 44/);
  });

  it("l'icona accanto alla parola non e sparita", () => {
    // b.400: Luca l'aveva gia persa una volta in questo punto.
    const v = senzaCommenti(leggi('app/components/MondoView.js'));
    const blocco = v.slice(v.indexOf('role="tablist"'), v.indexOf('role="tablist"') + 1400);
    expect(blocco).toMatch(/<Icon name=\{v\.icona\}/);
  });
});

describe("Chat — da che lingua a che lingua", () => {
  it("le lingue non vengono piu buttate quando si scrive la riga d'archivio", () => {
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s).toMatch(/lingue: \[\.\.\.new Set\(conv\.members\.map\(m => m\.lang\)\.filter\(Boolean\)\)\]/);
  });

  it('si AGGIUNGE un campo, non si cambia quello che c\'era', () => {
    // le righe scritte prima di oggi devono restare leggibili.
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s, "i nomi restano dov'erano").toMatch(/members: conv\.members\.map\(m => m\.name\)/);
  });

  it("l'archivio mostra le lingue, e per le righe vecchie ripiega su quella sola", () => {
    const h = senzaCommenti(leggi('app/components/HistoryView.js'));
    expect(h, 'le nuove').toMatch(/Array\.isArray\(c\.lingue\) && c\.lingue\.length > 0/);
    expect(h, 'le vecchie, che ne hanno una sola').toMatch(/\) : c\.lang \? \(/);
    expect(h, 'e se non ce ne sono, niente invece di un riquadro vuoto').toMatch(/\) : null\}/);
  });

  it('non si inventano bandiere che non ci sono', () => {
    const s = senzaCommenti(leggi('app/lib/store.js'));
    expect(s, 'le lingue vuote si scartano').toMatch(/\.filter\(Boolean\)/);
  });
});

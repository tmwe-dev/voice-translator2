// ═══════════════════════════════════════════════════════════════
// «U.find is not a function» — b.485
//
// Trovato da Luca sul telefono: la pagina intera sostituita dalla scritta
// di errore. E' la SECONDA volta: lo stesso schianto era gia stato chiuso
// in b.426.
//
// E qui c'e la cosa che fa piu male, ed e mia. Il diario di b.426 dichiara
// una prova di guardia — `__tests__/membri-non-elenco-b426.test.js` — che
// NON E' MAI ESISTITA: cercata in tutta la storia del deposito, non c'e in
// nessun commit. Ho scritto di aver messo una guardia e non l'ho messa, e
// senza guardia il difetto e tornato dentro in silenzio. Questa prova
// esiste davvero: si puo cancellare questo file e vederla sparire.
//
// LA CAUSA, che vale piu del difetto: `roomInfo?.members?.find(...)`
// protegge dal MANCANTE, non dal NON-ELENCO. Il punto interrogativo salta
// solo `null` e `undefined`. Se `members` torna un OGGETTO — e la lettura
// pubblica di una stanza non restituisce i membri apposta, dice solo
// quanti sono — allora `?.` non salta niente, si chiama `.find` su un
// oggetto, e la schermata muore.
//
// L'aiutante giusto esiste dal b.387: `membriDi()` in app/lib/membri.js,
// che fa `Array.isArray(m) ? m : []` e non lancia mai.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { membriDi, quantiDentro } from '../app/lib/membri.js';

const APP = path.join(__dirname, '..', 'app');

function fileConCodice(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) fileConCodice(p, trovati);
    else if (/\.jsx?$/.test(voce.name)) trovati.push(p);
  }
  return trovati;
}

// un difetto CITATO in un commento non e quel difetto (trappola numero 6)
function senzaCommenti(testo) {
  return testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('l\'aiutante regge qualunque cosa gli arrivi', () => {
  it('un members che non e un elenco diventa un elenco vuoto', () => {
    for (const finto of [undefined, null, {}, { 0: 'a' }, 'due', 42, true, NaN]) {
      expect(() => membriDi({ members: finto })).not.toThrow();
      expect(Array.isArray(membriDi({ members: finto })), String(finto)).toBe(true);
    }
    expect(membriDi(undefined)).toEqual([]);
    expect(membriDi({})).toEqual([]);
  });

  it('e un elenco vero passa intatto', () => {
    const veri = [{ name: 'Luca' }, { name: 'Ana' }];
    expect(membriDi({ members: veri })).toBe(veri);
  });

  it('e si puo sempre chiamarci find, come fa la schermata che schiantava', () => {
    expect(() => membriDi({ members: { a: 1 } }).find((m) => m.name === 'Luca')).not.toThrow();
    expect(membriDi({ members: { a: 1 } }).find((m) => m.name === 'Luca')).toBeUndefined();
  });

  it('quantiDentro non lancia nemmeno lui', () => {
    for (const finto of [undefined, null, {}, 'due', 42]) {
      expect(() => quantiDentro({ members: finto })).not.toThrow();
    }
  });
});

describe('nessuna schermata tocca i membri a mano', () => {
  it('non esiste piu un .find su members che non passi dall\'aiutante', () => {
    // Si guardano le SUPERFICI (components, hooks): sono quelle che, se
    // schiantano, portano via la pagina intera. Il codice di server ha i
    // suoi dati e li conosce.
    const colpevoli = [];
    for (const cartella of ['components', 'hooks']) {
      const dir = path.join(APP, cartella);
      if (!fs.existsSync(dir)) continue;
      for (const f of fileConCodice(dir)) {
        const codice = senzaCommenti(fs.readFileSync(f, 'utf8'));
        for (const m of codice.matchAll(/\.members\s*\??\.\s*(find|some|map|filter|forEach|reduce|slice|length)/g)) {
          colpevoli.push(`${path.relative(APP, f)} → .members?.${m[1]}`);
        }
      }
    }
    expect(colpevoli,
      'Il punto interrogativo NON protegge da un members che non e un elenco:\n'
      + 'salta solo null e undefined. Usa membriDi(stanza) da app/lib/membri.js.\n  '
      + colpevoli.join('\n  ')).toEqual([]);
  });

  it('e c\'e davvero qualcuno che usa l\'aiutante, se no la prova non prova niente', () => {
    const usi = fileConCodice(path.join(APP, 'components'))
      .concat(fileConCodice(path.join(APP, 'hooks')))
      .filter((f) => /membriDi\s*\(/.test(senzaCommenti(fs.readFileSync(f, 'utf8'))));
    expect(usi.length, 'nessuno chiama membriDi: la guardia sopra e vuota').toBeGreaterThan(4);
  });
});

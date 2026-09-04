import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as addebita from '../app/wallet/addebita.js';

// b.627 — UN SOLO MODO DI FAR PAGARE.
//
// Il vecchio giro (addebito DOPO il fornitore) e stato sostituito dal
// nuovo (riserva PRIMA, poi commit o release) nelle b.161, b.161-bis e
// b.164, perche l'addebito dopo lasciava aperta una finestra di corsa.
// Le sei funzioni vecchie erano rimaste esportate, morte ma importabili:
// bastava chiamarne una per saltare la riserva senza accorgersene.
//
// Questa prova vede l'assenza: se una di quelle sei torna, diventa rossa.

const MORTE = [
  'addebitaVoce',
  'addebitaVocePremium',
  'addebitaTesto',
  'addebitaAzioneChat',
  'addebitaClonazione',
  'creditoInsufficientePerClonazione',
];

const VIVE = [
  'creditoFinito',
  'creditoInsufficiente',
  'preventivoTesto',
  'preventivoVocePremium',
  'addebitaRiassunto',
];

const sorgente = () => fs.readFileSync(
  path.join(process.cwd(), 'app/wallet/addebita.js'), 'utf8',
);

describe('b.627 — il vecchio modo di far pagare non esiste piu', () => {
  it('nessuna delle sei funzioni vecchie e ancora esportata', () => {
    for (const nome of MORTE) {
      expect(addebita[nome], `${nome} non deve piu esistere`).toBeUndefined();
    }
  });

  it('e non sono nemmeno piu definite nel file', () => {
    const src = sorgente().replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const nome of MORTE) {
      expect(src).not.toMatch(new RegExp(`function\\s+${nome}\\b`));
    }
  });

  it('le funzioni che il giro nuovo usa davvero sono tutte al loro posto', () => {
    for (const nome of VIVE) {
      expect(typeof addebita[nome], `${nome} deve restare`).toBe('function');
    }
  });

  it('nessuna rotta importa una funzione tolta', () => {
    const radice = path.join(process.cwd(), 'app');
    const file = [];
    (function cammina(dir) {
      for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, voce.name);
        if (voce.isDirectory()) cammina(p);
        else if (/\.jsx?$/.test(voce.name)) file.push(p);
      }
    })(radice);

    for (const f of file) {
      const testo = fs.readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const nome of MORTE) {
        expect(testo, `${path.relative(process.cwd(), f)} usa ${nome}`)
          .not.toMatch(new RegExp(`\\b${nome}\\s*\\(`));
      }
    }
  });
});

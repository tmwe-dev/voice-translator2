// ═══════════════════════════════════════════════════════════════
// NESSUNO SI SIEDE SOPRA UN ALTRO — b.478
//
// Collaudo di Luca: «fulmine e luna sono sovrapposti, affiancali in alto a
// destra».
//
// Il righello (app/lib/righello.js) esiste PROPRIO per evitarlo: da una
// fila in alto a destra dove ogni elemento chiede il suo posto, e ogni
// posto si sposta di un passo a sinistra dal precedente. Ma due file
// diversi — la pila in page.js e la luna in GloboMondo.js — avevano
// chiesto tutti e due il posto ZERO, senza sapere l'uno dell'altro. Il
// righello non puo accorgersene da solo: nessuno guarda tutti i chiamanti
// insieme.
//
// Questa prova li guarda insieme. Se due componenti chiedono lo stesso
// posto, diventa rossa — prima che a vederlo sia Luca sul telefono.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

function fileConCodice(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) fileConCodice(p, trovati);
    else if (/\.jsx?$/.test(voce.name)) trovati.push(p);
  }
  return trovati;
}

describe('la fila in alto a destra non ha due inquilini nello stesso posto', () => {
  it('ogni posto e chiesto da un file solo', () => {
    const occupanti = new Map();   // posto -> [file]
    for (const f of fileConCodice(APP)) {
      if (f.endsWith(path.join('lib', 'righello.js'))) continue;   // e lui che li definisce
      const testo = fs.readFileSync(f, 'utf8');
      // si saltano i commenti: un posto CITATO non e un posto occupato
      const codice = testo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of codice.matchAll(/postoADestra\((\d+)\)/g)) {
        const posto = m[1];
        const chi = path.relative(APP, f);
        const gia = occupanti.get(posto) || [];
        if (!gia.includes(chi)) gia.push(chi);
        occupanti.set(posto, gia);
      }
    }
    const doppi = [...occupanti.entries()]
      .filter(([, chi]) => chi.length > 1)
      .map(([posto, chi]) => `posto ${posto}: ${chi.join(' e ')}`);
    expect(doppi,
      `Due componenti chiedono lo stesso posto nella fila a destra, e si\n`
      + `disegnano uno sopra l'altro. Dai a uno dei due il posto successivo:\n  `
      + doppi.join('\n  ')
    ).toEqual([]);
  });

  it('e c\'e almeno qualcuno che la usa, se no la prova non prova niente', () => {
    const usi = fileConCodice(APP)
      .filter((f) => /postoADestra\(\d+\)/.test(fs.readFileSync(f, 'utf8')));
    expect(usi.length).toBeGreaterThan(1);
  });
});

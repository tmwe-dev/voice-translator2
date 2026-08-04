// ═══════════════════════════════════════════════════════════════
// GUARDIA CONTRO I FILE ORFANI
//
// Nato da un audit vero: 1.851 righe in 13 file che nessuno importava,
// fra cui il REGALO CREDITI — una funzione scritta per intero e mai
// raggiungibile da nessun pulsante.
//
// Questo test costruisce il grafo degli import (compresi quelli
// dinamici) e fallisce se un file di app/ non è raggiungibile.
// Se un file serve davvero, collegalo. Se non serve, mettilo in
// app/attic/ — che è escluso da questo controllo.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

function tuttiIFile(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'attic' || voce.name === 'node_modules') continue;
      tuttiIFile(p, trovati);
    } else if (voce.name.endsWith('.js')) {
      trovati.push(p);
    }
  }
  return trovati;
}

// Next.js entra da questi file: non hanno bisogno di essere importati.
const INGRESSI = /(^|\/)(page|layout|route|not-found|error|global-error|loading|template|default|sitemap|robots|opengraph-image|icon|manifest)\.js$/;

describe('nessun file orfano in app/', () => {
  it('ogni file è raggiungibile da un ingresso di Next', () => {
    const file = tuttiIFile(APP);
    const importati = new Set();

    for (const f of file) {
      const src = fs.readFileSync(f, 'utf8');
      const riferimenti = [
        ...src.matchAll(/from\s+['"](\.[^'"]+)['"]/g),
        ...src.matchAll(/import\(\s*['"](\.[^'"]+)['"]/g),
        ...src.matchAll(/require\(\s*['"](\.[^'"]+)['"]/g),
      ];
      for (const r of riferimenti) {
        const base = path.resolve(path.dirname(f), r[1]);
        importati.add(base);
        importati.add(base + '.js');
        importati.add(path.join(base, 'index.js'));
      }
    }

    const orfani = file
      .filter(f => !importati.has(path.resolve(f)) && !INGRESSI.test(f))
      .map(f => path.relative(APP, f));

    expect(orfani, `File mai importati (collegali oppure spostali in app/attic/):\n  ${orfani.join('\n  ')}`).toEqual([]);
  });
});

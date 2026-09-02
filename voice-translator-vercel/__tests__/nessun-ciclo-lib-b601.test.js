import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// Un piccolo madge di casa: import statici E pigri (`import('...')`),
// solo percorsi relativi dentro app/. Niente dipendenze nuove nel
// package.json per una prova.
function tuttiIFile(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') tuttiIFile(p, acc); }
    else if (/\.(js|jsx)$/.test(n)) acc.push(p);
  }
  return acc;
}
function risolvi(da, spec) {
  const base = resolve(dirname(da), spec);
  for (const c of [base, base + '.js', base + '.jsx', join(base, 'index.js')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}
function grafoImport(radice) {
  const archi = new Map();
  for (const f of tuttiIFile(radice)) {
    // i commenti raccontano import che non esistono: si tolgono prima
    const src = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    const dest = new Set();
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"](\.[^'"]+)['"]/g)) {
      const r = risolvi(f, m[1]); if (r) dest.add(r);
    }
    for (const m of src.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const r = risolvi(f, m[1]); if (r) dest.add(r);
    }
    archi.set(f, [...dest]);
  }
  return archi;
}
function cicli(archi) {
  const trovati = [];
  const stato = new Map();   // 0 in corso, 1 finito
  const pila = [];
  const visita = (n) => {
    stato.set(n, 0); pila.push(n);
    for (const v of archi.get(n) || []) {
      if (!stato.has(v)) visita(v);
      else if (stato.get(v) === 0) {
        const i = pila.indexOf(v);
        if (i >= 0) trovati.push(pila.slice(i).concat(v));
      }
    }
    pila.pop(); stato.set(n, 1);
  };
  for (const n of archi.keys()) if (!stato.has(n)) visita(n);
  return trovati;
}

// b.601 — Modulo B2 dell'audit di architettura (b.598): madge trovava 4
// cicli in lib/, tutti tenuti insieme da `await import(...)` e da un
// commento falso. Questa prova chiede a madge, non al testo, che restino
// zero: se qualcuno riapre un ciclo con un import pigro, qui si vede.

describe('b.601 — l\'albero delle dipendenze di app/ non ha cicli', () => {
  it('nessun ciclo fra import statici e pigri (madge di casa)', () => {
    const radice = join(process.cwd(), 'app');
    const archi = grafoImport(radice);
    expect(archi.size).toBeGreaterThan(400);   // il grafo e' stato letto davvero
    const trovati = cicli(archi).map(c => c.map(f => relative(radice, f)));
    expect(trovati, `cicli trovati:\n${trovati.map(c => '  ' + c.join(' > ')).join('\n')}`).toEqual([]);
  }, 60000);

  it('decisioni.js e\' una foglia: nessun import, nemmeno pigro', () => {
    const s = leggi('app/lib/decisioni.js');
    expect(s).not.toMatch(/^import /m);
    expect(s).not.toMatch(/await import\(/);
  });

  it('blocchi.js e\' la foglia che store e moderazione condividono', () => {
    const b = leggi('app/lib/blocchi.js');
    expect(b).toMatch(/^import \{ redis \} from '\.\/redis\.js';/m);
    expect(b).toMatch(/^import \{ normalizzaNome \} from '\.\/decisioni\.js';/m);
    expect(b).toMatch(/export async function eBloccato/);
    expect(leggi('app/lib/store.js')).toMatch(/^import \{ eBloccato \} from '\.\/blocchi\.js';/m);
    expect(leggi('app/lib/store.js')).not.toMatch(/import\('\.\/moderazione\.js'\)/);
    const m = leggi('app/lib/moderazione.js');
    expect(m).toMatch(/^import \{ removeMember \} from '\.\/store\.js';/m);
    expect(m).not.toMatch(/import\('\.\/store\.js'\)/);
    expect(m).toMatch(/^export \{ eBloccato \};/m);
  });

  it('sessionGuard tiene lo store pigro per il bundle del client, non per un ciclo', () => {
    const g = leggi('app/lib/sessionGuard.js').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    expect(g).toMatch(/export async function modalitaAutorevole/);
    expect(g).toMatch(/await import\('\.\/store\.js'\)/);
    expect(g).not.toMatch(/^import .*store\.js/m);
    expect(g).not.toMatch(/BLOCKED_IN_DIRECT/);
  });
});

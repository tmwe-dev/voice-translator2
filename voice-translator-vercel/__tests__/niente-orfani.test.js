// ═══════════════════════════════════════════════════════════════
// GUARDIA CONTRO I FILE ORFANI
//
// Nato da un audit vero: 1.851 righe in 13 file che nessuno importava,
// fra cui il REGALO CREDITI — una funzione scritta per intero e mai
// raggiungibile da nessun pulsante.
//
// b.583 — la prima versione della guardia aveva un buco strutturale:
// verificava soltanto che QUALCUNO importasse il file. Due file morti che
// si importavano a vicenda risultavano entrambi vivi. Ora si parte dagli
// ingressi reali di Next e si percorre il grafo: vivo significa davvero
// raggiungibile dal prodotto, non semplicemente nominato da un altro file.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');
const ESTENSIONI = ['.js', '.jsx', '.mjs'];

function tuttiIFile(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules') continue;
      tuttiIFile(p, trovati);
    } else if (ESTENSIONI.some((e) => voce.name.endsWith(e))) {
      trovati.push(path.resolve(p));
    }
  }
  return trovati;
}

// Next.js entra da questi file: sono le radici del grafo, non hanno bisogno
// di essere importati da un altro modulo applicativo.
const INGRESSI = /(^|\/)(page|layout|route|not-found|error|global-error|loading|template|default|sitemap|robots|opengraph-image|icon|manifest)\.(?:js|jsx|mjs)$/;

function riferimenti(src) {
  return [
    ...src.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...src.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g),
  ].map((m) => m[1]);
}

function risolviLocale(importatore, spec, insieme) {
  if (!spec?.startsWith('.')) return null;
  const base = path.resolve(path.dirname(importatore), spec);
  const candidati = [
    base,
    ...ESTENSIONI.map((e) => base + e),
    ...ESTENSIONI.map((e) => path.join(base, 'index' + e)),
  ];
  return candidati.find((p) => insieme.has(path.resolve(p))) || null;
}

describe('nessun file orfano in app/', () => {
  it('ogni file è raggiungibile da un ingresso di Next', () => {
    const file = tuttiIFile(APP);
    const insieme = new Set(file);
    const grafo = new Map();

    for (const f of file) {
      const src = fs.readFileSync(f, 'utf8');
      const vicini = riferimenti(src)
        .map((spec) => risolviLocale(f, spec, insieme))
        .filter(Boolean);
      grafo.set(f, [...new Set(vicini)]);
    }

    const ingressi = file.filter((f) => INGRESSI.test(f));
    const raggiunti = new Set(ingressi);
    const coda = [...ingressi];
    while (coda.length) {
      const corrente = coda.shift();
      for (const prossimo of grafo.get(corrente) || []) {
        if (raggiunti.has(prossimo)) continue;
        raggiunti.add(prossimo);
        coda.push(prossimo);
      }
    }

    // ── Le LAPIDI non sono codice orfano ──
    // Il criterio resta stretto: la frase esatta e nessuna riga eseguibile.
    const eLapide = (f) => {
      const src = fs.readFileSync(f, 'utf8');
      if (!src.includes('LAPIDE — questo file va CANCELLATO')) return false;
      const codice = src.split('\n')
        .filter((r) => r.trim() && !r.trim().startsWith('//') && !r.trim().startsWith('*'));
      return codice.length === 0;
    };

    // ── Un CANTIERE e ammesso solo se dichiara la fase ed e provato ──
    const TEST = path.join(__dirname);
    const provati = new Set();
    for (const nome of fs.readdirSync(TEST).filter((x) => /\.test\.(?:js|jsx|mjs)$/.test(x))) {
      const t = path.join(TEST, nome);
      const src = fs.readFileSync(t, 'utf8');
      for (const spec of riferimenti(src)) {
        if (!spec.startsWith('.')) continue;
        const base = path.resolve(path.dirname(t), spec);
        for (const candidato of [base, ...ESTENSIONI.map((e) => base + e)]) {
          if (insieme.has(path.resolve(candidato))) provati.add(path.resolve(candidato));
        }
      }
    }
    const eCantiere = (f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /CANTIERE — collegato alla FASE \d+/.test(src) && provati.has(f);
    };

    const orfani = file
      .filter((f) => !raggiunti.has(f) && !eLapide(f) && !eCantiere(f))
      .map((f) => path.relative(APP, f))
      .sort();

    expect(
      orfani,
      `File non raggiungibili da nessun ingresso Next. Collegali, oppure cancellali:\n  ${orfani.join('\n  ')}`,
    ).toEqual([]);
  });
});

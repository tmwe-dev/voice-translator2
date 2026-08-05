// ═══════════════════════════════════════════════════════════════
// GUARDIA: UN HOOK NON PUO PROMETTERE COSE CHE NON HA
//
// Nata da un guasto vero, trovato solo aprendo le pagine una per una:
// useVoiceRecorder elencava `cleanup` fra le cose che restituisce, ma
// quella funzione non era MAI stata scritta. JavaScript cercava un nome
// inesistente e lanciava ReferenceError, quindi la pagina "La tua voce
// clonata" moriva sempre, all'apertura, con "Qualcosa e andato storto".
//
// Da fermo il file sembrava a posto: la riga incriminata e una parola
// sola in mezzo a quindici uguali. Il lint non se ne accorge, i test
// nemmeno, perche nessuno montava quel componente.
//
// Questo test legge ogni hook, prende i nomi che promette di
// restituire, e verifica che ciascuno esista davvero nel file.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const HOOKS = path.join(__dirname, '..', 'app', 'hooks');

// I nomi definiti nel file: const X, let X, function X, e i parametri
// dell'hook stesso.
function nomiDefiniti(sorgente) {
  const nomi = new Set();
  for (const m of sorgente.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) nomi.add(m[1]);
  for (const m of sorgente.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) nomi.add(m[1]);
  // destrutturazioni: const { a, b } = ... e const [a, b] = ...
  for (const m of sorgente.matchAll(/\b(?:const|let|var)\s*[[{]([^\]}]*)[\]}]\s*=/g)) {
    for (const pezzo of m[1].split(',')) {
      const n = pezzo.split(':').pop().trim().replace(/^\.\.\./, '').split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) nomi.add(n);
    }
  }
  // parametri della funzione esportata
  for (const m of sorgente.matchAll(/export default function \w*\s*\(([^)]*)\)/g)) {
    for (const pezzo of m[1].split(',')) {
      const n = pezzo.split(':').pop().trim().replace(/^\.\.\./, '').split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) nomi.add(n);
    }
  }
  return nomi;
}

// Le scorciatoie dell'ultimo `return { ... }`: solo `nome,` senza valore.
function scorciatoieRestituite(sorgente) {
  const i = sorgente.lastIndexOf('return {');
  if (i === -1) return [];
  let profondita = 0, fine = i;
  for (let k = i + 7; k < sorgente.length; k++) {
    if (sorgente[k] === '{') profondita++;
    else if (sorgente[k] === '}') { profondita--; if (profondita === 0) { fine = k; break; } }
  }
  const corpo = sorgente.slice(i + 8, fine);
  return corpo.split('\n')
    .map(r => r.replace(/\/\/.*$/, '').trim())
    .filter(r => /^[A-Za-z_$][\w$]*,?$/.test(r))
    .map(r => r.replace(/,$/, ''));
}

const file = fs.readdirSync(HOOKS).filter(f => f.endsWith('.js'));

describe('gli hook mantengono quello che promettono', () => {
  it('ci sono hook da controllare', () => {
    expect(file.length).toBeGreaterThan(3);
  });

  for (const f of file) {
    it(`${f} non restituisce nomi inesistenti`, () => {
      const sorgente = fs.readFileSync(path.join(HOOKS, f), 'utf8');
      const definiti = nomiDefiniti(sorgente);
      const promessi = scorciatoieRestituite(sorgente);
      const fantasmi = promessi.filter(n => !definiti.has(n));
      expect(fantasmi,
        `${f} promette ${fantasmi.join(', ')} ma non l'ha mai definito: alla prima apertura la pagina muore`)
        .toEqual([]);
    });
  }
});

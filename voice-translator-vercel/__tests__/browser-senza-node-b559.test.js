// ═══════════════════════════════════════════════════════════════
// b.559 — IL BROWSER NON PUO' PORTARSI DIETRO NODE
//
// Due deploy di fila in ERRORE su Vercel, e Luca intanto vedeva la
// versione vecchia senza sapere perche':
//
//   Module not found: Can't resolve 'dns'
//   ./app/lib/topics/ssrf.js → ./app/lib/topics/registro.js
//   → ./app/components/MondoNews.js → ./app/page.js
//
// LA CAUSA, ed e' mia. In b.557 avevo messo due funzioni PURE
// (`soloRecenti`, `quantiFreschi`) dentro `registro.js`, che legge i
// flussi dalla rete e quindi importa `ssrf.js`, che importa `dns` di
// Node. Quando MondoNews — codice del BROWSER — ha importato una di
// quelle due funzioni, si e' portato dietro tutta la catena.
//
// Le prove erano tutte verdi: vitest gira su Node, e su Node `dns`
// esiste. Il difetto viveva esattamente nel punto che le nostre prove
// non guardavano — la compilazione per il browser. Questa prova e'
// quel punto.
//
// LA REGOLA: una funzione PURA non vive nello stesso file di chi apre
// connessioni. Non e' pulizia formale, e' cio che decide se il browser
// puo usarla.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

// i moduli di Node che nel browser non esistono
const DI_NODE = new Set([
  'dns', 'fs', 'net', 'tls', 'http', 'https', 'child_process', 'os', 'path',
  'crypto', 'stream', 'zlib', 'worker_threads', 'cluster', 'dgram', 'v8', 'vm',
]);

function tuttiIFile(dir) {
  const fuori = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuori.push(...tuttiIFile(p));
    else if (/\.jsx?$/.test(e.name)) fuori.push(p);
  }
  return fuori;
}

// SOLO GLI IMPORT IN CIMA, non quelli dentro le funzioni.
// La differenza non e' formale: un `await import('./store.js')` scritto
// dentro una funzione diventa un pacchetto a parte, che il compilatore
// mette da parte e non pretende di risolvere per il browser — e infatti
// quella catena (decisioni → store → crypto) compila da mesi. Il
// difetto di b.557 era invece tutto in cima: MondoNews → registro →
// ssrf → dns, tre import statici in fila. E' quella la forma che
// rompe, ed e' quella che si guarda qui.
function importati(file) {
  const s = fs.readFileSync(file, 'utf8');
  const fuori = [];
  const re = /(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(s))) fuori.push(m[1]);
  return fuori;
}

function risolvi(da, spec) {
  if (!spec.startsWith('.')) return null;          // pacchetto: non e' roba nostra
  const p = path.resolve(path.dirname(da), spec);
  for (const q of [p, `${p}.js`, `${p}.jsx`, path.join(p, 'index.js')]) {
    if (fs.existsSync(q) && fs.statSync(q).isFile()) return q;
  }
  return null;
}

/** Da un file del browser, la prima catena che arriva a un modulo di Node. */
function catenaVersoNode(partenza) {
  const visti = new Set();
  const coda = [[partenza, [partenza]]];
  while (coda.length) {
    const [file, strada] = coda.shift();
    if (visti.has(file)) continue;
    visti.add(file);
    for (const spec of importati(file)) {
      const nudo = spec.replace(/^node:/, '');
      if (DI_NODE.has(nudo)) return [...strada.map((f) => path.relative(APP, f)), nudo];
      const dentro = risolvi(file, spec);
      if (dentro) coda.push([dentro, [...strada, dentro]]);
    }
  }
  return null;
}

describe('cio che finisce nel browser resta nel browser', () => {
  const clienti = tuttiIFile(APP).filter((f) => {
    const s = fs.readFileSync(f, 'utf8').slice(0, 200);
    return /^['"]use client['"]/.test(s.trim());
  });

  it('ci sono davvero delle schermate da controllare', () => {
    // se un giorno questo elenco si svuotasse, la prova diventerebbe
    // verde per assenza di misura: peggio che rossa.
    expect(clienti.length).toBeGreaterThan(20);
  });

  it('nessuna schermata trascina un modulo di Node', () => {
    const guasti = [];
    for (const f of clienti) {
      const catena = catenaVersoNode(f);
      if (catena) guasti.push(`${catena.join('  →  ')}`);
    }
    expect(guasti, `catene che rompono la compilazione:\n  ${guasti.join('\n  ')}`).toEqual([]);
  });

  it('e il difetto vero di b.557 sarebbe stato preso da questa prova', () => {
    // riproduzione: `registro.js` arriva a `dns` (giustamente, legge la
    // rete). Se una schermata lo importasse di nuovo, la prova sopra
    // diventerebbe rossa.
    const catena = catenaVersoNode(path.join(APP, 'lib/topics/registro.js'));
    expect(catena, 'registro.js e roba da server, e va bene cosi').not.toBe(null);
    expect(catena[catena.length - 1]).toBe('dns');
  });

  it('le funzioni pure stanno in un file che non importa niente', () => {
    const f = fs.readFileSync(path.join(APP, 'lib/topics/freschezza.js'), 'utf8');
    expect(f).not.toMatch(/^\s*import\s/m);
    expect(catenaVersoNode(path.join(APP, 'lib/topics/freschezza.js'))).toBe(null);
  });
});

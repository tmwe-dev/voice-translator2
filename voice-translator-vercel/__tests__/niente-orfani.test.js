// ═══════════════════════════════════════════════════════════════
// GUARDIA CONTRO I FILE ORFANI
//
// Nato da un audit vero: 1.851 righe in 13 file che nessuno importava,
// fra cui il REGALO CREDITI — una funzione scritta per intero e mai
// raggiungibile da nessun pulsante.
//
// Questo test costruisce il grafo degli import (compresi quelli
// dinamici) e fallisce se un file di app/ non è raggiungibile.
// Se un file serve davvero, collegalo. Se non serve, CANCELLALO: in
// b.109 la discarica app/attic/ (2.130 righe, zero importatori) e stata
// eliminata, perche una discarica dentro app/ viene comunque compilata,
// cercata e inclusa in ogni ricerca. Quello che vale la pena tenere sta
// in attic/ alla radice del repository, fuori dal progetto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP = path.join(__dirname, '..', 'app');

function tuttiIFile(dir, trovati = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      if (voce.name === 'node_modules') continue;
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

    // ── Le LAPIDI non sono codice orfano ──
    // Il disco su cui gira questo lavoro non permette di cancellare i
    // file. Quando un file va rimosso ma non si puo, ci si lascia una
    // lapide: un blocco di commenti che dice cosa c'era, perche se ne va
    // e il comando per toglierlo. Il criterio e stretto — deve portare
    // quella frase esatta E non contenere NEMMENO UNA riga eseguibile —
    // cosi non si puo usare per nascondere codice vero.
    const eLapide = (f) => {
      const src = fs.readFileSync(f, 'utf8');
      if (!src.includes('LAPIDE — questo file va CANCELLATO')) return false;
      const codice = src.split('\n')
        .filter(r => r.trim() && !r.trim().startsWith('//') && !r.trim().startsWith('*'));
      return codice.length === 0;
    };

    // ── b.575 — UN CANTIERE NON E UN ORFANO, MA QUASI ──
    // Il documento di Mondo impone una migrazione a fasi: «FASE 1:
    // creare i nuovi modelli. Nessun cambio UI». Per un tratto quei
    // file esistono e nessuno li chiama ancora — che e' esattamente
    // l'aspetto del codice morto, ed e' il motivo per cui questa
    // guardia esiste.
    // La differenza non puo essere una lista di eccezioni (diventa
    // subito il posto dove si nasconde la polvere). Deve essere una
    // PROVA: il file dichiara a quale fase e' attaccato, e c'e' un test
    // che lo monta davvero. Un cantiere ha degli operai dentro; una
    // rovina no. Il giorno che la fase collega il file, la riga di
    // dichiarazione se ne va con lei.
    const TEST = path.join(__dirname);
    const provati = new Set();
    for (const t of fs.readdirSync(TEST).filter(x => x.endsWith('.test.js'))) {
      const src = fs.readFileSync(path.join(TEST, t), 'utf8');
      for (const r of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        provati.add(path.resolve(path.dirname(path.join(TEST, t)), r[1]));
      }
    }
    const eCantiere = (f) => {
      const src = fs.readFileSync(f, 'utf8');
      return /CANTIERE — collegato alla FASE \d+/.test(src) && provati.has(path.resolve(f));
    };

    const orfani = file
      .filter(f => !importati.has(path.resolve(f)) && !INGRESSI.test(f) && !eLapide(f) && !eCantiere(f))
      .map(f => path.relative(APP, f));

    expect(orfani, `File mai importati. Collegali, oppure cancellali:\n  ${orfani.join('\n  ')}`).toEqual([]);
  });
});

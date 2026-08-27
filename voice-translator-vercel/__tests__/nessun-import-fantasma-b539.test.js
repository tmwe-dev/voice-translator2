import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// ═══════════════════════════════════════════════════════════════
// b.539 — LA RETE CHE MANCAVA.
//
// Collaudo di Luca, schermata rossa in faccia:
//   «TypeError: (0, l.getStyles) is not a function»
//
// Causa: in StanzeView (b.537) avevo scritto
//   import { getStyles } from '../lib/styles.js'
// ma `getStyles` e' un export DEFAULT. Con le graffe arriva `undefined`,
// e la schermata muore al primo disegno.
//
// Il difetto grave pero' non e' la riga sbagliata: e' che NESSUNA delle
// 14 prove di b.537 se n'e' accorta. Perche' leggevano il TESTO del file
// — «c'e' scritto StanzeView? c'e' scritto onJoinRoom?» — e il testo era
// giusto. Nessuna ha mai provato a FARLO PARTIRE.
//
// Questa prova chiude la classe intera, per tutta l'applicazione e per
// sempre: ogni import a graffe da un file nostro deve corrispondere a un
// export vero di quel file. Costa un secondo e vale per 400 file.
// ═══════════════════════════════════════════════════════════════

const RADICE = join(process.cwd(), 'app');

function tuttiIFile(dir, out = []) {
  for (const v of readdirSync(dir, { withFileTypes: true })) {
    const q = join(dir, v.name);
    if (v.isDirectory()) tuttiIFile(q, out);
    else if (v.name.endsWith('.js') || v.name.endsWith('.jsx')) out.push(q);
  }
  return out;
}

// I nomi che un file mette DAVVERO a disposizione degli altri.
export function nomiEsportati(src) {
  const nomi = new Set();
  let m;
  const funzioni = /export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = funzioni.exec(src))) nomi.add(m[1]);
  const costanti = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = costanti.exec(src))) nomi.add(m[1]);
  const graffe = /export\s*\{([^}]*)\}/g;
  while ((m = graffe.exec(src))) {
    for (const pezzo of m[1].split(',')) {
      const t = pezzo.trim();
      if (!t) continue;
      const come = t.split(/\s+as\s+/);
      nomi.add((come[1] || come[0]).trim());
    }
  }
  if (/export\s+default/.test(src)) nomi.add('default');
  return nomi;
}

describe('b.539 — nessun import fantasma in tutta l\'applicazione', () => {
  it('la lettura degli export riconosce tutte le forme (regola vera)', () => {
    const n = nomiEsportati(`
      export default function getStyles() {}
      export const tokens = {};
      export function paeseDaFonte() {}
      export class Tale {}
      export { uno, due as tre };
      export async function chiedi() {}
    `);
    // «due as tre» esporta TRE, non due: chi importa { due } prende il nulla.
    // E getStyles NON compare: e' un default, e un default a graffe non
    // si prende — che e' esattamente cio che ha ucciso la schermata Stanze.
    expect([...n].sort()).toEqual(['Tale', 'chiedi', 'default', 'paeseDaFonte', 'tokens', 'tre', 'uno']);
    expect(nomiEsportati('export default function getStyles() {}').has('getStyles')).toBe(false);
    expect(nomiEsportati('export default function getStyles() {}').has('default')).toBe(true);
    expect(nomiEsportati('const x = 1;').has('default')).toBe(false);
  });

  it('ogni import a graffe corrisponde a un export vero', () => {
    const guasti = [];
    const files = tuttiIFile(RADICE);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const re = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
      let m;
      while ((m = re.exec(src))) {
        const chiesti = m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        let target = resolve(dirname(f), m[2]);
        if (!existsSync(target)) {
          if (existsSync(`${target}.js`)) target += '.js';
          else continue;             // non e' un file nostro: non ci riguarda
        }
        if (statSync(target).isDirectory()) continue;
        const srcTarget = readFileSync(target, 'utf8');
        if (/export\s+\*\s+from/.test(srcTarget)) continue;   // ri-esporta: non si sa da dove
        const nomi = nomiEsportati(srcTarget);
        for (const c of chiesti) {
          if (!nomi.has(c)) {
            guasti.push(`${f.replace(process.cwd() + '/', '')}: importa { ${c} } da ${m[2]}, che NON lo esporta`);
          }
        }
      }
    }
    expect(guasti, 'import che puntano al nulla: a schermo diventano «... is not a function»').toEqual([]);
    expect(files.length, 'lo scandaglio deve guardare tutta l\'applicazione').toBeGreaterThan(300);
  });

  it('e il caso che ha rotto le Stanze non puo tornare', () => {
    const s = readFileSync(join(RADICE, 'components/StanzeView.js'), 'utf8');
    expect(s).toMatch(/import getStyles from '\.\.\/lib\/styles\.js'/);
    expect(s).not.toMatch(/import \{[^}]*getStyles[^}]*\} from/);
  });
});

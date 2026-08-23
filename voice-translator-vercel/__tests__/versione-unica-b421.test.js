// ═══════════════════════════════════════════════════════════════
// b.421 — LA VERSIONE CHE L'UTENTE LEGGE NON PUO' MENTIRE.
//
// `APP_VERSION` era ferma a b.405 mentre il programma era a b.420:
// quindici versioni indietro. Compare in Impostazioni, nell'oggetto
// della mail di assistenza e dentro l'esportazione dei dati personali —
// cioe chi segnala un problema dichiara una versione che non sta
// usando, e noi cerchiamo il difetto nel posto sbagliato.
//
// La causa non e la distrazione: e che la versione ha DUE fonti e solo
// una (`PUSH`) fa parte del gesto di pubblicare. Non si possono unire —
// b.417, b.418 e b.419 sono uscite con lo stesso push #711, quindi lo
// scarto fra i due numeri non e costante. Quello che si puo fare e
// impedire che divergano in silenzio: e questo file.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_VERSION, PUSH } from '../app/lib/constants.js';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// La versione piu recente dichiarata nel diario: la prima riga
// «- Versione: **b.NNN** (push #NNN)» dopo «Stato corrente».
function dalDiario() {
  const md = leggi('CLAUDE.md');
  const dopo = md.slice(md.indexOf('## Stato corrente'));
  const m = dopo.match(/- Versione:\s*\*\*(b\.\d+)\*\*\s*\(push #(\d+)\)/);
  return m ? { versione: m[1], push: Number(m[2]) } : null;
}

describe('la versione dichiarata e quella vera', () => {
  it('il diario dice a che versione siamo', () => {
    expect(dalDiario(), 'la riga «- Versione: **b.NNN** (push #NNN)» deve esistere').toBeTruthy();
  });

  it('APP_VERSION combacia col diario', () => {
    const d = dalDiario();
    expect(APP_VERSION, [
      'La versione che l\'utente legge in Impostazioni non e quella vera.',
      'Aggiorna APP_VERSION in app/lib/constants.js insieme al diario:',
      `  diario ${d.versione} · costante ${APP_VERSION}`,
    ].join('\n')).toBe(d.versione);
  });

  it('e anche il numero di rilascio combacia', () => {
    expect(PUSH).toBe(dalDiario().push);
  });

  it('la versione ha la forma giusta, non una stringa qualunque', () => {
    expect(APP_VERSION).toMatch(/^b\.\d{3}$/);
    expect(Number.isInteger(PUSH) && PUSH > 0).toBe(true);
  });

  it("e chi la mostra la prende da li, non se la riscrive", () => {
    // se qualcuno scrive «b.4xx» a mano in una schermata, il controllo
    // qui sopra non se ne accorgerebbe mai.
    const impostazioni = leggi('app/components/SettingsView.js')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(impostazioni, 'la schermata importa la costante').toMatch(/APP_VERSION/);
    expect(impostazioni, 'e non scrive un numero di versione a mano').not.toMatch(/['"`]b\.\d{3}['"`]/);
  });
});

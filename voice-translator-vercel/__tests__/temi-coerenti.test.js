// ═══════════════════════════════════════════════════════════════
// GUARDIA SUI TEMI
//
// Nato dal bug che tornava ogni settimana: "il tema chiaro ha il testo
// bianco su bianco", "questa pagina usa colori diversi".
//
// Causa vera: i componenti scrivevano `col.bg || '#09090b'`, ma la
// chiave `bg` NON esisteva in nessuna tavolozza. Il fallback nero
// vinceva sempre, in tutti i temi, anche in quello chiaro.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import getStyles from '../app/lib/styles.js';

const TEMI = ['deep', 'ember', 'avorio', 'lilla', 'blubianco', 'dawn'];
const COMPONENTI = path.join(__dirname, '..', 'app', 'components');

// Ogni chiave che i componenti si aspettano dal tema.
const CHIAVI_ATTESE = [
  'bg', 'bgGradient', 'textPrimary', 'textSecondary', 'textMuted',
  'cardBg', 'cardBorder', 'inputBg', 'inputBorder',
  'accent1', 'accent2', 'accent3', 'glassCard', 'headerBg', 'headerBorder',
];

describe('tavolozze dei temi', () => {
  it('tutti i temi espongono le stesse chiavi', () => {
    for (const tema of TEMI) {
      const colori = getStyles(tema).colors;
      for (const chiave of CHIAVI_ATTESE) {
        expect(colori[chiave], `tema ${tema}: manca "${chiave}"`).toBeTruthy();
      }
    }
  });

  it('il tema chiaro ha davvero un fondo chiaro e testo scuro', () => {
    const dawn = getStyles('dawn').colors;
    // Fondo chiaro: le tre componenti RGB sopra 200.
    const [r, g, b] = dawn.bg.slice(1).match(/../g).map(h => parseInt(h, 16));
    expect([r, g, b].every(v => v > 200), `fondo dawn troppo scuro: ${dawn.bg}`).toBe(true);
    // Testo scuro: sotto 100.
    const [tr, tg, tb] = dawn.textPrimary.slice(1).match(/../g).map(h => parseInt(h, 16));
    expect([tr, tg, tb].every(v => v < 100), `testo dawn troppo chiaro: ${dawn.textPrimary}`).toBe(true);
  });

  it('nessun componente inchioda il fondo a un nero fisso', () => {
    const colpevoli = [];
    for (const nome of fs.readdirSync(COMPONENTI)) {
      if (!nome.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(COMPONENTI, nome), 'utf8');
      // "bg: PALETTE.bgDeep" senza passare dal tema = pagina sempre nera.
      if (/\bbg:\s*PALETTE\.bgDeep/.test(src)) colpevoli.push(nome);
    }
    expect(colpevoli, `Usa "col.bg || PALETTE.bgDeep" invece:\n  ${colpevoli.join('\n  ')}`).toEqual([]);
  });

  it('niente emoji nelle notifiche', () => {
    const src = fs.readFileSync(path.join(COMPONENTI, 'Toast.js'), 'utf8');
    // Intervalli emoji (pittogrammi, simboli, faccine).
    expect(src).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{FE0F}]/u);
  });
});

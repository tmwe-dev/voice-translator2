// ═══════════════════════════════════════════════════════════════
// b.249 — l'avviso che faceva cadere l'app intera.
//
// Trovato dal collaudo fisico, non dai 2048 test: alla prima chiamata
// alla stanza rifiutata (403) il client mostrava un toast, e l'app
// finiva nell'ErrorBoundary con "TypeError: t is not a function".
//
// La causa: in ToastContainer il parametro della map si chiamava `t`
// e OMBREGGIAVA la funzione i18n `t` importata in testa al file. Alla
// riga dell'aria-label, `t(lingua, 'closeNotification')` chiamava
// l'oggetto avviso invece della funzione di traduzione. Dentro una map
// dentro JSX, l'eccezione risaliva fino all'ErrorBoundary di pagina:
// QUALSIASI avviso — errore di rete, conferma, informazione — uccideva
// l'app al posto di informarla. Presente da b.138 (quando l'aria-label
// e stato aggiunto): da allora nessun toast poteva essere mostrato.
//
// Perche i test non l'hanno mai visto: nessuno montava il contenitore
// con un avviso dentro. La lezione e nel CLAUDE.md §7: e il collaudo
// fisico che trova i difetti visibili all'utente.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const sorgente = fs.readFileSync(path.join(RADICE, 'app/components/Toast.js'), 'utf8');
const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('il contenitore degli avvisi non ombreggia la funzione i18n', () => {
  it('la map non usa più `t` come nome del parametro', () => {
    // Era esattamente `toasts.map(t => {`: da lì in giù ogni `t(...)`
    // era l'oggetto avviso, non la traduzione.
    expect(senzaCommenti).not.toMatch(/toasts\.map\(\s*t\s*[=(]/);
  });

  it('l\'aria-label di chiusura usa DAVVERO la funzione di traduzione', () => {
    expect(senzaCommenti).toMatch(/aria-label=\{t\(lingua, 'closeNotification'\)\}/);
  });

  it('e la funzione i18n resta importata con quel nome', () => {
    // Se qualcuno rinominasse l'import lasciando l'aria-label com'è,
    // il difetto tornerebbe identico a se stesso.
    expect(senzaCommenti).toMatch(/import \{ t, preloadLang/);
  });

  it('il testo e le azioni dell\'avviso leggono dal parametro nuovo', () => {
    expect(senzaCommenti).toMatch(/\{avviso\.message\}/);
    expect(senzaCommenti).toMatch(/avviso\.action\.onClick\(\)/);
    expect(senzaCommenti).toMatch(/dismissToast\(avviso\.id\)/);
  });
});

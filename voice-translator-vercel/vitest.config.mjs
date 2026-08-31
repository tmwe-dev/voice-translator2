import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// b.583 — il file e ESM per davvero: con estensione .js Vite lo caricava
// attraverso il vecchio percorso CJS e avvisava a ogni esecuzione che quel
// caricamento sara rimosso. .mjs elimina l'ambiguita senza cambiare i test.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// b.406 — I COMPONENTI DI QUESTO PROGETTO HANNO JSX DENTRO FILE `.js`.
//
// Next lo permette, il motore delle prove no: si fermava con «invalid JS
// syntax... name the file with the .jsx extension». Conseguenza pratica,
// e non piccola: MONTARE un componente in una prova era impossibile, e
// per questo le prove sui componenti leggono il sorgente con
// un'espressione regolare invece di farlo girare. E' esattamente il
// difetto di metodo che l'audit di Luca segnala al §9 — solo che qui non
// era pigrizia, era un ostacolo tecnico.
//
// Questo pezzo dice al motore che in `app/` un `.js` puo contenere JSX.
// Non tocca la costruzione del prodotto (quella la fa Next per conto
// suo): vale solo dentro le prove.
// ═══════════════════════════════════════════════════════════════
const jsxDentroJs = {
  name: 'bartalk-jsx-in-js',
  async transform(codice, percorso) {
    if (!/\/app\/.*\.js(\?|$)/.test(percorso)) return null;
    if (!/<[A-Za-z/>]/.test(codice)) return null;   // niente JSX: non si tocca
    const r = await transformWithOxc(codice, percorso.replace(/\.js(\?.*)?$/, '.jsx'));
    return { code: r.code, map: r.map };
  },
};

export default defineConfig({
  plugins: [jsxDentroJs],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.{js,jsx}'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./__tests__/setup.js'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['app/lib/**/*.js'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

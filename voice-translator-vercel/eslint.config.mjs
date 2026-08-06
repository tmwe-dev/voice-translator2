import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    // ── b.114 · la regola che mancava ──
    // Un invito rotto in produzione per `roomConfig is not defined`:
    // una variabile usata in un punto dove non esiste. Non un caso
    // limite — la riga era stata copiata da un altro punto di chiamata
    // dove quel nome c'era.
    //
    // 928 test verdi non l'hanno visto, perche i test leggono il
    // codice e non lo ESEGUONO. Lint invece lo sa da sempre: basta
    // accendere la regola. `next/core-web-vitals` la lascia spenta
    // perche da per scontato TypeScript, che qui non c'e.
    //
    // E la regola con il miglior rapporto fra costo e guasti evitati:
    // prende un'intera famiglia di errori — nomi sbagliati, import
    // dimenticati, variabili usate fuori dal loro ambito — che
    // altrimenti si scoprono solo quando qualcuno tocca il pulsante.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      'no-undef': 'error',
      // Structured logging: console.* forbidden in app code (use lib/logger.js)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // React 19: no need for React import
      'react/react-in-jsx-scope': 'off',
      // Allow unescaped apostrophes in JSX text (Italian UI strings)
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Test files: console allowed
    files: ['__tests__/**', 'e2e/**', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'coverage/**', 'playwright-report/**'],
  },
];

export default config;

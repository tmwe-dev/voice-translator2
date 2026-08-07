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
      // ── b.119 · un errore ingoiato in silenzio e un difetto in incubazione ──
      // Due dei guasti trovati provando in due erano esattamente questo:
      //   · la stanza lasciata a meta spariva per sempre, perche un
      //     controllo fallito finiva in un `catch {}`;
      //   · i messaggi in modalita Direct sparivano, perche l'invio
      //     falliva dentro un `try { ... } catch {}`.
      //
      // In nessuno dei due casi c'era un errore visibile: solo una cosa
      // che non succedeva.
      //
      // La regola NON vieta di ignorare un errore. Vieta di ignorarlo
      // SENZA DIRLO: basta una riga di commento che spieghi perche qui
      // va bene, e ESLint tace. Il costo e scrivere una frase; il
      // guadagno e che fra sei mesi si sa se era una scelta o una
      // dimenticanza.
      'no-empty': ['error', { allowEmptyCatch: false }],
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

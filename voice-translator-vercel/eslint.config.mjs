import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
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

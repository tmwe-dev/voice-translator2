import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Trovato dal vivo in produzione (collaudo fisico sulla home): la console
// mostrava a OGNI caricamento
//   "Loading the stylesheet 'https://accounts.google.com/gsi/style'
//    violates the Content Security Policy directive style-src"
// Lo script di Google era permesso (script-src), il suo foglio di stile no:
// il pulsante "Accedi con Google" restava senza il proprio aspetto.
// Le due direttive devono nominare lo stesso host.
const leggi = (f) => readFileSync(join(process.cwd(), f), 'utf8');
const direttiva = (csp, nome) => (csp.match(new RegExp(`${nome} ([^;]*)`)) || [, ''])[1];

describe('CSP: chi puo eseguire lo script di Google puo anche vestirlo', () => {
  it('middleware.js — accounts.google.com sta sia in script-src sia in style-src', () => {
    const src = leggi('middleware.js');
    const csp = (src.match(/'Content-Security-Policy': "([^"]+)"/) || [, ''])[1];
    expect(csp, 'la CSP deve esistere nel middleware').toBeTruthy();
    expect(direttiva(csp, 'script-src')).toContain('https://accounts.google.com');
    expect(direttiva(csp, 'style-src')).toContain('https://accounts.google.com');
  });

  it('next.config.mjs — la seconda CSP non deve essere piu stretta della prima', () => {
    const src = leggi('next.config.mjs');
    const style = (src.match(/"style-src ([^"]+)"/) || [, ''])[1];
    expect(style).toContain('https://accounts.google.com');
  });
});

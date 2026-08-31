import { describe, it, expect } from 'vitest';
import { politicaContenuti, intestazioniNext, intestazioniSicurezza } from '../security-headers.mjs';

// Trovato dal vivo in produzione (collaudo fisico sulla home): la console
// mostrava a OGNI caricamento
//   "Loading the stylesheet 'https://accounts.google.com/gsi/style'
//    violates the Content Security Policy directive style-src"
// Lo script di Google era permesso (script-src), il suo foglio di stile no:
// il pulsante "Accedi con Google" restava senza il proprio aspetto.
//
// b.583 — non esistono piu due copie testuali della CSP da confrontare:
// middleware e Next leggono entrambi security-headers.mjs. Questa prova
// difende il comportamento vero e anche il fatto che la forma Next derivi
// senza divergere dalla stessa mappa canonica.
function direttiva(csp, nome) {
  return csp.split('; ').find((pezzo) => pezzo.startsWith(nome + ' ')) || '';
}

describe('CSP: chi puo eseguire lo script di Google puo anche vestirlo', () => {
  it('accounts.google.com sta sia in script-src sia in style-src', () => {
    const csp = politicaContenuti({ inSviluppo: false });
    expect(direttiva(csp, 'script-src')).toContain('https://accounts.google.com');
    expect(direttiva(csp, 'style-src')).toContain('https://accounts.google.com');
  });

  it('middleware e Next ricevono la stessa Content-Security-Policy canonica', () => {
    const mappa = intestazioniSicurezza({ inSviluppo: false });
    const next = Object.fromEntries(
      intestazioniNext({ inSviluppo: false }).map(({ key, value }) => [key, value]),
    );
    expect(next['Content-Security-Policy']).toBe(mappa['Content-Security-Policy']);
    expect(next).toEqual(mappa);
  });

  it('la policy canonica resta una sola, non due copie da sincronizzare', async () => {
    const middleware = await import('../middleware.js');
    const nextConfig = await import('../next.config.mjs');
    expect(middleware.middleware).toBeTypeOf('function');
    expect(nextConfig.default).toBeTruthy();
  });
});

import { describe, it, expect } from 'vitest';
import { politicaContenuti, intestazioniSicurezza, intestazioniNext } from '../security-headers.mjs';

describe('b.583 — una sola politica di sicurezza', () => {
  it('concede unsafe-eval soltanto in sviluppo', () => {
    expect(politicaContenuti({ inSviluppo: false })).not.toContain("'unsafe-eval'");
    expect(politicaContenuti({ inSviluppo: true })).toContain("'unsafe-eval'");
  });

  it('non conserva il vecchio servizio QR esterno', () => {
    expect(politicaContenuti({ inSviluppo: false })).not.toContain('api.qrserver.com');
  });

  it('ha una sola HSTS e una sola Permissions-Policy canoniche', () => {
    const h = intestazioniSicurezza({ inSviluppo: false });
    expect(h['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['Permissions-Policy']).toBe('camera=(self), microphone=(self), geolocation=(self), payment=(self)');
  });

  it('la forma Next deriva dalla stessa mappa senza perdere header', () => {
    const mappa = intestazioniSicurezza({ inSviluppo: false });
    const next = Object.fromEntries(intestazioniNext({ inSviluppo: false }).map(({ key, value }) => [key, value]));
    expect(next).toEqual(mappa);
  });
});

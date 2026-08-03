/**
 * Test dei moduli wallet PURI (niente rete, niente DB).
 * La contabilità si testa con le funzioni SQL in staging.
 */
import { describe, it, expect } from 'vitest';
import { PACCHETTI, MOLTIPLICATORE_PREMIUM, formattaDurata, oreIncluse, coloreBatteria, BATTERIA } from '../../app/wallet/tariffe.js';
import { costoConversazione, costoMessaggioTesto, costoElevenLabsCaratteri, costoRiassunto } from '../../app/wallet/consumo.js';

describe('tariffe', () => {
  it('formattaDurata è leggibile', () => {
    expect(formattaDurata(0)).toBe('0m');
    expect(formattaDurata(90)).toBe('1m');
    expect(formattaDurata(3600)).toBe('1h 0m');
    expect(formattaDurata(9000)).toBe('2h 30m');
  });

  it('ogni pacchetto dichiara le ore standard e premium', () => {
    for (const p of PACCHETTI) {
      const ore = oreIncluse(p);
      expect(ore.standard).toMatch(/h/);
      expect(ore.premium.length).toBeGreaterThan(0);
    }
  });

  it('il pacchetto medio è quello consigliato', () => {
    expect(PACCHETTI.find(p => p.consigliato)?.id).toBe('pack_m');
  });

  it('coloreBatteria: verde pieno, giallo a metà, rosso quasi vuoto', () => {
    const pieno = BATTERIA.riferimentoSecondi;
    expect(coloreBatteria(pieno)).toBe('verde');
    expect(coloreBatteria(pieno * 0.3)).toBe('giallo');
    expect(coloreBatteria(pieno * 0.05)).toBe('rosso');
    expect(coloreBatteria(0)).toBe('rosso');
  });
});

describe('consumo', () => {
  it('voce standard: 1 secondo parlato = 1 secondo di credito', () => {
    expect(costoConversazione(60, false)).toBe(60);
  });

  it('voce premium: consuma il triplo', () => {
    expect(costoConversazione(60, true)).toBe(60 * MOLTIPLICATORE_PREMIUM);
  });

  it('arrotonda sempre per eccesso (mai regalare frazioni)', () => {
    expect(costoConversazione(10.2, false)).toBe(11);
  });

  it('messaggio di testo costa poco ma non zero', () => {
    expect(costoMessaggioTesto()).toBeGreaterThan(0);
    expect(costoMessaggioTesto()).toBeLessThan(30);
  });

  it('ElevenLabs a caratteri: ~17 caratteri = 1 secondo, con moltiplicatore', () => {
    expect(costoElevenLabsCaratteri(170)).toBe(10 * MOLTIPLICATORE_PREMIUM);
  });

  it('riassunto: costo fisso piccolo', () => {
    expect(costoRiassunto()).toBe(10);
  });
});

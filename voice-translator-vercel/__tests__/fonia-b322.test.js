import { describe, it, expect } from 'vitest';
import { inviluppo, tracciaTono, analizza, confronta, qualityGate } from '../app/lib/fonia.js';

// b.322 — il motore dell'ANALISI GRAFICA della pronuncia: fascia attesa,
// onda dell'utente, colori verde/arancio/rosso. Funzioni pure, provabili.

function seno(freq, sr, secondi, ampiezza = 0.5) {
  const n = Math.floor(sr * secondi);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ampiezza * Math.sin(2 * Math.PI * freq * i / sr);
  return out;
}

describe('fonia — analisi locale', () => {
  const SR = 16000;

  it('inviluppo: normalizzato e della lunghezza chiesta', () => {
    const env = inviluppo(seno(200, SR, 0.5), 40);
    expect(env).toHaveLength(40);
    expect(Math.max(...env)).toBeCloseTo(1, 1);
  });

  it('tracciaTono: un tono costante da un contorno piatto (vicino a 0 semitoni dalla mediana)', () => {
    const tono = tracciaTono(seno(180, SR, 0.6), SR, 40);
    const voiced = tono.filter((t) => t !== null);
    expect(voiced.length).toBeGreaterThan(10);
    for (const t of voiced) expect(Math.abs(t)).toBeLessThan(1);
  });

  it('confronta: la stessa voce contro se stessa e VERDE con somiglianza alta', () => {
    const a = analizza(seno(200, SR, 0.5), SR);
    const c = confronta(a, a);
    expect(c.somiglianza).toBeGreaterThanOrEqual(85);
    expect(c.punti.filter((p) => p.colore === 'verde').length).toBeGreaterThan(c.punti.length * 0.8);
  });

  it('confronta: melodie molto diverse producono punti fuori fascia', () => {
    // riferimento: tono che sale; utente: tono piatto e ritmo diverso
    const rifC = new Float32Array(SR);
    for (let i = 0; i < SR; i++) rifC[i] = 0.5 * Math.sin(2 * Math.PI * (120 + 160 * (i / SR)) * i / SR);
    const rif = analizza(rifC, SR);
    const ute = analizza(seno(200, SR, 1), SR);
    const c = confronta(rif, ute);
    expect(c.punti.some((p) => p.colore !== 'verde')).toBe(true);
  });

  it('qualityGate: rifiuta il silenzio e il campione troppo corto, accetta la voce', () => {
    expect(qualityGate(new Float32Array(SR), SR).ok).toBe(false);        // silenzio
    expect(qualityGate(seno(200, SR, 0.1), SR).ok).toBe(false);          // troppo corto
    expect(qualityGate(seno(200, SR, 0.8), SR).ok).toBe(true);           // voce vera
  });
});

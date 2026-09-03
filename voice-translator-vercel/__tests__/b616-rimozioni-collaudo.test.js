import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// b.616 — SOLO RIMOZIONI (mai mischiate con i cambi di b.615). Ogni
// assenza ha la prova che la vede.

describe('b.616 — /api/analytics non esiste piu, e nessuno la chiama', () => {
  it('la rotta e sparita', () => {
    expect(existsSync('app/api/analytics/route.js')).toBe(false);
  });
  it('monitor.js non manda piu beacon a una porta senza azioni', () => {
    const s = readFileSync('app/lib/monitor.js', 'utf8');
    expect(s).not.toMatch(/sendBeacon\(\s*['"]\/api\/analytics/);
  });
});

describe('b.616 — un solo bottone apre le Azioni AI nella stanza', () => {
  it('RoomView ha UNA aria-label «Azioni chat», non due, e nessuna fotocamera finta', () => {
    const s = readFileSync('app/components/RoomView.js', 'utf8');
    expect((s.match(/aria-label=\{L\('chatActionsTitle'\)\}/g) || []).length).toBe(1);
    // l'icona della fotocamera (il path SVG con l'obiettivo) non c'e piu nella barra
    expect(s).not.toContain('<circle cx="12" cy="13" r="4" />');
  });
});

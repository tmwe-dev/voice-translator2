import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.493 — TAVOLA 13: PRIMO AVVIO ═══
// «Una domanda per schermata» c'era gia (tre fasi). Quel che mancava:
// il trattino di DOVE SEI e giallo (regola 13: blu=sistema,
// giallo=dove-sei) e il tasto Aa sta in testata anche qui.

const vista = readFileSync(join(process.cwd(), 'app/components/WelcomeView.js'), 'utf8');

describe('tavola 13 — primo avvio', () => {
  it('il trattino di dove-sei e giallo (regola 13)', () => {
    expect(vista).toMatch(/i === phase[\s\S]{0,120}PALETTE\.amber/);
  });

  it('il tasto Aa sta in testata e ingrandisce', () => {
    expect(vista).toMatch(/aria-label=\{L\('textBigger'\)\}/);
    expect(vista).toMatch(/zoomTesto/);
  });

  it('le fasi dopo la prima hanno ancora la via del ritorno', () => {
    const backs = vista.match(/L\('backWord'\)/g) || [];
    expect(backs.length).toBeGreaterThanOrEqual(2);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.499 — TAVOLA 25: I COMPITI ═══
// Raggruppati per scadenza c'erano gia (b.333). Quel che mancava:
// «Nuovo compito» e la pillola grande in fondo (col modulo accanto,
// non in testata), e «Fotografa e incolla sono due tasti pari» — con
// scritto quale dei due costa.

const vista = readFileSync(join(process.cwd(), 'app/components/Life/CompitiView.js'), 'utf8');

describe('tavola 25 — i Compiti', () => {
  it('nuovo compito e la pillola grande in fondo alla agenda', () => {
    const agenda = vista.slice(vista.indexOf("{vista === 'agenda' &&"), vista.indexOf("{vista === 'materiali' &&"));
    expect(agenda).toMatch(/GRUPPI\.map[\s\S]+lifeHomeworkAdd/);
  });

  it('fotografa e incolla sono due tasti pari nei materiali', () => {
    expect(vista).toMatch(/matPhotoBtn/);
    expect(vista).toMatch(/matPasteBtn/);
  });

  it('fotografa apre lo scanner vero, non un vicolo cieco', () => {
    expect(vista).toMatch(/apriScanner\(\{ doc: true, dest: 'materiali' \}\)[\s\S]{0,600}matPhotoBtn/);
  });

  it('le chiavi nuove esistono in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      for (const k of ['matPhotoBtn', 'matPasteBtn']) {
        expect(s.includes(`"${k}":"`), `${f}/${k}`).toBe(true);
      }
    }
  });
});

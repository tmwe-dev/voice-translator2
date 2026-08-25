import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// ═══ b.492 — TAVOLA 05 DEL TEMPLATE: BUSINESS ═══
// «Strumenti, non riquadri. Ognuno dice cosa fa in una riga.»
// La scansione e UNA COSA GRANDE in cima (e il motivo per cui si apre
// la pagina); Rubrica e PeepOff sono righe come sulla Home; Aa sta in
// testata come ovunque. La scheda «Il tuo biglietto da visita» del
// template NON c'e: nel sistema quella funzione non esiste ancora, e
// una scheda senza niente dietro e una scatola vuota (regola 2).

const vista = readFileSync(join(process.cwd(), 'app/components/BusinessView.js'), 'utf8');

describe('tavola 05 — Business', () => {
  it('la scansione e la cosa grande in cima e apre lo scanner', () => {
    expect(vista).toMatch(/scanCardTitle/);
    expect(vista).toMatch(/scanCardDesc/);
  });

  it('la Rubrica e una riga e apre i contatti dello scanner', () => {
    expect(vista).toMatch(/addressBook/);
    expect(vista).toMatch(/tab=contacts/);
  });

  it('il tasto Aa sta in testata come ovunque', () => {
    expect(vista).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });

  it('PeepOff resta raggiungibile: nessuna funzione persa', () => {
    expect(vista).toMatch(/peepoff/);
  });

  it('lo scanner sa aprirsi sulla tab chiesta, con un file additivo', () => {
    const indice = readFileSync(join(process.cwd(), 'public/scanner/index.html'), 'utf8');
    expect(indice).toContain('bartalk-tab.js');
    const ponte = readFileSync(join(process.cwd(), 'public/scanner/js/bartalk-tab.js'), 'utf8');
    expect(ponte).toMatch(/URLSearchParams/);
    expect(ponte).toMatch(/data-tab/);
  });

  it('le chiavi nuove esistono in tutte le 38 lingue', () => {
    const cart = join(process.cwd(), 'app/lib/locales');
    const lingue = readdirSync(cart).filter(f => f.endsWith('.js'));
    expect(lingue.length).toBe(38);
    for (const f of lingue) {
      const s = readFileSync(join(cart, f), 'utf8');
      for (const k of ['scanCardTitle', 'scanCardDesc', 'addressBookDesc']) {
        expect(s.includes(`"${k}":"`), `${f}/${k}`).toBe(true);
      }
    }
  });
});

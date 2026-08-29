import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.523 → b.580 — l'intenzione resta: icone e testo non devono
// spostarsi a vicenda. La vecchia IconeCiclo/PassoVerticale non esiste
// piu: ogni preferenza e una riga compatta e l'intera riga cicla.
describe('b.580 — preferenze incolonnate e compatte', () => {
  const f = leggi('app/components/ui/PreferenzeMondo.js');

  it('l icona ha una cella fissa e il testo occupa lo spazio elastico', () => {
    expect(f).toMatch(/width: 38, height: 38/);
    expect(f).toMatch(/flexShrink: 0/);
    expect(f).toMatch(/flex: 1, minWidth: 0/);
  });

  it('lo stato attuale resta nel badge bruno sotto il titolo', () => {
    expect(f).toMatch(/background: 'rgba\(140,88,48,0\.34\)'/);
    expect(f).toMatch(/border: '1px solid rgba\(206,146,92,0\.42\)'/);
    expect(f).toMatch(/\{valore\}<\/span>/);
  });

  it('non esistono piu controlli tecnici che possano allargare la riga', () => {
    expect(f).not.toMatch(/IconeCiclo|PassoVerticale|mondoRitmo|mondoModo|mondoAggiorna/);
  });
});

describe('b.580 — il Paese resta una scelta del Mondo, non una preferenza del motore', () => {
  const v = leggi('app/components/MondoView.js');

  it('MondoView mantiene una bozza separata dal paese applicato', () => {
    expect(v).toMatch(/bozzaPaesePanello/);
    expect(v).toMatch(/paeseScelto/);
  });

  it('usa l elenco vero dei Paesi e permette il ritorno al mondo intero', () => {
    expect(v).toMatch(/import \{ PAESI \} from '\.\.\/lib\/paesi\.js'/);
    expect(v).toMatch(/wholeWorld/);
    expect(v).toMatch(/nomePaese\(pa\.codice\)/);
  });
});
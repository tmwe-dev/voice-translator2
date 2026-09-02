import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.597 — audit di Luca sulla traduzione in videochiamata: «non si sa
// come attivarla, come disattivarla». Il comando viveva SOLO dentro il
// cassetto "Altro" (due tocchi, un'icona fra sei righe). Ora e un
// comando primario nella barra, sempre visibile, un tocco.

describe('b.597 — la traduzione e un comando primario, non piu nascosta in "Altro"', () => {
  const f = leggi('app/components/VideoCallOverlay.js');

  it('il comando vive nella barra principale, accanto a microfono e telecamera', () => {
    expect(f).toMatch(/LA TRADUZIONE, PROMOSSA A COMANDO PRIMARIO/);
    expect(f).toMatch(/setInterpreterActive && \(\s*\n\s*<button onClick=\{\(\) => \{/);
  });

  it('non e piu duplicata dentro il cassetto "Altro"', () => {
    // prima c'era `{ chiave: 'interprete', ...}` nell'elenco di "Altro":
    // un solo comando, un solo posto — altrimenti due interruttori per
    // la stessa cosa in due punti diversi confondono piu di prima.
    expect(f).not.toMatch(/chiave: 'interprete'/);
  });

  it('in Stanza Diretta o di gruppo il comando resta tappabile e spiega perche', () => {
    expect(f).toMatch(/if \(stanzaDiretta\) \{ toast\.info\(L\('directNoCloud'\)\); return; \}/);
    expect(f).toMatch(/if \(stanzaConPiuDiDue\) \{ toast\.info\(L\('interpreterTwoOnly'\)\); return; \}/);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ═══ b.496 — TAVOLA 22: IL PROFILO PUBBLICO ═══
// «Chi e, che lingue parla, cosa ha detto. Nient'altro.»
// Le LINGUE accanto al nome (dedotte dai suoi commenti veri — non
// inventate); TRE NUMERI in fila (discussioni, commenti, seguaci);
// le discussioni con l'argomento sotto; Aa in testata.

const vista = readFileSync(join(process.cwd(), 'app/components/MondoPersona.js'), 'utf8');
const db = readFileSync(join(process.cwd(), 'app/lib/mondoDB.js'), 'utf8');

describe('tavola 22 — il profilo pubblico', () => {
  it('le lingue della persona arrivano dai suoi commenti veri', () => {
    expect(db).toMatch(/discussion_id, text, lang, created_at/);
    expect(vista).toMatch(/getLang\(/);
  });

  it('tre numeri in fila: discussioni, commenti, seguaci', () => {
    expect(vista).toMatch(/tabular-nums/);
    expect(vista).toMatch(/discussioni\?\.length/);
  });

  it('le discussioni portano l\'argomento sotto', () => {
    expect(vista).toMatch(/d\.topic/);
  });

  it('Aa sta in testata', () => {
    expect(vista).toMatch(/aria-label=\{L\('textBigger'\)\}/);
  });
});

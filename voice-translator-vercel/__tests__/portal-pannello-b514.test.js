import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.514 — il pannello laterale monta in document.body (createPortal)', () => {
  it('PannelloLaterale usa createPortal cosi il velo fixed non resta prigioniero di un antenato con transform', () => {
    const p = leggi('app/components/ui/PannelloLaterale.js');
    expect(p).toMatch(/import \{ createPortal \} from 'react-dom';/);
    expect(p).toMatch(/return createPortal\(/);
    expect(p).toMatch(/\n\s*document\.body\n\s*\);\n\}/);
  });

  it('il portal aspetta il montaggio lato client (niente document in SSR)', () => {
    const p = leggi('app/components/ui/PannelloLaterale.js');
    expect(p).toMatch(/const \[montato, setMontato\] = useState\(false\);/);
    expect(p).toMatch(/if \(!aperto \|\| !montato\) return null;/);
  });

  it('tutte le maschere con un pannello laterale usano ancora il componente condiviso PannelloLaterale', () => {
    const usi = ['app/components/MondoNews.js', 'app/components/MondoView.js', 'app/components/Life/LifeView.js', 'app/components/RoomView.js'];
    for (const file of usi) {
      const p = leggi(file);
      expect(p).toMatch(/<PannelloLaterale aperto=\{/);
    }
  });
});

// b.579 — il feed non puo mostrare il fondo mentre suona il primo video
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const feed = readFileSync(join(process.cwd(), 'app/components/FeedNotizieMondo.js'), 'utf8');

describe('b.579 — apertura coerente del feed', () => {
  it('separa indice logico dalla diapositiva realmente visibile', () => {
    expect(feed).toMatch(/const \[indiceVisibile, setIndiceVisibile\] = useState\(null\)/);
    expect(feed).toMatch(/setIndiceVisibile\(miglioreIdx\)/);
    expect(feed).toMatch(/setIndiceVisibile\(null\)/);
  });

  it('un player autoplay esiste solo se la sua slide e anche visibile', () => {
    expect(feed).toContain('i === indiceAttivo && i === indiceVisibile ? (');
    expect(feed).toContain('autoplay=1&playsinline=1&enablejsapi=1');
  });

  it('la slide di ricerca finale non nasce durante la fase instabile', () => {
    expect(feed).toContain('{pronto && elementi.length > 0 && onCerca && (');
  });

  it('disattiva lo scroll anchoring che puo trattenere il fondo', () => {
    expect(feed).toContain("overflowAnchor: 'none'");
  });
});

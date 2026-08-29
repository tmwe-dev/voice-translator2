import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

describe('b.544 — il mi piace resta una decisione locale immediata', () => {
  beforeEach(() => localStorage.clear());

  it('normalizza lo stesso articolo in una chiave sola', async () => {
    const { chiaveContenuto } = await import('../app/lib/gradimento.js');
    expect(chiaveContenuto('https://www.ansa.it/x/y/?utm_source=fb&id=3')).toBe(chiaveContenuto('https://ansa.it/x/y?id=3'));
  });

  it('metti e togli il cuore e il telefono se lo ricorda', async () => {
    const { giraCuore, hoMessoCuore } = await import('../app/lib/gradimento.js');
    const u = 'https://ansa.it/notizia';
    expect(giraCuore(u)).toMatchObject({ acceso: true, passo: 1 });
    expect(hoMessoCuore(u)).toBe(true);
    expect(giraCuore(u)).toMatchObject({ acceso: false, passo: -1 });
    expect(hoMessoCuore(u)).toBe(false);
  });
});

describe('b.544 — il conteggio collettivo non registra chi sei', () => {
  const rotta = leggi('app/api/mondo/gradimento/route.js');
  it('accetta solo +1/-1 e non scende sotto zero', () => {
    expect(rotta).toMatch(/const passo = Number\(body\?\.passo\) === -1 \? -1 : 1/);
    expect(rotta).toMatch(/if \(quanti < 0\)/);
  });
  it('non usa identita o sessione', () => expect(rotta).not.toMatch(/userToken|sessione|getSession/));
});

describe('b.544 — il cuore e il feed reale', () => {
  it('la colonnina contiene il cuore', () => expect(feed).toMatch(/chiave: 'cuore', icona: 'heart'/));
  it('si aggiorna localmente prima della rete', () => {
    expect(feed).toMatch(/const esito = giraCuore\(url\)/);
    const dentro = feed.slice(feed.indexOf('const cuore = useCallback'));
    expect(dentro.indexOf('setMiei(')).toBeLessThan(dentro.indexOf("fetch('/api/mondo/gradimento'"));
  });
});

describe('b.544 → b.580 — ultima ratio solo dopo un feed pronto', () => {
  it('il campo per seminare compare solo dopo il primo caricamento e in coda a contenuti reali', () => {
    expect(feed).toMatch(/\{pronto && elementi\.length > 0 && onCerca && \(/);
    const slide = feed.slice(feed.indexOf('{pronto && elementi.length > 0 && onCerca && ('));
    expect(slide.slice(0, 1800)).not.toMatch(/seedMoreTitle|seedMoreDesc|growMoreWord/);
  });

  it('seminando si torna in cima', () => {
    expect(feed).toMatch(/const semina = useCallback\(/);
    expect(feed).toMatch(/setIndiceAttivo\(0\)/);
    expect(feed).toMatch(/scrollTo\(\{ top: 0/);
  });

  it('il feed cresce prima di finire', () => {
    expect(feed).toMatch(/indiceAttivo >= elementi\.length - 3/);
    expect(feed).toMatch(/onCresci\(\)/);
  });
});
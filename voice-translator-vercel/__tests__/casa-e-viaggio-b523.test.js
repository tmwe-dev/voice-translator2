import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paeseDalFuso, paeseDiCasa, poliDelViaggiatore, ricerchePredefinite } from '../app/lib/casaEViaggio.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

describe('b.523 — casa e viaggio senza chiedere geolocalizzazione', () => {
  it('riconosce i fusi noti e non inventa quelli sconosciuti', () => {
    expect(paeseDalFuso('Europe/Rome')).toBe('IT');
    expect(paeseDalFuso('Asia/Shanghai')).toBe('CN');
    expect(paeseDalFuso('America/New_York')).toBe('US');
    expect(paeseDalFuso('Marte/Olympus')).toBeNull();
  });

  it('il profilo vince sulla lingua per il Paese di casa', () => {
    expect(paeseDiCasa({ country: 'it', lang: 'en' })).toBe('IT');
    expect(paeseDiCasa({ lang: 'it' })).toBe('IT');
    expect(paeseDiCasa({})).toBeNull();
  });

  it('un italiano in Cina ha casa IT e presenza CN', () => {
    expect(poliDelViaggiatore({ lang: 'it' }, 'Asia/Shanghai')).toMatchObject({ casa: 'IT', qui: 'CN', inViaggio: true });
    const giri = ricerchePredefinite({ lang: 'it' }, (c) => (c === 'IT' ? 'Italia' : 'Cina'), 'Asia/Shanghai');
    expect(giri.map((g) => g.codice)).toEqual(['IT', 'CN']);
  });
});

describe('b.523 → b.580 — Mondo Live usa casa, qui e Paese scelto', () => {
  const f = leggi('app/components/FinestraSulMondo.js');

  it('calcola i poli del viaggiatore e costruisce una lista senza doppioni', () => {
    expect(f).toMatch(/const poli = useMemo\(\(\) => poliDelViaggiatore\(prefs\)/);
    expect(f).toMatch(/\[poli\.casa, poli\.qui, paese\]\.filter\(Boolean\)/);
    expect(f).toMatch(/new Set/);
  });

  it('manda i Paesi al radar SSE invece di lanciare polling separati', () => {
    expect(f).toMatch(/countries: countries\.join\(','\)/);
    expect(f).toMatch(/new EventSource\(`\/api\/mondo\/live\?/);
    expect(f).not.toMatch(/ricerchePredefinite\(prefs/);
  });

  it('quando arriva un evento il globo vola sul suo Paese reale', () => {
    expect(f).toMatch(/const code = \(prossimo\.countries \|\| \[prossimo\.country\]\)\.filter\(Boolean\)\[0\] \|\| null/);
    expect(f).toMatch(/onPuntaGlobo\?\.\(code\)/);
  });
});

describe('b.523 — la ricerca principale resta fuori dalla sidebar', () => {
  const f = leggi('app/components/MondoNews.js');
  it('il campo viene prima del pannello laterale', () => {
    const campo = f.indexOf("L('newsWhatFollow')");
    const pannello = f.indexOf('<PannelloLaterale');
    expect(campo).toBeGreaterThan(-1);
    expect(campo).toBeLessThan(pannello);
  });
});
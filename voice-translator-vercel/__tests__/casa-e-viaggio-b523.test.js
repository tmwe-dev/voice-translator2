import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paeseDalFuso, paeseDiCasa, poliDelViaggiatore, ricerchePredefinite } from '../app/lib/casaEViaggio.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.523 — Luca: «le preferenze non sono obbligatorie, il default deve
// legare alla posizione geografica e la lingua. il mondo deve seguire
// il "viaggiatore" e deve tenerlo informato anche su cosa accade nel
// suo paese. immaginati un italiano in ferie che vuole leggere la
// gazzetta dello sport al mattino ma si trova in cina».

describe('b.523 — dove mi trovo, dal fuso orario (senza chiedere permessi)', () => {
  it('riconosce il Paese dal fuso', () => {
    expect(paeseDalFuso('Europe/Rome')).toBe('IT');
    expect(paeseDalFuso('Asia/Shanghai')).toBe('CN');
    expect(paeseDalFuso('America/New_York')).toBe('US');
    expect(paeseDalFuso('Europe/London')).toBe('GB');
  });
  it('fuso sconosciuto: null, non un Paese inventato', () => {
    expect(paeseDalFuso('Marte/Olympus')).toBeNull();
    expect(paeseDalFuso('')).toBeNull();
  });
});

describe('b.523 — da dove vengo: prima il profilo, poi la lingua', () => {
  it('il Paese sul profilo vince', () => {
    expect(paeseDiCasa({ country: 'it', lang: 'en' })).toBe('IT');
  });
  it('senza profilo lo dice la lingua', () => {
    expect(paeseDiCasa({ lang: 'it' })).toBe('IT');
  });
  it('senza niente, niente', () => {
    expect(paeseDiCasa({})).toBeNull();
  });
});

describe('b.523 — l italiano in ferie in Cina', () => {
  const prefs = { lang: 'it' };
  const fuso = 'Asia/Shanghai';

  it('ha due poli e risulta in viaggio', () => {
    const p = poliDelViaggiatore(prefs, fuso);
    expect(p.casa).toBe('IT');
    expect(p.qui).toBe('CN');
    expect(p.inViaggio).toBe(true);
  });

  it('senza configurare NIENTE riceve notizie di casa sua E di dove si trova', () => {
    const giri = ricerchePredefinite(prefs, (c) => (c === 'IT' ? 'Italia' : 'Cina'), fuso);
    expect(giri).toHaveLength(2);
    expect(giri[0]).toEqual({ codice: 'IT', query: 'Italia breaking news' });  // prima casa: la Gazzetta del mattino
    expect(giri[1]).toEqual({ codice: 'CN', query: 'Cina breaking news' });
  });

  it('chi NON e in viaggio ha un polo solo, non due uguali', () => {
    const giri = ricerchePredefinite({ lang: 'it' }, () => 'Italia', 'Europe/Rome');
    expect(giri).toHaveLength(1);
    expect(giri[0].codice).toBe('IT');
  });

  it('senza lingua e senza fuso utile non resta a mani vuote', () => {
    const giri = ricerchePredefinite({}, null, 'Marte/Olympus');
    expect(giri).toHaveLength(1);
    expect(giri[0]).toEqual({ codice: null, query: 'breaking news' });
  });
});

describe('b.523 — le breaking usano i due poli quando non c e nessuna preferenza', () => {
  const f = leggi('app/components/FinestraSulMondo.js');
  it('FinestraSulMondo chiama ricerchePredefinite', () => {
    expect(f).toMatch(/import \{ ricerchePredefinite \} from '\.\.\/lib\/casaEViaggio\.js'/);
    expect(f).toMatch(/const giri = ricerchePredefinite\(prefs, nomePaese\)/);
  });
  it('chi ha scelto i suoi argomenti comanda lui, come prima', () => {
    expect(f).toMatch(/if \(interessi\.length\) \{/);
  });
  it('il globo vola sul Paese del giro, non su quello vecchio', () => {
    expect(f).toMatch(/interessi\.length \? null : paeseDelGiro/);
  });
});

describe('b.523 — la ricerca principale sta FUORI dalla sidebar', () => {
  const f = leggi('app/components/MondoNews.js');
  it('il campo e nella pagina, prima del pannello', () => {
    const campo = f.indexOf("L('newsWhatFollow')");
    const pannello = f.indexOf('<PannelloLaterale');
    expect(campo).toBeGreaterThan(-1);
    expect(campo).toBeLessThan(pannello);
  });
  it('cercando non si chiude piu un pannello che non lo contiene', () => {
    const campo = f.indexOf("L('newsWhatFollow')");
    const pannello = f.indexOf('<PannelloLaterale');
    expect(f.slice(campo, pannello)).not.toMatch(/suChiudiStrumenti/);
  });
});

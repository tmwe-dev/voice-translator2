import { describe, expect, it } from 'vitest';
import { deveCercareSulWeb, sogliaFonti, SOGLIE_FONTI } from '../app/lib/topics/servizio.js';

describe('b.585 — discovery semplice', () => {
  it('una ricerca esplicita puo sempre allargarsi al web', () => {
    expect(deveCercareSulWeb({
      ricercaEsplicita: true,
      fontiLette: 20,
      fontiRegistrate: 500,
      soglia: SOGLIE_FONTI.paese,
    })).toBe(true);
  });

  it('un giro automatico non cerca se le fonti hanno gia prodotto abbastanza', () => {
    expect(deveCercareSulWeb({
      ricercaEsplicita: false,
      fontiLette: 6,
      fontiRegistrate: 10,
      soglia: SOGLIE_FONTI.paese,
    })).toBe(false);
  });

  it('un giro automatico non riscopre un ambito gia maturo', () => {
    expect(deveCercareSulWeb({
      ricercaEsplicita: false,
      fontiLette: 2,
      fontiRegistrate: SOGLIE_FONTI.paese,
      soglia: SOGLIE_FONTI.paese,
    })).toBe(false);
  });

  it('un ambito automatico ancora povero puo usare i motori', () => {
    expect(deveCercareSulWeb({
      ricercaEsplicita: false,
      fontiLette: 2,
      fontiRegistrate: 12,
      soglia: SOGLIE_FONTI.paese,
    })).toBe(true);
  });

  it('usa due soli contatori: paese e settore', () => {
    expect(sogliaFonti({ paese: 'IT' })).toBe(SOGLIE_FONTI.paese);
    expect(sogliaFonti({ paese: 'IT', settore: 'cinema' })).toBe(SOGLIE_FONTI.settore);
    expect(sogliaFonti({})).toBe(Infinity);
  });
});

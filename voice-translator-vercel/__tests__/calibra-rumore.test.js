// ═══════════════════════════════════════════════════════════════
// LA CALIBRAZIONE DEL RUMORE, RECUPERATA DALLA SOFFITTA
//
// Stava in app/attic/useVAD.js, in un file che nessuno importava piu.
// L'audit l'ha trovata ed e migliore di quello che l'ha sostituita: al
// suo posto c'erano quattro preset manuali che chiedono all'utente di
// descrivere il proprio ambiente. Ma l'utente non sa quanti decibel ha
// intorno — lo sa il microfono.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { creaCalibratore, sogliaInScala255, COSTANTI_CALIBRAZIONE } from '../app/lib/calibraRumore.js';

const { MISURE, MINIMA, MASSIMA } = COSTANTI_CALIBRAZIONE;
const alimenta = (cal, valore, quante = MISURE) => {
  for (let i = 0; i < quante; i++) cal.aggiungi(valore);
};

describe('il calibratore ascolta prima di decidere', () => {
  it('non e pronto finche non ha abbastanza misure', () => {
    const cal = creaCalibratore();
    alimenta(cal, 0.05, MISURE - 1);
    expect(cal.pronto()).toBe(false);
    cal.aggiungi(0.05);
    expect(cal.pronto()).toBe(true);
  });

  it('prima di essere pronto usa una stima prudente', () => {
    const cal = creaCalibratore();
    expect(cal.soglia()).toBeGreaterThanOrEqual(MINIMA);
    expect(cal.soglia()).toBeLessThanOrEqual(MASSIMA);
  });

  it('in una stanza rumorosa alza la soglia', () => {
    const silenziosa = creaCalibratore(); alimenta(silenziosa, 0.01);
    const rumorosa = creaCalibratore(); alimenta(rumorosa, 0.08);
    expect(rumorosa.soglia()).toBeGreaterThan(silenziosa.soglia());
  });
});

describe('la mediana, non la media', () => {
  it('un solo colpo di tosse non sposta il pavimento del rumore', () => {
    // E' la ragione per cui si usa la mediana: un valore altissimo su
    // sessanta sposta la media e non tocca la mediana.
    const cal = creaCalibratore();
    for (let i = 0; i < MISURE - 1; i++) cal.aggiungi(0.02);
    cal.aggiungi(1.0);   // il colpo di tosse
    expect(cal.pavimento()).toBeCloseTo(0.02, 2);
  });
});

describe('i due limiti che salvano dai casi estremi', () => {
  it('una stanza silenziosissima non fa diventare voce ogni respiro', () => {
    const cal = creaCalibratore(); alimenta(cal, 0);
    expect(cal.soglia()).toBe(MINIMA);
  });

  it('una stanza assordante non impedisce a tutti di parlare', () => {
    const cal = creaCalibratore(); alimenta(cal, 1);
    expect(cal.soglia()).toBe(MASSIMA);
  });
});

describe('robustezza', () => {
  it('i valori non numerici non sporcano la misura', () => {
    const cal = creaCalibratore();
    cal.aggiungi(NaN); cal.aggiungi(undefined); cal.aggiungi('forte');
    expect(cal.pronto()).toBe(false);
  });

  it('azzerando si ricomincia da capo', () => {
    const cal = creaCalibratore();
    alimenta(cal, 0.09);
    expect(cal.pronto()).toBe(true);
    cal.azzera();
    expect(cal.pronto()).toBe(false);
  });

  it('la conversione di scala e coerente e non sfora', () => {
    expect(sogliaInScala255(0)).toBe(0);
    expect(sogliaInScala255(1)).toBe(255);
    expect(sogliaInScala255(2)).toBe(255);
    expect(sogliaInScala255(-1)).toBe(0);
  });
});

describe('e collegata al codice vivo', () => {
  const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');

  it('esiste il preset "auto" e chiede la calibrazione', () => {
    expect(leggi('lib/constants.js')).toMatch(/auto:\s*\{[^}]*calibra: true/);
  });

  it('il ciclo del microfono usa la soglia calibrata', () => {
    const vad = leggi('hooks/useFreeTalkVAD.js');
    expect(vad).toMatch(/creaCalibratore\(\)/);
    expect(vad, 'la soglia deve poter cambiare durante l\'ascolto').toMatch(/sogliaOra/);
    expect(vad).toMatch(/cal\.pronto\(\)/);
  });

  it('la sensibilita manuale resta possibile', () => {
    // Recuperare l'automatico non deve togliere la scelta a chi la vuole.
    const cost = leggi('lib/constants.js');
    for (const p of ['quiet', 'normal', 'noisy', 'street']) {
      expect(cost).toMatch(new RegExp(`${p}:\\s*\\{`));
    }
  });
});

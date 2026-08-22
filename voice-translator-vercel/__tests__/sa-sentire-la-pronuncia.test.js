import { describe, it, expect } from 'vitest';
import { valutaPronuncia } from '../app/lib/compagni/corsi/pronuncia.js';
import { analizza, confronta, qualityGate } from '../app/lib/fonia.js';

// ═══════════════════════════════════════════════════════════════
// SA SENTIRE LA PRONUNCIA? — la domanda di Luca, messa alla prova.
//
// b.373. Luca ha chiesto: «verificare se il sistema e in grado di capire
// se la dizione e corretta». Non si risponde a parole: si misura.
//
// Il giudizio sta su DUE strati, e questa prova li interroga tutti e due
// separatamente, perche sbagliano in modi diversi:
//
//   1. LE PAROLE — quello che la trascrizione capisce. Risponde a "ti
//      farebbero ripetere?". Se la macchina non ti capisce, un
//      madrelingua nemmeno.
//   2. LA MELODIA E IL RITMO — misurati qui in casa sull'onda. Risponde
//      a "suoni straniero anche quando ti capiscono?". E' lo strato che
//      prende l'italiano che legge l'inglese tutto piatto.
//
// COSA QUESTA PROVA PROTEGGE. Sono numeri di taratura: soglie, penali,
// pesi. Si spostano con una riga e nessuno se ne accorge finche uno
// studente non si vede dare 90 a una frase detta male — e a quel punto
// non si fida piu del punteggio, che e l'unica cosa che rende utile
// l'esercizio.
// ═══════════════════════════════════════════════════════════════

const SR = 16000;

/** Un parlato finto: un tono che segue una melodia, con le sue pause. */
function voce({ melodia, durata = 2.0, pause = [], volume = 1 }) {
  const n = Math.round(SR * durata);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (pause.some(([a, b]) => t >= a && t < b)) { x[i] = 0; continue; }
    fase += (2 * Math.PI * melodia(t)) / SR;
    x[i] = volume * 0.5 * (Math.sin(fase) + 0.5 * Math.sin(2 * fase) + 0.25 * Math.sin(3 * fase));
  }
  return x;
}

const FRASE = 'I think this is the third one';
const voto = (detto) => valutaPronuncia(FRASE, detto, 'en').punteggio;
const rosse = (detto) => valutaPronuncia(FRASE, detto, 'en').parole.filter(p => !p.ok && !p.vicino).map(p => p.parola);

describe('strato 1 — ti hanno capito?', () => {
  it('detta bene fa il pieno', () => {
    expect(voto('I think this is the third one')).toBe(100);
  });

  it('il "th" detto alla italiana costa, e si vede QUALE parola', () => {
    // e l'errore piu comune di un italiano in inglese: think -> tink
    const p = voto('I tink dis is de turd one');
    expect(p).toBeLessThan(70);
    expect(p).toBeGreaterThan(30);           // capibile a fatica, non "altra frase"
    expect(rosse('I tink dis is de turd one')).toContain('this');
  });

  it('saltare una parola si nota, ma non affossa la frase', () => {
    const p = voto('I think this the third one');
    expect(p).toBeLessThan(95);
    expect(p).toBeGreaterThan(75);
    expect(rosse('I think this the third one')).toContain('is');
  });

  it('unaltra frase non puo prendere un buon voto', () => {
    expect(voto('the weather is nice today')).toBeLessThan(40);
  });

  it('leggere a caso tante parole non gonfia il punteggio', () => {
    expect(voto('I think this is the third one and many other random words here'))
      .toBeLessThan(100);
  });
});

describe('strato 2 — suoni straniero?', () => {
  const melodiaViva = (t) => 130 + 40 * Math.sin(t * Math.PI * 2);
  const rif = analizza(voce({ melodia: melodiaViva, pause: [[0.45, 0.55]] }), SR);
  const somiglianza = (onda) => confronta(rif, analizza(onda, SR)).somiglianza;

  it('una voce piu acuta che dice la STESSA melodia non viene punita', () => {
    // e il punto della misura in semitoni: uomo e donna alla pari
    expect(somiglianza(voce({ melodia: (t) => 200 + 62 * Math.sin(t * Math.PI * 2), pause: [[0.45, 0.55]] })))
      .toBeGreaterThan(85);
  });

  it('la melodia PIATTA — il tipico "letto dal libro" — viene presa', () => {
    expect(somiglianza(voce({ melodia: () => 130, pause: [[0.45, 0.55]] }))).toBeLessThan(60);
  });

  it('la melodia ROVESCIATA e il caso peggiore, e prende il voto peggiore', () => {
    // sale dove doveva scendere: in una domanda cambia il senso
    expect(somiglianza(voce({ melodia: (t) => 130 - 40 * Math.sin(t * Math.PI * 2), pause: [[0.45, 0.55]] })))
      .toBeLessThan(25);
  });

  it('parlare a meta velocita costa, ma non azzera', () => {
    const s = somiglianza(voce({ melodia: melodiaViva, durata: 4.0, pause: [[0.45, 0.55]] }));
    expect(s).toBeLessThan(85);
    expect(s).toBeGreaterThan(50);
  });
});

describe('il filtro: un campione inaffidabile NON si giudica', () => {
  it('registrazione buona: si giudica', () => {
    expect(qualityGate(voce({ melodia: () => 130 }), SR).ok).toBe(true);
  });

  it('troppo corta: si ferma e lo dice', () => {
    const g = qualityGate(voce({ melodia: () => 130, durata: 0.2 }), SR);
    expect(g.ok).toBe(false);
    expect(String(g.motivo).length).toBeGreaterThan(10);
  });

  it('microfono muto: si ferma, non da zero', () => {
    // dare zero a chi ha il microfono spento e la peggiore delle bugie
    expect(qualityGate(new Float32Array(SR * 2), SR).ok).toBe(false);
  });

  it('audio distorto: si ferma', () => {
    expect(qualityGate(voce({ melodia: () => 130, volume: 9 }), SR).ok).toBe(false);
  });
});

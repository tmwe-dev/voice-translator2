// ═══════════════════════════════════════════════════════════════
// GUARDIA SUL VELO
//
// La tendina copre, non cancella. Quindi il rischio grosso non e velare
// troppo poco: e velare cose innocue, perche allora la gente smette di
// fidarsi e apre tutto senza guardare.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { daVelare, velare } from '../app/lib/velo.js';

const APP = path.join(__dirname, '..', 'app');
const leggi = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

describe('cosa va coperto', () => {
  it('un insulto pesante si vela', () => {
    expect(daVelare('ma vaffanculo va').velare).toBe(true);
    expect(daVelare('you are a fucking idiot').velare).toBe(true);
    expect(daVelare('eres un gilipollas').velare).toBe(true);
  });

  it('non si aggira con le maiuscole o gli accenti', () => {
    expect(daVelare('VAFFANCULO').velare).toBe(true);
    expect(daVelare('Cabrón').velare).toBe(true);
  });

  it('non si aggira scrivendo con i numeri o gli asterischi', () => {
    expect(daVelare('sei uno str0nzo').velare).toBe(true);
    expect(daVelare('f*ck you').velare).toBe(true);
    expect(daVelare('sh1t').velare).toBe(true);
  });

  it('non si aggira allungando le lettere', () => {
    expect(daVelare('stroooonzo').velare).toBe(true);
  });

  it('urlare in maiuscolo con tre punti esclamativi si vela', () => {
    expect(daVelare('NON TI SOPPORTO PIU!!!').velare).toBe(true);
    expect(daVelare('NON TI SOPPORTO PIU!!!').motivo).toBe('sta urlando');
  });
});

describe('cosa NON va coperto — la parte che conta di piu', () => {
  it('una conversazione normale resta scoperta', () => {
    expect(daVelare('Buongiorno, dove posso trovare un taxi?').velare).toBe(false);
    expect(daVelare('Non sono d’accordo con te, e ti spiego perche').velare).toBe(false);
    expect(daVelare('Good morning, where can I find a taxi?').velare).toBe(false);
  });

  it('una parola che ne CONTIENE un\'altra non si vela', () => {
    // Il classico problema di Scunthorpe: chi filtra per sottostringa
    // finisce per censurare nomi di citta e cognomi.
    expect(daVelare('gli ho dato un cazzotto').velare).toBe(false);
    expect(daVelare('mi passi le analisi?').velare).toBe(false);
    expect(daVelare('vado a Scunthorpe domani').velare).toBe(false);
    expect(daVelare('ho comprato della merce').velare).toBe(false);
  });

  it('una frase maiuscola senza rabbia non si vela', () => {
    expect(daVelare('ATTENZIONE AL GRADINO').velare).toBe(false);
    expect(daVelare('OK!').velare).toBe(false);
  });

  it('un testo vuoto o assente non fa saltare niente', () => {
    expect(daVelare('').velare).toBe(false);
    expect(daVelare(null).velare).toBe(false);
    expect(daVelare(undefined).velare).toBe(false);
    expect(daVelare(42).velare).toBe(false);
  });
});

describe('il verdetto del server, quando c\'e, comanda', () => {
  it('un messaggio segnalato dal server si vela anche se le parole sono pulite', () => {
    const m = { original: 'ti aspetto sotto casa', moderazione: { velare: true, motivo: 'contenuto grave' } };
    expect(velare(m)).toEqual({ velare: true, motivo: 'contenuto grave' });
  });

  it('senza verdetto si guarda il testo', () => {
    expect(velare({ original: 'vaffanculo' }).velare).toBe(true);
    expect(velare({ original: 'ciao come stai' }).velare).toBe(false);
    expect(velare(null).velare).toBe(false);
  });
});

describe('la tendina in pagina', () => {
  const velo = leggi('components/Velo.js');
  const lista = leggi('components/MessageList.js');

  it('copre ma non cancella: si puo scoprire', () => {
    expect(velo).toMatch(/Tocca per leggere/);
    expect(velo).toMatch(/setScoperto\(true\)/);
  });

  it('e si puo richiudere, per chi si pente', () => {
    expect(velo).toMatch(/veloCoverAgain/);
  });

  it('dice PERCHE e li: una macchia grigia muta sembra un guasto', () => {
    // b.138 — la frase c'e ancora, ma sta nei pacchetti lingua: nel
    // codice si controlla la chiave, non l'italiano.
    expect(velo).toMatch(/veloHeavy/);
    expect(velo).toMatch(/veloShouting/);
  });

  it('il testo coperto non viene letto dalla sintesi vocale per sbaglio', () => {
    expect(velo).toMatch(/aria-hidden="true"/);
    expect(velo, 'ma il pulsante deve dirlo').toMatch(/aria-label=/);
  });

  it('quello che scrivo io non me lo copre in faccia', () => {
    // So cosa ho scritto: coprirmelo sarebbe solo fastidioso.
    expect(lista).toMatch(/attivo=\{!isMine\}/);
  });

  it('se non c\'e niente da coprire il messaggio esce identico a prima', () => {
    expect(lista).toMatch(/if \(!esito\.velare\) return children;/);
  });
});

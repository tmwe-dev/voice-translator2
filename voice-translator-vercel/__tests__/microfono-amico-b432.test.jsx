// b.432 — «pagina amico life manca il microfono».
//
// Collaudo di Luca. Era vero alla lettera: li dentro l'unico microfono e
// quello di «Dal vivo», che apre una telefonata. Dettare nel campo — la
// cosa piu ovvia da fare parlando con un Compagno — non si poteva.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── il riconoscimento del telefono, finto ──
let ultimo = null;
class Finto {
  constructor() { ultimo = this; this.acceso = false; }
  start() { this.acceso = true; }
  stop() { this.acceso = false; this.onend?.(); }
  pezzo(t, definitivo = false) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: t }, isFinal: definitivo }] });
  }
}

beforeEach(() => { ultimo = null; global.window.SpeechRecognition = Finto; });
afterEach(() => { delete global.window.SpeechRecognition; vi.resetModules(); });

describe('la dettatura sta in un posto solo', () => {
  it('il telefono che non sa ascoltare lo dice, invece di far comparire un microfono morto', async () => {
    const { dettaturaDisponibile } = await import('../app/lib/dettatura.js');
    expect(dettaturaDisponibile()).toBe(true);
    delete global.window.SpeechRecognition;
    expect(dettaturaDisponibile()).toBe(false);
    global.window.SpeechRecognition = Finto;
  });

  it('manda il testo mentre arriva, cosi si vede scrivere', async () => {
    const { ascolta } = await import('../app/lib/dettatura.js');
    const visti = [];
    ascolta({ lingua: 'it', suTesto: (t) => visti.push(t) });
    ultimo.pezzo('Buon');
    ultimo.pezzo('Buongiorno');
    expect(visti).toEqual(['Buon', 'Buongiorno']);
  });

  it('continua da quello che c\'era gia nel campo', async () => {
    const { ascolta } = await import('../app/lib/dettatura.js');
    let visto = '';
    ascolta({ lingua: 'it', inizio: 'Ciao', suTesto: (t) => { visto = t; } });
    ultimo.pezzo('come stai');
    expect(visto).toBe('Ciao come stai');
  });

  it('alla chiusura consegna solo cio che era DEFINITIVO', async () => {
    // un residuo provvisorio potrebbe dire una cosa diversa da quella che
    // si e sentita, e chi legge non avrebbe modo di accorgersene.
    const { ascolta } = await import('../app/lib/dettatura.js');
    let finale = null;
    const s = ascolta({ lingua: 'it', suTesto: () => {}, suFine: (t) => { finale = t; } });
    ultimo.pezzo('Buongiorno', true);
    ultimo.pezzo('vorrei forse');      // provvisorio, non confermato
    s.ferma();
    expect(finale).toBe('Buongiorno');
  });

  it('il silenzio non e un guasto: non chiude la dettatura', async () => {
    const { ascolta } = await import('../app/lib/dettatura.js');
    let chiusa = false;
    ascolta({ lingua: 'it', suTesto: () => {}, suFine: () => { chiusa = true; } });
    ultimo.onerror?.({ error: 'no-speech' });
    expect(chiusa, 'una pausa non deve far sembrare rotto il microfono').toBe(false);
  });

  it('fermarla due volte non e un guasto', async () => {
    const { ascolta } = await import('../app/lib/dettatura.js');
    const s = ascolta({ lingua: 'it', suTesto: () => {} });
    expect(() => { s.ferma(); s.ferma(); }).not.toThrow();
  });
});

describe('il microfono nella pagina Amico', () => {
  it('c\'e, ed e accanto al campo', () => {
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    expect(a, 'si chiede se il telefono sa ascoltare').toMatch(/dettaturaDisponibile\(\)/);
    expect(a, 'e il tasto porta l\'etichetta giusta').toMatch(/aria-label=\{L\('dictateWord'\)\}/);
  });

  it('NON e una quarta copia: la dettatura viene dal posto comune', () => {
    // La stessa cosa era gia scritta a mano in tre punti. Il diario ha
    // gia curato questa malattia una volta (b.409, il lettore delle news).
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    expect(a).toMatch(/from '\.\.\/\.\.\/lib\/dettatura\.js'/);
    expect(a, 'niente riconoscimento costruito qui dentro').not.toMatch(/webkitSpeechRecognition/);
  });

  it('non invia da solo: la frase la rileggi prima di mandarla', () => {
    // qui si parla con qualcuno che risponde, non si consegna una
    // traduzione al volo: sono due gesti diversi.
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    const dentro = a.slice(a.indexOf('const detta ='), a.indexOf('const invia ='));
    expect(dentro, 'la dettatura non chiama l\'invio').not.toMatch(/invia\(\)/);
  });

  it('uscendo dalla schermata il microfono si chiude', () => {
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    expect(a).toMatch(/ascoltoRef\.current\?\.ferma\(\); ascoltoRef\.current = null/);
  });

  it('la riga in basso ha le misure del kit', () => {
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    expect(a, 'campo alto 54').toMatch(/height: 54, padding: '0 14px', borderRadius: 16/);
    expect(a, 'testo 16: sotto, il telefono ingrandisce la pagina da solo').toMatch(/fontSize: 16, fontFamily: FONT, outline: 'none'/);
    expect(a, 'i due tasti quadri').toMatch(/width: 54, height: 54, borderRadius: 16/);
  });

  it('non si puo mandare il vuoto', () => {
    const a = senzaCommenti(leggi('app/components/Life/AmicoChat.js'));
    expect(a).toMatch(/disabled=\{attende \|\| !testo\.trim\(\)\}/);
  });
});

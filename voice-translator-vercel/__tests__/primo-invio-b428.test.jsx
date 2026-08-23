// b.428 — «la traduzione non e partita con il primo messaggio».
//
// Collaudo di Luca, e il secondo pezzo dello stesso messaggio: «se clicco
// sul microfono registro, quando lo clicco di nuovo deve inviare il
// messaggio e leggerlo».
//
// Questa prova rifa il gesto vero, col riconoscimento vocale finto: si
// preme il microfono, arrivano i pezzi della frase come arrivano davvero
// (prima un pezzo, poi la frase intera), si preme di nuovo per chiudere.
// Alla fine ci si aspetta due cose sole: la traduzione e stata CHIESTA, e
// la voce ha letto.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

let prefsCorrenti = { lang: 'it', name: 'Prova' };
vi.mock('../app/contexts/AppContext.js', () => ({
  useApp: () => ({
    L: (k) => k, S: { colors: {} },
    prefs: prefsCorrenti, savePrefs: () => {}, setView: () => {},
  }),
}));
let letteDalTelefono = [];
vi.mock('../app/lib/voceSistema.js', () => ({
  parlaColSistema: async (t) => { letteDalTelefono.push(t); return true; },
}));

import PrimaProva from '../app/components/PrimaProva.js';

// ── il riconoscimento vocale finto, con i tempi veri ──
let ultimoRec = null;
class RiconoscimentoFinto {
  constructor() { this.lang = ''; ultimoRec = this; }
  start() { this.acceso = true; }
  stop() { this.acceso = false; /* il vero chiama onend poco dopo */ }
  // pezzi come li manda il browser: prima volatili, poi definitivi
  pezzo(testo, definitivo = false) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: testo }, isFinal: definitivo }] });
  }
  chiude() { this.onend?.(); }
}

let chiamate = [];
beforeEach(() => {
  chiamate = []; letteDalTelefono = [];
  ultimoRec = null;
  global.window.SpeechRecognition = RiconoscimentoFinto;
  global.fetch = async (url) => {
    chiamate.push(String(url));
    if (String(url) === '/api/translate') {
      return { ok: true, status: 200, json: async () => ({ translated: 'Good morning' }) };
    }
    // nessuna voce dai server: parlera il telefono
    return { ok: false, status: 503, blob: async () => null, json: async () => null };
  };
});
afterEach(() => { cleanup(); delete global.window.SpeechRecognition; });

const mic = (c) => [...c.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '') === 'dictateWord');
const respira = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 30)); }); };

describe('il primo messaggio dettato', () => {
  it('premendo il microfono la seconda volta, la frase parte e viene letta', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);

    // 1. si preme: comincia a registrare
    await act(async () => { mic(container).click(); });
    expect(ultimoRec, 'il riconoscimento e partito').toBeTruthy();

    // 2. la frase arriva a pezzi, come fa davvero
    await act(async () => { ultimoRec.pezzo('Buongiorno'); });
    await act(async () => { ultimoRec.pezzo('Buongiorno vorrei andare all aeroporto', true); });
    await respira();

    // 3. si preme di nuovo: deve INVIARE e LEGGERE
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.chiude(); });
    await respira();
    await respira();

    expect(chiamate.filter((u) => u === '/api/translate').length,
      'la traduzione e stata chiesta').toBeGreaterThan(0);
    expect(container.textContent, 'e la frase tradotta si legge').toContain('Good morning');
    expect(letteDalTelefono.length, 'e la voce ha letto').toBeGreaterThan(0);
  });

  it('se arriva un pezzo IN RITARDO dopo la chiusura, la frase non si perde', async () => {
    // il caso vero che rompeva tutto: la risposta torna mentre il testo e
    // gia cresciuto, la resa viene scartata come «sta ancora allungando»,
    // e la firma anti-doppione resta armata su quella frase — che da quel
    // momento non si puo piu chiedere.
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.pezzo('Buongiorno'); });
    await respira();
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.chiude(); });
    // il pezzo in ritardo, che allunga la frase gia mandata
    await act(async () => { ultimoRec.pezzo('Buongiorno vorrei', true); });
    await respira(); await respira();
    // e adesso si aspetta: qualcosa DEVE essere arrivato a schermo
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
    await respira();
    expect(container.textContent, 'la frase non e sparita nel nulla').toContain('Good morning');
  });
});

describe('quando il primo tentativo va storto', () => {
  it('la stessa frase si puo RICHIEDERE: non resta bruciata per sempre', async () => {
    // Il caso di Luca: «la traduzione non e partita con il primo
    // messaggio». Basta un singhiozzo — rete lenta, funzione fredda, un
    // 429 — e la prima chiamata non torna con niente.
    // Il difetto non e il singhiozzo: e che la firma anti-doppione resta
    // ARMATA su quella frase. Da quel momento riprovare la stessa frase
    // non produce piu nulla: ne una chiamata, ne un errore, ne un segno.
    // Chi ci prova pensa che l'app sia morta, e non ha torto.
    let giro = 0;
    global.fetch = async (url) => {
      chiamate.push(String(url));
      if (String(url) === '/api/translate') {
        giro += 1;
        if (giro === 1) return { ok: false, status: 503, json: async () => null };
        return { ok: true, status: 200, json: async () => ({ translated: 'Good morning' }) };
      }
      return { ok: false, status: 503, blob: async () => null, json: async () => null };
    };

    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    const campo = container.querySelector('textarea');
    const scrivi = async (t) => {
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(campo.constructor.prototype, 'value').set;
        set.call(campo, t);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    const invia = () => [...container.querySelectorAll('button')]
      .find((b) => (b.getAttribute('aria-label') || '') === 'sendWord');

    await scrivi('Buongiorno');
    await act(async () => { invia().click(); });
    await respira();
    expect(giro, 'il primo tentativo e partito ed e andato storto').toBe(1);

    // si riprova la STESSA frase, come farebbe chiunque
    await act(async () => { invia().click(); });
    await respira(); await respira();

    expect(giro, 'il secondo tentativo deve partire davvero').toBe(2);
    expect(container.textContent, 'e stavolta la frase arriva').toContain('Good morning');
  });
});

describe('il secondo tocco sul microfono e un ordine, non un suggerimento', () => {
  it('manda la frase anche se il browser non avvisa mai della chiusura', async () => {
    // Su alcuni telefoni l'avviso di fine ascolto arriva tardi o non
    // arriva affatto. Finora era LUI a mandare la frase: se taceva, il
    // secondo tocco non faceva niente e la frase restava nel campo.
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.pezzo('Buongiorno', true); });
    await respira();
    // secondo tocco — e il browser NON chiama mai `chiude()`
    await act(async () => { mic(container).click(); });
    await respira(); await respira();
    expect(chiamate.filter((u) => u === '/api/translate').length,
      'la frase e partita lo stesso').toBeGreaterThan(0);
    expect(container.textContent).toContain('Good morning');
  });

  it('e se il browser avvisa DOPO, non parte due volte', async () => {
    const { container } = render(<PrimaProva onChiudi={() => {}} />);
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.pezzo('Buongiorno', true); });
    await respira();
    await act(async () => { mic(container).click(); });
    await act(async () => { ultimoRec.chiude(); });
    await respira(); await respira();
    expect(chiamate.filter((u) => u === '/api/translate').length,
      'una sola richiesta, non due').toBe(1);
  });
});

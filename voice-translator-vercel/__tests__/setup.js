// Vitest setup file
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js server imports
//
// b.363 — Il finto NextResponse costruiva una risposta vera e poi la
// spalmava dentro un oggetto qualsiasi (`{ ...new Response(...) }`).
// Una Response non ha proprieta proprie: sta tutto sul suo prototipo.
// Risultato: ogni intestazione — il content-type, i permessi di origine,
// le intestazioni di sicurezza — spariva nel passaggio, e nessun test di
// tutto il progetto poteva accorgersi se una risposta le perdeva davvero.
// Ora si restituisce la risposta vera, con le sue intestazioni intatte, e
// le si aggiunge soltanto la scorciatoia che restituisce i dati gia
// pronti senza doverli rileggere dal corpo.
//
// b.363 — Inoltre il finto NextResponse era un oggetto semplice, non
// qualcosa che si potesse costruire con `new`. Il middleware vero
// costruisce le sue risposte di rifiuto proprio cosi: nessun test poteva
// chiamarlo davvero senza farlo esplodere, e infatti la regola delle
// origini veniva ricopiata a mano dentro i test invece di essere provata.
vi.mock('next/server', () => {
  class NextResponse extends Response {
    static json(data, init) {
      const intestazioni = new Headers(init?.headers || {});
      if (!intestazioni.has('content-type')) {
        intestazioni.set('content-type', 'application/json');
      }
      const risposta = new NextResponse(JSON.stringify(data), {
        ...init,
        headers: intestazioni,
      });
      risposta.json = async () => data;
      return risposta;
    }

    static next() {
      return new NextResponse(null);
    }
  }

  return { NextResponse };
});

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { createElement as e } from 'react';

// ═══════════════════════════════════════════════════════════════
// b.539 — LE SCHERMATE SI MONTANO DAVVERO.
//
// La schermata rossa che Luca ha visto («getStyles is not a function»)
// e' passata attraverso QUATTORDICI prove verdi. Tutte leggevano il
// testo del file — «c'e scritto StanzeView? c'e scritto onJoinRoom?» —
// e il testo era giusto: sbagliata era una riga di import, che si vede
// solo FACENDO PARTIRE il componente.
//
// Da b.406 il motore delle prove sa compilare il JSX dentro i .js: gli
// ostacoli tecnici per montarli non ci sono piu. Qui si montano le
// schermate nuove e si controlla la sola cosa che conta a questo
// livello: che non muoiano. Non e' una prova di grafica — e' il
// rilevatore di fumo.
// ═══════════════════════════════════════════════════════════════

// Il contesto vero tira dentro mezza applicazione: qui serve solo che
// le schermate ricevano cio che chiedono.
const finto = {
  L: (k) => k,
  setView: vi.fn(),
  theme: 'deep',
  prefs: { lang: 'it', name: 'Luca' },
  savePrefs: vi.fn(),
  userToken: null,
  S: null,
};
vi.mock('../app/contexts/AppContext.js', async () => {
  const vero = await vi.importActual('../app/contexts/AppContext.js');
  return { ...vero, useApp: () => finto };
});

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ rooms: [] }) }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('b.539 — le schermate nuove si montano senza morire', () => {
  it('StanzeView parte (era LEI a morire: import a graffe di un default)', async () => {
    const { default: StanzeView } = await import('../app/components/StanzeView.js');
    expect(() => render(e(StanzeView, { onJoinRoom: vi.fn(), onCreateRoom: vi.fn() }))).not.toThrow();
    // e disegna le sue due sezioni: «Aperte adesso» c'e sempre
    expect(screen.getByText('openNowWord')).toBeTruthy();
  });

  it('e con stanze vere disegna l\'argomento vivo, non il codice della stanza', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ rooms: [{
        roomId: 'AB12CD34', nome: 'Bar dello sport', host: 'Ada', hostLang: 'de', memberCount: 3,
        ultimo: { testo: 'Wer gewinnt heute?', traduzioni: { it: 'Chi vince oggi?' }, quando: Date.now() },
      }] }),
    }));
    const { default: StanzeView } = await import('../app/components/StanzeView.js');
    render(e(StanzeView, { onJoinRoom: vi.fn(), onCreateRoom: vi.fn() }));
    // l'attesa e' la stessa di chi guarda: la frase compare quando la
    // rete risponde.
    expect(await screen.findByText('Chi vince oggi?')).toBeTruthy();
    expect(screen.getByText('Bar dello sport')).toBeTruthy();   // il nome scende di servizio
  });

  it('TendinaVetro parte, e il pannello si apre solo quando lo si tocca', async () => {
    const { default: TendinaVetro } = await import('../app/components/ui/TendinaVetro.js');
    const opzioni = [{ id: 'it', label: 'Italiano', icona: '🇮🇹' }, { id: 'en', label: 'English' }];
    expect(() => render(e(TendinaVetro, {
      valore: 'it', opzioni, onScegli: vi.fn(), targa: 'lingua', C: { accent: '#5b8cff' },
    }))).not.toThrow();
    expect(screen.getByText('Italiano')).toBeTruthy();
    // chiusa: l'altra voce non c'e ancora
    expect(screen.queryByText('English')).toBeNull();
  });

  it('AvvisoSessione non disegna niente quando la sessione e viva', async () => {
    const { default: AvvisoSessione } = await import('../app/components/AvvisoSessione.js');
    const { container } = render(e(AvvisoSessione, {}));
    expect(container.innerHTML).toBe('');
  });
});

describe('b.539 — «perche questo contenuto non ha tasti?» (Luca)', () => {
  const feed = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'app/components/FeedNotizieMondo.js'), 'utf8');

  it('la colonnina esiste, e sta sul bordo destro lontano dai comandi del player', () => {
    expect(feed).toMatch(/function Azioni\(\{ voci \}\)/);
    const col = feed.slice(feed.indexOf('function Azioni'), feed.indexOf('function Azioni') + 900);
    expect(col).toMatch(/right: 10, top: '50%'/);          // meta altezza, a destra
    expect(col).not.toMatch(/bottom: \d/);                  // MAI in fondo: li c'e YouTube
    expect(col).toMatch(/width: 46, height: 46/);           // bersaglio da dito
  });

  it('i VIDEO ora hanno Parlane e la porta verso YouTube', () => {
    const slideVideo = feed.slice(feed.indexOf("{el.tipo === 'video' ?"), feed.indexOf('b.535 — Luca: «il menu di youtube'));
    expect(slideVideo).toMatch(/<Azioni voci=\{\[/);
    expect(slideVideo).toMatch(/onParlane\?\.\(\{ titolo: el\.dati\.titolo/);
    expect(slideVideo).toMatch(/youtube\.com\/watch\?v=\$\{el\.dati\.id\}/);
  });

  it('e gli ARTICOLI hanno le stesse porte nello stesso posto', () => {
    const dopo = feed.slice(feed.indexOf('le stesse porte dei video'));
    expect(dopo).toMatch(/onApriArticolo\?\.\(el\.dati\)/);
    expect(dopo).toMatch(/onParlane\?\.\(el\.dati\)/);
    // e la porta esterna solo se un indirizzo c'e davvero
    expect(dopo).toMatch(/el\.dati\.url \? \{ chiave: 'fuori'/);
  });
});

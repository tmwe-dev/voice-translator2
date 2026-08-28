import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { nomePaese } from '../app/lib/schedaMondo.js';
import { createElement as e } from 'react';
import FeedNotizieMondo from '../app/components/FeedNotizieMondo.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const feed = leggi('app/components/FeedNotizieMondo.js');

// ═══════════════════════════════════════════════════════════════
// b.546 — IL COLLAUDO DI LUCA SUL FEED, tre frasi:
//   «hai rotto il passaggio, passando al prossimo video non lo riproduce»
//   «mostra sempre una sola miniatura e mai due affiancate» +
//   «non vedo bandiere negli articoli ne le fonti, mostra la bandiera e
//    l'origine e che si veda bene»
//   «parlane non deve occupare tutto quello spazio»
//
// PERCHE' QUESTE PROVE MONTANO IL COMPONENTE DAVVERO, e non leggono il
// sorgente con un'espressione regolare come tutte le altre del feed:
// perche' il difetto piu grave del passaggio rotto era invisibile al
// sorgente. Il feed non arrivava piu a disegnarsi — l'effetto dei cuori
// di b.544 nominava `elementi` nel proprio elenco di dipendenze mentre
// `elementi` era dichiarato venti righe piu sotto, e leggere una `const`
// non ancora inizializzata ferma JavaScript sul colpo. Nove file di
// prove passavano tutti, e in mano a Luca non funzionava niente.
// Da qui in avanti, sul feed, almeno una prova lo MONTA.
// ═══════════════════════════════════════════════════════════════

// osservatore finto: si tiene da parte cosa gli e stato chiesto di
// guardare e con quali soglie, e si puo far parlare a comando.
let ultimoOsservatore = null;
class OsservatoreFinto {
  constructor(richiamo, opzioni) {
    this.richiamo = richiamo;
    this.opzioni = opzioni;
    this.guardati = [];
    ultimoOsservatore = this;
  }
  observe(n) { this.guardati.push(n); }
  unobserve() {}
  disconnect() { this.guardati = []; }
  // «di queste slide adesso si vede tanto cosi»
  racconta(quote) {
    // dentro `act`: e un avviso che arriva da fuori React, come nel
    // browser, e il disegno che ne segue va aspettato.
    act(() => this.richiamo(quote.map(([i, area]) => ({
      isIntersecting: area > 0, intersectionRatio: area,
      target: { dataset: { indice: String(i) } },
    })), this));
  }
}

const C = { bg: '#05070f', accent: '#5b8cff', purple: '#8b5bff' };
const L = (k) => k;

const articolo = (n, dominio, fonte) => ({
  id: `a${n}`, titolo: `Titolo ${n}`, sintesi: 'due righe', url: `https://${dominio}/n${n}`,
  immagine: `https://${dominio}/foto${n}.jpg`,
  fonti: [{ fonte, dominio }],
});
const filmato = (n) => ({ id: `vid${n}`, titolo: `Video ${n}`, canale: `Canale ${n}`, miniatura: 'https://y/t.jpg' });

// b.546 — il feed vive in un PORTALE su document.body (Sovrapposizione,
// b.516): il `container` che torna da render() resta vuoto, e le cose
// si cercano nel documento. E' la stessa ragione per cui l'osservatore
// non nasceva — vale la pena che si veda anche qui.
const monta = (extra = {}) => {
  render(e(FeedNotizieMondo, {
    aperto: true, onChiudi: vi.fn(), C, L, filtro: 'video',
    argomenti: [], video: [], ...extra,
  }));
  return document.body;
};

describe('b.546 — «hai rotto il passaggio»: la causa', () => {
  beforeEach(() => {
    ultimoOsservatore = null;
    global.IntersectionObserver = OsservatoreFinto;
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
  });
  afterEach(() => cleanup());

  it('il feed si DISEGNA (prima moriva ad ogni giro, e nessuno se ne accorgeva)', () => {
    expect(() => monta({ video: [filmato(1), filmato(2), filmato(3)] })).not.toThrow();
    expect(screen.getByText('Video 1')).toBeTruthy();
  });

  it('e le cose si dichiarano sopra a chi le usa: `elementi` viene prima del giro dei cuori', () => {
    const doveElenco = feed.indexOf('const elementi = useMemo(');
    const doveCuori = feed.indexOf('/api/mondo/gradimento?chiavi=');
    expect(doveElenco).toBeGreaterThan(0);
    expect(doveElenco, 'l\'elenco si costruisce PRIMA di chi lo nomina fra le dipendenze').toBeLessThan(doveCuori);
  });
});

describe('b.546 — «passando al prossimo video non lo riproduce»: le tre trappole', () => {
  beforeEach(() => {
    ultimoOsservatore = null;
    global.IntersectionObserver = OsservatoreFinto;
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
  });
  afterEach(() => cleanup());

  it('la soglia non e piu solo 0.6: una slide piu alta della finestra non ci arriva mai', () => {
    monta({ video: [filmato(1), filmato(2)] });
    expect(ultimoOsservatore.opzioni.threshold).toContain(0.25);
    expect(ultimoOsservatore.opzioni.threshold).toContain(0.6);
  });

  it('scorrendo alla slide dopo, il player si sposta davvero', () => {
    const container = monta({ video: [filmato(1), filmato(2), filmato(3)] });
    const player = () => container.querySelector('iframe');
    // in cima: suona il primo
    ultimoOsservatore.racconta([[0, 1], [1, 0], [2, 0]]);
    expect(player().src).toContain('vid1');
    // si scorre: la seconda si vede per meta abbondante, la prima cala.
    // Con la vecchia soglia 0.6 nessuna delle due passava e il player
    // restava incollato al primo video: era il difetto di Luca.
    ultimoOsservatore.racconta([[0, 0.45], [1, 0.55], [2, 0]]);
    expect(player().src).toContain('vid2');
  });

  it('e si decide guardando TUTTE le slide, non solo quelle che si sono appena mosse', () => {
    const container = monta({ video: [filmato(1), filmato(2), filmato(3)] });
    ultimoOsservatore.racconta([[0, 1], [1, 0], [2, 0]]);
    ultimoOsservatore.racconta([[0, 0.3], [1, 0.7]]);
    expect(container.querySelector('iframe').src).toContain('vid2');
    // ora l'osservatore parla SOLO della seconda che sta scendendo:
    // la terza non ha attraversato nessuna soglia in questo giro.
    // Senza memoria qui non si deciderebbe niente; con la memoria si sa
    // che la terza si vede di piu.
    ultimoOsservatore.racconta([[1, 0.35]]);
    ultimoOsservatore.racconta([[2, 0.8]]);
    expect(container.querySelector('iframe').src).toContain('vid3');
  });

  it('la barra del browser che va e viene non riporta piu indietro', () => {
    vi.useFakeTimers();
    try {
      const container = monta({ video: [filmato(1), filmato(2)] });
      const slide = container.querySelectorAll('[data-indice]')[1];
      slide.scrollIntoView = vi.fn();
      // altezza cambiata, larghezza no: e la barra del browser mentre si
      // scorre. Prima di b.546 qui partiva un ritorno forzato alla slide
      // attiva, cioe quella da cui si stava scappando.
      act(() => { window.dispatchEvent(new Event('resize')); vi.advanceTimersByTime(400); });
      expect(slide.scrollIntoView).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it('ma se lo schermo gira DAVVERO (cambia la larghezza) la slide torna al suo posto', () => {
    vi.useFakeTimers();
    try {
      const container = monta({ video: [filmato(1), filmato(2)] });
      ultimoOsservatore.racconta([[0, 0.2], [1, 0.9]]);
      const slide = container.querySelectorAll('[data-indice]')[1];
      slide.scrollIntoView = vi.fn();
      window.innerWidth = window.innerWidth + 300;
      act(() => { window.dispatchEvent(new Event('orientationchange')); vi.advanceTimersByTime(400); });
      expect(slide.scrollIntoView).toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});

describe('b.546 — «mostra la bandiera e l\'origine e che si veda bene»', () => {
  beforeEach(() => {
    ultimoOsservatore = null;
    global.IntersectionObserver = OsservatoreFinto;
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
  });
  afterEach(() => cleanup());

  it('l\'articolo mostra la fonte e la bandiera del suo paese', () => {
    monta({ filtro: 'articoli', argomenti: [articolo(1, 'ilpost.it', 'Il Post')] });
    expect(screen.getByText('Il Post')).toBeTruthy();
    // il nome del paese lo scrive il telefono nella lingua di chi guarda
    expect(screen.getByLabelText(nomePaese('IT'))).toBeTruthy();   // 🇮🇹, riconosciuta dal .it
  });

  it('se il paese non si sa, resta la sola fonte: mai una bandiera sbagliata', () => {
    monta({ filtro: 'articoli', argomenti: [articolo(2, 'esempio.io', 'Esempio')] });
    expect(screen.getByText('Esempio')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('e il video dice il canale', () => {
    const container = monta({ video: [filmato(7)] });
    expect(screen.getAllByText('Canale 7').length).toBeGreaterThan(0);
    expect(container.querySelector('[role="img"]'), 'nessuna bandiera indovinata sui video').toBeNull();
  });

  it('una foto sola: lo strato dello sfondo disegna un elemento e basta', () => {
    const container = monta({ filtro: 'articoli', argomenti: [articolo(3, 'lemonde.fr', 'Le Monde')] });
    expect(container.querySelectorAll('img').length).toBe(1);
  });
});

describe('b.546 — «parlane non deve occupare tutto quello spazio»', () => {
  beforeEach(() => {
    ultimoOsservatore = null;
    global.IntersectionObserver = OsservatoreFinto;
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));
  });
  afterEach(() => cleanup());

  it('nessuna porta a piena larghezza nella slide articolo: stanno tutte nella colonnina', () => {
    const container = monta({ filtro: 'articoli', argomenti: [articolo(4, 'ansa.it', 'ANSA')] });
    for (const b of container.querySelectorAll('button')) {
      expect(b.style.width === '100%' || b.style.flex === '1', b.getAttribute('aria-label') || '').toBe(false);
    }
    // e le porte ci sono lo stesso, tonde da 46 punti
    expect(screen.getByLabelText('newsTalkAbout').style.width).toBe('46px');
  });
});

describe('b.546 — e niente grassetto in cio che b.546 ha aggiunto', () => {
  it('il badge dell\'origine si ferma a 500', () => {
    // b.552 — si chiama RigaOrigine da quando la nota ha una riga sua in
    // alto (ordine di Luca: «se devi mettere una nota mettila in alto in
    // una riga dedicata»). Il pezzo e' lo stesso e la regola pure.
    const badge = feed.slice(feed.indexOf('function RigaOrigine'), feed.indexOf('export default function FeedNotizieMondo'));
    expect(badge).toMatch(/fontWeight: 500/);
    expect(badge, 'Luca: «non voglio grassetto da nessuna parte»').not.toMatch(/fontWeight: (600|700)/);
  });
});

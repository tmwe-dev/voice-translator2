// ═══════════════════════════════════════════════════════════════
// b.417 — LA PRIMA PROVA NON RESTA PIU MUTA SENZA DIRLO.
//
// Non viene da un audit: viene dai registri di produzione.
// «Edge TTS: sintesi riuscita ma audio vuoto» — 32 volte, 5 persone,
// l'ultima alle 10:18 di oggi sulla build in linea. Non riproducibile a
// mano (dieci lingue provate danno audio vero), quindi e il fornitore
// che ogni tanto consegna zero byte. Cio che era nostro e la reazione.
//
// La Diretta e il Taxi ripiegano e si sentono lo stesso. La Prima prova
// no — ed e la prima cosa che tocca chi apre l'app.
//
// Qui il componente viene MONTATO DAVVERO e le voci si fanno fallire
// una per una, come nella realta. Le tre prove del secondo blocco erano
// tutte ROSSE prima di questo intervento.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { t } from '../app/lib/i18n.js';

// ── il telefono che parla, finto ──────────────────────────────────
// `partenza` decide se la voce PARTE davvero: e la distinzione di b.262
// fra «finito» e «mai partito», e qui e tutto il punto.
let detti = [];
let partenza = true;
let sintesiPresente = true;

function montaSintesi() {
  detti = [];
  if (!sintesiPresente) { delete global.speechSynthesis; delete global.SpeechSynthesisUtterance; return; }
  global.SpeechSynthesisUtterance = class {
    constructor(testo) { this.text = testo; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; }
  };
  global.speechSynthesis = {
    paused: false, speaking: false,
    getVoices: () => [{ name: 'Google italiano', lang: 'it-IT' }, { name: 'Compact Eddy', lang: 'en-US' }],
    cancel: () => {},
    resume: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    speak: (u) => {
      detti.push(u.text);
      if (partenza) u.onstart?.();
      u.onend?.();
    },
  };
}

// ── le rotte della voce, finte ────────────────────────────────────
// `risposte` dice, per rotta, che cosa torna: 'suono' | 'vuoto' | 'giu'.
let risposte = {};
let chiamate = [];

function corpo(esito) {
  if (esito === 'giu') return { ok: false, status: 503, blob: async () => new Blob([]) };
  if (esito === 'vuoto') return { ok: true, status: 200, blob: async () => new Blob([]) };
  return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array([1, 2, 3])]) };
}

vi.mock('../app/lib/memoria.js', () => ({ memSet: () => {}, memDel: () => {}, memGet: () => null }));
vi.mock('../app/components/Ascolta.js', () => ({ default: () => null }));
vi.mock('../app/components/Icon.js', () => ({ default: () => null }));
vi.mock('../app/contexts/AppContext.js', () => ({
  useApp: () => ({
    L: (k) => t('it', k),      // le frasi VERE del pacchetto italiano
    S: { colors: {} },
    prefs: { lang: 'it' },
  }),
}));

const { default: PrimaProva } = await import('../app/components/PrimaProva.js');
const { parlaColSistema, spezzaPerLaVoce } = await import('../app/lib/voceSistema.js');

const respira = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => {
  partenza = true; sintesiPresente = true; montaSintesi();
  risposte = { '/api/tts-elevenlabs': 'suono', '/api/tts-edge': 'suono' };
  chiamate = [];
  if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:finto';
  if (!global.URL.revokeObjectURL) global.URL.revokeObjectURL = () => {};
  // l'Audio di jsdom non suona: qui suona sempre, cosi il ripiego scatta
  // solo per i motivi che stiamo provando e non per colpa di jsdom.
  global.Audio = class { constructor() { this.play = async () => {}; } };
  global.fetch = async (url, opzioni) => {
    chiamate.push(url);
    if (url === '/api/translate') {
      return { ok: true, status: 200, json: async () => ({ translated: 'Hello' }) };
    }
    return corpo(risposte[url] || 'giu');
  };
});
afterEach(cleanup);

// La strada vera: si scrive, la traduzione arriva, la voce parte da sola.
//
// b.423 — il campo di scrittura c'e SEMPRE, in basso (collaudo di Luca:
// «l'icona tastiera non serve, eliminala e lascia sempre un campo di testo
// disponibile per scrivere»). Per un giro ho fatto passare questa prova da
// un tastino che apriva il campo: quel tastino non esiste piu.
// L'INTENTO DI QUESTA PROVA NON E' MAI CAMBIATO: la frase entra nel
// registro PRIMA che si provi a parlare, cosi qualunque cosa succeda alla
// voce il testo c'e.
async function traduciDavvero() {
  const { container } = render(<PrimaProva onChiudi={() => {}} />);
  const campo = container.querySelector('textarea') || container.querySelector('input[type="text"]');
  expect(campo, 'il campo dove si scrive esiste').toBeTruthy();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(campo.constructor.prototype, 'value').set;
    setter.call(campo, 'Ciao');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // la traduzione parte da sola quando smetti di scrivere
  await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
  await respira();
}

describe('la voce del telefono, adesso in un posto solo', () => {
  it('torna VERO solo se e partita davvero, non se e stata chiamata', async () => {
    expect(await parlaColSistema('Ciao', 'it')).toBe(true);
    partenza = false;
    expect(await parlaColSistema('Ciao', 'it'), 'chiamata ma mai partita').toBe(false);
  });

  it('non prova nemmeno a dire il vuoto', async () => {
    expect(await parlaColSistema('   ', 'it')).toBe(false);
    expect(detti).toEqual([]);
  });

  it('su un telefono senza voce non esplode: dice di no', async () => {
    sintesiPresente = false; montaSintesi();
    expect(await parlaColSistema('Ciao', 'it')).toBe(false);
  });

  it('spezza le frasi lunghe, che Chrome tronca a quindici secondi', () => {
    const pezzi = spezzaPerLaVoce(`${'a'.repeat(150)}. ${'b'.repeat(150)}.`);
    expect(pezzi.length).toBeGreaterThan(1);
    expect(pezzi.join('')).toContain('a'.repeat(150));
  });
});

describe('la Prima prova: quando il fornitore tace', () => {
  it('con la voce buona non disturba il telefono', async () => {
    await traduciDavvero();
    expect(chiamate).toContain('/api/tts-elevenlabs');
    expect(detti, 'la voce di sistema e un RIPIEGO, non un doppione').toEqual([]);
  });

  it('«200 con zero byte» e un guasto, non una voce', async () => {
    // E' il difetto vero dei registri: la risposta e ok, il suono non c'e.
    // Prima si costruiva un Audio vuoto e lo stato tornava «quieto» come se
    // avesse parlato: silenzio totale, senza una parola.
    risposte = { '/api/tts-elevenlabs': 'vuoto', '/api/tts-edge': 'vuoto' };
    await traduciDavvero();
    expect(chiamate, 'le ha provate tutte e due').toContain('/api/tts-edge');
    expect(detti, 'e poi ha parlato il telefono').toEqual(['Hello']);
  });

  it('se tacciono i server, parla il telefono', async () => {
    risposte = { '/api/tts-elevenlabs': 'giu', '/api/tts-edge': 'giu' };
    await traduciDavvero();
    expect(detti).toEqual(['Hello']);
    expect(screen.queryByText(t('it', 'speakNowVoiceless')), 'ha parlato: niente avviso').toBeNull();
  });

  it("e se non parla NESSUNO, lo dice invece di restare zitta", async () => {
    risposte = { '/api/tts-elevenlabs': 'giu', '/api/tts-edge': 'giu' };
    partenza = false;
    await traduciDavvero();
    expect(screen.getByText(t('it', 'speakNowVoiceless'))).toBeTruthy();
  });

  it("l'avviso della voce NON e l'errore della traduzione: sono due cose", async () => {
    risposte = { '/api/tts-elevenlabs': 'giu', '/api/tts-edge': 'giu' };
    partenza = false;
    await traduciDavvero();
    expect(screen.queryByText(t('it', 'speakNowError')), 'la traduzione e arrivata benissimo').toBeNull();
    expect(t('it', 'speakNowVoiceless')).not.toBe('speakNowVoiceless');
  });
});

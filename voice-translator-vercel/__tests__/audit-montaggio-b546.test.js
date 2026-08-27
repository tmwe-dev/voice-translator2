import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement as e } from 'react';

// ═══════════════════════════════════════════════════════════════
// b.546 — L'AUDIT DEL MONTAGGIO.
//
// Luca, con la schermata rossa: «ReferenceError: Cannot access 'T' before
// initialization ... non va piu un cazzo, hai rotto molte cose».
//
// Quel 'T' e' il nome accorciato di una `const` letta PRIMA di essere
// dichiarata — la zona morta temporale. Succede quando un useEffect (o
// un useCallback) nomina nel suo elenco di dipendenze una costante che
// vive PIU SOTTO nel file: l'elenco delle dipendenze e' un argomento,
// e viene valutato durante il disegno.
//
// Nessuna delle nostre prove lo prendeva, perche' leggevano il TESTO dei
// file invece di FARLI PARTIRE. Qui si montano davvero le schermate: se
// una ha una zona morta, esplode qui invece che in faccia a Luca.
// ═══════════════════════════════════════════════════════════════

const finto = {
  L: (k) => k, setView: vi.fn(), theme: 'deep',
  prefs: { lang: 'it', name: 'Luca', uiLang: 'it' },
  savePrefs: vi.fn(), userToken: null, S: null,
  myLang: 'it', setMyLang: vi.fn(), setPrefs: vi.fn(),
};
vi.mock('../app/contexts/AppContext.js', async () => {
  const vero = await vi.importActual('../app/contexts/AppContext.js');
  return { ...vero, useApp: () => finto };
});

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ rooms: [], conteggi: {}, rami: [], fonti: [] }) }));
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

// Le schermate che Luca tocca ogni giorno. Se una non si monta,
// l'applicazione le mostra la schermata rossa.
const SCHERMATE = [
  ['MondoNews', '../app/components/MondoNews.js', { C: { accent: '#5b8cff', cardBorder: '#333', card: '#111', textPrimary: '#fff', textMuted: '#888', input: '#222', purple: '#38e1ff', red: '#f55', bg: '#05070f' } }],
  ['FeedNotizieMondo', '../app/components/FeedNotizieMondo.js', { aperto: true, C: { accent: '#5b8cff', purple: '#38e1ff', bg: '#05070f', cardBorder: '#333' }, L: (k) => k, argomenti: [], video: [], filtro: 'entrambi' }],
  ['StanzeView', '../app/components/StanzeView.js', { onJoinRoom: vi.fn(), onCreateRoom: vi.fn() }],
  ['MondoView', '../app/components/MondoView.js', { onJoinRoom: vi.fn(), onCreateRoom: vi.fn(), onParlane: vi.fn() }],
];

describe('b.546 — ogni schermata si monta senza esplodere', () => {
  for (const [nome, percorso, props] of SCHERMATE) {
    it(`${nome} parte`, async () => {
      const mod = await import(percorso);
      const Componente = mod.default;
      expect(Componente, `${nome}: manca l'export default`).toBeTruthy();
      let errore = null;
      try { render(e(Componente, props)); } catch (err) { errore = err; }
      expect(errore && `${nome}: ${errore.message}`, `${nome} non si monta`).toBeNull();
    });
  }
});

describe('b.546 — i pezzi del motore si montano', () => {
  const PEZZI = [
    ['VentaglioReazioni', '../app/components/ui/VentaglioReazioni.js', { valore: null, opzioni: [], onScegli: vi.fn(), C: { accent: '#5b8cff' }, targa: 'x' }],
    ['Campanella', '../app/components/ui/Campanella.js', { C: { accent1: '#5b8cff', accent: '#5b8cff' }, L: (k) => k, chiaviSeguite: [], onApriContenuto: vi.fn() }],
    ['FiloCommenti', '../app/components/ui/FiloCommenti.js', { aperto: false, url: '', titolo: '', C: { accent1: '#5b8cff', accent: '#5b8cff' }, L: (k) => k, nome: 'Luca', onChiudi: vi.fn(), onApriStanza: vi.fn() }],
    ['TendinaVetro', '../app/components/ui/TendinaVetro.js', { valore: 'a', opzioni: [{ id: 'a', label: 'A' }], onScegli: vi.fn(), targa: 'x', C: { accent: '#5b8cff' } }],
  ];
  for (const [nome, percorso, props] of PEZZI) {
    it(`${nome} parte`, async () => {
      const mod = await import(percorso);
      let errore = null;
      try { render(e(mod.default, props)); } catch (err) { errore = err; }
      expect(errore && `${nome}: ${errore.message}`).toBeNull();
    });
  }
});

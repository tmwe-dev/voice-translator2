// ═══════════════════════════════════════════════════════════════
// b.581 — TRADUCI VISIBILE + CINQUE SECONDI SOLO DI PREPARAZIONE
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createElement as e } from 'react';
import InterpreteVideo, {
  statoFrasePreparata, lingueCoincidono,
} from '../app/components/ui/InterpreteVideo.js';
import { prossimaDaDire } from '../app/lib/interpreteVideo.js';

const C = { accent: '#5b8cff', cardBorder: '#222' };
const L = (k) => k;

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = vi.fn(async (url) => {
    if (String(url).startsWith('/api/video/sottotitoli')) {
      return {
        ok: true,
        json: async () => ({
          disponibili: true,
          lingua: 'en',
          righe: [
            { inizio: 10, fine: 13, testo: 'Good morning.' },
          ],
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('sincronizzazione', () => {
  const frase = { inizio: 10, fine: 13, testo: 'Good morning.' };

  it('a 6 secondi la frase delle 10 e gia da PREPARARE ma non da mostrare', () => {
    const candidata = prossimaDaDire([frase], 6, new Set());
    expect(candidata?.testo).toBe('Good morning.');
    expect(statoFrasePreparata(candidata, 6)).toBe('presto');
  });

  it('la stessa frase parte solo quando l orologio arriva al suo timestamp', () => {
    expect(statoFrasePreparata(frase, 9.8)).toBe('presto');
    expect(statoFrasePreparata(frase, 10)).toBe('ora');
    expect(statoFrasePreparata(frase, 13.5)).toBe('ora');
    expect(statoFrasePreparata(frase, 15.1)).toBe('persa');
  });

  it('riconosce che en-US e en sono la stessa lingua e non richiedono una nuova traduzione', () => {
    expect(lingueCoincidono('en-US', 'en')).toBe(true);
    expect(lingueCoincidono('pt-BR', 'pt')).toBe(true);
    expect(lingueCoincidono('en', 'it')).toBe(false);
  });
});

describe('comando primario Traduci', () => {
  it('e visibile subito fuori dai tre puntini e porta la lingua dell utente', () => {
    render(e(InterpreteVideo, { videoId: 'abcdefghijk', lingua: 'it', attivo: false, C, L }));
    expect(screen.getByTestId('traduci-video')).toBeTruthy();
    expect(screen.getByLabelText('Traduci IT')).toBeTruthy();
  });

  it('quando i sottotitoli arrivano apre Originale / Testo lingua / Voce lingua', async () => {
    render(e(InterpreteVideo, { videoId: 'abcdefghijk', lingua: 'it', attivo: false, C, L }));
    const t = screen.getByTestId('traduci-video');
    await waitFor(() => expect(t.disabled).toBe(false));
    fireEvent.click(t);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getByText('interpreteSpento')).toBeTruthy();
    expect(screen.getByText('interpreteSottotitoli IT')).toBeTruthy();
    expect(screen.getByText('interpreteVoce IT')).toBeTruthy();
  });

  it('la scelta Testo resta valida anche sul video successivo', async () => {
    const prima = render(e(InterpreteVideo, { videoId: 'abcdefghijk', lingua: 'it', attivo: false, C, L }));
    const t = screen.getByTestId('traduci-video');
    await waitFor(() => expect(t.disabled).toBe(false));
    fireEvent.click(t);
    fireEvent.click(screen.getByText('interpreteSottotitoli IT'));
    expect(window.localStorage.getItem('bartalk-interprete-video-modo-v1')).toBe('sottotitoli');
    prima.unmount();

    render(e(InterpreteVideo, { videoId: 'lmnopqrstuv', lingua: 'it', attivo: false, C, L }));
    await waitFor(() => expect(screen.getByTestId('traduci-video').disabled).toBe(false));
    expect(screen.getByText('interpreteSottotitoli IT')).toBeTruthy();
  });
});

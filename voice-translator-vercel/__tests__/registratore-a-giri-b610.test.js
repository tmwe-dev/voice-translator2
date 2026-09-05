import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// b.610 — Trovato dal vivo (collaudo 03/09): `recorder.start(3000)` consegna
// FETTE di un unico WebM, e solo la prima ha l'intestazione; Whisper
// rifiutava tutte le altre («audio corrotto», 400) — il primo blocco
// 200, poi 500 ogni 3 secondi. Ora ogni giro e' un registratore nuovo:
// start() senza fetta, un file intero per blocco.
//
// b.634 — la proprieta difesa qui resta IDENTICA (un registratore nuovo
// per giro, start() senza fetta, e nessun giro fantasma dopo lo stop).
// Cambia solo CHI decide il momento del taglio: non piu l'orologio a
// 3 secondi, ma la voce — il cancello del rumore. La prova e stata
// riportata sul segnale nuovo, non indebolita: adesso deve anche
// dimostrare che senza voce non si consegna niente.

vi.mock('../app/lib/microfonoMaster.js', () => ({
  prendiVoce: vi.fn(async () => ({ id: 'copia', getTracks: () => [] })),
  rendiVoce: vi.fn(),
}));
// b.634 — il finto cancello del rumore conserva `onCambio`: e la voce
// che comanda il taglio, quindi le prove devono poterla far parlare.
let voce = null;
vi.mock('../app/lib/noiseGate.js', () => ({
  createNoiseGate: vi.fn((stream, opz) => {
    voce = opz?.onCambio || null;
    return { cleanStream: { id: 'pulito' }, destroy: vi.fn() };
  }),
}));
vi.mock('../app/hooks/useStreamingInterpreter.js', () => ({
  default: () => ({ active: false, start: vi.fn(async () => false), stop: vi.fn(), handleIncomingMessage: vi.fn(),
    mySubtitles: [], partnerSubtitles: [], myLiveText: '', partnerLiveSubtitle: '', voceGuasta: false, partnerVoceMancata: false }),
}));
vi.mock('../app/lib/circuitBreaker.js', () => ({ apiCircuitBreaker: { execute: (_k, fn) => fn() } }));

import useInterpreterMode from '../app/hooks/useInterpreterMode.js';

let registratori;
class MediaRecorderFinto {
  constructor(stream, opz) { this.stream = stream; this.opz = opz; this.state = 'inactive'; this.avvii = []; registratori.push(this); }
  static isTypeSupported() { return true; }
  start(fetta) { this.avvii.push(fetta); this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: { size: 5000 } }); this.onstop?.(); }
}

describe('b.610 — il registratore va a giri', () => {
  beforeEach(() => {
    registratori = [];
    voce = null;
    vi.useFakeTimers();
    globalThis.MediaRecorder = MediaRecorderFinto;
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ original: '' }) }));
  });
  afterEach(() => { vi.useRealTimers(); delete globalThis.MediaRecorder; });

  const monta = () => renderHook(() => useInterpreterMode({
    webrtc: { sendDirectMessage: vi.fn(), webrtcState: 'connected' }, myLang: 'it', partnerLang: 'en',
    roomId: 'R', roomSessionTokenRef: { current: 't' }, userToken: 'u',
    startDucking: vi.fn(), stopDucking: vi.fn(), conversationContext: null,
  }));

  // aiutanti: parlare, tacere, lasciar passare il tempo
  const parla = async () => { await act(async () => { voce?.(true); }); };
  const tace = async () => { await act(async () => { voce?.(false); }); };
  const passa = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); };

  it('start() SENZA fetta, e il taglio arriva quando la voce si ferma', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    expect(registratori.length).toBe(1);
    expect(registratori[0].avvii).toEqual([undefined]);          // niente timeslice (b.610)
    expect(registratori[0].state).toBe('recording');

    // b.634 — tre secondi di orologio, da soli, non tagliano piu niente
    await passa(3000);
    expect(registratori[0].state).toBe('recording');
    expect(registratori.length).toBe(1);

    // si parla per due secondi, poi si tace: la pausa chiude la frase
    await parla();
    await passa(2000);
    await tace();
    await passa(700);
    expect(registratori[0].state).toBe('inactive');              // blocco intero consegnato
    expect(registratori.length).toBe(2);                          // e il giro dopo e gia partito
    expect(registratori[1].state).toBe('recording');
    expect(registratori[1].avvii).toEqual([undefined]);
  });

  it('una frase troppo corta non si porta via un giro: si aspetta il minimo', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await parla();
    await passa(200);
    await tace();
    await passa(700);
    expect(registratori[0].state, 'sotto MIN_FRASE_MS non si chiude').toBe('recording');
    await passa(400);                                             // completato il minimo
    expect(registratori[0].state).toBe('inactive');
  });

  it('chi riprende a parlare durante la pausa non viene tagliato a meta', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await parla();
    await passa(1500);
    await tace();
    await passa(400);            // pausa breve fra due parole
    await parla();               // riprende: la chiusura si disarma
    await passa(2000);
    expect(registratori[0].state, 'la frase non era finita').toBe('recording');
    expect(registratori.length).toBe(1);
  });

  it('il silenzio non manda NIENTE a trascrivere', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    globalThis.fetch.mockClear();
    await passa(9000);                                            // il tetto scade senza voce
    await passa(100);
    expect(registratori.length, 'il registratore si ricicla').toBeGreaterThan(1);
    expect(globalThis.fetch, 'nessun giro pagato per il silenzio').not.toHaveBeenCalled();
  });

  it('chi non si ferma mai viene spezzato al tetto, non lasciato correre', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await parla();
    await passa(9000);
    expect(registratori[0].state).toBe('inactive');
    expect(registratori.length).toBe(2);
  });

  it('allo stop non parte nessun giro nuovo e il registratore in corsa si ferma', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await parla();
    await passa(2000);
    await tace();
    await passa(700);
    expect(registratori.length).toBe(2);
    act(() => { result.current.stop(); });
    expect(registratori[1].state).toBe('inactive');
    await passa(10000);
    expect(registratori.length).toBe(2);                          // nessun giro fantasma
  });

  it('un blocco consegnato DOPO lo stop non finisce in coda (nessuna trascrizione a conversazione chiusa)', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await parla();
    globalThis.fetch.mockClear();
    act(() => { result.current.stop(); });
    // il registratore fermato ha consegnato il suo blocco a ondataavailable: activeRef era gia false
    await passa(100);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

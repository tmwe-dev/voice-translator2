import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// b.610 — Trovato dal vivo (collaudo 03/09): `recorder.start(3000)` consegna
// FETTE di un unico WebM, e solo la prima ha l'intestazione; Whisper
// rifiutava tutte le altre («audio corrotto», 400) — il primo blocco
// 200, poi 500 ogni 3 secondi. Ora ogni giro e' un registratore nuovo:
// start() senza fetta, stop() dopo CHUNK_DURATION, un file intero per blocco.

vi.mock('../app/lib/microfonoMaster.js', () => ({
  prendiVoce: vi.fn(async () => ({ id: 'copia', getTracks: () => [] })),
  rendiVoce: vi.fn(),
}));
vi.mock('../app/lib/noiseGate.js', () => ({
  createNoiseGate: vi.fn((stream) => ({ cleanStream: { id: 'pulito' }, destroy: vi.fn() })),
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

  it('start() SENZA fetta; dopo CHUNK_DURATION stop(), e parte un registratore NUOVO', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    expect(registratori.length).toBe(1);
    expect(registratori[0].avvii).toEqual([undefined]);          // niente timeslice
    expect(registratori[0].state).toBe('recording');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(registratori[0].state).toBe('inactive');              // fermato: blocco intero consegnato
    expect(registratori.length).toBe(2);                          // e il giro dopo e' gia partito
    expect(registratori[1].state).toBe('recording');
    expect(registratori[1].avvii).toEqual([undefined]);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(registratori.length).toBe(3);
  });

  it('allo stop non parte nessun giro nuovo e il registratore in corsa si ferma', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(registratori.length).toBe(2);
    act(() => { result.current.stop(); });
    expect(registratori[1].state).toBe('inactive');
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(registratori.length).toBe(2);                          // nessun giro fantasma
  });

  it('un blocco consegnato DOPO lo stop non finisce in coda (nessuna trascrizione a conversazione chiusa)', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    globalThis.fetch.mockClear();
    act(() => { result.current.stop(); });
    // il registratore fermato ha consegnato il suo blocco a ondataavailable: activeRef era gia false
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

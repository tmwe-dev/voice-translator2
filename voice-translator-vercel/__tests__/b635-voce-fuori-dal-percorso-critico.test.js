import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ═══════════════════════════════════════════════════════════════
// b.635 — LA VOCE ESCE DAL PERCORSO CRITICO
//
// La coda dei blocchi era UNA SOLA e teneva dentro tutto: Whisper,
// traduzione, sottotitolo, sintesi vocale, base64 e invio. Finche non
// finiva l'ultimo di quei passi, il blocco successivo non cominciava il
// primo.
//
// Misurato in produzione il 05/09 (tabella `translations`, stanza vera,
// 302 intervalli): un giro ogni 6-8 secondi, e NON UN SOLO intervallo
// sotto i 4. Il microfono ne consegna uno ogni 3: la coda cresce fino al
// tetto e da li si buttano i blocchi PIU VECCHI — quaranta secondi di
// ritardo e meta conversazione persa.
//
// La sintesi vocale non serve al blocco successivo: serve al partner.
// Adesso sono due file separate, ognuna in ordine per conto suo.
// ═══════════════════════════════════════════════════════════════

vi.mock('../app/lib/microfonoMaster.js', () => ({
  prendiVoce: vi.fn(async () => ({ id: 'copia', getTracks: () => [] })),
  rendiVoce: vi.fn(),
}));
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

// La voce: un blocco finto, e una leva per farla durare quanto si vuole.
let sbloccaVoce = null;
let chiamateVoce = 0;
vi.mock('../app/lib/audio/voceTradotta.js', () => ({
  chiediVoce: vi.fn(async () => {
    chiamateVoce++;
    await new Promise((r) => { sbloccaVoce = r; });
    return { blob: { size: 100 }, motivo: '/api/tts-edge' };
  }),
  blobABase64: vi.fn(async () => 'AAAA'),
  inviaAudioDC: vi.fn(),
  creaRiassemblatore: () => ({ aggiungi: () => null, pulisci: () => 0 }),
  riproduciBase64: vi.fn(),
}));

import useInterpreterMode from '../app/hooks/useInterpreterMode.js';

let registratori;
class MediaRecorderFinto {
  constructor(stream, opz) { this.stream = stream; this.state = 'inactive'; registratori.push(this); }
  static isTypeSupported() { return true; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['x'.repeat(5000)], { type: 'audio/webm' }) }); this.onstop?.(); }
}

describe('b.635 — due file, non una: la voce non blocca piu la parola', () => {
  let inviati;
  beforeEach(() => {
    registratori = []; voce = null; sbloccaVoce = null; chiamateVoce = 0; inviati = [];
    globalThis.MediaRecorder = MediaRecorderFinto;
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('transcribe')) return { ok: true, status: 200, json: async () => ({ original: 'ciao come stai' }) };
      return { ok: true, status: 200, json: async () => ({ translated: 'hello how are you' }) };
    });
  });
  afterEach(() => { delete globalThis.MediaRecorder; });

  const monta = () => renderHook(() => useInterpreterMode({
    webrtc: { sendDirectMessage: (m) => inviati.push(m), webrtcState: 'connected' },
    myLang: 'it', partnerLang: 'en',
    roomId: 'R', roomSessionTokenRef: { current: 't' }, userToken: 'u',
    startDucking: vi.fn(), stopDucking: vi.fn(), conversationContext: null,
  }));

  const frase = async (r) => {
    // una frase: si parla, si tace, la pausa chiude il giro (b.634)
    await act(async () => { voce?.(true); });
    await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
    const rec = registratori[registratori.length - 1];
    await act(async () => { rec.stop(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  };

  it('il secondo blocco si trascrive mentre la voce del primo e ancora in sintesi', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });

    await frase();
    // la prima frase e arrivata fino alla voce, che ora e BLOCCATA
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(chiamateVoce, 'la voce della prima frase e partita').toBe(1);
    const sottotitoliDopoUno = inviati.filter((m) => m.type === 'interpreter-subtitle').length;
    expect(sottotitoliDopoUno).toBe(1);

    // seconda frase, con la voce della prima ANCORA appesa
    globalThis.fetch.mockClear();
    await frase();
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });

    // ED E QUESTO IL PUNTO: la parola e andata avanti da sola.
    expect(globalThis.fetch, 'trascrizione e traduzione della seconda frase, con la voce ferma').toHaveBeenCalled();
    const sottotitoli = inviati.filter((m) => m.type === 'interpreter-subtitle');
    expect(sottotitoli.length, 'il secondo sottotitolo e partito senza aspettare la prima voce').toBe(2);
  });

  it('le voci restano in ordine: una alla volta, mai due insieme', async () => {
    const { result } = monta();
    await act(async () => { await result.current.start(); });
    await frase();
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    await frase();
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    // la prima voce e ancora bloccata: la seconda NON deve essere partita
    expect(chiamateVoce, 'la seconda voce aspetta il suo turno').toBe(1);
    // si sblocca la prima: parte la seconda
    await act(async () => { sbloccaVoce?.(); await new Promise((r) => setTimeout(r, 10)); });
    expect(chiamateVoce).toBe(2);
  });
});

describe('b.635 — il codice dice quello che fa', () => {
  const fs = require('fs'); const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app/hooks/useInterpreterMode.js'), 'utf8');

  it('processChunk non chiama piu la sintesi: la accoda', () => {
    const i = src.indexOf('const processChunk = useCallback');
    const j = src.indexOf('const diciERimanda = useCallback');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    const corpo = src.slice(i, j);
    expect(corpo, 'la sintesi non sta piu nel percorso critico').not.toContain('chiediVoce(');
    expect(corpo).toContain('accodaVoceRef.current?.(translated)');
  });

  it('la coda voce ha un tetto, e lo dichiara quando scarta', () => {
    expect(src).toContain('const MAX_CODA_VOCE = 4;');
    const i = src.indexOf('const accodaVoce = useCallback');
    const corpo = src.slice(i, i + 800);
    expect(corpo).toMatch(/splice\(0, scartate\)/);
    expect(corpo, 'lo scarto in silenzio era il difetto, non lo scarto').toMatch(/log\.warn/);
  });

  it('spegnendo l\'interprete non resta voce di una conversazione chiusa', () => {
    const quante = (src.match(/codaVoceRef\.current = \[\]/g) || []).length;
    expect(quante, 'avvio, stop, smontaggio e fine ciclo').toBeGreaterThanOrEqual(4);
  });
});

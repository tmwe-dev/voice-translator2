import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.599 — Modulo A dell'audit di architettura (b.598): la voce tradotta
// era riscritta due volte, in modo divergente, nelle due pipeline
// dell'interprete. Ora e' un modulo solo, provato QUI per comportamento,
// non per presenza di stringhe.

vi.mock('../app/lib/audioPrefs.js', () => ({
  getVoceChiamata: vi.fn(() => ''),
  getVolumeTTS: vi.fn(() => 0.8),
}));
vi.mock('../app/lib/circuitBreaker.js', () => ({
  apiCircuitBreaker: { execute: (_k, fn) => fn() },
}));

import { getVoceChiamata, getVolumeTTS } from '../app/lib/audioPrefs.js';
import {
  chiediVoce, blobABase64, inviaAudioDC, creaRiassemblatore, riproduciBase64,
  regolaVolumeInCorsa, MAX_PEZZO_DC, TENTATIVI_PER_MOTORE,
} from '../app/lib/audio/voceTradotta.js';
import { EVENTO, MSG, lancia, avvisaTTS, avvisaVoceLocale } from '../app/lib/eventi.js';

const risposta = (status, blob) => ({ status, ok: status >= 200 && status < 300, blob: async () => blob });

describe('chiediVoce — un ordine, due tentativi, 402 e 204 come nello streaming', () => {
  beforeEach(() => { getVoceChiamata.mockReturnValue(''); });

  it('Edge prima, ElevenLabs dopo, e manda langCode a tutti e due', async () => {
    const chiamate = [];
    const fetchImpl = vi.fn(async (rotta, opz) => { chiamate.push([rotta, JSON.parse(opz.body)]); return risposta(503); });
    const { blob, motivo } = await chiediVoce('ciao', { langCode: 'es', roomId: 'r1', roomSessionToken: 't', fetchImpl });
    expect(blob).toBeNull();
    expect(motivo).toBe('nessun-motore');
    expect(chiamate.map(c => c[0])).toEqual([
      '/api/tts-edge', '/api/tts-edge', '/api/tts-elevenlabs', '/api/tts-elevenlabs',
    ]);
    expect(chiamate.length).toBe(2 * TENTATIVI_PER_MOTORE);
    for (const [, corpo] of chiamate) {
      expect(corpo.langCode).toBe('es');
      expect(corpo.lang).toBeUndefined();
      expect(corpo.roomSessionToken).toBe('t');
    }
  });

  it('con una voce scelta la premium prova per prima', async () => {
    getVoceChiamata.mockReturnValue('voce-x');
    const rotte = [];
    const fetchImpl = vi.fn(async (rotta) => { rotte.push(rotta); return risposta(200, 'AUDIO'); });
    const { blob, motivo } = await chiediVoce('ciao', { langCode: 'fr', fetchImpl });
    expect(blob).toBe('AUDIO');
    expect(motivo).toBe('/api/tts-elevenlabs');
    expect(rotte).toEqual(['/api/tts-elevenlabs']);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).voiceId).toBe('voce-x');
  });

  it('402 sulla premium: si passa SUBITO all\'altro motore, senza secondo tentativo', async () => {
    const rotte = [];
    const fetchImpl = vi.fn(async (rotta) => {
      rotte.push(rotta);
      return rotta === '/api/tts-elevenlabs' ? risposta(402) : risposta(200, 'EDGE');
    });
    const { blob } = await chiediVoce('ciao', { langCode: 'de', preferisciEleven: true, fetchImpl });
    expect(blob).toBe('EDGE');
    expect(rotte).toEqual(['/api/tts-elevenlabs', '/api/tts-edge']);
  });

  it('204 = niente da dire: null, e NON si prova l\'altro motore', async () => {
    const fetchImpl = vi.fn(async () => risposta(204));
    const { blob, motivo } = await chiediVoce('👍', { langCode: 'it', fetchImpl });
    expect(blob).toBeNull();
    expect(motivo).toBe('niente-da-dire');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('la rete che inciampa non ferma il giro', async () => {
    let n = 0;
    const fetchImpl = vi.fn(async () => { n++; if (n === 1) throw new Error('rete'); return risposta(200, 'OK'); });
    const { blob } = await chiediVoce('ciao', { langCode: 'it', fetchImpl });
    expect(blob).toBe('OK');
    expect(n).toBe(2);
  });

  it('testo vuoto: non chiama nessuno', async () => {
    const fetchImpl = vi.fn();
    const { motivo } = await chiediVoce(' ', { langCode: 'it', fetchImpl });
    expect(motivo).toBe('testo-vuoto');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('blobABase64 e inviaAudioDC', () => {
  it('converte un blob grande (oltre 64K) senza scoppiare', async () => {
    const byte = new Uint8Array(100000).map((_, i) => i % 256);
    const blob = { arrayBuffer: async () => byte.buffer };
    const b64 = await blobABase64(blob);
    expect(b64.length).toBeGreaterThan(100000);
    expect(Uint8Array.from(atob(b64), c => c.charCodeAt(0))).toEqual(byte);
  });

  it('un audio piccolo va in UN messaggio, uno grande a pezzi numerati', () => {
    const mandati = [];
    const webrtc = { sendDirectMessage: (m) => mandati.push(m) };
    expect(inviaAudioDC(webrtc, 'x'.repeat(MAX_PEZZO_DC))).toBe(1);
    expect(mandati[0]).toEqual({ type: MSG.AUDIO, data: 'x'.repeat(MAX_PEZZO_DC) });
    mandati.length = 0;
    const grande = 'a'.repeat(MAX_PEZZO_DC * 2 + 5);
    expect(inviaAudioDC(webrtc, grande)).toBe(3);
    expect(mandati.every(m => m.type === MSG.AUDIO_PARTE && m.total === 3 && m.id === mandati[0].id)).toBe(true);
    expect(mandati.map(m => m.part)).toEqual([0, 1, 2]);
    expect(mandati.map(m => m.data).join('')).toBe(grande);
  });

  it('senza canale non manda niente e non scoppia', () => {
    expect(inviaAudioDC(null, 'abc')).toBe(0);
    expect(inviaAudioDC({}, 'abc')).toBe(0);
  });
});

describe('creaRiassemblatore — i pezzi tornano interi, gli orfani si buttano', () => {
  it('ricompone in ordine anche se i pezzi arrivano mescolati', () => {
    const r = creaRiassemblatore();
    expect(r.aggiungi({ id: 'k', part: 2, total: 3, data: 'C' })).toBeNull();
    expect(r.aggiungi({ id: 'k', part: 0, total: 3, data: 'A' })).toBeNull();
    expect(r.aggiungi({ id: 'k', part: 1, total: 3, data: 'B' })).toBe('ABC');
    expect(r.inSospeso()).toBe(0);
  });
  it('pulisci() butta solo i pezzi vecchi', () => {
    vi.useFakeTimers();
    const r = creaRiassemblatore();
    r.aggiungi({ id: 'vecchio', part: 0, total: 2, data: 'x' });
    vi.advanceTimersByTime(40000);
    r.aggiungi({ id: 'nuovo', part: 0, total: 2, data: 'y' });
    expect(r.pulisci(30000)).toBe(1);
    expect(r.inSospeso()).toBe(1);
    vi.useRealTimers();
  });
  it('messaggi malformati non lasciano traccia', () => {
    const r = creaRiassemblatore();
    expect(r.aggiungi(null)).toBeNull();
    expect(r.aggiungi({ part: 0, total: 1, data: 'x' })).toBeNull();
    expect(r.inSospeso()).toBe(0);
  });
});

describe('riproduciBase64 — l\'avviso si spegne da UN\'USCITA SOLA', () => {
  let audioCreati;
  beforeEach(() => {
    audioCreati = [];
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.Audio = class {
      constructor() { this.volume = 1; this.paused = true; this.ended = false; audioCreati.push(this); }
      play() { this.paused = false; return this._rifiuta ? Promise.reject(new Error('no')) : Promise.resolve(); }
      pause() { this.paused = true; }
    };
    getVolumeTTS.mockReturnValue(0.8);
  });
  afterEach(() => { delete globalThis.Audio; });

  const b64 = btoa('abc');

  it('accende ducking + evento, e a onended li spegne una volta sola', () => {
    const eventi = [];
    const ascolta = (e) => eventi.push(e.detail.attivo);
    window.addEventListener(EVENTO.TTS, ascolta);
    const startDucking = vi.fn(), stopDucking = vi.fn(), onAudio = vi.fn();
    const a = riproduciBase64(b64, { startDucking, stopDucking, onAudio });
    expect(a).toBe(audioCreati[0]);
    expect(a.volume).toBe(0.8);
    expect(startDucking).toHaveBeenCalledTimes(1);
    expect(eventi).toEqual([true]);
    expect(onAudio).toHaveBeenLastCalledWith(a);
    a.onended();
    a.onerror();          // seconda uscita: non deve spegnere due volte
    expect(stopDucking).toHaveBeenCalledTimes(1);
    expect(eventi).toEqual([true, false]);
    expect(onAudio).toHaveBeenLastCalledWith(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO.TTS, ascolta);
  });

  it('se play() rifiuta, l\'avviso si spegne lo stesso (b.381/b.404, ora per tutti e due)', async () => {
    const eventi = [];
    const ascolta = (e) => eventi.push(e.detail.attivo);
    window.addEventListener(EVENTO.TTS, ascolta);
    const stopDucking = vi.fn();
    globalThis.Audio.prototype._rifiuta = true;
    riproduciBase64(b64, { stopDucking });
    await new Promise(r => setTimeout(r, 0));
    expect(eventi).toEqual([true, false]);
    expect(stopDucking).toHaveBeenCalledTimes(1);
    delete globalThis.Audio.prototype._rifiuta;
    window.removeEventListener(EVENTO.TTS, ascolta);
  });

  it('a volume zero non suona e non accende niente', () => {
    getVolumeTTS.mockReturnValue(0);
    const startDucking = vi.fn();
    expect(riproduciBase64(b64, { startDucking })).toBeNull();
    expect(startDucking).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('base64 rotto: nessuna eccezione, avviso spento', () => {
    const eventi = [];
    const ascolta = (e) => eventi.push(e.detail.attivo);
    window.addEventListener(EVENTO.TTS, ascolta);
    expect(riproduciBase64('%%%non-base64%%%', {})).toBeNull();
    expect(eventi).toEqual([false]);
    window.removeEventListener(EVENTO.TTS, ascolta);
  });

  it('regolaVolumeInCorsa: a zero mette in pausa, rialzando riparte', () => {
    const a = new globalThis.Audio();
    a.paused = false;
    expect(regolaVolumeInCorsa(a, 0)).toBe(true);
    expect(a.paused).toBe(true);
    regolaVolumeInCorsa(a, 0.5);
    expect(a.paused).toBe(false);
    expect(a.volume).toBe(0.5);
    expect(regolaVolumeInCorsa(null)).toBe(false);
  });
});

describe('lib/eventi.js — i nomi in un posto solo', () => {
  it('lancia() consegna il detail e non scoppia mai', () => {
    const ricevuti = [];
    const f = (e) => ricevuti.push(e.detail);
    window.addEventListener(EVENTO.VOCE_LOCALE, f);
    expect(avvisaVoceLocale(1)).toBe(true);
    expect(avvisaTTS(0)).toBe(true);
    expect(lancia(EVENTO.VOCE_NON_DISPONIBILE)).toBe(true);
    expect(ricevuti).toEqual([{ parlando: true }]);
    window.removeEventListener(EVENTO.VOCE_LOCALE, f);
  });
  it('gli oggetti sono congelati: un refuso non puo diventare un nuovo nome', () => {
    expect(Object.isFrozen(EVENTO)).toBe(true);
    expect(Object.isFrozen(MSG)).toBe(true);
  });
  it('nessuna stringa bartalk:* o interpreter-* scritta a mano nelle due pipeline e nella stanza', () => {
    for (const p of ['app/hooks/useInterpreterMode.js', 'app/hooks/useStreamingInterpreter.js',
      'app/components/RoomView.js', 'app/hooks/useAudioSystem.js']) {
      const codice = leggi(p).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      expect(codice, p).not.toMatch(/['"]bartalk:/);
      expect(codice, p).not.toMatch(/['"]interpreter-(subtitle|audio|audio-part|voce-mancata)['"]/);
    }
  });
  it('le due pipeline non riscrivono piu la voce: usano il modulo', () => {
    const legacy = leggi('app/hooks/useInterpreterMode.js');
    const streaming = leggi('app/hooks/useStreamingInterpreter.js');
    for (const f of [legacy, streaming]) {
      expect(f).toMatch(/from '\.\.\/lib\/audio\/voceTradotta\.js'/);
      expect(f).not.toMatch(/String\.fromCharCode\.apply/);
      expect(f).not.toMatch(/MAX_DC_SIZE/);
      expect(f).not.toMatch(/URL\.createObjectURL/);
      expect(f).not.toMatch(/\/api\/tts-edge/);
    }
  });
});

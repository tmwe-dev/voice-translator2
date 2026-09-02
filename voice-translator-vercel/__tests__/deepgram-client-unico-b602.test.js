import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { float32AInt16, avviaCatturaPCM16 } from '../app/lib/audio/catturaPCM16.js';
import {
  chiediChiaveDeepgram, urlDeepgram, leggiMessaggioDeepgram, apriDeepgram,
} from '../app/lib/audio/deepgramLive.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.602 — Modulo C dell'audit di architettura (b.598): tre client Deepgram
// e tre conversioni PCM16 scritte a mano in tre file, sei richieste
// diverse della chiave, sei aperture dirette del microfono. Ora un client
// solo, provato QUI per comportamento con socket e AudioContext finti.

// ── AudioContext finto ──
let processori;
let destinazioneCollegata;
function installaAudioFinto() {
  processori = [];
  destinazioneCollegata = 0;
  globalThis.AudioContext = class {
    constructor({ sampleRate } = {}) { this.sampleRate = sampleRate; this.state = 'running'; this.destination = { id: 'dest' }; }
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createScriptProcessor() {
      const p = { onaudioprocess: null, disconnect: vi.fn(), connect: vi.fn((n) => { if (n?.id === 'dest') destinazioneCollegata++; }) };
      processori.push(p);
      return p;
    }
    close() { this.state = 'closed'; }
  };
}

describe('catturaPCM16', () => {
  beforeEach(installaAudioFinto);
  afterEach(() => { delete globalThis.AudioContext; });

  it('float32AInt16 satura e scala', () => {
    const out = float32AInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]));
    expect(Array.from(out)).toEqual([0, 0x7FFF, -0x8000, 0x7FFF, -0x8000, Math.trunc(0.5 * 0x7FFF)]);
  });

  it('consegna ArrayBuffer PCM16 e NON collega mai il processore all\'uscita (eco)', () => {
    const ricevuti = [];
    const c = avviaCatturaPCM16({}, { onPezzo: (b) => ricevuti.push(b), sampleRate: 16000 });
    expect(c.audioCtx.sampleRate).toBe(16000);
    processori[0].onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.25, -0.25]) } });
    expect(ricevuti.length).toBe(1);
    expect(Array.from(new Int16Array(ricevuti[0]))).toEqual([Math.trunc(0.25 * 0x7FFF), -0.25 * 0x8000]);
    expect(destinazioneCollegata).toBe(0);
  });

  it('`attiva` che torna false butta il blocco; ferma() e\' idempotente e chiude il contesto', () => {
    const onPezzo = vi.fn();
    let aperta = false;
    const c = avviaCatturaPCM16({}, { onPezzo, attiva: () => aperta });
    processori[0].onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([1]) } });
    expect(onPezzo).not.toHaveBeenCalled();
    aperta = true;
    processori[0].onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([1]) } });
    expect(onPezzo).toHaveBeenCalledTimes(1);
    c.ferma(); c.ferma();
    expect(c.audioCtx.state).toBe('closed');
    expect(processori[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('un ricevitore che scoppia non ferma la cattura', () => {
    avviaCatturaPCM16({}, { onPezzo: () => { throw new Error('boom'); } });
    expect(() => processori[0].onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([1]) } })).not.toThrow();
  });
});

describe('deepgramLive — chiave, url, messaggi', () => {
  it('chiediChiaveDeepgram: un corpo solo, con scadenza, mai un\'eccezione', async () => {
    const chiamate = [];
    const fetchImpl = vi.fn(async (u, o) => { chiamate.push([u, JSON.parse(o.body), o.signal]); return { ok: true, json: async () => ({ key: 'K' }) }; });
    expect(await chiediChiaveDeepgram({ userToken: 'u', roomId: 'R', roomSessionToken: 'T', fetchImpl })).toBe('K');
    expect(chiamate[0][0]).toBe('/api/stt-token');
    expect(chiamate[0][1]).toEqual({ userToken: 'u', roomId: 'R', roomSessionToken: 'T' });
    expect(chiamate[0][2]).toBeInstanceOf(AbortSignal);
    // senza stanza il gettone di stanza non parte (b.161: non e' suo)
    await chiediChiaveDeepgram({ userToken: 'u', roomSessionToken: 'T', fetchImpl });
    expect(chiamate[1][1]).toEqual({ userToken: 'u' });
    expect(await chiediChiaveDeepgram({ fetchImpl: async () => ({ ok: false }) })).toBeNull();
    expect(await chiediChiaveDeepgram({ fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('html'); } }) })).toBeNull();
    expect(await chiediChiaveDeepgram({ fetchImpl: async () => { throw new Error('rete'); } })).toBeNull();
  });

  it('urlDeepgram: lingua ridotta a due lettere, parametri voluti presenti', () => {
    const u = new URL(urlDeepgram({ lingua: 'it-IT', utteranceEndMs: 1400, endpointing: 500 }));
    expect(u.host).toBe('api.deepgram.com');
    expect(u.searchParams.get('language')).toBe('it');
    expect(u.searchParams.get('utterance_end_ms')).toBe('1400');
    expect(u.searchParams.get('endpointing')).toBe('500');
    expect(u.searchParams.get('encoding')).toBe('linear16');
    expect(u.searchParams.get('sample_rate')).toBe('16000');
    expect(new URL(urlDeepgram({ lingua: 'en' })).searchParams.has('endpointing')).toBe(false);
  });

  it('leggiMessaggioDeepgram: testo, fine frase, spazzatura', () => {
    expect(leggiMessaggioDeepgram(JSON.stringify({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: 'ciao' }] } })))
      .toEqual({ tipo: 'testo', transcript: 'ciao', isFinal: true });
    expect(leggiMessaggioDeepgram(JSON.stringify({ type: 'Results', channel: { alternatives: [{ transcript: '' }] } }))).toBeNull();
    expect(leggiMessaggioDeepgram(JSON.stringify({ type: 'UtteranceEnd' }))).toEqual({ tipo: 'fineFrase' });
    expect(leggiMessaggioDeepgram('non json')).toBeNull();
    expect(leggiMessaggioDeepgram(JSON.stringify({ type: 'Metadata' }))).toBeNull();
  });
});

describe('deepgramLive — apriDeepgram con socket finto', () => {
  let sockets;
  class SocketFinto {
    constructor(url, protocolli) { this.url = url; this.protocolli = protocolli; this.readyState = 0; this.inviati = []; sockets.push(this); }
    send(x) { this.inviati.push(x); }
    close() { this.readyState = 3; }
    apri() { this.readyState = 1; this.onopen?.(); }
  }
  beforeEach(() => { sockets = []; installaAudioFinto(); vi.useFakeTimers(); });
  afterEach(() => { delete globalThis.AudioContext; vi.useRealTimers(); });

  it('si apre: la chiave viaggia nel sotto-protocollo, i campioni partono solo a socket aperto, i messaggi arrivano gia letti', async () => {
    const onTesto = vi.fn(), onFineFrase = vi.fn();
    const p = apriDeepgram({ chiave: 'K', stream: {}, lingua: 'it', onTesto, onFineFrase, WebSocketImpl: SocketFinto });
    sockets[0].apri();
    const sess = await p;
    expect(sess).not.toBeNull();
    expect(sockets[0].protocolli).toEqual(['token', 'K']);
    processori[0].onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.5]) } });
    expect(sockets[0].inviati.length).toBe(1);
    sockets[0].onmessage({ data: JSON.stringify({ type: 'Results', is_final: false, channel: { alternatives: [{ transcript: 'ci' }] } }) });
    sockets[0].onmessage({ data: JSON.stringify({ type: 'UtteranceEnd' }) });
    expect(onTesto).toHaveBeenCalledWith('ci', false);
    expect(onFineFrase).toHaveBeenCalledTimes(1);
    // chiudi(): CloseStream, attesa, close; la cattura si ferma
    const chiusura = sess.chiudi();
    expect(sockets[0].inviati.at(-1)).toBe(JSON.stringify({ type: 'CloseStream' }));
    await vi.advanceTimersByTimeAsync(500);
    await chiusura;
    expect(sockets[0].readyState).toBe(3);
    expect(sess.aperta).toBe(false);
    expect(processori[0].disconnect).toHaveBeenCalled();
  });

  it('non si apre entro la scadenza: null, socket chiuso, niente cattura (una sola porta d\'uscita)', async () => {
    const p = apriDeepgram({ chiave: 'K', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto, scadenzaAperturaMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    expect(await p).toBeNull();
    expect(sockets[0].readyState).toBe(3);
    expect(processori.length).toBe(0);
    // un'apertura tardiva non riapre niente
    sockets[0].apri();
    expect(processori.length).toBe(0);
  });

  it('cade prima di aprirsi (chiave rifiutata): null subito, senza aspettare la scadenza', async () => {
    const p = apriDeepgram({ chiave: 'K', stream: {}, lingua: 'it', WebSocketImpl: SocketFinto });
    sockets[0].onclose();
    expect(await p).toBeNull();
  });

  it('cade DOPO l\'apertura: onChiuso avvisa una volta e la cattura si ferma', async () => {
    const onChiuso = vi.fn();
    const p = apriDeepgram({ chiave: 'K', stream: {}, lingua: 'it', onChiuso, WebSocketImpl: SocketFinto });
    sockets[0].apri();
    const sess = await p;
    sockets[0].readyState = 3;
    sockets[0].onclose();
    expect(onChiuso).toHaveBeenCalledTimes(1);
    expect(sess.aperta).toBe(false);
    expect(processori[0].disconnect).toHaveBeenCalled();
  });

  it('un ascoltatore che scoppia non fa cadere il socket', async () => {
    const p = apriDeepgram({ chiave: 'K', stream: {}, lingua: 'it', onTesto: () => { throw new Error('boom'); }, WebSocketImpl: SocketFinto });
    sockets[0].apri(); await p;
    expect(() => sockets[0].onmessage({ data: JSON.stringify({ type: 'Results', channel: { alternatives: [{ transcript: 'x' }] } }) })).not.toThrow();
  });
});

describe('b.602 — le copie sono sparite', () => {
  it('nessun WebSocket verso Deepgram, nessun ScriptProcessor, nessuna chiamata a /api/stt-token fuori dal client unico', () => {
    for (const p of ['app/hooks/useStreamingInterpreter.js', 'app/hooks/useDeepgramSTT.js', 'app/components/SpeakerView.js']) {
      const s = leggi(p).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
      expect(s, p).not.toMatch(/api\.deepgram\.com/);
      expect(s, p).not.toMatch(/createScriptProcessor/);
      expect(s, p).not.toMatch(/Int16Array/);
      expect(s, p).not.toMatch(/['"]\/api\/stt-token['"]/);
      expect(s, p).toMatch(/from '\.\.\/(?:\.\.\/)?lib\/audio\/deepgramLive\.js'/);
      expect(s, p).toMatch(/prendiVoce\(\)/);
    }
  });
  it('le tre schermate Life passano dal microfono unico', () => {
    for (const p of ['app/components/Life/LifeView.js', 'app/components/Life/PannelloPronuncia.js', 'app/components/Life/CompagnoLive.js']) {
      const s = leggi(p).split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
      expect(s, p).not.toMatch(/getUserMedia\(\{ audio: true \}\)/);
      expect(s, p).toMatch(/prendiVoce\(\)/);
      expect(s, p).toMatch(/rendiVoce\(/);
    }
  });
});

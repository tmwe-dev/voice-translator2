import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { procuraVoce, suonaBlob } from '../app/lib/audio/voceTradotta.js';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.603 — Modulo D dell'audit di architettura (b.598): le pipeline gemelle
// FUORI dagli interpreti. Cinque copie di SpeechRecognition → lib/dettatura.js
// (b.432, che lo chiedeva da allora); il ciclo dei motori vocali e il
// lettore di SpeakerView/TaxiTalk (clone esatto) e di PrimaProva/
// InterpreteVideo → procuraVoce/suonaBlob nel modulo unico.

const risposta = (status, size = 10) => ({ status, ok: status >= 200 && status < 300, blob: async () => ({ size }) });

describe('procuraVoce — un ciclo per tutti gli ordini di motori', () => {
  it('prova in ordine e si ferma al primo audio non vuoto', async () => {
    const rotte = [];
    const fetchImpl = vi.fn(async (r) => { rotte.push(r); return r === '/api/a' ? risposta(503) : risposta(200); });
    const b = await procuraVoce([{ rotta: '/api/a', corpo: { x: 1 } }, { rotta: '/api/b', corpo: { y: 2 } }], { fetchImpl });
    expect(b.size).toBe(10);
    expect(rotte).toEqual(['/api/a', '/api/b']);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ y: 2 });
  });
  it('«200 con zero byte» non e\' un audio: si passa al prossimo', async () => {
    const fetchImpl = vi.fn(async (r) => r === '/api/a' ? risposta(200, 0) : risposta(200, 5));
    expect((await procuraVoce([{ rotta: '/api/a' }, { rotta: '/api/b' }], { fetchImpl })).size).toBe(5);
  });
  it('204 = niente da dire: null SENZA provare i motori a pagamento dopo', async () => {
    const fetchImpl = vi.fn(async () => risposta(204));
    expect(await procuraVoce([{ rotta: '/api/tts-edge' }, { rotta: '/api/tts' }], { fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('la rete che inciampa non ferma il ciclo; finiti tutti → null', async () => {
    const fetchImpl = vi.fn(async (r) => { if (r === '/api/a') throw new Error('rete'); return risposta(500); });
    expect(await procuraVoce([{ rotta: '/api/a' }, { rotta: '/api/b' }], { fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('motori vuoti o malformati: null, nessuna chiamata', async () => {
    const fetchImpl = vi.fn();
    expect(await procuraVoce([], { fetchImpl })).toBeNull();
    expect(await procuraVoce([null, {}], { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('suonaBlob — risolve sempre, la coda non si blocca mai', () => {
  let audio;
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.Audio = class { constructor() { this.volume = 1; audio = this; } play() { return this._rifiuta ? Promise.reject(new Error('no')) : Promise.resolve(); } };
  });
  afterEach(() => { vi.useRealTimers(); delete globalThis.Audio; });

  it('finisce a onended, libera l\'url una volta sola, consegna l\'elemento', async () => {
    const onAudio = vi.fn();
    const p = suonaBlob({ size: 3 }, { onAudio, volume: 0.5 });
    expect(onAudio).toHaveBeenCalledWith(audio);
    expect(audio.volume).toBe(0.5);
    audio.onended(); audio.onerror();
    expect(await p).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
  it('senza onended ne onerror, la rete di sicurezza chiude dopo la scadenza', async () => {
    const p = suonaBlob({ size: 3 }, { scadenzaMs: 1000 });
    vi.advanceTimersByTime(1001);
    expect(await p).toBe(false);
  });
  it('play() rifiutato → false; blob vuoto → false subito', async () => {
    globalThis.Audio.prototype._rifiuta = true;
    const p = suonaBlob({ size: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toBe(false);
    delete globalThis.Audio.prototype._rifiuta;
    expect(await suonaBlob(null)).toBe(false);
    expect(await suonaBlob({ size: 0 })).toBe(false);
  });
});

describe('b.603 — le copie sono sparite', () => {
  const senzaCommenti = (p) => leggi(p).split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  it('cinque copie di SpeechRecognition → lib/dettatura.js', () => {
    for (const p of ['app/components/SpeakerView.js', 'app/components/TaxiTalk.js', 'app/components/PrimaProva.js', 'app/components/Life/LifeView.js']) {
      const s = senzaCommenti(p);
      expect(s, p).not.toMatch(/SpeechRecognition/);
      expect(s, p).toMatch(/ascoltaDettatura\(\{/);
      expect(s, p).toMatch(/from '\.\.\/(?:\.\.\/)?lib\/dettatura\.js'/);
    }
    // due usi nella Prima prova (io e l'ospite), non uno
    expect(leggi('app/components/PrimaProva.js').match(/ascoltaDettatura\(\{/g).length).toBe(2);
  });
  it('nessuna fetch a mano verso le rotte vocali nelle quattro schermate', () => {
    for (const p of ['app/components/SpeakerView.js', 'app/components/TaxiTalk.js', 'app/components/PrimaProva.js', 'app/components/ui/InterpreteVideo.js']) {
      const s = senzaCommenti(p);
      expect(s, p).not.toMatch(/fetch\(\s*['"]\/api\/tts/);
      expect(s, p).toMatch(/procuraVoce\(/);
    }
    for (const p of ['app/components/SpeakerView.js', 'app/components/TaxiTalk.js']) {
      expect(senzaCommenti(p), p).not.toMatch(/new Audio\(/);
    }
  });
  it('gli ORDINI dei motori restano di chi chiama (sono scelte, non copie)', () => {
    expect(leggi('app/components/SpeakerView.js')).toMatch(/\{ rotta: '\/api\/tts-edge'[\s\S]{0,200}\{ rotta: '\/api\/tts'/);
    expect(leggi('app/components/PrimaProva.js')).toMatch(/\{ rotta: '\/api\/tts-elevenlabs'[\s\S]{0,120}\{ rotta: '\/api\/tts-edge'/);
    expect(leggi('app/components/ui/InterpreteVideo.js')).toMatch(/viaAsiatica\(lingua\) \? '\/api\/tts' : '\/api\/tts-elevenlabs'/);
  });
});

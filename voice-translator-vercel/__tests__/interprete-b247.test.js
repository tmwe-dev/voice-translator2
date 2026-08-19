// ═══════════════════════════════════════════════════════════════
// b.247 — tre difetti della modalità INTERPRETE, verificati riga per riga
// prima di correggerli. Tutti e tre erano silenziosi: nessuno di questi
// si presenta con un errore in console, si presentano come «l'interprete
// ogni tanto salta delle frasi» e «il microfono resta acceso».
//
//  1. DOPPIA PIPELINE. `useStreamingInterpreter.start()` dava `false` in
//     due punti (`ws.onerror` e un `setTimeout(..., 4000)`) senza chiudere
//     NIENTE: WebSocket, getUserMedia, AudioContext e ScriptProcessor
//     restavano vivi. `useInterpreterMode` legge quel false come
//     «streaming non disponibile» e accende la pipeline a blocchi da 3s:
//     se il WebSocket Deepgram si apriva un attimo dopo, la stessa voce
//     veniva catturata e trascritta DUE volte. Per giunta il
//     temporizzatore non veniva mai annullato, quindi scattava anche dopo
//     una connessione riuscita.
//  2. CHUNK PERSI. `if (!activeRef.current || processingRef.current) return;`
//     buttava via il blocco audio successivo mentre il precedente era
//     ancora in viaggio. Il MediaRecorder ne consegna uno ogni 3 secondi,
//     la catena STT→traduzione→TTS→base64→DataChannel spesso ci mette di
//     più: su rete lenta si perdevano frasi intere, senza un rigo di log.
//  3. DEEPGRAM SPENTO E ACCESO INSIEME. `useDeepgramSTT` forzava
//     `deepgramAvailableRef.current = false` (b.172) mentre
//     `useStreamingInterpreter` chiamava `/api/stt-token` e apriva il suo
//     WebSocket verso lo stesso fornitore. Una decisione scritta in due
//     posti che non si parlavano.
//
// NOTA ONESTA: questi test leggono il sorgente, non aprono due telefoni e
// non misurano nessun microfono. Provano che la struttura è quella
// giusta; che l'interprete non salti più una frase lo dice il collaudo
// dal vivo.
//
// I controlli girano sempre sul sorgente SENZA COMMENTI: i commenti
// citano i difetti per spiegarli, e un test che leggesse la propria
// spiegazione passerebbe da solo (CLAUDE.md §6).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import useStreamingInterpreter from '../app/hooks/useStreamingInterpreter.js';
import useInterpreterMode from '../app/hooks/useInterpreterMode.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const streaming = () => senzaCommenti(leggi('app/hooks/useStreamingInterpreter.js'));
const modalita = () => senzaCommenti(leggi('app/hooks/useInterpreterMode.js'));
const deepgram = () => senzaCommenti(leggi('app/hooks/useDeepgramSTT.js'));
const policy = () => leggi('app/lib/sttPolicy.js');

// ───────────────────────────────────────────────────────────────
// 1. DOPPIA PIPELINE
// ───────────────────────────────────────────────────────────────
describe('un avvio fallito non lascia acceso un secondo microfono', () => {
  it('esiste UNA funzione di abort che spegne tutto', () => {
    const s = streaming();
    expect(s).toContain('const abortaStreaming = useCallback(');
    // Deve toccare tutte e quattro le risorse che prima restavano vive.
    const i = s.indexOf('const abortaStreaming = useCallback(');
    const corpo = s.slice(i, s.indexOf('const start = useCallback('));
    expect(corpo, 'lo ScriptProcessor').toContain('processorRef.current.disconnect()');
    expect(corpo, "l'AudioContext").toContain('.close()');
    expect(corpo, 'le tracce del microfono').toContain('.getTracks().forEach');
    expect(corpo, 'il WebSocket').toContain('.close()');
  });

  it("l'abort è idempotente: ogni risorsa viene azzerata dopo essere stata chiusa", () => {
    const s = streaming();
    const i = s.indexOf('const abortaStreaming = useCallback(');
    const corpo = s.slice(i, s.indexOf('const start = useCallback('));
    // Chiamarla due volte non deve essere un guasto: la seconda volta i ref
    // sono null e ogni blocco viene saltato.
    expect(corpo).toContain('processorRef.current = null');
    expect(corpo).toContain('audioCtxRef.current = null');
    expect(corpo).toContain('streamRef.current = null');
    expect(corpo).toContain('wsRef.current = null');
    expect(corpo).toContain('noiseGateRef.current = null');
  });

  it('OGNI esito negativo passa dall\'abort — era il difetto', () => {
    const s = streaming();
    // Prima gli esiti negativi erano due `resolve(false)` sparsi e nudi.
    const uscite = [...s.matchAll(/(resolve|concludi)\(false\)/g)];
    expect(uscite.length, 'un esito negativo deve esistere ancora').toBeGreaterThan(0);
    for (const m of uscite) {
      if (m[1] !== 'resolve') continue;
      // Se qualcuno rimette un resolve(false) diretto, deve almeno chiudere.
      expect(s.slice(Math.max(0, m.index - 300), m.index),
        `il resolve(false) a ${m.index} non è preceduto da un abort`)
        .toContain('abortaStreaming()');
    }
    // E la porta d'uscita unica aborta PRIMA di risolvere.
    const i = s.indexOf('const concludi = (esito)');
    expect(i, 'la porta d\'uscita unica deve esistere').toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 300);
    expect(corpo).toContain('if (!esito) abortaStreaming();');
    expect(corpo.indexOf('abortaStreaming()')).toBeLessThan(corpo.indexOf('resolve(esito)'));
  });

  it('non c\'è più il temporizzatore che risolveva false senza chiudere niente', () => {
    // La riga esatta di prima: `setTimeout(() => resolve(false), 4000);`
    expect(streaming()).not.toMatch(/setTimeout\(\(\) => resolve\(false\), 4000\)/);
  });

  it("e nemmeno l'onerror che risolveva false a nudo", () => {
    expect(streaming()).not.toMatch(/ws\.onerror = \(\) => \{ console\.warn\('\[StreamInterp\] WS error'\); resolve\(false\); \}/);
  });

  it('il temporizzatore di apertura viene ANNULLATO quando si conclude', () => {
    // Prima restava armato anche dopo una connessione riuscita.
    const s = streaming();
    expect(s).toContain('clearTimeout(timerAperturaId)');
    expect(s).toMatch(/let risolto = false/);
  });

  it('anche stop() e lo smontaggio usano la stessa funzione, non una copia', () => {
    const s = streaming();
    const iStop = s.indexOf('const stop = useCallback(');
    expect(iStop).toBeGreaterThan(-1);
    expect(s.slice(iStop, iStop + 900)).toContain('abortaStreaming()');
    // Almeno tre usi: rami di fallimento, stop, smontaggio.
    const usi = (s.match(/abortaStreaming\(\)/g) || []).length;
    expect(usi, 'abort riusato ovunque').toBeGreaterThanOrEqual(3);
  });
});

// ───────────────────────────────────────────────────────────────
// 2. CHUNK PERSI
// ───────────────────────────────────────────────────────────────
describe('nessun blocco audio viene buttato via in silenzio', () => {
  it('la guardia che scartava il blocco NON c\'è più', () => {
    expect(modalita()).not.toContain('if (!activeRef.current || processingRef.current) return;');
  });

  it('esiste una coda FIFO con un tetto dichiarato', () => {
    const s = modalita();
    expect(s).toMatch(/const MAX_CODA_CHUNK = \d+;/);
    expect(s).toContain('codaChunkRef');
    // FIFO vera: si accoda in fondo e si preleva dalla testa.
    expect(s).toContain('codaChunkRef.current.push(');
    expect(s).toContain('codaChunkRef.current.shift()');
  });

  it('il MediaRecorder ora ACCODA invece di elaborare al volo', () => {
    const s = modalita();
    const i = s.indexOf('recorder.ondataavailable');
    expect(i).toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 260);
    expect(corpo).toContain('accodaChunkRef.current?.(e.data)');
    expect(corpo, 'non deve più saltare la coda').not.toContain('processChunkRef.current?.(e.data)');
  });

  it('i blocchi si elaborano UNO ALLA VOLTA e in ordine', () => {
    const s = modalita();
    const i = s.indexOf('const elaboraCoda = useCallback(');
    expect(i, 'il consumatore della coda deve esistere').toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 700);
    expect(corpo).toContain('if (processingRef.current) return;');
    expect(corpo).toContain('while (codaChunkRef.current.length > 0');
    expect(corpo).toMatch(/await processChunkRef\.current\?\.\(/);
  });

  it('se la coda si riempie si scarta il PIÙ VECCHIO, e lo si dichiara', () => {
    const s = modalita();
    const i = s.indexOf('codaChunkRef.current.length > MAX_CODA_CHUNK');
    expect(i, 'il tetto deve essere controllato').toBeGreaterThan(-1);
    const corpo = s.slice(i, i + 600);
    // splice(0, n) toglie dalla testa: i più vecchi. Mai pop().
    expect(corpo).toContain('codaChunkRef.current.splice(0,');
    expect(corpo, "mai in silenzio: era il punto").toContain('console.warn(');
    expect(corpo).not.toContain('codaChunkRef.current.pop()');
  });

  it('la coda si svuota allo stop e allo smontaggio', () => {
    const s = modalita();
    const iStop = s.indexOf('const stopInterpreter = useCallback(');
    expect(iStop).toBeGreaterThan(-1);
    expect(s.slice(iStop, iStop + 500)).toContain('codaChunkRef.current = []');
    // activeRef va abbassato subito: si allineerebbe solo al render dopo,
    // e nel frattempo un blocco in arrivo finirebbe ancora in coda.
    expect(s.slice(iStop, iStop + 500)).toContain('activeRef.current = false');
    const usi = (s.match(/codaChunkRef\.current = \[\]/g) || []).length;
    expect(usi, 'stop, smontaggio e avvio').toBeGreaterThanOrEqual(3);
  });
});

// ───────────────────────────────────────────────────────────────
// 3. UNA SOLA DECISIONE SULLA DETTATURA
// ───────────────────────────────────────────────────────────────
describe('quale motore STT si usa lo decide un posto solo', () => {
  it('il modulo esiste ed è PURO: niente rete, niente stato, niente hook', () => {
    const p = policy();
    expect(p).not.toMatch(/\bfetch\(/);
    expect(p).not.toMatch(/useState|useRef|useEffect|useCallback/);
    expect(p).not.toMatch(/from 'react'/);
    expect(p).not.toMatch(/'use client'/);
    // Nessun import: una decisione non deve trascinarsi dietro nulla.
    expect(p).not.toMatch(/^import /m);
  });

  it('distingue i due usi, perché la risposta giusta è diversa', () => {
    const p = senzaCommenti(policy());
    expect(p).toContain('TRADUZIONE:');
    expect(p).toContain('INTERPRETE:');
    expect(p).toContain('export function deepgramAmmesso');
  });

  it('e la risposta di oggi non cambia: Deepgram no sulla traduzione, sì sull\'interprete', async () => {
    const { deepgramAmmesso, USO, motoriAmmessi, MOTORE, motorePreferito } =
      await import('../app/lib/sttPolicy.js');
    expect(deepgramAmmesso(USO.TRADUZIONE), 'spento da b.172, e resta spento').toBe(false);
    expect(deepgramAmmesso(USO.INTERPRETE), "l'interprete ha bisogno dello streaming").toBe(true);
    // La dettatura non si perde: sulla traduzione resta Whisper.
    expect(motoriAmmessi(USO.TRADUZIONE)).toContain(MOTORE.WHISPER);
    expect(motorePreferito(USO.TRADUZIONE)).toBe(MOTORE.WHISPER);
    // Un uso inventato non accende niente per sbaglio.
    expect(motoriAmmessi('boh')).toEqual([]);
    expect(deepgramAmmesso(undefined)).toBe(false);
  });

  it('la copia restituita non permette di modificare la regola da fuori', () => {
    // Una decisione condivisa che si può mutare per sbaglio è di nuovo
    // una decisione scritta in due posti.
    return import('../app/lib/sttPolicy.js').then(({ motoriAmmessi, USO, MOTORE }) => {
      motoriAmmessi(USO.TRADUZIONE).push(MOTORE.DEEPGRAM);
      expect(motoriAmmessi(USO.TRADUZIONE)).not.toContain(MOTORE.DEEPGRAM);
    });
  });

  it('useDeepgramSTT non scrive più il false a mano: lo chiede alla policy', () => {
    const s = deepgram();
    expect(s).not.toContain('deepgramAvailableRef.current = false;');
    expect(s).toContain("from '../lib/sttPolicy.js'");
    expect(s).toContain('deepgramAvailableRef.current = deepgramAmmesso(USO.TRADUZIONE)');
  });

  it('e nemmeno startDeepgramStreaming apre il microfono senza chiedere', () => {
    const s = deepgram();
    const i = s.indexOf('const startDeepgramStreaming = useCallback(');
    const iMic = s.indexOf('navigator.mediaDevices.getUserMedia');
    const iGuardia = s.indexOf('if (!deepgramAmmesso(USO.TRADUZIONE))');
    expect(iGuardia, 'la guardia deve esistere').toBeGreaterThan(i);
    expect(iGuardia, 'e stare PRIMA di qualunque effetto collaterale').toBeLessThan(iMic);
  });

  it("l'interprete chiede alla stessa policy invece di decidere per conto suo", () => {
    const s = streaming();
    expect(s).toContain("from '../lib/sttPolicy.js'");
    // Prima chiamava /api/stt-token comunque: ora la chiamata è dentro la
    // guardia della policy.
    const iGuardia = s.indexOf('if (!deepgramAmmesso(USO.INTERPRETE)) return;');
    const iFetch = s.indexOf("fetch('/api/stt-token'");
    expect(iGuardia, 'la guardia sulla chiave deve esistere').toBeGreaterThan(-1);
    expect(iGuardia, 'e precedere la richiesta della chiave').toBeLessThan(iFetch);
    // E anche start() non parte se la policy dice di no.
    const iStart = s.indexOf('const start = useCallback(');
    expect(s.slice(iStart, iStart + 400)).toContain('deepgramAmmesso(USO.INTERPRETE)');
  });
});

// ═══════════════════════════════════════════════════════════════
// LE DUE PROVE VERE (non lettura del sorgente: si fa girare l'hook)
//
// Qui gli hook vengono montati davvero, con microfono, WebSocket,
// MediaRecorder e rete finti. Sono le due prove che PRIMA erano rosse
// per il comportamento, non per come è scritto il codice.
// ═══════════════════════════════════════════════════════════════

// Traccia audio finta: registra se qualcuno l'ha davvero spenta.
function traccaFinta() {
  return { kind: 'audio', spenta: false, stop() { this.spenta = true; } };
}
function flussoFinto(tracce) {
  return { getTracks: () => tracce, getAudioTracks: () => tracce, getVideoTracks: () => [] };
}
const attesa = (ms = 0) => new Promise(r => setTimeout(r, ms));

describe('PROVA VERA — un avvio fallito rilascia davvero il microfono', () => {
  let tracce, socketCreati, originali;

  beforeEach(() => {
    tracce = [traccaFinta()];
    socketCreati = [];
    originali = { WebSocket: global.WebSocket, fetch: global.fetch };

    class SocketFinto {
      static OPEN = 1;
      static CLOSED = 3;
      constructor() {
        this.readyState = 0;
        this.chiuso = false;
        socketCreati.push(this);
        // Non si apre mai: è il caso che prima lasciava tutto acceso.
        setTimeout(() => this.onerror?.({ type: 'error' }), 0);
      }
      send() {}
      close() { this.chiuso = true; this.readyState = 3; }
    }
    global.WebSocket = SocketFinto;
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/stt-token')) {
        return { ok: true, json: async () => ({ key: 'chiave-finta' }) };
      }
      return { ok: false };
    });
    global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => flussoFinto(tracce)) };
  });

  afterEach(() => {
    global.WebSocket = originali.WebSocket;
    global.fetch = originali.fetch;
    vi.restoreAllMocks();
  });

  it('start() torna false E spegne microfono e WebSocket', async () => {
    const { result } = renderHook(() => useStreamingInterpreter({
      webrtc: { sendDirectMessage: vi.fn() },
      myLang: 'it', partnerLang: 'en', roomId: 'r1',
      roomSessionTokenRef: { current: 'rst' }, userToken: 'ut',
      conversationContext: { getContext: () => '', addMessage: vi.fn() },
      startDucking: vi.fn(), stopDucking: vi.fn(),
    }));

    let esito;
    await act(async () => { esito = await result.current.start(); });

    expect(esito, 'la pipeline a blocchi deve poter partire').toBe(false);
    // ↓↓↓ QUESTO era il difetto: prima il microfono restava acceso, e con
    // la pipeline di ripiego che partiva si finiva con DUE microfoni aperti
    // sulla stessa voce.
    expect(tracce[0].spenta, 'la traccia del microfono deve essere stata fermata').toBe(true);
    expect(socketCreati.length).toBe(1);
    expect(socketCreati[0].chiuso, 'il WebSocket deve essere stato chiuso').toBe(true);
    expect(result.current.active, 'e non ci si deve credere attivi').toBe(false);
  });

  it('e chiamare stop() dopo un abort non è un guasto (idempotenza)', async () => {
    const { result } = renderHook(() => useStreamingInterpreter({
      webrtc: { sendDirectMessage: vi.fn() },
      myLang: 'it', partnerLang: 'en', roomId: 'r1',
      roomSessionTokenRef: { current: 'rst' }, userToken: 'ut',
      conversationContext: { getContext: () => '', addMessage: vi.fn() },
      startDucking: vi.fn(), stopDucking: vi.fn(),
    }));

    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); result.current.stop(); });
    expect(tracce[0].spenta).toBe(true);
  });
});

describe('PROVA VERA — tre blocchi audio di fila, nessuno perso', () => {
  let registratori, chiamateSTT, originali, tracce;

  beforeEach(() => {
    registratori = [];
    chiamateSTT = [];
    tracce = [traccaFinta()];
    originali = { fetch: global.fetch, MediaRecorder: global.MediaRecorder };

    class RegistratoreFinto {
      static isTypeSupported() { return true; }
      constructor() { this.state = 'inactive'; registratori.push(this); }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; }
    }
    global.MediaRecorder = RegistratoreFinto;
    global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => flussoFinto(tracce)) };

    global.fetch = vi.fn(async (url, opts) => {
      const u = String(url);
      // Niente chiave Deepgram → l'interprete ripiega sulla pipeline a
      // blocchi da 3 secondi, che è quella che perdeva le frasi.
      if (u.includes('/api/stt-token')) return { ok: false };
      if (u.includes('/api/transcribe')) {
        const n = chiamateSTT.length + 1;
        chiamateSTT.push(n);
        // La trascrizione è LENTA: è esattamente la condizione in cui
        // arrivava il blocco successivo e veniva buttato via.
        await attesa(10);
        return { ok: true, json: async () => ({ original: `frase numero ${n}` }) };
      }
      if (u.includes('/api/translate')) {
        const inviato = JSON.parse(opts.body);
        return { ok: true, json: async () => ({ translated: `[tradotto] ${inviato.text}` }) };
      }
      if (u.includes('/api/tts-edge')) {
        return { ok: true, blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(16) }) };
      }
      return { ok: false };
    });
  });

  afterEach(() => {
    global.fetch = originali.fetch;
    global.MediaRecorder = originali.MediaRecorder;
    vi.restoreAllMocks();
  });

  const montaggio = (inviati) => renderHook(() => useInterpreterMode({
    webrtc: { sendDirectMessage: (m) => inviati.push(m), webrtcState: 'connected' },
    myLang: 'it', partnerLang: 'en', roomId: 'r1',
    roomSessionTokenRef: { current: 'rst' }, userToken: 'ut', useOwnKeys: false,
    startDucking: vi.fn(), stopDucking: vi.fn(),
    conversationContext: { getContext: () => '', addMessage: vi.fn() },
  }));

  const blocco = () => new Blob([new Uint8Array(4000)], { type: 'audio/webm' });

  it('i tre blocchi vengono TUTTI trascritti, in ordine', async () => {
    const inviati = [];
    const { result } = montaggio(inviati);

    await act(async () => { await result.current.start(); });
    expect(registratori.length, 'deve essere partita la pipeline a blocchi').toBe(1);

    // Tre blocchi consegnati uno dietro l'altro mentre il primo è ancora
    // in lavorazione. PRIMA: il 2° e il 3° sparivano senza un rigo di log.
    await act(async () => {
      registratori[0].ondataavailable({ data: blocco() });
      registratori[0].ondataavailable({ data: blocco() });
      registratori[0].ondataavailable({ data: blocco() });
      await attesa(200);
    });

    expect(chiamateSTT.length, 'nessun blocco deve essere andato perso').toBe(3);

    const sottotitoli = inviati.filter(m => m.type === 'interpreter-subtitle');
    expect(sottotitoli.length).toBe(3);
    // FIFO: l'ordine di consegna è l'ordine in cui si è parlato.
    expect(sottotitoli.map(s => s.originalText))
      .toEqual(['frase numero 1', 'frase numero 2', 'frase numero 3']);
  });

  it('lo stop butta via la coda: non si traduce una conversazione finita', async () => {
    const inviati = [];
    const { result } = montaggio(inviati);

    await act(async () => { await result.current.start(); });
    await act(async () => {
      for (let i = 0; i < 5; i++) registratori[0].ondataavailable({ data: blocco() });
      await attesa(1); // il primo blocco è appena partito, gli altri sono in coda
      result.current.stop();
      await attesa(200);
    });

    // Il blocco già in viaggio può concludersi; quelli in coda no.
    expect(chiamateSTT.length, 'la coda non deve continuare a valle dello stop')
      .toBeLessThan(5);
    expect(tracce[0].spenta, 'e il microfono si spegne').toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// CIÒ CHE NON DEVE ESSERSI ROTTO
// ───────────────────────────────────────────────────────────────
describe('ciò che non deve essersi rotto', () => {
  it('la pipeline di ripiego a blocchi da 3 secondi c\'è ancora', () => {
    const s = modalita();
    expect(s).toContain('const CHUNK_DURATION = 3000;');
    expect(s).toContain('recorder.start(CHUNK_DURATION)');
    expect(s).toContain("fetch('/api/transcribe'");
  });

  it('e si accende ancora quando lo streaming dice di no', () => {
    const s = modalita();
    // b.277 — la sostanza dell'avvio vive ora in startUnifiedInterno
    // (startUnified e' solo la porta che impedisce il doppio ingresso).
    const i = s.indexOf('const startUnifiedInterno = useCallback(');
    const corpo = s.slice(i, i + 400);
    expect(corpo).toContain('await streaming.start()');
    expect(corpo).toContain('startInterpreter()');
    // e la porta esiste davvero
    expect(s).toContain('avvioInCorsoRef');
  });

  it('la catena STT → traduzione → TTS del blocco è rimasta intera', () => {
    const s = modalita();
    const i = s.indexOf('const processChunk = useCallback(');
    const corpo = s.slice(i, s.indexOf('const elaboraCoda = useCallback('));
    expect(corpo).toContain("apiCircuitBreaker.execute('interpreter-stt'");
    expect(corpo).toContain("apiCircuitBreaker.execute('interpreter-translate'");
    expect(corpo).toContain("apiCircuitBreaker.execute('interpreter-tts'");
    expect(corpo, 'invio al partner').toContain('interpreter-subtitle');
  });

  it("l'interprete in streaming continua a mandare sottotitoli e voce", () => {
    const s = streaming();
    expect(s).toContain("type: 'interpreter-subtitle'");
    expect(s).toContain("type: 'interpreter-audio'");
    expect(s).toContain("fetch('/api/tts-edge'");
  });
});

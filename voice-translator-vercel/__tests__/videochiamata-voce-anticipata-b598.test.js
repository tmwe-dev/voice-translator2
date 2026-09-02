import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.598 — «quando rilevi la voce dell'utente, qualsiasi sia il volume
// dell'audio lo riduci per permettere al microfono di ascoltare l'utente»
// (Luca). Piu i tre debiti residui di b.597: la trascrizione che falliva
// in silenzio, il TTS che ritentava a zero millisecondi, la modalita
// compatta senza interprete. Piu tre difetti trovati dall'audit di
// architettura nella pipeline di ripiego.

// ─────────────────────────────────────────────────────────────
// 1. Il cancello del rumore AVVISA quando la voce comincia e finisce.
//    Prova di COMPORTAMENTO: AudioContext finto, si guida il livello.
// ─────────────────────────────────────────────────────────────
describe('b.598 — noiseGate.onCambio dice quando l\'utente parla', () => {
  let livelloRms;
  let rafCallbacks;
  let ctxChiusi;

  beforeEach(() => {
    livelloRms = 0;
    rafCallbacks = [];
    ctxChiusi = 0;
    const nodo = () => ({ connect: vi.fn(), disconnect: vi.fn(), frequency: { value: 0 }, Q: { value: 0 }, type: '' });
    globalThis.AudioContext = class {
      constructor() { this.currentTime = 0; }
      createMediaStreamSource() { return nodo(); }
      createAnalyser() {
        return { ...nodo(), fftSize: 256, smoothingTimeConstant: 0,
          getFloatTimeDomainData: (arr) => { arr.fill(livelloRms); } };
      }
      createGain() { return { ...nodo(), gain: { value: 1, setTargetAtTime: vi.fn() } }; }
      createBiquadFilter() { return nodo(); }
      createMediaStreamDestination() { return { ...nodo(), stream: { id: 'pulito' } }; }
      close() { ctxChiusi++; }
    };
    globalThis.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; };
    globalThis.cancelAnimationFrame = vi.fn();
  });
  afterEach(() => {
    delete globalThis.AudioContext;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
    vi.resetModules();
  });

  const giro = () => { const cb = rafCallbacks.shift(); if (cb) cb(); };

  it('apre → onCambio(true); chiude → onCambio(false); una volta per transizione, non a ogni fotogramma', async () => {
    const { createNoiseGate } = await import('../app/lib/noiseGate.js');
    const onCambio = vi.fn();
    // il cancello nasce APERTO e il primo giro con silenzio lo chiude
    livelloRms = 0;
    createNoiseGate({}, { threshold: -45, onCambio });
    expect(onCambio).toHaveBeenCalledWith(false);
    onCambio.mockClear();
    // silenzio ripetuto: nessun nuovo avviso
    giro(); giro();
    expect(onCambio).not.toHaveBeenCalled();
    // voce (rms 0.1 = -20 dB > -45): si apre, UNA volta
    livelloRms = 0.1;
    giro(); giro(); giro();
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio).toHaveBeenLastCalledWith(true);
    // torna il silenzio: si chiude, UNA volta
    livelloRms = 0;
    giro(); giro();
    expect(onCambio).toHaveBeenCalledTimes(2);
    expect(onCambio).toHaveBeenLastCalledWith(false);
  });

  it('destroy() mentre si parla manda onCambio(false): l\'attenuazione non resta accesa per sempre', async () => {
    const { createNoiseGate } = await import('../app/lib/noiseGate.js');
    const onCambio = vi.fn();
    livelloRms = 0.1;
    const g = createNoiseGate({}, { threshold: -45, onCambio });
    // nasce aperto e resta aperto: nessuna transizione ancora
    expect(onCambio).not.toHaveBeenCalled();
    g.destroy();
    expect(onCambio).toHaveBeenCalledTimes(1);
    expect(onCambio).toHaveBeenCalledWith(false);
    expect(ctxChiusi).toBe(1);
  });

  it('un ascoltatore che scoppia non ferma il cancello', async () => {
    const { createNoiseGate } = await import('../app/lib/noiseGate.js');
    livelloRms = 0;
    const g = createNoiseGate({}, { threshold: -45, onCambio: () => { throw new Error('boom'); } });
    livelloRms = 0.1;
    expect(() => { giro(); giro(); }).not.toThrow();
    expect(() => g.destroy()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Il segnale arriva alla stanza, da TUTTE E DUE le pipeline, e la
//    stanza attenua se parla l'utente OPPURE se suona la voce tradotta.
// ─────────────────────────────────────────────────────────────
describe('b.598 — la voce locale attenua il partner subito, non dopo il giro di traduzione', () => {
  it('tutte e due le pipeline collegano onCambio al cancello e mandano bartalk:voce-locale', () => {
    // b.599 — l'aiutante sta in lib/eventi.js; tutte e due lo importano.
    expect(leggi('app/lib/eventi.js')).toMatch(/export const avvisaVoceLocale = \(parlando\) => lancia\(EVENTO\.VOCE_LOCALE/);
    for (const p of ['app/hooks/useInterpreterMode.js', 'app/hooks/useStreamingInterpreter.js']) {
      const f = leggi(p);
      expect(f, p).toMatch(/avvisaVoceLocale.*from '\.\.\/lib\/eventi\.js'/);
      expect(f, p).toMatch(/onCambio: avvisaVoceLocale/);
    }
  });

  it('la stanza ascolta i due segnali e li mette in OR', () => {
    const r = leggi('app/components/RoomView.js');
    expect(r).toMatch(/attenuazioneAttivaRef = useRef\(\{ tts: false, voceLocale: false \}\)/);
    expect(r).toMatch(/window\.addEventListener\(EVENTO\.TTS, suTTS\)/);
    expect(r).toMatch(/window\.addEventListener\(EVENTO\.VOCE_LOCALE, suVoceLocale\)/);
    expect(r).toMatch(/attenuazioneAttivaRef\.current\.tts \|\| attenuazioneAttivaRef\.current\.voceLocale/);
    expect(r).toMatch(/window\.removeEventListener\(EVENTO\.VOCE_LOCALE, suVoceLocale\)/);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. La trascrizione che fallisce non e piu muta.
// ─────────────────────────────────────────────────────────────
describe('b.598 — tre trascrizioni fallite di fila si dicono a schermo', () => {
  it('il hook conta i fallimenti consecutivi e li azzera al primo successo', () => {
    const f = leggi('app/hooks/useInterpreterMode.js');
    expect(f).toMatch(/const \[problemaAudio, setProblemaAudio\] = useState\(false\)/);
    expect(f).toMatch(/audioFallitiRef\.current\+\+;\s*\n\s*if \(audioFallitiRef\.current >= 3\) setProblemaAudio\(true\)/);
    expect(f).toMatch(/audioFallitiRef\.current = 0;\s*\n\s*setProblemaAudio\(false\)/);
    expect(f).toMatch(/problemaAudio,\n  \};/);
  });
  it('la videochiamata lo mostra con parole, in tutte le lingue', () => {
    const v = leggi('app/components/VideoCallOverlay.js');
    expect(v).toMatch(/interpreterActive && interpreter\?\.problemaAudio \? \(/);
    expect(v).toMatch(/L\('audioNonChiaro'\)/);
    expect(leggi('app/lib/locales/it.js')).toContain('"audioNonChiaro":');
    expect(leggi('app/lib/locales/en.js')).toContain('"audioNonChiaro":');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Edge TTS: il secondo tentativo aspetta, non ripete a zero ms.
// ─────────────────────────────────────────────────────────────
describe('b.598 — audio vuoto: pausa prima del secondo tentativo (mitigazione dichiarata, non causa confermata)', () => {
  it('c\'e una pausa tra i due tentativi', () => {
    const r = leggi('app/api/tts-edge/route.js');
    expect(r).toMatch(/MITIGAZIONE, NON CAUSA CONFERMATA/);
    expect(r).toMatch(/await new Promise\(\(resolve\) => setTimeout\(resolve, 400\)\);\s*\n\s*audioBuffer = await sintetizza\(\);/);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. La modalita compatta non e piu un vicolo cieco per l'interprete.
// ─────────────────────────────────────────────────────────────
describe('b.598 — anche la modalita compatta ha traduzione e sottotitolo', () => {
  const v = leggi('app/components/VideoCallOverlay.js');
  it('l\'ultimo sottotitolo si calcola una volta sola, a livello di componente', () => {
    expect(v).toMatch(/const latest = subsCompatto\.length > 0/);
    // e non piu dentro l'IIFE del tutto schermo
    expect(v).not.toMatch(/const subs = daInterprete \|\|/);
  });
  it('la modalita compatta ha il comando traduzione con lo stesso guard del tutto schermo', () => {
    const compatta = v.slice(v.indexOf('{/* Controls area */}'));
    expect(compatta).toMatch(/LA TRADUZIONE, ANCHE QUI/);
    expect(compatta).toMatch(/setInterpreterActive && \(\s*\n\s*<ControlBtn/);
    expect(compatta).toMatch(/if \(stanzaDiretta\) \{ toast\.info\(L\('directNoCloud'\)\); return; \}/);
    expect(compatta).toMatch(/if \(stanzaConPiuDiDue\) \{ toast\.info\(L\('interpreterTwoOnly'\)\); return; \}/);
  });
  it('e mostra l\'ultima frase tradotta sopra il video', () => {
    expect(v).toMatch(/SOTTOTITOLO ANCHE IN MODALITA COMPATTA/);
    expect(v).toMatch(/\{interpreterActive && latest && \(/);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Tre difetti del ripiego trovati dall'audit di architettura.
// ─────────────────────────────────────────────────────────────
describe('b.598 — il ripiego a blocchi allineato allo streaming', () => {
  const f = leggi('app/hooks/useInterpreterMode.js');
  it('ElevenLabs riceve langCode, non lang (che la rotta non legge)', () => {
    expect(f).not.toMatch(/campo: 'lang' \}/);
    expect(leggi('app/api/tts-elevenlabs/route.js')).toMatch(/const \{ text, voiceId, langCode,/);
  });
  it('playBase64Audio del ripiego spegne l\'avviso da un\'uscita sola (b.381/b.404 anche qui)', () => {
    // b.599 — la riproduzione e' la STESSA funzione per tutte e due le
    // pipeline (riproduciBase64, provata per comportamento in
    // voce-tradotta-modulo-unico-b599.test.js): qui si chiede solo che
    // il ripiego la usi e non ne tenga una copia.
    const corpo = f.slice(f.indexOf('const playBase64Audio = useCallback'), f.indexOf('const handleInterpreterMessage'))
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    expect(corpo).toMatch(/riproduciBase64\(base64Data, \{ startDucking, stopDucking \}\)/);
    expect(corpo).not.toMatch(/new Audio\(/);
  });
  it('la voce mancata usa il contratto dello streaming: DataChannel + stato, in invio e in ricezione', () => {
    expect(f).toMatch(/webrtc\?\.sendDirectMessage\?\.\(\{ type: MSG\.VOCE_MANCATA \}\)/);
    expect(f).toMatch(/if \(msg\.type === MSG\.VOCE_MANCATA\) \{\s*\n\s*setPartnerVoceMancataLegacy\(true\)/);
    expect(f).toMatch(/voceGuasta: streaming\.voceGuasta \|\| voceGuastaLegacy/);
    expect(f).toMatch(/partnerVoceMancata: streaming\.partnerVoceMancata \|\| partnerVoceMancataLegacy/);
  });
});

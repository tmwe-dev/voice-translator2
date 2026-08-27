import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');

// b.531 — collaudo telefono di Luca: «non vedo la mia miniatura...
// le traduzioni in real time sono scorrette e non funzionano».

describe('b.531 — la mia miniatura c e SEMPRE', () => {
  const f = leggi('app/components/VideoCallOverlay.js');
  it('a camera spenta resta il riquadro (avatar + camera barrata), un tocco riaccende', () => {
    expect(f).toMatch(/if \(!webrtc\.videoEnabled\) webrtc\.toggleVideo\(\);/);
    expect(f).not.toMatch(/\{webrtc\.localStream && webrtc\.videoEnabled && \(\n            <div/);
  });
  it('sta sopra la testata, mai coperta', () => {
    expect(f).toMatch(/width: 84, height: 112, zIndex: 8/);
  });
});

describe('b.531 — le frasi non si spezzano piu sul respiro', () => {
  const f = leggi('app/hooks/useStreamingInterpreter.js');
  it('soglie umane: 1400ms di pausa, endpointing 500', () => {
    expect(f).toMatch(/const SENTENCE_PAUSE_MS = 1400;/);
    expect(f).toMatch(/endpointing: '500'/);
  });
  it('un moncone corto senza punto ASPETTA il seguito (fino a 2,5s)', () => {
    expect(f).toMatch(/const monconeRef = useRef\(''\);/);
    expect(f).toMatch(/parole < 4/);
    expect(f).toMatch(/2500\);/);
  });
  it('tutte e due le uscite (pausa e UtteranceEnd) passano dal cuscinetto', () => {
    const conte = (f.match(/completaFrase\(frase\);/g) || []).length;
    expect(conte).toBe(2);
  });
  it('quando la frase parte, la riga live si pulisce (il cartello non resta appeso)', () => {
    expect(f).toMatch(/setMyLiveText\(''\);\n    handleSentenceComplete\(intera\);/);
  });
});

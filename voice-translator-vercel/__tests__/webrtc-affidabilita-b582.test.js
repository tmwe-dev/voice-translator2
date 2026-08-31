import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicaProfiloVideoGruppo, profiloVideoGruppo } from '../app/lib/videoGruppoQualita.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('b.582 — il TURN e pronto prima della negoziazione', () => {
  it('createOffer aspetta /api/turn e configura il relay prima di creare la offer', async () => {
    let risolviFetch;
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { risolviFetch = resolve; })));

    const webrtc = await import('../app/lib/webrtc.js?b582-turn');
    const ordine = [];
    let configurazione = null;
    const pc = {
      getConfiguration: () => ({}),
      setConfiguration: (c) => { configurazione = c; ordine.push('config'); },
      createOffer: async () => { ordine.push('offer'); return { type: 'offer', sdp: 'test' }; },
      setLocalDescription: async (d) => { pc.localDescription = d; ordine.push('local'); },
      localDescription: null,
    };

    const promessa = webrtc.createOffer(pc);
    await Promise.resolve();
    expect(ordine).toEqual([]);

    risolviFetch({
      ok: true,
      json: async () => ({ iceServers: [{ urls: 'turn:relay.test:3478', username: 'u', credential: 'p' }] }),
    });
    await promessa;

    expect(ordine).toEqual(['config', 'offer', 'local']);
    expect(configurazione.iceServers.some(s => String(s.urls).startsWith('turn:'))).toBe(true);
  });
});

describe('b.582 — la mesh abbassa il costo video crescendo', () => {
  it('riduce banda, fps e risoluzione fra 2 e 8 partecipanti', () => {
    const due = profiloVideoGruppo(2);
    const otto = profiloVideoGruppo(8);
    expect(otto.maxBitrate).toBeLessThan(due.maxBitrate);
    expect(otto.maxFramerate).toBeLessThan(due.maxFramerate);
    expect(otto.scaleResolutionDownBy).toBeGreaterThan(due.scaleResolutionDownBy);
  });

  it('applica davvero il profilo al sender video e non tocca quello audio', async () => {
    const setVideo = vi.fn(async () => {});
    const setAudio = vi.fn(async () => {});
    const video = {
      track: { kind: 'video' },
      getParameters: () => ({ encodings: [{}] }),
      setParameters: setVideo,
    };
    const audio = {
      track: { kind: 'audio' },
      getParameters: () => ({ encodings: [{}] }),
      setParameters: setAudio,
    };
    const pc = { getSenders: () => [video, audio] };

    expect(await applicaProfiloVideoGruppo(pc, 8)).toBe(true);
    expect(setAudio).not.toHaveBeenCalled();
    expect(setVideo).toHaveBeenCalledTimes(1);
    const parametri = setVideo.mock.calls[0][0].encodings[0];
    expect(parametri.maxBitrate).toBe(260_000);
    expect(parametri.maxFramerate).toBe(15);
    expect(parametri.scaleResolutionDownBy).toBe(1.5);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// b.619 — IL PERMESSO NON DEVE ACCENDERE NIENTE.
//
// Confronto con Ermes (jose-master), che dal vivo e' vistosamente pronto a
// rispondere: prima di aprire la linea chiede `getUserMedia({audio:true})` e
// basta. Noi invece chiedevamo una COPIA al microfono unico e la rendevamo
// un istante dopo: l'hardware si accendeva a 48.000 Hz, si spegneva, e la
// libreria del fornitore lo riapriva a 16.000 — tre operazioni sul
// microfono per una domanda sola. Su iPhone quel valzer costa, e ogni tanto
// lascia il dispositivo occupato.

describe('b.619 — chiediPermessoVoce', () => {
  let prese;
  beforeEach(() => {
    vi.resetModules();
    prese = [];
    // il finto MediaStream: prendiVoce ne costruisce uno per la copia
    globalThis.MediaStream = class { constructor(tracce = []) { this._t = tracce; } getTracks() { return this._t; } getAudioTracks() { return this._t; } };
    globalThis.navigator = globalThis.navigator || {};
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (vincoli) => {
          const traccia = { kind: 'audio', readyState: 'live', stop() { this.readyState = 'ended'; }, clone() { return { ...this, stop() {} }; }, getSettings: () => ({}) };
          const s = { vincoli, tracce: [traccia], getTracks: () => [traccia], getAudioTracks: () => [traccia] };
          prese.push(s);
          return s;
        }),
      },
    });
  });
  afterEach(() => { delete globalThis.navigator.mediaDevices; delete globalThis.MediaStream; });

  it('chiede il permesso SENZA vincoli, come Ermes: il formato lo sceglie chi usa il microfono', async () => {
    const m = await import('../app/lib/microfonoMaster.js');
    await m.chiediPermessoVoce();
    expect(prese).toHaveLength(1);
    expect(prese[0].vincoli).toEqual({ audio: true });
    expect(prese[0].vincoli.audio.sampleRate, 'niente 48 kHz forzati').toBeUndefined();
  });

  it('e lascia il microfono LIBERO: la presa si chiude subito', async () => {
    const m = await import('../app/lib/microfonoMaster.js');
    await m.chiediPermessoVoce();
    expect(prese[0].getTracks()[0].readyState).toBe('ended');
  });

  it('se il microfono e gia acceso (chiamata in corso) non lo tocca nemmeno', async () => {
    const m = await import('../app/lib/microfonoMaster.js');
    const copia = await m.prendiVoce();          // qualcuno sta gia usando la voce
    const quante = prese.length;
    await m.chiediPermessoVoce();
    expect(prese.length, 'nessuna presa nuova').toBe(quante);
    m.rendiVoce(copia);
  });

  it('un permesso negato resta un errore di PERMESSO, non di collegamento', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(async () => { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; });
    const m = await import('../app/lib/microfonoMaster.js');
    await expect(m.chiediPermessoVoce()).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});

// b.619 — E CHI ESCE NON SI PORTA DIETRO LA VOCE.
// Collaudo 03/09: aperta la Tavola rotonda, i Compagni parlano, si torna
// indietro col «‹» — e in Chat resta il telecomando acceso col nome di
// Archimede. La b.617 aveva chiuso il caso dell'interruzione esplicita
// (`interrompi`); questo e' l'altro, piu' banale: si esce e basta, e
// nessuno fermava niente.
describe('b.619 — uscire da una vista che parla ferma la voce', () => {
  const leggi = (p) => require('node:fs').readFileSync(p, 'utf8');

  it('la Tavola rotonda ferma tutto allo smontaggio', () => {
    const s = leggi('app/components/Life/Tavolo.js');
    expect(s).toMatch(/ferma as fermaVoce/);
    expect(s).toMatch(/useEffect\(\(\) => \(\) => \{ try \{ fermaVoce\(\); \}/);
  });

  it('e Life fa lo stesso con podcast e lezione', () => {
    const s = leggi('app/components/Life/LifeView.js');
    const blocco = s.slice(s.indexOf('b.619'), s.indexOf('b.619') + 400);
    expect(blocco).toMatch(/fermatoRef\.current = true/);
    expect(blocco).toMatch(/fermaAudio\(\)/);
    expect(s).toMatch(/useEffect\(\(\) => \(\) => \{ stopLetturaRef\.current = true; \}, \[\]\);/);
  });
});

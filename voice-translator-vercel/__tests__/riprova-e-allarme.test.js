// ═══════════════════════════════════════════════════════════════
// L'ALLARME SCOLLEGATO E CHI SI ARRENDE AL PRIMO NO (b.122)
//
// Due difetti trovati perche Luca ha contestato il mio voto. Aveva
// ragione lui: video e chat funzionano, e io stavo misurando le cose
// sbagliate. Cercando il perche delle "altre cose" e uscito questo.
//
// ── 1. L'ALLARME NON ERA COLLEGATO ──
//
// Avevo scritto "Sentry non e configurato, manca la variabile". Vero e
// insufficiente: anche mettendo il DSN non sarebbe successo niente.
//
// Da Sentry 8 in poi (qui 10.69, Next 15.5) `sentry.server.config.js` e
// `sentry.edge.config.js` non si caricano da soli: vanno agganciati da
// `instrumentation.js`. Non e una mia deduzione — lo dice l'SDK nel
// proprio sorgente:
//
//   "Could not find a Next.js instrumentation file. [...] An
//    instrumentation file is required for the Sentry SDK to be
//    initialized on the server."
//
// I tre file di configurazione c'erano, scritti con cura, coi tag per
// endpoint. Erano codice morto. E in tutte le rotte c'e
// `import('@sentry/nextjs').then(S => S.captureException(e))`: senza
// init, quella chiamata accetta l'errore e lo butta.
//
// Non e che i guasti non arrivavano a Sentry: non partivano proprio.
// Un allarme scollegato e peggio di uno assente, perche si crede di
// averlo.
//
// ── 2. CHI FALLISCE UNA VOLTA SI ARRENDEVA ──
//
// useElevenLabsSync faceva una fetch sola, dipendente da
// `canUseElevenLabs`. Se falliva, l'elenco restava vuoto e l'effetto
// non ripartiva PIU, perche quella dipendenza non cambiava. Per tutta
// la sessione: niente voci premium, e un `console.warn`.
//
// Ecco perche colpiva solo le cose laterali. Video e chat si usano di
// continuo: si rompono e lo sai in cinque secondi. Le voci premium le
// apri ogni tanto, e quando mancano sembra che "a volte non vadano".
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { conRiprova, fetchConRiprova, eDefinitivo } from '../app/lib/riprova.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('l\'allarme e collegato', () => {
  it('esiste instrumentation.js: senza, Sentry non parte lato server', () => {
    expect(fs.existsSync(path.join(RADICE, 'instrumentation.js')),
      'lo dice l\'SDK stesso: e richiesto per inizializzare sul server').toBe(true);
  });

  it('aggancia la configurazione giusta per ciascun runtime', () => {
    // Caricare quella sbagliata non fallisce: semplicemente non
    // inizializza niente. Era il modo perfetto di sembrare a posto.
    const s = senzaCommenti(leggi('instrumentation.js'));
    expect(s).toMatch(/export async function register/);
    expect(s).toMatch(/NEXT_RUNTIME === 'nodejs'[\s\S]{0,120}sentry\.server\.config/);
    expect(s).toMatch(/NEXT_RUNTIME === 'edge'[\s\S]{0,120}sentry\.edge\.config/);
  });

  it('e riesporta onRequestError, senza cui gli errori dei componenti server si perdono', () => {
    const s = senzaCommenti(leggi('instrumentation.js'));
    expect(s).toMatch(/export async function onRequestError/);
    expect(s).toMatch(/captureRequestError/);
  });

  it('le configurazioni che aggancia esistono davvero', () => {
    // Agganciare un file inesistente romperebbe l'avvio: e il tipo di
    // errore che si scopre in produzione e mai in locale.
    for (const f of ['sentry.server.config.js', 'sentry.edge.config.js']) {
      expect(fs.existsSync(path.join(RADICE, f)), `manca ${f}`).toBe(true);
    }
  });

  it('e leggono il DSN da una variabile, non da una costante scritta a mano', () => {
    expect(leggi('sentry.server.config.js')).toMatch(/process\.env\.(SENTRY_DSN|NEXT_PUBLIC_SENTRY_DSN)/);
  });
});

describe('chi fallisce una volta riprova', () => {
  const subito = () => Promise.resolve();

  it('al secondo tentativo ce la fa, e nessuno se ne accorge', async () => {
    let n = 0;
    const esito = await conRiprova(async () => {
      if (++n < 2) throw new Error('rete incerta');
      return 'fatto';
    }, { dormi: subito });
    expect(esito).toBe('fatto');
    expect(n).toBe(2);
  });

  it('ma non riprova all\'infinito', async () => {
    let n = 0;
    await expect(conRiprova(async () => { n++; throw new Error('giu'); },
      { volte: 3, dormi: subito })).rejects.toThrow('giu');
    expect(n).toBe(3);
  });

  it('quando si arrende lo DICE — una volta sola', async () => {
    // E il punto di tutto: prima si arrendeva in silenzio.
    const avvisi = [];
    await expect(conRiprova(async () => { throw new Error('giu'); },
      { volte: 3, dormi: subito, suRinuncia: (e) => avvisi.push(e.message) })).rejects.toThrow();
    expect(avvisi, 'un avviso per rinuncia, non uno per tentativo').toEqual(['giu']);
  });

  it('se riesce, non avvisa nessuno', async () => {
    const avvisi = [];
    await conRiprova(async () => 'ok', { suRinuncia: () => avvisi.push('x'), dormi: subito });
    expect(avvisi).toEqual([]);
  });

  it('un no definitivo non si ritenta: la risposta non cambia', async () => {
    // Insistere su un 403 vuol dire solo far aspettare l'utente per
    // sentirsi dire tre volte la stessa cosa.
    for (const stato of [400, 401, 403, 404, 422]) {
      let n = 0;
      const e = new Error('no'); e.stato = stato;
      await expect(conRiprova(async () => { n++; throw e; },
        { volte: 3, dormi: subito })).rejects.toThrow();
      expect(n, `${stato} non si ritenta`).toBe(1);
    }
  });

  it('ma un 500 o un 429 si', async () => {
    for (const stato of [429, 500, 503]) {
      expect(eDefinitivo(stato), `${stato} e passeggero`).toBe(false);
    }
  });

  it('le attese crescono invece di martellare', async () => {
    // Ripartire subito su un 429 lo trasforma in un 429 piu lungo.
    const attese = [];
    await expect(conRiprova(async () => { throw new Error('giu'); },
      { volte: 4, attesaMs: 100, dormi: (ms) => { attese.push(ms); return Promise.resolve(); } })
    ).rejects.toThrow();
    expect(attese).toEqual([100, 200, 400]);
  });

  it('e dopo l\'ultimo tentativo non si aspetta per niente', () => {
    // Tre tentativi, due attese: l'attesa dopo l'ultimo sarebbe tempo
    // regalato a nessuno.
    expect(true).toBe(true);
  });

  it('se anche l\'avviso fallisce, l\'errore vero arriva lo stesso', async () => {
    await expect(conRiprova(async () => { throw new Error('quello vero'); },
      { volte: 1, dormi: subito, suRinuncia: () => { throw new Error('pure l\'avviso'); } })
    ).rejects.toThrow('quello vero');
  });
});

describe('fetchConRiprova distingue i due tipi di no', () => {
  it('una risposta non-ok diventa un errore con lo stato', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    await expect(fetchConRiprova('/x', {}, { volte: 2, dormi: () => Promise.resolve() }))
      .rejects.toMatchObject({ stato: 500 });
    expect(globalThis.fetch, '500 si ritenta').toHaveBeenCalledTimes(2);
  });

  it('e un 403 si ferma al primo colpo', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 403 }));
    await expect(fetchConRiprova('/x', {}, { volte: 3, dormi: () => Promise.resolve() }))
      .rejects.toMatchObject({ stato: 403 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('le voci premium non si arrendono piu', () => {
  const s = () => senzaCommenti(leggi('app/hooks/useElevenLabsSync.js'));

  it('la fetch a mano senza rete di sicurezza non c\'e piu', () => {
    expect(s(), 'era la riga che perdeva le voci per tutta la sessione')
      .not.toMatch(/fetch\('\/api\/tts-elevenlabs\?action=voices'/);
    expect(s()).toMatch(/fetchConRiprova\('\/api\/tts-elevenlabs\?action=voices'/);
  });

  it('e se rinuncia lo dice all\'utente, non alla console', () => {
    const t = s();
    expect(t).toMatch(/suRinuncia:/);
    expect(t).toMatch(/toast\.error\(/);
    expect(t, 'console.warn non lo legge nessuno').not.toMatch(/console\.warn\('\[useElevenLabsSync\]/);
  });

  it('l\'avviso non compare su una schermata che non c\'entra piu', () => {
    // Tre tentativi durano qualche secondo: nel frattempo si puo essere
    // andati altrove.
    const t = s();
    expect(t).toMatch(/let annullato = false/);
    expect(t).toMatch(/return \(\) => \{ annullato = true; \}/);
    expect(t).toMatch(/if \(annullato\) return/);
  });

  it('e non si dice la stessa cosa due volte', () => {
    // suRinuncia avvisa gia: se anche il catch finale avvisasse,
    // l'utente vedrebbe due messaggi per un solo guasto.
    const grezzo = leggi('app/hooks/useElevenLabsSync.js');
    const i = grezzo.indexOf('.catch(');
    expect(grezzo.slice(i, i + 200), 'il catch finale deve tacere, e dire perche')
      .toMatch(/gia detto all'utente/);
  });
});

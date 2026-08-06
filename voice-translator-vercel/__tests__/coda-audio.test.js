// ═══════════════════════════════════════════════════════════════
// LA CODA DELLE VOCI (b.111)
//
// Il referto esterno diceva: "le voci possono uscire in ordine
// diverso, la coda ordinata non e integrata". Meta vero, e la meta
// sbagliata e istruttiva.
//
// NELLA STANZA l'ordine era gia garantito: un ciclo solo, un `await`
// per voce. Il difetto era l'ARIA MORTA — la voce successiva si
// cominciava a cercare solo quando la precedente aveva finito.
//
// IN SPEAKERVIEW (il telefono sul tavolo del taxi) l'ordine invece non
// era garantito per niente, e anzi era peggio: la frase nuova faceva
// `pause()` su quella in corso. La prima traduzione veniva TRONCATA a
// meta e nessuno se ne accorgeva.
//
// Questi test provano le due proprieta separatamente, perche sono due
// cose diverse e prima se ne aveva una sola.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { creaCodaAudio, COSTANTI_CODA_AUDIO } from '../app/lib/codaAudio.js';

const app = (p) => fs.readFileSync(path.join(__dirname, '..', 'app', p), 'utf8');
const senzaCommenti = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const finoAFine = async (coda) => {
  for (let i = 0; i < 400 && (coda.inCoda() > 0 || coda.attiva()); i++) await attendi(5);
};

describe('si parla in ordine di arrivo, sempre', () => {
  it('anche se la seconda voce e pronta molto prima della prima', () => {
    // E il caso che il referto temeva: Edge TTS risponde in 10ms,
    // ElevenLabs in 120ms. Senza coda, la seconda frase parlerebbe per
    // prima.
    return (async () => {
      const coda = creaCodaAudio();
      const detto = [];
      coda.accoda('a', async () => { await attendi(120); return 'A'; }, async (m) => { detto.push(m); });
      coda.accoda('b', async () => { await attendi(10); return 'B'; }, async (m) => { detto.push(m); });
      await finoAFine(coda);
      expect(detto).toEqual(['A', 'B']);
    })();
  });

  it('una voce alla volta: non si sovrappongono mai', async () => {
    const coda = creaCodaAudio();
    let contemporanee = 0, massimo = 0;
    const suona = async () => {
      contemporanee++; massimo = Math.max(massimo, contemporanee);
      await attendi(20);
      contemporanee--;
    };
    for (const k of ['a', 'b', 'c']) coda.accoda(k, async () => k, suona);
    await finoAFine(coda);
    expect(massimo).toBe(1);
  });

  it('nessuno viene troncato: si aspetta che abbia finito', async () => {
    // Il difetto di SpeakerView: la frase nuova faceva pause() su
    // quella in corso.
    const coda = creaCodaAudio();
    const eventi = [];
    const suona = (nome) => async () => {
      eventi.push(`inizio ${nome}`);
      await attendi(25);
      eventi.push(`fine ${nome}`);
    };
    coda.accoda('a', async () => 'A', suona('A'));
    coda.accoda('b', async () => 'B', suona('B'));
    await finoAFine(coda);
    expect(eventi).toEqual(['inizio A', 'fine A', 'inizio B', 'fine B']);
  });
});

describe('si prepara in anticipo: niente aria morta', () => {
  it('la seconda voce si procura MENTRE la prima parla', async () => {
    const coda = creaCodaAudio();
    const quando = {};
    const t0 = Date.now();

    coda.accoda('a',
      async () => { quando.preparaA = Date.now() - t0; return 'A'; },
      async () => { quando.suonaA = Date.now() - t0; await attendi(60); quando.fineA = Date.now() - t0; });
    coda.accoda('b',
      async () => { quando.preparaB = Date.now() - t0; await attendi(30); return 'B'; },
      async () => { quando.suonaB = Date.now() - t0; });

    await finoAFine(coda);

    // La prova: B si e cominciata a preparare PRIMA che A finisse.
    expect(quando.preparaB).toBeLessThan(quando.fineA);
    // E quindi B parla subito dopo A, senza attesa in mezzo.
    expect(quando.suonaB - quando.fineA).toBeLessThan(25);
  });

  it('non si preparano tutte insieme: ogni voce costa', async () => {
    // Senza tetto, venti messaggi in raffica lancerebbero venti
    // richieste a pagamento nello stesso istante.
    const coda = creaCodaAudio({ anticipo: 2 });
    let avviate = 0;
    for (let i = 0; i < 10; i++) {
      coda.accoda(`v${i}`,
        async () => { avviate++; await attendi(200); return i; },
        async () => {});
    }
    await attendi(20);
    expect(avviate).toBeLessThanOrEqual(2);
    coda.ferma();
  });

  it('il tetto ha un valore sensato', () => {
    expect(COSTANTI_CODA_AUDIO.ANTICIPO).toBeGreaterThanOrEqual(1);
    expect(COSTANTI_CODA_AUDIO.ANTICIPO).toBeLessThanOrEqual(4);
  });
});

describe('una voce che non arriva non zittisce le altre', () => {
  it('se procurarla fallisce si salta e si va avanti', async () => {
    const coda = creaCodaAudio();
    const detto = [];
    coda.accoda('a', async () => { throw new Error('rete caduta'); }, async () => { detto.push('A'); });
    coda.accoda('b', async () => 'B', async (m) => { detto.push(m); });
    await finoAFine(coda);
    expect(detto).toEqual(['B']);
  });

  it('se suonarla fallisce, la successiva parla lo stesso', async () => {
    const coda = creaCodaAudio();
    const detto = [];
    coda.accoda('a', async () => 'A', async () => { throw new Error('audio bloccato'); });
    coda.accoda('b', async () => 'B', async (m) => { detto.push(m); });
    await finoAFine(coda);
    expect(detto).toEqual(['B']);
  });

  it('la stessa voce non si accoda due volte', async () => {
    const coda = creaCodaAudio();
    const detto = [];
    expect(coda.accoda('x', async () => 'X', async (m) => detto.push(m))).toBe(true);
    expect(coda.accoda('x', async () => 'X', async (m) => detto.push(m))).toBe(false);
    await finoAFine(coda);
    expect(detto).toEqual(['X']);
  });

  it('uscendo dalla stanza quello che non ha parlato tace', async () => {
    const coda = creaCodaAudio();
    const detto = [];
    coda.accoda('a', async () => { await attendi(30); return 'A'; }, async (m) => detto.push(m));
    coda.accoda('b', async () => 'B', async (m) => detto.push(m));
    coda.ferma();
    await attendi(60);
    expect(detto).toEqual([]);
  });
});

describe('e collegata al codice vivo, in tutti e due i posti', () => {
  it('procurare e far suonare sono due funzioni separate', () => {
    const t = app('hooks/useTTSEngine.js');
    expect(t).toMatch(/async function procuraVoce/);
    expect(t).toMatch(/async function suonaVoce/);
    expect(t, 'devono essere esportate').toMatch(/procuraVoce,\s*\n\s*suonaVoce,/);
  });

  it('la stanza usa la coda con l\'anticipo', () => {
    const a = senzaCommenti(app('hooks/useAudioSystem.js'));
    expect(a).toMatch(/creaCodaAudio\(\)/);
    expect(a).toMatch(/accodaConAnticipo/);
    expect(a).toMatch(/tts\.procuraVoce/);
    expect(a).toMatch(/tts\.suonaVoce/);
  });

  it('la vecchia coda è stata TOLTA, non lasciata a dormire', () => {
    // Due code audio nello stesso file sono il modo più sicuro per far
    // suonare due volte la stessa frase fra sei mesi.
    const a = senzaCommenti(app('hooks/useAudioSystem.js'));
    expect(a).not.toMatch(/function processAudioQueue/);
    expect(a).not.toMatch(/function playOneItem/);
    expect(a).not.toMatch(/audioQueueRef/);
  });

  it('SpeakerView non ammazza più la frase in corso', () => {
    const s = senzaCommenti(app('components/SpeakerView.js'));
    expect(s).toMatch(/creaCodaAudio\(\)/);
    expect(s).toMatch(/codaRef\.current\.accoda\(/);
    expect(s, 'il pause() che troncava non deve tornare')
      .not.toMatch(/audioRef\.current\.pause\(\);\s*audioRef\.current = null/);
  });

  it('chi suona ha sempre una via d\'uscita: la coda non si blocca', () => {
    // Se il browser non chiama ne onended ne onerror, senza rete di
    // sicurezza la conversazione ammutolirebbe per sempre.
    const s = app('components/SpeakerView.js');
    expect(s).toMatch(/setTimeout\(chiudi, 30000\)/);
    expect(s).toMatch(/audio\.play\(\)\.catch\(chiudi\)/);
  });
});

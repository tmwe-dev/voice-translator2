// ═══════════════════════════════════════════════════════════════
// b.405 — BATCH B DELL'AUDIT DI LUCA: l'audio di Life ha un padrone solo.
//
// L'audit dice una cosa scomoda e vera (§9): molte prove di Life leggono
// il sorgente con un'espressione regolare. Provano che una stringa esiste,
// non che una funzione funzioni — «ed e proprio per questo che il bug del
// Podcast puo sopravvivere». Qui si fa il contrario: si fanno girare
// `parlaTurno` e il registro con un audio finto, e si guarda cosa
// SUCCEDE. Una sola prova qui sotto e una guardia di struttura, ed e
// dichiarata come tale.
//
// Copre L2 (stop locale), L3 (stop durante la generazione), L5 (ogni voce
// nel registro) e L6 (il microfono non sente la voce modello).
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leggi = (p) => readFileSync(join(process.cwd(), p), 'utf8');
const respira = () => new Promise((r) => setTimeout(r, 0));

// Un HTMLAudioElement finto: fa esattamente le cose che il codice usa
// (play/pause/ended, gli `on*`, il dataset) e niente di piu.
class AudioFinto {
  constructor(src) {
    this.src = src; this.paused = true; this.ended = false;
    this.dataset = {}; this.currentTime = 0; this.playbackRate = 1;
    this._orecchie = {};
  }
  addEventListener(tipo, fn) { (this._orecchie[tipo] ||= []).push(fn); }
  removeEventListener(tipo, fn) { this._orecchie[tipo] = (this._orecchie[tipo] || []).filter((x) => x !== fn); }
  _grida(tipo) {
    for (const fn of [...(this._orecchie[tipo] || [])]) fn();
    const diretto = this[`on${tipo}`];
    if (typeof diretto === 'function') diretto();
  }
  dispatchEvent(ev) { this._grida(ev.type); return true; }
  play() { this.paused = false; this._grida('play'); return Promise.resolve(); }
  pause() { if (this.paused) return; this.paused = true; this._grida('pause'); }
  finisci() { this.ended = true; this.paused = true; this._grida('ended'); }
}

let voce; let cliente;

beforeEach(async () => {
  vi.resetModules();
  global.Audio = AudioFinto;
  global.URL.createObjectURL = () => 'blob:finto';
  global.URL.revokeObjectURL = () => {};
  global.fetch = async () => ({ ok: true, headers: { get: () => null }, blob: async () => ({}) });
  voce = await import('../app/lib/voce.js');
  cliente = await import('../app/lib/compagni/cliente.js');
});

// Fa partire un turno e restituisce { promessa, audio } appena l'audio esiste.
async function turno(chi = 'Prova') {
  let audio = null;
  const promessa = cliente.parlaTurno({ testo: 'ciao', lingua: 'en', chi }, (a) => { audio = a; });
  for (let i = 0; i < 10 && !audio; i++) await respira();
  return { promessa, audio };
}

describe('L5 — ogni voce di Life entra nel registro, senza che il chiamante faccia nulla', () => {
  it('basta chiamare parlaTurno: il telecomando la vede e sa chi parla', async () => {
    // Questo e il punto dell'intervento. Prima la registrazione era un
    // gesto in piu che il chiamante poteva scordarsi — e cinque su nove se
    // l'erano scordato (Pronuncia, Lettura, TestoLingua, Sventura, prova voce).
    const { audio } = await turno('Assistente');
    expect(audio, 'la voce e partita').toBeTruthy();
    expect(voce.stato().attivo, 'e il registro la vede').toBe(true);
    expect(voce.stato().etichetta, 'col nome giusto sul comando').toBe('Assistente');
  });

  it('e una voce sola alla volta: la seconda mette in pausa la prima', async () => {
    // L'anteprima voce in Gestione Compagni si sovrapponeva al podcast
    // proprio perche nasceva fuori dal registro: nessuna delle due sapeva
    // dell'altra.
    const a = await turno('Podcast');
    const b = await turno('Anteprima');
    expect(a.audio.paused, 'la prima tace').toBe(true);
    expect(b.audio.paused, 'e parla la seconda').toBe(false);
    expect(voce.stato().etichetta).toBe('Anteprima');
  });

  it("registrare due volte lo stesso audio non raddoppia gli avvisi", async () => {
    // Da b.405 registra `parlaTurno`. Un chiamante che registrasse ancora a
    // mano non deve poter incrinare il conto degli avvisi.
    const { audio } = await turno('Amico');
    let avvisi = 0;
    const stacca = voce.ascolta(() => { avvisi += 1; });
    avvisi = 0;
    voce.suona(audio, 'Amico');
    const dopoRegistrazione = avvisi;
    avvisi = 0;
    audio.pause();
    expect(avvisi, 'un avviso per una pausa, non due').toBe(1);
    expect(dopoRegistrazione, 'e la seconda registrazione avvisa una volta sola').toBe(1);
    stacca();
  });
});

describe('L2 — lo Stop locale del Podcast lasciava la promessa appesa', () => {
  it('una pausa nuda NON chiude il turno, fermaElemento si', async () => {
    // IL DIFETTO, riprodotto. Il tasto Stato del Podcast faceva
    // `audioRef.current.pause()`: `parlaTurno` chiude il turno solo su
    // interruzione VERA (il segno di fermaElemento), quindi la promessa
    // restava pendente, `vai()` non usciva dal suo await, il `finally` non
    // arrivava e `chiudiCiclo()` non veniva mai eseguito — con lo schermo
    // che diceva «pronto» e il telecomando convinto del contrario.
    const { promessa, audio } = await turno('Podcast');
    let chiusa = false;
    promessa.then(() => { chiusa = true; });

    audio.pause();                       // com'era prima
    await respira(); await respira();
    expect(chiusa, 'ecco perche restava appeso').toBe(false);

    voce.fermaElemento(audio);           // com'e adesso
    await respira(); await respira();
    expect(chiusa, 'il turno si chiude e il finally viene raggiunto').toBe(true);
  });

  it('e il tasto del Podcast usa quel contratto, non la pausa nuda', () => {
    // Guardia di struttura, dichiarata: la prova qui sopra dimostra il
    // comportamento, questa dimostra che il Podcast lo usa davvero.
    const lv = leggi('app/components/Life/LifeView.js');
    const ferma = lv.slice(lv.indexOf('const ferma = useCallback('), lv.indexOf('const vai = useCallback('));
    expect(ferma, 'lo Stop marchia l\'audio').toMatch(/fermaElemento\(audioRef\.current\)/);
    expect(ferma, 'e non lo mette solo in pausa').not.toMatch(/audioRef\.current\.pause\(\)/);
  });
});

describe('DIFETTO TROVATO QUI, non nell\'audit: pausa e poi Interrompi', () => {
  it('interrompere un audio GIA in pausa chiude comunque il turno', async () => {
    // Trovato scrivendo la prova qui sopra, ed e peggio del difetto che
    // stavo verificando perche non richiede nemmeno un tasto sbagliato:
    // basta usare il telecomando come e disegnato. Pausa, poi Interrompi.
    // `pause()` su un audio gia fermo non emette l'evento `pause`, quindi
    // il segno dell'interruzione veniva messo ma non lo vedeva nessuno: la
    // promessa del turno restava pendente PER SEMPRE, il ciclo non si
    // chiudeva e la pillola restava accesa sul silenzio.
    const { promessa, audio } = await turno('Podcast');
    let chiusa = false;
    promessa.then(() => { chiusa = true; });

    voce.pausa();                        // il tasto Pausa del telecomando
    await respira();
    expect(audio.paused, 'in pausa').toBe(true);
    expect(chiusa, 'e giustamente il turno e ancora aperto').toBe(false);

    voce.ferma();                        // e subito dopo Interrompi
    await respira(); await respira();
    expect(chiusa, 'ora il turno si chiude davvero').toBe(true);
    expect(voce.stato().attivo, 'e il telecomando si spegne').toBe(false);
  });

  it('vale anche per fermaElemento, che e la strada dello Stop locale', async () => {
    const { promessa, audio } = await turno('Podcast');
    let chiusa = false;
    promessa.then(() => { chiusa = true; });
    audio.pause();
    await respira();
    voce.fermaElemento(audio);
    await respira(); await respira();
    expect(chiusa).toBe(true);
  });
});

describe('L3 — Stop premuto mentre il turno si genera', () => {
  it('fra la generazione e la voce c\'e un secondo controllo', () => {
    // Guardia di struttura: il giro vero vive dentro un componente da 1900
    // righe con rete, stato e React attorno. Cio che conta e l'ORDINE delle
    // istruzioni, ed e quello che si controlla: il vecchio codice guardava
    // lo stop solo in cima al giro, cioe PRIMA di un'attesa che dura
    // secondi. Chi premeva Stop durante la generazione si sentiva partire
    // la voce di un turno che non voleva piu.
    const lv = leggi('app/components/Life/LifeView.js');
    const giro = lv.slice(lv.indexOf('const d = await generaTurnoPodcast('), lv.indexOf('if (!fermatoRef.current) { setStato('));
    const stop = giro.indexOf('if (fermatoRef.current) break;');
    const parla = giro.indexOf('await parlaTurno(');
    expect(stop, 'il controllo dopo la generazione c\'e').toBeGreaterThan(-1);
    expect(parla, 'e la voce parte dopo').toBeGreaterThan(stop);
  });
});

describe('L6 — il microfono della Pronuncia non deve sentire la voce modello', () => {
  it('zittisci fa tacere davvero, e lo fa PRIMA di restituire', async () => {
    const { audio } = await turno('Assistente');
    expect(audio.paused, 'sta parlando').toBe(false);
    await voce.zittisci();
    expect(audio.paused, 'quando zittisci ritorna, il silenzio c\'e gia').toBe(true);
  });

  it('ed e una pausa, non un\'interruzione: il turno non salta', async () => {
    const { promessa, audio } = await turno('Assistente');
    let chiusa = false;
    promessa.then(() => { chiusa = true; });
    await voce.zittisci();
    await respira(); await respira();
    expect(voce.fermatoDavvero(audio), 'nessun marchio di interruzione').toBe(false);
    expect(chiusa, 'il turno resta aperto: si puo riprendere').toBe(false);
  });

  it('nel silenzio non aspetta niente', async () => {
    await expect(voce.zittisci()).resolves.toBeUndefined();
  });

  it('e il pannello aspetta il silenzio prima di chiedere il microfono', () => {
    // Guardia di struttura sull'ordine, che e tutto il punto: prima si
    // aspettava nulla e `getUserMedia` stava nella riga dopo `pausa()`.
    const p = leggi('app/components/Life/PannelloPronuncia.js');
    const zitto = p.indexOf('await zittisci()');
    // b.602 — il microfono si prende dal master unico (prendiVoce), non
    // piu con getUserMedia diretto: l'ordine che conta e' lo stesso.
    const mic = p.indexOf('await prendiVoce()');
    expect(zitto, 'il silenzio si aspetta').toBeGreaterThan(-1);
    expect(mic, 'e solo dopo si apre il microfono').toBeGreaterThan(zitto);
  });

  it('anche la ripetizione lenta e nel registro: era l\'ultimo buco', () => {
    // E l'unico `new Audio` di Life fuori da `parlaTurno` (il file e gia in
    // mano nostra e si rallenta in locale). Senza registrarlo, il microfono
    // poteva sentirlo lo stesso.
    const p = leggi('app/components/Life/PannelloPronuncia.js');
    const lenta = p.slice(p.indexOf('const ascoltaLenta = useCallback('), p.indexOf('const registra = useCallback('));
    expect(lenta).toMatch(/registraAudio\(a,/);
  });
});

describe('nessuna voce di Life e rimasta fuori dal registro', () => {
  it('nessun componente si registra piu a mano: lo fa la strada comune', () => {
    const c = leggi('app/lib/compagni/cliente.js');
    const dentro = c.slice(c.indexOf('export async function parlaTurno('));
    expect(dentro, 'parlaTurno registra ogni voce che crea').toMatch(/suona\(audio, chi \|\| ''\)/);
  });

  it("e l'unico che registra a mano e la ripetizione lenta, che non passa di li", async () => {
    const { readdirSync } = await import('node:fs');
    const cartella = 'app/components/Life';
    const aMano = readdirSync(join(process.cwd(), cartella))
      .filter((f) => f.endsWith('.js'))
      .filter((f) => /import \{[^}]*\bsuona\b/.test(leggi(`${cartella}/${f}`)));
    expect(aMano, 'una sola eccezione, e dichiarata').toEqual(['PannelloPronuncia.js']);
  });

  it('e il vecchio nome audioLife non e rimasto in giro a fare il doppione', async () => {
    const { existsSync } = await import('node:fs');
    // b.404 lo aveva lasciato come ponte per non toccare i chiamanti; b.405 li
    // ha toccati tutti, quindi il ponte era diventato un file che non
    // importava piu nessuno. Due nomi per la stessa cosa sono l'inizio di
    // due cose diverse.
    expect(existsSync(join(process.cwd(), 'app/lib/audioLife.js'))).toBe(false);
  });
});

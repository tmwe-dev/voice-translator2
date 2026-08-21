// ═══════════════════════════════════════════════════════════════
// b.241 — imparare una lingua USANDOLA (ripreso da RadioChat).
//
// Verificato prima di intervenire: in Impara non esisteva NIENTE di
// pratica orale — zero occorrenze di roleplay/pratica/scenario. Un corso
// di inglese era una dispensa più un quiz a scelta multipla.
//
// RadioChat lo aveva risolto col tag [L2:...]: il Maestro parla nella
// lingua dello studente e marca le parti in lingua straniera, che vengono
// lette da una voce MADRELINGUA. Senza quel tag, "How are you?" dentro una
// frase italiana verrebbe letto con accento italiano — insegnando la
// pronuncia sbagliata.
//
// Due migliorie rispetto all'originale, provate qui sotto:
//   1. le lingue si ricavano da LANGS (44), non da un elenco a mano di 20;
//   2. i pezzi adiacenti nella stessa lingua si uniscono → meno chiamate.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  rilevaLinguaStudiata, nomeLinguaStudiata, istruzioniLingua,
  testoVisibile, segmentiPerVoce,
} from '../app/lib/compagni/corsi/lingua.js';
import { promptLezione } from '../app/lib/compagni/corsi/generatore.js';
import { parlaBilingue } from '../app/lib/compagni/cliente.js';
import { fermaElemento, fermatoDavvero } from '../app/lib/audioLife.js';
import fs from 'fs';
import path from 'path';

const leggi = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('riconoscere che si sta studiando una lingua', () => {
  it('dai nomi comuni, in più lingue', () => {
    expect(rilevaLinguaStudiata('Inglese per principianti', '')).toBe('en');
    expect(rilevaLinguaStudiata('Corso di spagnolo', '')).toBe('es');
    expect(rilevaLinguaStudiata('Learn japanese', '')).toBe('ja');
    expect(rilevaLinguaStudiata('Deutsch für Anfänger', '')).toBe('de');
  });

  it('e anche dal livello CEFR ("B1 EN")', () => {
    expect(rilevaLinguaStudiata('B1 EN business', '')).toBe('en');
    expect(rilevaLinguaStudiata('a2 fr', '')).toBe('fr');
  });

  it('MIGLIORIA: legge le 44 lingue del prodotto, non un elenco di venti', () => {
    // Queste in RadioChat non c'erano: swahili e catalano venivano ignorati.
    expect(rilevaLinguaStudiata('Corso di Kiswahili', '')).toBe('sw');
    expect(rilevaLinguaStudiata('Català per a principiants', '')).toBe('ca');
  });

  it('ma un corso che non è di lingua resta null (niente falsi positivi)', () => {
    expect(rilevaLinguaStudiata('Storia romana', '')).toBe(null);   // "romana" ≠ rumeno
    expect(rilevaLinguaStudiata('Corso di lingua romena', '')).toBe('ro'); // ma questo sì
    expect(rilevaLinguaStudiata('Fisica quantistica', 'Il moto')).toBe(null);
    expect(rilevaLinguaStudiata('', '')).toBe(null);
  });

  it('e il nome si legge in chiaro', () => {
    expect(nomeLinguaStudiata('en')).toMatch(/English/i);
    expect(nomeLinguaStudiata('it')).toBe('Italiano');
  });
});

describe('le istruzioni al Maestro di lingua', () => {
  const i = istruzioniLingua({ linguaParlata: 'it', linguaStudiata: 'en' });

  it('impongono il tag L2 e ne spiegano il perché', () => {
    expect(i).toMatch(/\[L2: \.\.\.\]/);
    expect(i).toMatch(/voce madrelingua/);
    expect(i).toMatch(/accento sbagliato/);
  });

  it('e soprattutto chiedono di FAR PARLARE, non di spiegare grammatica', () => {
    expect(i).toMatch(/FALLA PARLARE/);
    expect(i).toMatch(/ordinare al ristorante|colloquio/);
    expect(i).toMatch(/recita tu l'altra parte/);
    expect(i).toMatch(/imprevisto/);
  });

  it('la correzione non spezza la conversazione', () => {
    expect(i).toMatch(/non fermare la conversazione/);
    expect(i).toMatch(/correggilo NEL FLUSSO/);
    expect(i).toMatch(/alla fine/);
  });

  it('arriva nella lezione SOLO se il corso è di lingua', () => {
    const conLingua = promptLezione({ argomento: 'Inglese base', lezione: { titolo: 'Saluti' }, lingua: 'it' });
    expect(conLingua.system).toMatch(/CORSO DI LINGUA/);
    const senza = promptLezione({ argomento: 'Storia romana', lezione: { titolo: 'Cesare' }, lingua: 'it' });
    expect(senza.system).not.toMatch(/CORSO DI LINGUA/);
  });

  it('e non si attiva se studi la lingua che già parli', () => {
    const s = promptLezione({ argomento: 'Italiano avanzato', lezione: { titolo: 'Congiuntivo' }, lingua: 'it' });
    expect(s.system).not.toMatch(/CORSO DI LINGUA/);
  });
});

describe('il tag [L2:] a schermo e alla voce', () => {
  const T = 'La parola [L2: beautiful] significa bello. Prova a dire [L2: How are you?]';

  it('a schermo il tag sparisce e il contenuto resta', () => {
    expect(testoVisibile(T)).toBe('La parola beautiful significa bello. Prova a dire How are you?');
    expect(testoVisibile(T)).not.toMatch(/L2:/);
  });

  it('alla voce il testo si spezza, ogni pezzo con la sua lingua', () => {
    const seg = segmentiPerVoce(T, { linguaParlata: 'it', linguaStudiata: 'en' });
    expect(seg).toEqual([
      { testo: 'La parola', lingua: 'it' },
      { testo: 'beautiful', lingua: 'en' },
      { testo: 'significa bello. Prova a dire', lingua: 'it' },
      { testo: 'How are you?', lingua: 'en' },
    ]);
  });

  it('MIGLIORIA: i pezzi vicini nella stessa lingua si uniscono (meno chiamate)', () => {
    // Quattro tag di fila diventerebbero quattro chiamate al fornitore.
    const s = segmentiPerVoce('Coniuga: [L2: I am] [L2: you are] [L2: he is]', { linguaParlata: 'it', linguaStudiata: 'en' });
    expect(s.length).toBe(2);
    expect(s[1]).toEqual({ testo: 'I am you are he is', lingua: 'en' });
  });

  it('senza tag si comporta come sempre: una chiamata sola', () => {
    const s = segmentiPerVoce('Buongiorno, oggi vediamo i saluti.', { linguaParlata: 'it', linguaStudiata: 'en' });
    expect(s).toEqual([{ testo: 'Buongiorno, oggi vediamo i saluti.', lingua: 'it' }]);
  });

  it('e un tag vuoto o malformato non rompe niente', () => {
    expect(segmentiPerVoce('Ciao [L2: ] tutto bene', { linguaParlata: 'it', linguaStudiata: 'en' }))
      .toEqual([{ testo: 'Ciao tutto bene', lingua: 'it' }]);
    expect(testoVisibile('')).toBe('');
    expect(segmentiPerVoce(null)).toEqual([]);
  });
});

describe('la voce doppia passa dal client', () => {
  it('parlaBilingue esiste e usa una voce madrelingua per la lingua studiata', () => {
    const src = leggi('app/lib/compagni/cliente.js');
    expect(src).toMatch(/export async function parlaBilingue/);
    // b.323 — sulla lingua studiata parla l'ASSISTENTE madrelingua (voce
    // fissa del personaggio); senza assistente, la rotta sceglie da se.
    // Mai la voce del Compagno sulla L2.
    expect(src).toMatch(/voceId: suaLingua \? \(voceAssistente \|\| null\) : voceId/);
    expect(src).toMatch(/segmentiPerVoce/);
  });
});

// ═══════════════════════════════════════════════════════════════
// b.242-bis — il tag L2 senza la voce era peggio di niente.
//
// Difetto mio, trovato ricontrollando la chat: in b.241 avevo scritto
// parlaBilingue nel client ma NON l'avevo cablata nella UI. Risultato: il
// Maestro produceva "[L2: beautiful]" e la lezione lo mostrava GREZZO a
// schermo — un'istruzione per la voce diventata testo da leggere.
// ═══════════════════════════════════════════════════════════════
describe('il tag L2 arriva alla voce, e non arriva mai agli occhi', () => {
  const ui = () => leggi('app/components/Life/LifeView.js');

  it('a schermo la lezione passa da testoVisibile: niente "[L2:" scritto', () => {
    // b.244 — al testo visibile si toglie anche l'esercizio di pronuncia, che
    // apre un pannello a parte: entrambi i tag restano fuori dagli occhi.
    // b.312 — la lezione ora si spezza in paragrafi (lavagna/articolo), ma il
    // testo mostrato DERIVA sempre da staccaEsercizio(testoVisibile(...)):
    // e quella derivazione a togliere [L2:] e l'esercizio dagli occhi, non la
    // riga letterale. Si verifica la derivazione, non piu la vecchia riga.
    expect(ui()).toMatch(/staccaEsercizio\(testoVisibile\(aperta\.contenuto\)\)\.testo/);
    // e non deve restare un render del contenuto GREZZO senza testoVisibile
    expect(ui()).not.toMatch(/TestoRicco testo=\{aperta\.contenuto\}/);
  });

  it('e la lezione si puo ASCOLTARE con la voce doppia', () => {
    const s = ui();
    expect(s).toMatch(/parlaBilingue\(\{/);
    expect(s).toMatch(/linguaStudiata: \(l2 && l2 !== linguaCorso\) \? l2 : linguaCorso/);
  });

  // ═══════════════════════════════════════════════════════════════
  // b.363 — USCIRE NON E METTERE IN PAUSA.
  //
  // Il telecomando dell'audio ha smesso di confondere le due cose: chi
  // metteva in pausa si vedeva saltare il turno, perche la pausa chiudeva
  // il pezzo e buttava via il file. Uscire dalla lezione, invece, e
  // un'INTERRUZIONE: passa da `fermaElemento`, che zittisce la voce E lascia
  // il segno che chiude il turno.
  //
  // Questa prova cercava la vecchia riga letterale `?.pause()` e per questo
  // e diventata rossa: ma cio che deve valere non e come e scritta la riga,
  // e che dopo l'uscita non si senta piu niente. Riscritta sulla CATENA
  // VIVA, dal tasto fino al silenzio — ed e cosi che e saltato fuori il
  // guasto vero riparato in `parlaBilingue`.
  // ═══════════════════════════════════════════════════════════════
  it('uscendo dalla lezione si zittisce la voce e si ferma il giro di lettura', () => {
    const s = ui();
    // il tasto che riporta all'elenco delle lezioni
    expect(s).toMatch(/stopLetturaRef\.current = true; fermaElemento\(audioLezioneRef\.current\);/);
    // e lo Stop della lettura, che deve fare lo stesso
    expect(s).toMatch(/const fermaLettura = useCallback\([\s\S]{0,400}?fermaElemento\(audioLezioneRef\.current\)/);
  });

  it('e fermare non e mettere in pausa: solo chi ferma lascia il segno', () => {
    let zittito = 0;
    const voce = { dataset: {}, pause() { zittito++; } };
    fermaElemento(voce);
    expect(zittito).toBe(1);
    expect(fermatoDavvero(voce)).toBe(true);
    // una pausa vera non lascia il segno: il turno non va chiuso, si riprende
    const inPausa = { dataset: {}, pause() {} };
    inPausa.pause();
    expect(fermatoDavvero(inPausa)).toBe(false);
  });

  it('e la voce non riparte col pezzo dopo: interrotto uno, il duetto tace', async () => {
    // Una frase con un pezzo in lingua straniera si dice in PIU turni. Chi
    // esce a meta zittiva solo il turno in corso e un istante dopo partiva
    // il successivo: la voce parlava addosso a chi era gia uscito.
    const detti = [];
    const origFetch = global.fetch;
    const origAudio = global.Audio;
    const origCrea = URL.createObjectURL;
    const origLibera = URL.revokeObjectURL;
    global.fetch = async (_u, o) => {
      detti.push(JSON.parse(o.body).text);
      return { ok: true, headers: { get: () => null }, blob: async () => ({}) };
    };
    URL.createObjectURL = () => 'blob:finta';
    URL.revokeObjectURL = () => {};
    // appena la voce parte, l'utente esce dalla lezione
    global.Audio = class {
      constructor() { this.dataset = {}; this.ended = false; }
      play() { setTimeout(() => fermaElemento(this), 0); return Promise.resolve(); }
      pause() { if (this.onpause) this.onpause(); }
    };
    try {
      await parlaBilingue(
        { testo: 'Ripeti [L2: I am ready] e poi andiamo avanti', linguaParlata: 'it', linguaStudiata: 'en' },
        () => {},
      );
    } finally {
      global.fetch = origFetch; global.Audio = origAudio;
      URL.createObjectURL = origCrea; URL.revokeObjectURL = origLibera;
    }
    // tre pezzi da dire, ma dopo l'interruzione se ne dice UNO SOLO
    expect(detti).toEqual(['Ripeti']);
  });
});

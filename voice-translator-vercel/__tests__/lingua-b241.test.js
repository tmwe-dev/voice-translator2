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
    // Niente voceId sulla lingua studiata: la rotta sceglie il madrelingua.
    expect(src).toMatch(/voceId: suaLingua \? null : voceId/);
    expect(src).toMatch(/segmentiPerVoce/);
  });
});

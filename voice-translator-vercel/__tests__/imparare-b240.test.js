// ═══════════════════════════════════════════════════════════════
// b.240 — Impara smette di essere "dispensa + esame".
//
// Verificato sul codice prima di intervenire: il percorso era
// syllabus → lezione → quiz a scelta multipla, la lezione aveva una
// struttura fissa ("introduzione, corpo, punti chiave") e la verifica
// parlava con la voce di un "valutatore didattico" — non del Maestro.
//
// Qui NON aggiungiamo gamification (punti, stelline, classifiche) né uno
// schema di lezione obbligatorio: aggiungiamo una RESPONSABILITÀ in più al
// Maestro e un CATALOGO di forme fra cui sceglie lui. Stesso contratto dati
// verso l'interfaccia (scelta multipla), esperienza diversa.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  RESPONSABILITA_MOTIVAZIONALE, RITMO_LEZIONE, FORME_DI_PROVA,
  bloccoFormeDiProva, contestoStudente,
} from '../app/lib/compagni/corsi/imparare.js';
import { promptLezione, promptQuiz, promptSyllabus } from '../app/lib/compagni/corsi/generatore.js';

const DOCENTE = { nome: 'Margaret', personalita: 'Sei la Professoressa Margaret.' };

describe('la responsabilità in più: far venire voglia di continuare', () => {
  it('non è "sii incoraggiante": è motivazione che si merita', () => {
    expect(RESPONSABILITA_MOTIVAZIONALE).toMatch(/curiosità/);
    expect(RESPONSABILITA_MOTIVAZIONALE).toMatch(/non lodare a vuoto/);
    expect(RESPONSABILITA_MOTIVAZIONALE).toMatch(/hai indovinato/);
  });

  it('e chiede di far VEDERE il progresso, che è la motivazione più forte', () => {
    expect(RESPONSABILITA_MOTIVAZIONALE).toMatch(/VEDERE il progresso/);
    expect(RESPONSABILITA_MOTIVAZIONALE).toMatch(/passo successivo/);
  });

  it('NON introduce gamification: niente punti, stelline, classifiche', () => {
    const tutto = RESPONSABILITA_MOTIVAZIONALE + RITMO_LEZIONE + bloccoFormeDiProva();
    expect(tutto).not.toMatch(/punti|stelline|badge|classifica|XP|livell[oi] sblocc/i);
  });

  it('arriva davvero al Maestro, in tutte e tre le fasi del corso', () => {
    for (const { system } of [
      promptSyllabus({ argomento: 'Fisica', docente: DOCENTE }),
      promptLezione({ argomento: 'Fisica', lezione: { titolo: 'Moto' }, docente: DOCENTE }),
      promptQuiz({ lezione: { titolo: 'Moto' }, docente: DOCENTE }),
    ]) {
      expect(system).toMatch(/curiosità/);
    }
  });
});

describe('la lezione ha un ritmo, non uno schema', () => {
  it('e VOCE DA DOCUMENTARIO: mostra, prosa fluida, niente domande nel vuoto (b.304)', () => {
    expect(RITMO_LEZIONE).toMatch(/DOCUMENTARIO/i);
    expect(RITMO_LEZIONE).toMatch(/PROSA CONTINUA|fluid/i);
    expect(RITMO_LEZIONE).toMatch(/MOSTRA/);
    expect(RITMO_LEZIONE).toMatch(/MAI domande buttate|nel vuoto/i);
    expect(RITMO_LEZIONE).toMatch(/NON rileggere il titolo/i);
  });

  it('e la vecchia struttura da dispensa non c\'è più', () => {
    const { prompt } = promptLezione({ argomento: 'Storia', lezione: { titolo: 'Roma' } });
    expect(prompt).not.toMatch(/una breve introduzione, il corpo con esempi concreti/);
    // b.304 — il ritmo e ora la VOCE DA DOCUMENTARIO (prosa fluida che mostra).
    expect(prompt).toMatch(/DOCUMENTARIO|MOSTRA|PROSA CONTINUA/);
  });
});

describe('la prova cambia forma: sfida, non interrogazione', () => {
  it('il catalogo offre forme diverse, compreso smentire il Maestro', () => {
    const ids = FORME_DI_PROVA.map(f => f.id);
    expect(ids).toContain('correggi-maestro');
    expect(ids).toContain('trova-errore');
    expect(ids).toContain('caso');
    expect(FORME_DI_PROVA.every(f => f.desc && f.desc.length > 10)).toBe(true);
  });

  it('il Maestro SCEGLIE: non c\'è "se lingua allora roleplay"', () => {
    const b = bloccoFormeDiProva(3);
    expect(b).toMatch(/Scegli tu/);
    expect(b).toMatch(/non fare 3 domande tutte uguali/);
    expect(b).not.toMatch(/\bse\b.*\ballora\b/i);
  });

  it('ma il CONTRATTO DEI DATI verso l\'interfaccia non cambia', () => {
    // "Correggi il Maestro" e "trova l'errore" restano domande a scelta
    // multipla: cambia l'esperienza, non il formato che la UI sa mostrare.
    const { prompt } = promptQuiz({ lezione: { titolo: 'Moto' }, contenuto: 'testo', nDomande: 3 });
    expect(prompt).toMatch(/"domanda":"\.\.\.","opzioni":\["a","b","c","d"\],"corretta":0/);
    expect(prompt).toMatch(/Ogni domanda resta a scelta multipla/);
  });

  it('la sfida la lancia il MAESTRO, non un "valutatore didattico"', () => {
    const { system } = promptQuiz({ lezione: { titolo: 'Moto' }, docente: DOCENTE });
    expect(system).toMatch(/Margaret/);
    expect(system).toMatch(/metti alla prova/);
    expect(system).not.toMatch(/valutatore didattico/);
  });

  it('e la regola anti-invenzione del quiz resta intatta', () => {
    // b.231: si chiede SOLO ciò che è stato davvero insegnato. Non deve
    // essersi persa nel rendere la prova più viva.
    const { prompt } = promptQuiz({ lezione: { titolo: 'Moto' }, contenuto: 'La velocità è...' });
    expect(prompt).toMatch(/REGOLA VINCOLANTE: non chiedere nulla che non sia presente/);
  });
});

describe('lo studente si descrive a parole, non con punteggi finti', () => {
  it('senza osservazioni non aggiunge niente al prompt', () => {
    expect(contestoStudente([])).toBe('');
    expect(contestoStudente()).toBe('');
  });

  it('con osservazioni le porta, e chiede di usarle senza elencarle', () => {
    const c = contestoStudente(['fatica coi tempi passati', 'capisce con esempi pratici']);
    expect(c).toMatch(/fatica coi tempi passati/);
    expect(c).toMatch(/usalo, non elencarlo/);
  });

  it('e niente percentuali inventate tipo motivazione=72%', () => {
    const c = contestoStudente(['capisce con esempi pratici']);
    expect(c).not.toMatch(/\d+%/);
  });
});

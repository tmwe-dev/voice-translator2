// ═══════════════════════════════════════════════════════════════
// b.242 — il Maestro ricorda, e la sfida si gioca davvero.
//
// Verificato prima di intervenire, e sono due difetti veri:
//  1. Impara non salvava NIENTE — nessuna tabella, nemmeno un localStorage.
//     Con un Maestro smemorato "cinque minuti fa non ci riuscivi, adesso sì"
//     è impossibile da dire, e il ripasso mirato non esiste.
//  2. Il quiz non era interattivo: mostrava le domande con GIÀ segnata la
//     risposta giusta col ✓. Non c'era niente da rispondere.
//
// Migrazione applicata e verificata live: imparare_studente (osservazioni a
// parole) e imparare_progresso (dove sei arrivato, come è andata, cosa è
// rimasto indietro). Chiave = impronta pubblica, mai l'email.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  chiaveCorso, unisciOsservazioni, riassuntoProgresso, contestoStudente,
} from '../app/lib/compagni/corsi/imparare.js';
import { promptLezione, promptQuiz } from '../app/lib/compagni/corsi/generatore.js';
import { promptVocazione } from '../app/lib/compagni/vocazione.js';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('il ricordo si scrive a parole, non con punteggi inventati', () => {
  it('le osservazioni si uniscono senza doppioni e senza crescere all\'infinito', () => {
    const u = unisciOsservazioni(['capisce con esempi', 'fatica coi verbi'], ['CAPISCE CON ESEMPI', 'ama la storia']);
    expect(u).toContain('ama la storia');
    expect(u.filter(x => /capisce con esempi/i.test(x)).length).toBe(1); // niente doppioni
    expect(unisciOsservazioni(Array.from({ length: 40 }, (_, i) => `nota ${i}`), []).length).toBeLessThanOrEqual(12);
  });

  it('la chiave di un corso è stabile e pulita', () => {
    expect(chiaveCorso('Inglese per Principianti!')).toBe('inglese-per-principianti');
    expect(chiaveCorso('  ')).toBe('corso');
  });
});

describe('il progresso diventa una cosa che il Maestro può DIRE', () => {
  it('senza storia non dice niente', () => {
    expect(riassuntoProgresso([])).toBe('');
    expect(riassuntoProgresso()).toBe('');
  });

  it('racconta dove siete arrivati e com\'è andata', () => {
    const s = riassuntoProgresso([{ lezione: 0, punteggio: 90, da_rivedere: [] }]);
    expect(s).toMatch(/DOVE SIETE ARRIVATI/);
    expect(s).toMatch(/andata bene \(90%\)/);
  });

  it('e quando la persona MIGLIORA glielo fa notare: è la motivazione più forte', () => {
    const s = riassuntoProgresso([
      { lezione: 0, punteggio: 40, da_rivedere: [] },
      { lezione: 1, punteggio: 85, da_rivedere: [] },
    ]);
    expect(s).toMatch(/MIGLIORATA/);
    expect(s).toMatch(/era 40%, ora 85%/);
    expect(s).toMatch(/faglielo notare/);
  });

  it('se invece cala, lo legge come un problema di ritmo — non come colpa sua', () => {
    const s = riassuntoProgresso([
      { lezione: 0, punteggio: 90, da_rivedere: [] },
      { lezione: 1, punteggio: 45, da_rivedere: [] },
    ]);
    expect(s).toMatch(/sta calando/);
    expect(s).toMatch(/ritmo troppo veloce|troppo veloce|non la prende/);
  });

  it('le cose rimaste indietro tornano NEL DISCORSO, non come interrogazione', () => {
    const s = riassuntoProgresso([{ lezione: 0, punteggio: 50, da_rivedere: ['il past simple', 'gli articoli'] }]);
    expect(s).toMatch(/COSE RIMASTE INDIETRO/);
    expect(s).toMatch(/il past simple/);
    expect(s).toMatch(/non come un'interrogazione/);
  });

  it('e niente percentuali inventate sulla persona', () => {
    const s = contestoStudente(['capisce con esempi pratici']);
    expect(s).not.toMatch(/\d+%/);
    expect(s).toMatch(/usalo, non elencarlo/);
  });
});

describe('il ricordo arriva davvero nel prompt del Maestro', () => {
  const progresso = [{ lezione: 0, punteggio: 40, da_rivedere: ['i verbi'] }, { lezione: 1, punteggio: 80, da_rivedere: [] }];
  const osservazioni = ['impara meglio con esempi concreti'];

  it('nella lezione', () => {
    const { system } = promptLezione({ argomento: 'Inglese', lezione: { titolo: 'Passato' }, osservazioni, progresso });
    expect(system).toMatch(/impara meglio con esempi concreti/);
    expect(system).toMatch(/MIGLIORATA/);
  });

  it('e nella sfida', () => {
    const { system } = promptQuiz({ lezione: { titolo: 'Passato' }, osservazioni, progresso });
    expect(system).toMatch(/impara meglio con esempi concreti/);
    expect(system).toMatch(/COSE RIMASTE INDIETRO/);
  });

  it('ma senza ricordo il prompt resta pulito come prima', () => {
    const { system } = promptLezione({ argomento: 'Storia', lezione: { titolo: 'Roma' } });
    expect(system).not.toMatch(/DOVE SIETE ARRIVATI/);
    expect(system).not.toMatch(/COSA SAI GIÀ DI QUESTA PERSONA/);
  });
});

describe('i moduli restano separati: i prompt non si trascinano il database', () => {
  it('generatore.js NON importa il modulo che parla con Supabase', () => {
    const g = leggi('app/lib/compagni/corsi/generatore.js');
    expect(g).not.toMatch(/from '\.\/studente\.js'/);
    expect(g).toMatch(/riassuntoProgresso.*from '\.\/imparare\.js'/s);
  });

  it('e studente.js è l\'unico che tocca le tabelle', () => {
    const s = leggi('app/lib/compagni/corsi/studente.js');
    expect(s).toMatch(/imparare_studente/);
    expect(s).toMatch(/imparare_progresso/);
    expect(s).toMatch(/idUtente/); // mai l'email in chiaro
  });
});

describe('la sfida ora si gioca (prima le risposte erano già segnate)', () => {
  const ui = () => leggi('app/components/Life/LifeView.js');

  it('si sceglie un\'opzione, non si legge la soluzione', () => {
    const s = ui();
    expect(s).toMatch(/const \[risposte, setRisposte\]/);
    expect(s).toMatch(/onClick=\{\(\) => !data && rispondi\(i, j\)\}/);
  });

  it('il risultato appare solo dopo aver risposto a tutto', () => {
    expect(ui()).toMatch(/Object\.keys\(risposte\)\.length === aperta\.domande\.length/);
  });

  it('e l\'esito arriva al Maestro, ma se fallisce la sfida resta valida', () => {
    const s = ui();
    expect(s).toMatch(/registraEsito\(\{/);
    expect(s).toMatch(/daRivedere/);
    expect(s).toMatch(/catch\(\(\) => \{ \/\* il ricordo e un di piu/);
  });

  it('e cambiando lezione o sfida le risposte si azzerano', () => {
    expect((ui().match(/setRisposte\(\{\}\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('chi è il Maestro quando parla', () => {
  const g = promptVocazione('guida');

  it('non spiega soltanto: accende', () => {
    expect(g).toMatch(/Non spieghi soltanto: accendi/);
    expect(g).toMatch(/quella luce passa a chi ti ascolta/);
  });

  it('porta storie, aneddoti, detti dei vecchi — e un po\' di mistero', () => {
    expect(g).toMatch(/Porta STORIE/);
    expect(g).toMatch(/aneddoto|detto dei vecchi/);
    expect(g).toMatch(/mistero da sciogliere la volta dopo/);
  });

  it('è il fratello maggiore che uno vorrebbe: comprensivo ma determinato', () => {
    expect(g).toMatch(/fratello maggiore/);
    expect(g).toMatch(/comprensivo ma determinato/);
    expect(g).toMatch(/non umili mai nessuno/);
  });

  it('ma l\'entusiasmo non si recita', () => {
    // Il rischio opposto: il Maestro tifoso, che entusiasma a comando.
    expect(g).toMatch(/Entusiasmati per davvero, non per mestiere/);
    expect(g).toMatch(/l'entusiasmo recitato si sente/);
  });

  it('e quando la conversazione finisce, qualcosa deve restare', () => {
    expect(g).toMatch(/che le resti addosso qualcosa/);
    expect(g).toMatch(/la voglia di tornare/);
  });
});

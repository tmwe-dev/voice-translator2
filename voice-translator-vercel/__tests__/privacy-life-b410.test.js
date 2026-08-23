// ═══════════════════════════════════════════════════════════════
// b.410 — BATCH E dell'audit: i due P0 di privacy che restavano.
//
// L7 dell'audit — «Isolamento account locale»:
//   A entra, scrive una chat e un obiettivo · esce · B entra ·
//   B NON deve vedere niente di A · A rientra e ritrova le sue cose.
//
// L8 dell'audit — «Sensitive memory guard»: un'uscita simulata del
// modello con farmaco, diagnosi, indirizzo, documento, telefono, email.
// Nessuno deve finire in chiaro nella memoria automatica.
//
// Qui si fanno girare le funzioni vere. Il primo blocco simula due
// account di fila dentro lo stesso deposito, che e esattamente lo
// scenario del difetto.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Un localStorage finto, come quello di un telefono solo.
function depositoFinto() {
  const dentro = new Map();
  return {
    get length() { return dentro.size; },
    key: (i) => [...dentro.keys()][i] ?? null,
    getItem: (k) => (dentro.has(k) ? dentro.get(k) : null),
    setItem: (k, v) => { dentro.set(k, String(v)); },
    removeItem: (k) => { dentro.delete(k); },
    _tutte: () => [...dentro.keys()],
    _svuota: () => dentro.clear(),
  };
}

let deposito;
let scaffale;
let obiettivi;

beforeEach(async () => {
  vi.resetModules();
  deposito = depositoFinto();
  Object.defineProperty(global.window, 'localStorage', { value: deposito, configurable: true, writable: true });
  scaffale = await import('../app/lib/scaffale.js');
  obiettivi = await import('../app/lib/compagni/obiettivi.js');
});

describe('L7 — due account sullo stesso telefono non si leggono addosso', () => {
  it('quello che scrive A, B non lo vede. E A lo ritrova.', () => {
    scaffale.entra('anna@esempio.it');
    scaffale.scrivi('chat:omar', JSON.stringify([{ ruolo: 'persona', testo: 'la mia terapia va meglio' }]));

    scaffale.entra('bruno@esempio.it');
    expect(scaffale.leggi('chat:omar'), 'B apre lo stesso Compagno e non trova niente').toBe(null);
    scaffale.scrivi('chat:omar', JSON.stringify([{ ruolo: 'persona', testo: 'ciao' }]));

    scaffale.entra('anna@esempio.it');
    const suo = JSON.parse(scaffale.leggi('chat:omar'));
    expect(suo[0].testo, 'A ritrova la SUA conversazione, non quella di B').toBe('la mia terapia va meglio');
  });

  it('e vale per gli obiettivi, che e dove stanno salute e finanza', () => {
    scaffale.entra('anna@esempio.it');
    obiettivi.salvaObiettivo({ titolo: 'Rimettermi in forma', categoria: 'salute' });
    expect(obiettivi.elencoObiettivi().length).toBe(1);

    scaffale.entra('bruno@esempio.it');
    expect(obiettivi.elencoObiettivi(), 'B parte da zero').toEqual([]);

    scaffale.entra('anna@esempio.it');
    expect(obiettivi.elencoObiettivi()[0].titolo).toBe('Rimettermi in forma');
  });

  it("l'email non finisce in chiaro dentro la chiave", () => {
    scaffale.entra('anna@esempio.it');
    scaffale.scrivi('chat:omar', 'x');
    const chiavi = deposito._tutte().join(' ');
    expect(chiavi, "la chiave si legge da qualunque strumento del browser").not.toContain('anna@esempio.it');
    expect(chiavi).not.toContain('anna');
  });

  it("e chi non ha fatto l'accesso ha il suo scaffale, che resta suo", () => {
    scaffale.entra('');
    scaffale.scrivi('obiettivi', '["cosa mia"]');
    const primaVolta = scaffale.leggi('obiettivi');
    scaffale.azzeraPerProva();               // come una ricarica della pagina
    scaffale.entra('');
    expect(scaffale.leggi('obiettivi'), "l'ospite ritrova le sue cose").toBe(primaVolta);
    scaffale.entra('anna@esempio.it');
    expect(scaffale.leggi('obiettivi'), "ma un account non eredita quelle dell'ospite").toBe(null);
  });

  it('due email diverse non finiscono mai sullo stesso ripiano', () => {
    expect(scaffale.impronta('anna@esempio.it')).not.toBe(scaffale.impronta('bruno@esempio.it'));
    expect(scaffale.impronta('Anna@Esempio.IT'), 'e la stessa persona scritta diversa e la stessa')
      .toBe(scaffale.impronta('anna@esempio.it'));
  });
});

describe('il trasloco delle cose vecchie: una volta sola, e poi la porta si chiude', () => {
  it('chi entra per primo se le ritrova', () => {
    deposito.setItem('vt-obiettivi', '[{"titolo":"vecchio"}]');
    deposito.setItem('vt-chat-omar', '[{"testo":"conversazione di prima"}]');
    scaffale.entra('anna@esempio.it');
    expect(JSON.parse(scaffale.leggi('obiettivi'))[0].titolo).toBe('vecchio');
    expect(scaffale.leggi('chat:omar')).toContain('conversazione di prima');
  });

  it('e le vecchie chiavi spariscono: erano la porta che stiamo chiudendo', () => {
    deposito.setItem('vt-obiettivi', '[{"titolo":"vecchio"}]');
    deposito.setItem('vt-chat-omar', '[{"testo":"x"}]');
    scaffale.entra('anna@esempio.it');
    expect(deposito.getItem('vt-obiettivi')).toBe(null);
    expect(deposito.getItem('vt-chat-omar')).toBe(null);
  });

  it('il SECONDO account non eredita niente: il trasloco non si ripete', () => {
    // e il punto che conta: prima di oggi quei dati li vedevano tutti.
    // Da adesso li vede uno solo, e chi arriva dopo parte pulito.
    deposito.setItem('vt-obiettivi', '[{"titolo":"vecchio"}]');
    scaffale.entra('anna@esempio.it');
    scaffale.entra('bruno@esempio.it');
    expect(scaffale.leggi('obiettivi')).toBe(null);
  });
});

describe('L8 — la seconda barriera davanti alla memoria', () => {
  let minimizza;
  beforeEach(async () => { minimizza = await import('../app/lib/compagni/minimizza.js'); });

  it("un farmaco col dosaggio NON si salva: e l'esempio dell'audit", () => {
    const esito = minimizza.minimizza({
      content: 'La persona assume FARMACO_X 20 mg la sera', tags: ['salute'],
    });
    expect(esito.ok, 'non entra nel database in nessuna forma').toBe(false);
    expect(esito.motivo).toBe('terapia-con-dosaggio');
  });

  it('e non si salva nemmeno redatto, perche redarlo sarebbe una finta', () => {
    // «La persona assume [omesso] 20 mg» direbbe ancora tutto cio che conta.
    const { ricordi } = minimizza.minimizzaTutti([{ content: 'Prende 500 mg di antibiotico da tre giorni' }]);
    expect(ricordi.length).toBe(0);
  });

  it('recapiti, documenti, coordinate e carte vengono coperti', () => {
    const casi = [
      ['scrivimi a mario.rossi@posta.it', 'mario.rossi@posta.it'],
      ['il mio numero e +39 333 1234567', '3331234567'],
      ['abita in Via Garibaldi 24', 'Garibaldi'],
      ['IBAN IT60X0542811101000000123456', 'IT60X0542811101000000123456'],
      ['carta 4539578763621486', '4539578763621486'],
      ['passaporto YA1234567', 'YA1234567'],
    ];
    for (const [testo, dentro] of casi) {
      const r = minimizza.ripulisci(testo);
      expect(r.testo, `non doveva restare: ${testo}`).not.toContain(dentro);
      expect(r.tolti.length, `niente riconosciuto in: ${testo}`).toBeGreaterThan(0);
    }
  });

  it('ma non copre quello che non e sensibile: niente falsi allarmi', () => {
    const innocui = [
      'Ha finito il corso di inglese nel 2024',
      'Vuole leggere 12 libri quest anno',
      'Si allena tre volte a settimana',
      'Il suo Compagno preferito e Archimede',
    ];
    for (const t of innocui) {
      const r = minimizza.ripulisci(t);
      expect(r.testo, `coperto per sbaglio: ${t}`).toBe(t);
      expect(r.tolti).toEqual([]);
    }
  });

  it('un numero lungo qualunque non e una carta: il controllo di Luhn serve a questo', () => {
    const r = minimizza.ripulisci('il codice interno e 1234567890123456');
    expect(r.testo, 'non passa Luhn, quindi non e una carta').toContain('1234567890123456');
  });

  it('il registro dice quanti e di che tipo, MAI cosa', () => {
    const { conto } = minimizza.minimizzaTutti([
      { content: 'assume FARMACO_X 20 mg' },
      { content: 'scrivimi a tizio@posta.it' },
    ]);
    const scritto = JSON.stringify(conto);
    expect(scritto).toContain('scartato:terapia-con-dosaggio');
    expect(scritto).toContain('coperto:recapito-email');
    expect(scritto, 'nel registro non finisce il dato che stavi proteggendo').not.toContain('tizio@posta.it');
    expect(scritto).not.toContain('FARMACO_X');
  });

  it("e il testo salvato non contiene piu l'indirizzo, ma resta una frase", () => {
    const esito = minimizza.minimizza({ content: 'Si e trasferito in Via Roma 25 e sta bene' });
    expect(esito.ok).toBe(true);
    expect(esito.ricordo.content).not.toContain('Roma 25');
    expect(esito.ricordo.content, 'il senso resta').toContain('sta bene');
  });
});

describe('la barriera sta DAVANTI al database, non accanto', () => {
  it('aggiungiRicordi passa dal setaccio prima di scrivere', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'app/lib/compagni/memoria.js'), 'utf8');
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const funzione = codice.slice(codice.indexOf('export async function aggiungiRicordi'));
    const setaccio = funzione.indexOf('minimizzaTutti(');
    const insert = funzione.indexOf('.insert(');
    expect(setaccio, 'il setaccio c\'e').toBeGreaterThan(-1);
    expect(insert, 'e sta PRIMA della scrittura').toBeGreaterThan(setaccio);
  });
});

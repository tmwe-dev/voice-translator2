// ═══════════════════════════════════════════════════════════════
// b.411 — BATCH E, seconda parte: la memoria del Compagno.
//
// L9 dell'audit — «recent/consolidated»: preparare ricordi recenti di due
// giorni, recenti di dieci, consolidati pertinenti e non; nel contesto
// devono entrare i primi e i terzi, non i secondi.
// L14 — «cancellazione memoria»: Compagno con ricordi, Dimentica, zero.
// P1.14 — un deposito guasto NON e «nessun ricordo».
// P1.16 — cancellare un Compagno porta via i suoi ricordi.
//
// Il deposito e finto ma si comporta come quello vero: registra le
// condizioni della richiesta, cosi si puo guardare COSA E' STATO CHIESTO
// e non solo cosa e tornato indietro.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Un finto Supabase che segna le condizioni di ogni interrogazione.
const richieste = [];
let daRestituire = [];
let guasto = null;
const cancellazioni = [];
let guastoCancellazione = null;

function costruttore(tabella) {
  const q = { tabella, dove: {}, filtri: [] };
  const catena = {
    select: (campi) => { q.campi = campi; return catena; },
    eq: (c, v) => { q.dove[c] = v; return catena; },
    gte: (c, v) => { q.filtri.push({ tipo: 'gte', campo: c, valore: v }); return catena; },
    overlaps: (c, v) => { q.filtri.push({ tipo: 'overlaps', campo: c, valore: v }); return catena; },
    order: (c, o) => { q.ordine = { campo: c, ...o }; return catena; },
    limit: (n) => { q.limite = n; richieste.push(q); return Promise.resolve({ data: guasto ? null : daRestituire, error: guasto }); },
    insert: (righe) => { q.inserite = righe; richieste.push(q); return Promise.resolve({ error: null }); },
    delete: () => {
      const d = { tabella, dove: {} };
      const fine = {
        eq: (c, v) => { d.dove[c] = v; return fine; },
        then: (ris) => { cancellazioni.push(d); return Promise.resolve({ error: guastoCancellazione }).then(ris); },
      };
      return fine;
    },
  };
  return catena;
}

vi.mock('../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: (t) => costruttore(t) }),
}));
vi.mock('../app/lib/compagni/ponte.js', () => ({ generaTesto: async () => ({ ok: false }) }));

const memoria = await import('../app/lib/compagni/memoria.js');
const persistenza = await import('../app/lib/compagni/persistenza.js');

beforeEach(() => {
  richieste.length = 0; cancellazioni.length = 0;
  daRestituire = []; guasto = null; guastoCancellazione = null;
});

const chiediContesto = () => memoria.ricordiPerContesto('luca@esempio.it', 'archimede', ['studio']);

describe('L9 — la finestra «recente» adesso esiste davvero', () => {
  it('si chiedono SOLO i recenti, e solo quelli degli ultimi sette giorni', async () => {
    await chiediContesto();
    const recenti = richieste.find((q) => q.dove.layer === 'recent');
    expect(recenti, 'prima non si chiedeva affatto il livello').toBeTruthy();

    const finestra = recenti.filtri.find((f) => f.tipo === 'gte' && f.campo === 'created_at');
    expect(finestra, 'ne si guardava la data').toBeTruthy();

    const giorni = (Date.now() - new Date(finestra.valore).getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(giorni), 'sette giorni, come dice il piano').toBe(memoria.GIORNI_RECENTI);
  });

  it('e i consolidati restano una domanda a parte, per tag e importanza', async () => {
    await chiediContesto();
    const cons = richieste.find((q) => q.dove.layer === 'consolidated');
    expect(cons).toBeTruthy();
    expect(cons.filtri.some((f) => f.tipo === 'overlaps' && f.campo === 'tags')).toBe(true);
    expect(cons.ordine.campo).toBe('importance');
    // il punto del difetto: i consolidati NON devono poter occupare gli
    // slot dei recenti, ed e per questo che sono due domande separate.
    expect(cons).not.toBe(richieste.find((q) => q.dove.layer === 'recent'));
  });

  it('senza tag rilevanti non si va nemmeno a cercare i consolidati', async () => {
    await memoria.ricordiPerContesto('luca@esempio.it', 'archimede', []);
    expect(richieste.filter((q) => q.dove.layer === 'consolidated').length).toBe(0);
  });
});

describe('P1.14 — un deposito guasto non e «nessun ricordo»', () => {
  it('quando la lettura fallisce, si sa', async () => {
    guasto = { message: 'connection reset' };
    const r = await chiediContesto();
    expect(r, 'la chat non cade: la memoria e un di piu').toEqual([]);
    expect(memoria.memoriaDisponibile(), 'ma la differenza si puo chiedere').toBe(false);
  });

  it('e quando torna a funzionare, si sa anche quello', async () => {
    guasto = { message: 'connection reset' };
    await chiediContesto();
    expect(memoria.memoriaDisponibile()).toBe(false);
    guasto = null;
    await chiediContesto();
    expect(memoria.memoriaDisponibile(), 'non resta marchiata guasta per sempre').toBe(true);
  });

  it('nessun ricordo E un deposito sano restano due cose diverse', async () => {
    daRestituire = [];
    const r = await chiediContesto();
    expect(r).toEqual([]);
    expect(memoria.memoriaDisponibile(), 'vuoto non vuol dire rotto').toBe(true);
  });
});

describe('P1.16 — cancellare un Compagno porta via i suoi ricordi', () => {
  it('prima i ricordi, poi la scheda', async () => {
    await persistenza.cancellaCompagno('luca@esempio.it', 'archimede');
    expect(cancellazioni.length, 'due cancellazioni, non una').toBe(2);
    expect(cancellazioni[0].tabella, 'i ricordi per primi').toBe('compagno_memorie');
    expect(cancellazioni[1].tabella).toBe('compagni');
    expect(cancellazioni[0].dove.compagno_id).toBe('archimede');
  });

  it("e se i ricordi non si cancellano, la scheda NON si cancella", async () => {
    // meglio un Compagno che resta (e si puo ricancellare) che dei ricordi
    // senza Compagno, che nessuna schermata sa piu raggiungere.
    guastoCancellazione = { message: 'giu' };
    const fatto = await persistenza.cancellaCompagno('luca@esempio.it', 'archimede');
    expect(fatto).toBe(false);
    expect(cancellazioni.length, 'ci si e fermati alla prima').toBe(1);
  });
});

describe('L14 — «Dimentica» cancella per davvero, e solo il tuo', () => {
  it('tocca una tabella sola, e solo le righe tue di quel Compagno', async () => {
    const fatto = await memoria.dimentica('luca@esempio.it', 'archimede');
    expect(fatto).toBe(true);
    expect(cancellazioni.length).toBe(1);
    expect(cancellazioni[0].tabella).toBe('compagno_memorie');
    expect(cancellazioni[0].dove.compagno_id).toBe('archimede');
    expect(cancellazioni[0].dove.owner, "l'impronta di chi lo chiede, non un id dal corpo").toBeTruthy();
  });

  it('senza sapere chi sei non cancella niente', async () => {
    expect(await memoria.dimentica('', 'archimede')).toBe(false);
    expect(cancellazioni.length).toBe(0);
  });
});

describe('P1.17 — «Dimentica» adesso si puo chiedere', () => {
  const leggi = async (p) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    return readFileSync(join(process.cwd(), p), 'utf8');
  };

  it("la rotta ha l'azione, il cliente il verbo, la schermata il tasto", async () => {
    // Prima `dimentica()` esisteva in memoria.js e NESSUNO la chiamava:
    // cercato in tutto il progetto, zero chiamanti. La catena va guardata
    // tutta e tre, perche basta un anello mancante e la promessa torna
    // una frase.
    expect(await leggi('app/api/compagni/mie/route.js')).toMatch(/azione === 'dimentica'/);
    expect(await leggi('app/lib/compagni/cliente.js')).toMatch(/export function dimenticaMio/);
    expect(await leggi('app/components/Life/GestioneCompagni.js')).toMatch(/dimenticaMio\(/);
  });
});

describe('P1.18 — il contatore dei turni non lo tiene piu il client', () => {
  it("la rotta conta da se, e `body.totale` resta solo un ripiego", async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'app/api/compagni/amico/route.js'), 'utf8');
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codice, 'il conteggio passa dal deposito nostro').toMatch(/contaTurno\(email, compagno\.id/);
    expect(codice, "e non si decide piu su cio che dichiara il client")
      .not.toMatch(/const totaleTurni = \(Number\(body\.totale\)/);
  });
});

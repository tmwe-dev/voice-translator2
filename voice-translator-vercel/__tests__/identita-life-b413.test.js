// ═══════════════════════════════════════════════════════════════
// b.413 — P1.15: l'impronta dell'utente di Life.
//
// Era `sha256(email)` troncato. Il difetto non e la funzione: e che
// l'email E' INDOVINABILE. Chi ha un'impronta puo provare le email
// finche torna, o costruirsi una tabella ed ENUMERARE le persone. Mondo
// era gia passato all'HMAC per questo motivo esatto in b.244, e il
// commento di Life diceva ancora «la stessa impronta di Mondo».
//
// LA PARTE DIFFICILE E' LA MIGRAZIONE, e queste prove sono soprattutto
// su quella: dagli id vecchi NON si risale alle email (sono digest),
// quindi una migrazione di massa e IMPOSSIBILE — nessuno sa a chi
// appartiene la riga `u_3f2a...`. L'unico momento in cui quel legame
// esiste e quando la persona torna.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Un finto Supabase che tiene righe vere, cosi il trasloco si vede
// succedere invece di essere raccontato.
let tabelle;
let guasta = null;

function costruttore(nome) {
  return {
    update: (patch) => ({
      eq: (colonna, valore) => ({
        select: async () => {
          if (guasta === nome) return { data: null, error: { message: 'giu' } };
          const righe = (tabelle[nome] || []).filter((r) => r[colonna] === valore);
          for (const r of righe) Object.assign(r, patch);
          return { data: righe.map((r) => ({ [colonna]: r[colonna] })), error: null };
        },
      }),
    }),
    select: () => ({
      eq: (colonna, valore) => ({
        order: async () => ({ data: (tabelle[nome] || []).filter((r) => r[colonna] === valore), error: null }),
      }),
    }),
  };
}

vi.mock('../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: (t) => costruttore(t) }),
}));
vi.mock('../app/lib/compagni/profili.js', () => ({ pulisciProfili: (x) => x }));

const SEGRETO = 'un-segreto-lungo-abbastanza-per-essere-un-segreto';
let persistenza;

beforeEach(async () => {
  vi.resetModules();
  guasta = null;
  tabelle = {};
  process.env.MONDO_ID_SECRET = SEGRETO;
  persistenza = await import('../app/lib/compagni/persistenza.js');
});
afterEach(() => { delete process.env.MONDO_ID_SECRET; });

const EMAIL = 'luca@esempio.it';

describe("l'impronta non si indovina piu partendo dall'email", () => {
  it('col segreto, non e piu il digest nudo', () => {
    expect(persistenza.idUtente(EMAIL)).not.toBe(persistenza.idUtenteVecchio(EMAIL));
  });

  it('e chi non ha il segreto non puo rifarla', async () => {
    // e tutta la differenza: prima bastava sapere l'email.
    // Il valore si prende PRIMA di cambiare il segreto: `idUtente` lo
    // legge quando viene chiamata, non quando il modulo viene caricato —
    // mia svista nella prima stesura di questa prova, presa da lei stessa.
    const conQuesto = persistenza.idUtente(EMAIL);
    process.env.MONDO_ID_SECRET = 'un-altro-segreto-completamente-diverso';
    expect(persistenza.idUtente(EMAIL)).not.toBe(conQuesto);
  });

  it('ma resta stabile per la stessa persona, o si perderebbe tutto ogni volta', () => {
    expect(persistenza.idUtente(EMAIL)).toBe(persistenza.idUtente(EMAIL));
    expect(persistenza.idUtente('Luca@Esempio.IT'), 'e non cambia con le maiuscole')
      .toBe(persistenza.idUtente(EMAIL));
  });

  it('senza segreto non si spegne Life: si ricade sul vecchio schema', async () => {
    vi.resetModules();
    delete process.env.MONDO_ID_SECRET;
    const senza = await import('../app/lib/compagni/persistenza.js');
    expect(senza.idUtente(EMAIL)).toBe(senza.idUtenteVecchio(EMAIL));
  });

  it("e in nessun caso l'email finisce dentro l'impronta", () => {
    const i = persistenza.idUtente(EMAIL);
    expect(i).not.toContain('luca');
    expect(i).not.toContain('esempio');
    expect(i.startsWith('u_')).toBe(true);
  });
});

describe('il trasloco pigro: quando la persona torna', () => {
  const conRighe = () => {
    const vecchio = persistenza.idUtenteVecchio(EMAIL);
    tabelle = {
      compagni: [{ id: 'a', owner: vecchio }, { id: 'b', owner: 'u_diqualcunaltro' }],
      compagno_memorie: [{ id: 1, owner: vecchio }],
      corsi_utente: [{ id: 'c', owner: vecchio }],
      corsi_pubblici: [{ id: 'p', autore: vecchio }],
      profilo_studente: [], pronuncia_profilo: [], compiti_jobs: [],
      compiti_materiali: [], imparare_progresso: [], imparare_studente: [],
    };
    return vecchio;
  };

  it('le righe passano alla nuova impronta, tutte le tabelle', async () => {
    conRighe();
    const nuovo = persistenza.idUtente(EMAIL);
    const spostate = await persistenza.assicuraIdentita(EMAIL);
    expect(spostate).toBe(4);
    expect(tabelle.compagni[0].owner).toBe(nuovo);
    expect(tabelle.compagno_memorie[0].owner).toBe(nuovo);
    expect(tabelle.corsi_utente[0].owner).toBe(nuovo);
    expect(tabelle.corsi_pubblici[0].autore, 'anche dove la colonna si chiama diversamente').toBe(nuovo);
  });

  it('e NON tocca le righe di qualcun altro', async () => {
    conRighe();
    await persistenza.assicuraIdentita(EMAIL);
    expect(tabelle.compagni[1].owner).toBe('u_diqualcunaltro');
  });

  it('richiamarlo due volte non fa danni: la seconda non sposta niente', async () => {
    conRighe();
    await persistenza.assicuraIdentita(EMAIL);
    expect(await persistenza.assicuraIdentita(EMAIL), 'gia traslocato').toBe(0);
  });

  it('e senza segreto non si trasloca proprio: non ci sarebbe dove', async () => {
    vi.resetModules();
    delete process.env.MONDO_ID_SECRET;
    const senza = await import('../app/lib/compagni/persistenza.js');
    tabelle = { compagni: [{ id: 'a', owner: senza.idUtenteVecchio(EMAIL) }] };
    expect(await senza.assicuraIdentita(EMAIL)).toBe(0);
    expect(tabelle.compagni[0].owner, 'la riga resta dov\'e').toBe(senza.idUtenteVecchio(EMAIL));
  });

  it('una tabella guasta non blocca le altre, e non perde niente', async () => {
    conRighe();
    guasta = 'compagno_memorie';
    const nuovo = persistenza.idUtente(EMAIL);
    const spostate = await persistenza.assicuraIdentita(EMAIL);
    expect(spostate, 'tre su quattro').toBe(3);
    expect(tabelle.compagni[0].owner).toBe(nuovo);
    expect(tabelle.compagno_memorie[0].owner, 'quella guasta resta com\'era, e si riprova alla prossima')
      .toBe(persistenza.idUtenteVecchio(EMAIL));
  });

  it('senza email non fa niente', async () => {
    expect(await persistenza.assicuraIdentita('')).toBe(0);
  });
});

describe('il trasloco sta dove Life comincia', () => {
  it("`elencaCompagni` lo chiama prima di leggere", async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'app/lib/compagni/persistenza.js'), 'utf8');
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const f = codice.slice(codice.indexOf('export async function elencaCompagni'));
    const trasloco = f.indexOf('await assicuraIdentita(email)');
    const lettura = f.indexOf(".from('compagni')");
    expect(trasloco, 'il trasloco c\'e').toBeGreaterThan(-1);
    expect(lettura, 'e viene PRIMA della lettura, o si leggerebbe una casa vuota').toBeGreaterThan(trasloco);
  });

  it('e le righe traslocate si ritrovano davvero', async () => {
    const vecchio = persistenza.idUtenteVecchio(EMAIL);
    tabelle = {
      compagni: [{ id: 'a', owner: vecchio, nome: 'Archimede', voce_id: 'v', profili: {} }],
      compagno_memorie: [], corsi_utente: [], corsi_pubblici: [],
      profilo_studente: [], pronuncia_profilo: [], compiti_jobs: [],
      compiti_materiali: [], imparare_progresso: [], imparare_studente: [],
    };
    const elenco = await persistenza.elencaCompagni(EMAIL);
    expect(elenco.length, 'il Compagno non e sparito col cambio di impronta').toBe(1);
    expect(elenco[0].nome).toBe('Archimede');
  });
});

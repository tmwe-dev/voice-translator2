// ═══════════════════════════════════════════════════════════════
// b.415 — «cancella i miei dati» adesso li cancella davvero.
//
// L'audit esterno: «la cancellazione centrale elimina soprattutto cio
// che vive in Redis. Nel frattempo esistono dati utente anche in
// Supabase, Life, Compagni, corsi, pronuncia, compiti, PeepOff. Serve un
// unico DELETE USER». E: «revocare tutte le sessioni quando si elimina
// l'account».
//
// VERIFICATO: era vero. `deleteUserData` toccava profilo, sessione
// CORRENTE, pagamenti, codici, referral e prestiti — tutto e solo su
// Redis. Su Supabase restava tutto, e chi era entrato anche dal telefono
// restava dentro fino alla scadenza naturale: sette giorni.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Il deposito veloce, finto ma con la memoria.
const deposito = new Map();
const insiemi = new Map();
vi.mock('../app/lib/redis.js', () => ({
  redis: async (comando, chiave, valore) => {
    if (comando === 'SET') { deposito.set(chiave, valore); return 'OK'; }
    if (comando === 'GET') return deposito.get(chiave) ?? null;
    if (comando === 'DEL') { deposito.delete(chiave); insiemi.delete(chiave); return 1; }
    if (comando === 'SADD') { const s = insiemi.get(chiave) || new Set(); s.add(valore); insiemi.set(chiave, s); return 1; }
    if (comando === 'SMEMBERS') return [...(insiemi.get(chiave) || [])];
    if (comando === 'EXPIRE') return 1;
    return null;
  },
}));

// Supabase finto: registra ogni cancellazione, con tabella e condizione.
const cancellazioni = [];
let guasta = null;
vi.mock('../app/lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({
    from: (tabella) => ({
      delete: () => ({
        eq: async (colonna, valore) => {
          if (guasta === tabella) return { error: { message: 'giu' } };
          cancellazioni.push({ tabella, colonna, valore });
          return { error: null };
        },
      }),
    }),
  }),
}));

const SEGRETO = 'segreto-di-prova-abbastanza-lungo';
const EMAIL = 'luca@esempio.it';
let cancellazione;
let persistenza;

beforeEach(async () => {
  vi.resetModules();
  deposito.clear(); insiemi.clear(); cancellazioni.length = 0; guasta = null;
  process.env.MONDO_ID_SECRET = SEGRETO;
  cancellazione = await import('../app/lib/cancellazione.js');
  persistenza = await import('../app/lib/compagni/persistenza.js');
});

describe('i dati su Supabase adesso spariscono', () => {
  it('tutte le tabelle di Life, non solo Redis', async () => {
    const { cancellati } = await cancellazione.cancellaDatiPersistenti(EMAIL);
    const toccate = new Set(cancellazioni.map((c) => c.tabella));
    for (const t of ['compagni', 'compagno_memorie', 'corsi_utente', 'compiti_jobs',
      'compiti_materiali', 'profilo_studente', 'pronuncia_profilo',
      'imparare_progresso', 'imparare_studente']) {
      expect(toccate.has(t), `${t}: prima restava li per sempre`).toBe(true);
    }
    expect(cancellati).toContain('compagni');
  });

  it('e sotto TUTTE E DUE le impronte, vecchia e nuova', async () => {
    // Non e ridondanza: dopo b.413 l'impronta e un HMAC, ma le righe di
    // chi non e ancora tornato hanno ancora quella vecchia. Cancellare
    // solo la nuova lascerebbe indietro proprio i dati di chi non usa
    // l'app da un po' — cioe, con ogni probabilita, di chi vuole sparire.
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const suCompagni = cancellazioni.filter((c) => c.tabella === 'compagni').map((c) => c.valore);
    expect(suCompagni).toContain(persistenza.idUtente(EMAIL));
    expect(suCompagni).toContain(persistenza.idUtenteVecchio(EMAIL));
    expect(persistenza.idUtente(EMAIL)).not.toBe(persistenza.idUtenteVecchio(EMAIL));
  });

  it('e i dispositivi PeepOff, che non usano l\'impronta ma l\'indirizzo', async () => {
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const p = cancellazioni.filter((c) => c.tabella.startsWith('peepoff'));
    expect(p.length).toBe(2);
    expect(p[0].valore, 'nome#dominio, ricavato dall\'email').toBe('luca#esempio.it');
  });

  it("cio che non si e riusciti a cancellare NON si dichiara cancellato", async () => {
    guasta = 'compagno_memorie';
    const { cancellati, mancati } = await cancellazione.cancellaDatiPersistenti(EMAIL);
    expect(mancati).toContain('compagno_memorie');
    expect(cancellati, 'e non compare fra i fatti').not.toContain('compagno_memorie');
    expect(cancellati, 'ma le altre sono passate lo stesso').toContain('compagni');
  });
});

describe('le sessioni: tutte, non solo quella da cui stai chiedendo', () => {
  it('un account con tre accessi aperti li perde tutti e tre', async () => {
    insiemi.set(`sessioni:${EMAIL}`, new Set(['g1', 'g2', 'g3']));
    deposito.set('session:g1', '{}'); deposito.set('session:g2', '{}'); deposito.set('session:g3', '{}');
    const quante = await cancellazione.revocaTutteLeSessioni(EMAIL);
    expect(quante).toBe(3);
    expect(deposito.has('session:g1')).toBe(false);
    expect(deposito.has('session:g3'), 'anche quella del telefono').toBe(false);
    expect(insiemi.has(`sessioni:${EMAIL}`), 'e l\'elenco stesso sparisce').toBe(false);
  });

  it('senza elenco non esplode: torna zero e la sessione corrente si chiude lo stesso', async () => {
    expect(await cancellazione.revocaTutteLeSessioni(EMAIL)).toBe(0);
  });

  it('e chi entra ora finisce nell\'elenco: senza, non ci sarebbe niente da revocare', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(process.cwd(), 'app/lib/users.js'), 'utf8');
    const codice = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const f = codice.slice(codice.indexOf('export async function createSession'));
    expect(f).toMatch(/SADD', `sessioni:\$\{basso\}`/);
  });
});

describe('b.419 — e la tua attivita su Mondo, che e tua e di nessun altro', () => {
  // L'audit esterno del 23/08: «mondo_follows, mondo_comment_likes,
  // mondo_segnalazioni sono metadati personali, vanno cancellati; le
  // discussioni e i commenti sono contenuto pubblico e restano una
  // decisione di prodotto». VERIFICATO: era vero, non si toccavano.
  it('chi segui, i tuoi mi-piace e le tue segnalazioni spariscono', async () => {
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const toccate = new Set(cancellazioni.map((c) => c.tabella));
    for (const t of ['mondo_comment_likes', 'mondo_segnalazioni', 'mondo_follows']) {
      expect(toccate.has(t), `${t}: prima restava li per sempre`).toBe(true);
    }
  });

  it("e si usa l'identita di MONDO, chiedendola a Mondo", async () => {
    const { idPubblico } = await import('../app/lib/mondoDB.js');
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const like = cancellazioni.find((c) => c.tabella === 'mondo_comment_likes');
    expect(like.valore).toBe(idPubblico(EMAIL));

    // SCOPERTA SCRIVENDO QUESTA PROVA, e va scritta perche e facile
    // fraintenderla: OGGI `idPubblico` di Mondo e `idUtente` di Life
    // danno lo STESSO valore. Non e un caso ed e voluto — b.413 ha
    // scelto apposta lo stesso segreto e la stessa forma («due segreti
    // per la stessa idea sono due cose da ricordare e una da
    // dimenticare»). Quindi questa prova NON puo distinguere le due
    // identita, e sarebbe disonesto far finta di si.
    // Cio che fissa e da CHI si va a chiedere l'identita: il giorno che
    // una delle due cambia — e Mondo l'ha gia cambiata una volta, in
    // b.244 — questa riga resta giusta da sola.
    expect(like.valore, 'oggi coincidono, e la prova lo dichiara').toBe(persistenza.idUtente(EMAIL));
  });

  it('i «segui» si tolgono da tutti e due i lati', async () => {
    // quelli messi da te, e quelli messi a un profilo che sta per sparire.
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const f = cancellazioni.filter((c) => c.tabella === 'mondo_follows').map((c) => c.colonna);
    expect(f).toContain('follower_user_id');
    expect(f).toContain('followed_user_id');
  });

  it('ma NON tocca discussioni e commenti: quelli non sono solo tuoi', async () => {
    // dentro ci sono le risposte di altre persone. E' una decisione di
    // prodotto in sospeso, e finche non e presa la risposta lo dichiara.
    await cancellazione.cancellaDatiPersistenti(EMAIL);
    const toccate = new Set(cancellazioni.map((c) => c.tabella));
    expect(toccate.has('mondo_discussions')).toBe(false);
    expect(toccate.has('mondo_comments')).toBe(false);
  });

  it('e non dichiara cancellato lo storico traduzioni, che non tocca', async () => {
    // `translations` e a ZERO righe sul database vivo e non puo riempirsi:
    // chi la scrive cerca `profiles.id`, e `profiles` non esiste. Qui non
    // si cancella niente — e soprattutto non lo si dichiara.
    const { cancellati } = await cancellazione.cancellaDatiPersistenti(EMAIL);
    expect(cancellati).not.toContain('translations');
    expect(cancellazioni.some((c) => c.tabella === 'translations')).toBe(false);
  });
});

describe('la catena e una sola, e la frase dice la verita', () => {
  const leggi = async (p) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    return readFileSync(join(process.cwd(), p), 'utf8');
  };

  it('`deleteUserData` chiama tutte e due le porte nuove', async () => {
    const codice = (await leggi('app/lib/users.js'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const f = codice.slice(codice.indexOf('export async function deleteUserData'));
    expect(f).toMatch(/revocaTutteLeSessioni\(lowerEmail\)/);
    expect(f).toMatch(/cancellaDatiPersistenti\(lowerEmail\)/);
  });

  it('e la risposta all\'utente non promette piu di cio che fa', async () => {
    const r = await leggi('app/api/user/route.js');
    // cio che ora sparisce davvero
    expect(r).toMatch(/ALL sessions/);
    expect(r).toMatch(/Companions/);
    expect(r).toMatch(/PeepOff/);
    expect(r, 'b.419 — e l\'attivita su Mondo').toMatch(/who you follow/);
    // e cio che resta, detto invece che sottinteso
    expect(r).toMatch(/Retained/);
    expect(r).toMatch(/wallet accounting/);
    expect(r).toMatch(/Mondo/);
    // la vecchia frase, che ora sarebbe falsa in due punti su tre
    expect(r).not.toMatch(/expire naturally within 7 days/);
  });
});

describe('gli strumenti Business stanno in una stanza con meno porte', () => {
  it('niente navigazione dall\'alto e niente scaricamenti automatici', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const b = readFileSync(join(process.cwd(), 'app/components/BusinessView.js'), 'utf8');
    const iframe = b.slice(b.indexOf('<iframe'));
    expect(iframe).toMatch(/sandbox="[^"]*allow-scripts/);
    expect(iframe, 'un XSS non deve poter portare via tutta l\'applicazione')
      .not.toMatch(/allow-top-navigation/);
    expect(iframe, 'ne far partire scaricamenti da solo').not.toMatch(/allow-downloads/);
    expect(iframe).toMatch(/referrerPolicy="no-referrer"/);
  });

  it('e la fotocamera la ha solo chi la usa', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const b = readFileSync(join(process.cwd(), 'app/components/BusinessView.js'), 'utf8');
    expect(b, 'il permesso viene dallo strumento, non e scritto uguale per tutti')
      .toMatch(/allow=\{aperto\.permessi \|\| ''\}/);
    const codice = b.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codice).not.toMatch(/allow="camera; microphone"/);
  });
});

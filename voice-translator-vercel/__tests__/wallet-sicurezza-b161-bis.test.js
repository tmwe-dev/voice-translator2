// ═══════════════════════════════════════════════════════════════
// GUARDIA — RESERVE → PROVIDER → COMMIT/RELEASE (b.161-bis, punto 5)
//
// Nato dalla contestazione diretta dell'utente sul quinto punto rimasto
// aperto dopo b.161 ("Reserve → Provider → Commit/Release non ancora
// implementato: rimane una finestra di race fra richieste concorrenti").
//
// Il preventivo pre-chiamata (b.161, punto 1: creditoInsufficiente)
// chiudeva il bypass RIPETIBILE ma non la finestra di CORSA: due
// richieste concorrenti leggono lo stesso saldo, lo passano ENTRAMBE,
// e solo l'addebito finale (atomico) le distingue — la seconda torna
// "esaurito" ma il fornitore, per lei, e gia stato chiamato una volta
// di troppo. Questa migrazione + questo modulo chiudono la finestra:
// il saldo scende SUBITO, atomicamente, con la riserva — prima ancora
// di chiamare il fornitore.
//
// Verificato dal vivo (rollback-only) in produzione durante la stesura:
// riserva riduce il saldo subito, una riserva concorrente sopra il
// residuo viene rifiutata, commit rimborsa la differenza se il costo
// vero e minore, il doppio commit e rifiutato, release restituisce
// l'intera riserva. Zero righe lasciate per l'utente di test.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('Migrazione 010: wallet_riserva/wallet_commit/wallet_release/wallet_rilascia_riserve_scadute', () => {
  const src = leggi('supabase/migrations/010_wallet_riserva.sql');

  it('crea la tabella wallet_riserve con RLS attiva e nessun accesso da anon/authenticated', () => {
    expect(src).toContain('CREATE TABLE IF NOT EXISTS wallet_riserve');
    expect(src).toContain('ALTER TABLE wallet_riserve ENABLE ROW LEVEL SECURITY;');
    expect(src).toContain('REVOKE ALL ON wallet_riserve FROM PUBLIC, anon, authenticated;');
    expect(src).toContain('GRANT ALL ON wallet_riserve TO service_role;');
  });

  it('wallet_riserva usa lo stesso lock per-utente e lo stesso limite di wallet_usa (migrazione 006)', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_riserva');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit'));
    expect(blocco).toContain('PERFORM pg_advisory_xact_lock(hashtext(p_user_id));');
    expect(blocco).toContain('IF p_secondi > 100000 THEN');
    expect(blocco).toContain("SECURITY DEFINER SET search_path = public, pg_temp");
  });

  it('wallet_riserva scala il saldo SUBITO (INSERT su credit_ledger dentro la stessa transazione della riserva)', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_riserva');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit'));
    expect(blocco).toContain("INSERT INTO wallet_riserve");
    expect(blocco).toContain("INSERT INTO credit_ledger (user_id, tipo, secondi, dettaglio)");
    expect(blocco).toContain("'riserva', -p_secondi");
  });

  it('wallet_commit non addebita mai piu della riserva (tetto LEAST) e rifiuta un doppio commit', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_release'));
    expect(blocco).toContain('LEAST(COALESCE(p_secondi_reali, r.secondi), r.secondi)');
    expect(blocco).toContain("IF r.stato <> 'attiva' THEN");
    expect(blocco).toContain("'rilascio_parziale'");
  });

  it('wallet_release restituisce l\'intera riserva e rifiuta anche lui un doppio rilascio', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_release');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute'));
    expect(blocco).toContain("IF r.stato <> 'attiva' THEN");
    expect(blocco).toContain("'rilascio', r.secondi");
  });

  it('wallet_rilascia_riserve_scadute pulisce le riserve attive da piu di 10 minuti (crash serverless a meta)', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute');
    const blocco = src.slice(i);
    expect(blocco).toContain("stato = 'attiva' AND created_at < now() - INTERVAL '10 minutes'");
  });

  it("la CHECK su credit_ledger.tipo accetta 'riserva', 'rilascio' e 'rilascio_parziale' senza perdere le voci esistenti", () => {
    expect(src).toContain('ALTER TABLE credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_tipo_check;');
    const i = src.indexOf('ADD CONSTRAINT credit_ledger_tipo_check');
    const blocco = src.slice(i, i + 400);
    for (const tipo of ['acquisto', 'benvenuto', 'voucher', 'regalo_in', 'regalo_out', 'uso', 'rimborso', 'omaggio', 'riserva', 'rilascio', 'rilascio_parziale']) {
      expect(blocco).toContain(`'${tipo}'`);
    }
  });

  it('tutte e 4 le funzioni sono revocate a PUBLIC/anon/authenticated e concesse solo a service_role', () => {
    for (const fn of ['wallet_riserva(TEXT, INTEGER, JSONB)', 'wallet_commit(BIGINT, INTEGER, JSONB)', 'wallet_release(BIGINT, TEXT)', 'wallet_rilascia_riserve_scadute()']) {
      expect(src).toContain(`REVOKE EXECUTE ON FUNCTION ${fn} FROM PUBLIC, anon, authenticated;`);
      expect(src).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO service_role;`);
    }
  });
});

describe('app/wallet/riserva.js: wrapper JS per riserva/commit/release', () => {
  const src = leggi('app/wallet/riserva.js');

  it('espone le tre funzioni chiamando le RPC corrispondenti', () => {
    expect(src).toContain('export async function riserva(');
    expect(src).toContain("db().rpc('wallet_riserva'");
    expect(src).toContain('export async function commit(');
    expect(src).toContain("db().rpc('wallet_commit'");
    expect(src).toContain('export async function release(');
    expect(src).toContain("db().rpc('wallet_release'");
  });

  it('riserva() e fail-closed: un errore o un\'eccezione bloccano (ok:false), non fanno passare la richiesta', () => {
    const i = src.indexOf('export async function riserva(');
    const blocco = src.slice(i, src.indexOf('export async function commit('));
    expect(blocco).toContain("if (error) return { ok: false, motivo: 'errore db: ' + error.message };");
    expect(blocco).toMatch(/catch \(e\) \{[\s\S]*return \{ ok: false, motivo: 'errore: ' \+ e\.message \};/);
  });

  it('commit() e release() non propagano mai errori al chiamante (solo log): non devono far cadere una risposta gia pronta', () => {
    const iCommit = src.indexOf('export async function commit(');
    const iRelease = src.indexOf('export async function release(');
    const bloccoCommit = src.slice(iCommit, iRelease);
    const bloccoRelease = src.slice(iRelease);
    expect(bloccoCommit).not.toMatch(/return \{ ok: false/);
    expect(bloccoRelease).not.toMatch(/return \{ ok: false/);
    expect(bloccoCommit).toContain('console.error');
    expect(bloccoRelease).toContain('console.error');
  });

  it('riserva() valida l\'importo prima di toccare il database (nessuna RPC con un numero non valido)', () => {
    const i = src.indexOf('export async function riserva(');
    const blocco = src.slice(i, src.indexOf('export async function commit('));
    const iValidazione = blocco.indexOf("if (!Number.isFinite(importo) || importo <= 0)");
    const iRpc = blocco.indexOf("db().rpc('wallet_riserva'");
    expect(iValidazione).toBeGreaterThan(-1);
    expect(iRpc).toBeGreaterThan(iValidazione);
  });
});

describe('/api/wallet/admin: rimborso manuale Stripe (b.162, punto 3)', () => {
  const src = leggi('app/api/wallet/admin/route.js');

  it("azione 'rimborso' esiste, valida utente e minuti come 'accredita', e scala (secondi negativi)", () => {
    const i = src.indexOf("if (azione === 'rimborso') {");
    expect(i).toBeGreaterThan(-1);
    const blocco = src.slice(i, src.indexOf("if (azione === 'voucher')"));
    expect(blocco).toContain('utenteEsiste');
    expect(blocco).toContain("tipo: 'rimborso'");
    expect(blocco).toContain('secondi: -Math.round(minuti * 60)');
  });

  it('nessun webhook Stripe automatico: charge.refunded/charge.dispute.created non sono gestiti nel webhook esistente', () => {
    const webhook = leggi('app/api/stripe/webhook/route.js');
    expect(webhook).not.toContain("event.type === 'charge.refunded'");
    expect(webhook).not.toContain("event.type === 'charge.dispute.created'");
  });
});

describe('Cron rilascio riserve scadute: la funzione SQL di migrazione 010 non restava orfana (b.162-bis, lacuna del proprio audit)', () => {
  it("la rotta cron esiste, richiede ADMIN_PASS o CRON_SECRET (timing-safe), chiama wallet_rilascia_riserve_scadute", () => {
    const src = leggi('app/api/wallet/cron-rilascia-riserve/route.js');
    // b.363 — l'import ha guadagnato withApiGuard (il tetto ai tentativi
    // messo sulla rotta oggi): qui conta che safeCompare arrivi ancora da
    // apiGuard.js, non l'elenco letterale di cosa altro viaggia con lei.
    expect(src).toMatch(/import \{[^}]*\bsafeCompare\b[^}]*\} from '\.\.\/\.\.\/\.\.\/lib\/apiGuard\.js';/);
    expect(src).toContain('safeCompare(pass, process.env.ADMIN_PASS)');
    expect(src).toContain('safeCompare(pass, process.env.CRON_SECRET)');
    expect(src).toContain("db().rpc('wallet_rilascia_riserve_scadute')");
  });

  it('vercel.json ha una voce cron per la nuova rotta', () => {
    const conf = JSON.parse(leggi('vercel.json'));
    const voce = conf.crons.find(c => c.path === '/api/wallet/cron-rilascia-riserve');
    expect(voce).toBeTruthy();
  });
});

describe('Migrazione 011: la riserva confermata diventa la riga "uso" finale, non resta orfana (b.163)', () => {
  // b.163 — BUG REALE segnalato dall'utente analizzando b.162 (non
  // trovato da un mio audit): wallet_economics/wallet_totali/
  // wallet_per_utente e wallet_uso() filtravano solo tipo='uso' (o
  // "secondi < 0" senza nettare gli offset). Una riserva confermata al
  // costo pieno restava per sempre di tipo 'riserva': spariva dai
  // secondi consumati/costi provider/numero_usi dell'Admin. Una
  // riserva rilasciata (fornitore fallito) veniva invece contata da
  // wallet_uso() come consumo vero, perche la riga positiva di
  // compensazione non era mai nettata. Il saldo restava sempre
  // corretto (per questo non l'avevo notato: avevo verificato SOLO il
  // saldo, non la contabilita analitica a valle) — la correzione e
  // stata verificata dal vivo (rollback-only) con 7 asserzioni, vedi
  // il messaggio di commit.
  const src = leggi('supabase/migrations/011_wallet_riserva_reporting.sql');

  it('wallet_riserve guadagna un puntatore alla riga di credit_ledger che rappresenta la riserva (ledger_id)', () => {
    expect(src).toContain('ALTER TABLE wallet_riserve ADD COLUMN IF NOT EXISTS ledger_id BIGINT;');
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_riserva');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit'));
    expect(blocco).toContain('RETURNING id INTO v_ledger_id;');
    expect(blocco).toContain('UPDATE wallet_riserve SET ledger_id = v_ledger_id WHERE id = v_id;');
  });

  it('wallet_commit AGGIORNA la riga esistente a tipo=uso invece di inserirne una nuova (nessuna riga rilascio_parziale)', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_release'));
    expect(blocco).toContain("UPDATE credit_ledger");
    expect(blocco).toContain("tipo = 'uso'");
    expect(blocco).toContain('secondi = -v_reali');
    expect(blocco).toContain('WHERE id = r.ledger_id');
    expect(blocco).not.toContain("INSERT INTO credit_ledger");
    expect(blocco).not.toContain('rilascio_parziale');
  });

  it('wallet_commit proporziona costo_cent al consumo reale, non lascia il costo dell\'intera riserva', () => {
    const i = src.indexOf('CREATE OR REPLACE FUNCTION wallet_commit');
    const blocco = src.slice(i, src.indexOf('CREATE OR REPLACE FUNCTION wallet_release'));
    expect(blocco).toContain("costo_cent");
    expect(blocco).toContain('v_costo_orig * v_reali / r.secondi');
  });

  it('wallet_release e wallet_rilascia_riserve_scadute azzerano la riga esistente (secondi=0) invece di inserirne una di compenso', () => {
    for (const fn of ['CREATE OR REPLACE FUNCTION wallet_release', 'CREATE OR REPLACE FUNCTION wallet_rilascia_riserve_scadute']) {
      const i = src.indexOf(fn);
      const blocco = src.slice(i, i + 1200);
      expect(blocco).toContain("UPDATE credit_ledger");
      expect(blocco).toContain("tipo = 'rilascio', secondi = 0");
      expect(blocco).toContain('WHERE id = r.ledger_id');
      expect(blocco).not.toContain('INSERT INTO credit_ledger');
    }
  });

  it('nessuna modifica alle viste economiche o a wallet_uso(): il fix e solo nel modo in cui la riga finale viene scritta', () => {
    expect(src).not.toMatch(/CREATE (OR REPLACE )?VIEW/i);
    expect(src).not.toContain('FUNCTION wallet_uso');
  });
});

describe('/api/tts-elevenlabs: RESERVE → PROVIDER → COMMIT/RELEASE esteso alla voce premium (b.164, punto 1 della roadmap utente dopo b.163)', () => {
  // b.164 — CONFERMATO dall'utente stesso ("ElevenLabs deve entrare
  // nella reservation... conserva una piccola finestra di concorrenza"),
  // blocco #1 per arrivare al 10: stessa classe di difetto gia chiusa su
  // transcribe/translate/tts (b.161-bis/b.162), qui era ancora aperta —
  // ed e' il fornitore piu caro (moltiplicatore 3x).
  const src = leggi('app/api/tts-elevenlabs/route.js');

  it('importa riserva/commit/release, non piu addebitaVocePremium/creditoInsufficiente come funzioni usate', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js';");
    expect(src).not.toContain('await addebitaVocePremium(');
    expect(src).not.toContain('await creditoInsufficiente(');
  });

  it('la riserva usa lo stesso costoPrevisto (preventivoVocePremium) poi confermato dal commit, presa PRIMA di chiamare ElevenLabs', () => {
    const iPreventivo = src.indexOf('costoPrevisto = preventivoVocePremium(cleanText.length);');
    const iRiserva = src.indexOf('const r = await riserva(pagante, costoPrevisto');
    const iFetch = src.indexOf('fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`');
    expect(iPreventivo).toBeGreaterThan(-1);
    expect(iRiserva).toBeGreaterThan(iPreventivo);
    expect(iRiserva).toBeLessThan(iFetch);
  });

  it('un fallimento della riserva blocca con 402 prima di chiamare ElevenLabs', () => {
    const iRiserva = src.indexOf('const r = await riserva(pagante, costoPrevisto');
    const i402 = src.indexOf('status: 402 }', iRiserva);
    const iFetch = src.indexOf('fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`', iRiserva);
    expect(i402).toBeGreaterThan(iRiserva);
    expect(i402).toBeLessThan(iFetch);
  });

  it('se il modello di fallback riesce si conferma la STESSA riserva presa sopra, non se ne apre una seconda', () => {
    const i = src.indexOf('if (fallback.ok) {');
    const blocco = src.slice(i, src.indexOf('return new NextResponse(buf,'));
    expect(blocco).toContain('await commit(riservaId, costoPrevisto');
    expect(blocco).toContain('riservaId = null;');
    expect(blocco).not.toContain('await riserva(');
  });

  it('se ENTRAMBI i modelli falliscono la riserva torna intera nel wallet, mai un addebito per un fornitore che non ha risposto', () => {
    expect(src).toContain("release(riservaId, 'elevenlabs_fallito')");
  });

  it('la rete di sicurezza nel catch esterno di handlePost rilascia una riserva ancora attiva per qualunque errore imprevisto', () => {
    expect(src).toContain("if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});");
  });

  it('creditoEsaurito viene derivato da creditoFinito DOPO il commit, per preservare il segnale UX gia usato dal client', () => {
    const iCommit = src.lastIndexOf('await commit(riservaId, costoPrevisto');
    const iCreditoFinito = src.indexOf('creditoEsaurito = await creditoFinito(pagante);', iCommit);
    expect(iCreditoFinito).toBeGreaterThan(iCommit);
  });

  it('b.164-bis (CONFERMATO dall\'utente): nel percorso primario il commit avviene DOPO aver letto per intero il corpo audio, non prima — altrimenti uno stream interrotto dopo il 200 OK addebita senza consegnare nulla', () => {
    const iBuffer = src.indexOf('const buffer = Buffer.from(await response.arrayBuffer());');
    const iCommit = src.lastIndexOf('await commit(riservaId, costoPrevisto');
    expect(iBuffer).toBeGreaterThan(-1);
    expect(iCommit).toBeGreaterThan(iBuffer);
  });
});

describe('/api/voice-clone: RESERVE → PROVIDER → COMMIT/RELEASE esteso alla clonazione voce (b.164, punto 2 della roadmap utente dopo b.163)', () => {
  const src = leggi('app/api/voice-clone/route.js');

  it('importa riserva/commit/release, non piu addebitaClonazione/creditoInsufficientePerClonazione come funzioni usate', () => {
    expect(src).toContain("import { riserva, commit, release } from '../../wallet/riserva.js';");
    expect(src).not.toContain('await addebitaClonazione(');
    expect(src).not.toContain('await creditoInsufficientePerClonazione(');
  });

  it('un fallimento della riserva blocca con 402 prima di chiamare ElevenLabs', () => {
    const iRiserva = src.indexOf('const r = await riserva(session.email, COSTO_CLONAZIONE_SECONDI');
    expect(iRiserva).toBeGreaterThan(-1);
    const i402 = src.indexOf('status: 402 }', iRiserva);
    const iFetch = src.indexOf("fetch('https://api.elevenlabs.io/v1/voices/add'", iRiserva);
    expect(i402).toBeGreaterThan(iRiserva);
    expect(i402).toBeLessThan(iFetch);
  });

  it('un fallimento di ElevenLabs (add o voice_id mancante) rilascia la riserva, mai un addebito per una clonazione non riuscita', () => {
    const iFetch = src.indexOf("fetch('https://api.elevenlabs.io/v1/voices/add'");
    const blocco = src.slice(iFetch);
    expect(blocco).toContain("release(riservaId, 'elevenlabs_fallito')");
    expect(blocco).toContain("release(riservaId, 'elevenlabs_no_voice_id')");
  });

  it('la riserva si conferma SOLO dopo che ElevenLabs ha restituito un voice_id valido', () => {
    const iVoiceIdCheck = src.indexOf('if (!voiceId) {');
    const iCommit = src.indexOf('await commit(riservaId, COSTO_CLONAZIONE_SECONDI');
    expect(iVoiceIdCheck).toBeGreaterThan(-1);
    expect(iCommit).toBeGreaterThan(iVoiceIdCheck);
  });

  it('la rete di sicurezza nel catch esterno di handlePost rilascia una riserva ancora attiva per qualunque errore imprevisto', () => {
    expect(src).toContain("if (riservaId) await release(riservaId, 'errore_imprevisto').catch(() => {});");
  });

  it('b.164-bis (CONFERMATO dall\'utente): il commit avviene PRIMA di salvare il record utente, cosi un updateUser fallito non rilascia un costo provider gia sostenuto', () => {
    const iCommit = src.indexOf('await commit(riservaId, COSTO_CLONAZIONE_SECONDI');
    const iUpdateUser = src.indexOf('await updateUser(session.email, {');
    expect(iCommit).toBeGreaterThan(-1);
    expect(iUpdateUser).toBeGreaterThan(iCommit);
  });

  it('il salvataggio utente dopo il commit ha un try/catch proprio, cosi un suo fallimento non risale al catch esterno che rilascerebbe un addebito ormai reale', () => {
    const iUpdateUser = src.indexOf('await updateUser(session.email, {');
    const blocco = src.slice(Math.max(0, iUpdateUser - 200), iUpdateUser + 300);
    expect(blocco).toContain('try {');
    expect(blocco).toContain('catch (e) {');
    expect(blocco).toContain('BONIFICA MANUALE');
  });
});

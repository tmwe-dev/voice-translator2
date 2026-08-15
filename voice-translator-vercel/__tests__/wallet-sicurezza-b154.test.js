// ═══════════════════════════════════════════════════════════════
// GUARDIA — falle di sicurezza/economia chiuse in b.154
//
// Nate da un audit esterno del 14/8, verificato punto per punto
// leggendo il codice e (per le RPC Supabase) interrogando dal vivo
// il progetto collegato. Questo file blocca il regresso delle
// correzioni: se qualcuno le disfa per sbaglio, questi test
// diventano rossi.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

describe('apiAuth: token invalido e accesso libero (b.154)', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('un userToken presente ma senza sessione valida viene RESPINTO, non lasciato passare', () => {
    // Prima: `if (session) {...}` senza else — session falsy cadeva nel
    // vuoto e finiva con billingEmail null, come l'accesso anonimo.
    const iSession = src.indexOf('const session = await getSession(userToken);');
    expect(iSession).toBeGreaterThan(-1);
    const dopo = src.slice(iSession, iSession + 900);
    expect(dopo).toMatch(/if\s*\(!session\)\s*\{[\s\S]*?status:\s*401/);
  });

  it('il percorso "nessun token, nessuna stanza" non esce piu subito con un return', () => {
    // Path 4 ora deve attraversare il controllo del tetto di piattaforma
    // sotto, non uscire con un return anticipato che lo salta.
    const iPath4 = src.indexOf('Path 4');
    expect(iPath4).toBeGreaterThan(-1);
    const blocco = src.slice(iPath4, src.indexOf('For ElevenLabs'));
    expect(blocco).not.toMatch(/return\s*\{\s*apiKey/);
  });

  it('il tetto di spesa DI PIATTAFORMA si controlla sempre, non solo con un billingEmail', () => {
    const iCheck = src.indexOf('Check daily spending limits');
    expect(iCheck).toBeGreaterThan(-1);
    // b.170 — finestra allargata: qui ora c'e anche la nota estesa sulla
    // riserva-budget atomica (vedi apiAuth.js), piu lunga del vecchio
    // GET+confronto che sostituisce.
    const blocco = src.slice(iCheck, iCheck + 3200);
    // Il vecchio `if (billingEmail && !isOwnKey && !skipCreditCheck)`
    // avvolgeva TUTTO, tetto di piattaforma incluso.
    expect(blocco).toMatch(/if\s*\(!isOwnKey\s*&&\s*!skipCreditCheck\)/);
    expect(blocco).toMatch(/PLATFORM_TOTAL/);
  });

  it('trackDailySpend conta anche le chiamate senza email (solo il contatore di piattaforma)', () => {
    const iFn = src.indexOf('export async function trackDailySpend');
    expect(iFn).toBeGreaterThan(-1);
    // b.170 — CONFERMATO: la forma e' cambiata (non piu un `if (!email)`
    // con ritorno anticipato, vedi la nota su BUDGET_RESERVE_CENTS in
    // config.js), ma l'intento resta lo stesso: il contatore aggregato
    // di piattaforma si aggiorna SEMPRE, quello personale solo se c'e
    // un'email da limitare.
    const corpo = src.slice(iFn, iFn + 2200);
    expect(corpo).toMatch(/if\s*\(email\)\s*await\s*somma/);
    expect(corpo).toContain('daily:platform:');
    expect(corpo).toMatch(/await\s*somma\(`daily:platform:\$\{todayUTC\}`/);
  });
});

describe('rotte a pagamento: il tracking non e piu condizionato solo a billingEmail (b.154)', () => {
  it('translate: trackDailySpend parte anche senza billingEmail', () => {
    const src = leggi('app/api/translate/route.js');
    const i = src.indexOf('bgTasks.push(trackDailySpend(billingEmail');
    expect(i).toBeGreaterThan(-1);
    // b.170 — finestra allargata: c'e anche la nota sulla riserva-budget
    // nettata (vedi apiAuth.js) fra il guardiano e questa riga.
    const prima = src.slice(Math.max(0, i - 400), i);
    // b.159 — la guardia qui era `!isOwnKey && !isReview`: da b.159
    // isReview non ha piu voce in capitolo sui soldi (vedi il file
    // wallet-sicurezza-b159.test.js), quindi resta solo `!isOwnKey`.
    expect(prima).toMatch(/if\s*\(!isOwnKey\)\s*\{/);
    expect(prima).not.toMatch(/if\s*\(billingEmail\s*&&\s*!isOwnKey\)/);
  });

  it('tts: l\'addebito personale resta condizionato alla riserva presa, il tracking no', () => {
    // b.157 — /api/tts non aveva NESSUN addebito reale (era rimasto
    // solo il vecchio deductCredits su Redis, morto): corretto con
    // addebitaTesto, il vero ponte verso il wallet.
    // b.161-bis — addebitaTesto e' diventato il commit della riserva
    // presa prima del fornitore (riservaId, non piu solo billingEmail:
    // vedi wallet-sicurezza-b161-bis.test.js).
    const src = leggi('app/api/tts/route.js');
    expect(src).toMatch(/if\s*\(riservaId\)\s*\{\s*try\s*\{\s*await commit/);
    // b.170 — trackDailySpend riceve anche la riserva-budget da nettare.
    expect(src).toMatch(/trackDailySpend\(billingEmail, charge, riservatoUtenteCents, riservatoPiattaformaCents\)\.catch/);
  });

  it('tts-elevenlabs: stessa correzione su entrambi i punti di addebito', () => {
    const src = leggi('app/api/tts-elevenlabs/route.js');
    // b.170 — ogni chiamata ora passa anche la riserva-budget da nettare
    // (vedi apiAuth.js): il regex accetta i due argomenti in piu.
    const occorrenze = src.match(/trackDailySpend\(billingEmail, charge1?(?:, riservatoUtenteCents, riservatoPiattaformaCents)?\)/g) || [];
    expect(occorrenze.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Stripe webhook: idempotenza e payment_status (b.154)', () => {
  it('la route webhook IMPORTA registraAcquistoStripe (idempotente), non registraMovimento', () => {
    // Si guarda solo la riga di import: il resto del file puo citare
    // "registraMovimento" in un commento storico senza che sia piu
    // usato nel codice — una citazione in un commento non e il difetto.
    const src = leggi('app/api/wallet/webhook/route.js');
    const rigaImportContabilita = src.split('\n').find(r => r.includes("from '../../../wallet/contabilita.js'"));
    expect(rigaImportContabilita).toContain('registraAcquistoStripe');
    expect(rigaImportContabilita).not.toContain('registraMovimento');
  });

  it('registraAcquistoStripe tratta la violazione di unicita (23505) come duplicato, non come errore', () => {
    const src = leggi('app/wallet/contabilita.js');
    const i = src.indexOf('export async function registraAcquistoStripe');
    expect(i).toBeGreaterThan(-1);
    const corpo = src.slice(i, i + 900);
    expect(corpo).toMatch(/error\.code === '23505'/);
    expect(corpo).toMatch(/duplicato:\s*true/);
  });

  it('estraiPagamento rifiuta un evento "completed" il cui pagamento non e "paid"', () => {
    const src = leggi('app/wallet/stripe.js');
    const i = src.indexOf('export function estraiPagamento');
    expect(i).toBeGreaterThan(-1);
    const corpo = src.slice(i, i + 2200);
    expect(corpo).toMatch(/payment_status/);
    // b.158 — CONFERMATO, il vecchio controllo era
    // `if (payment_status && payment_status !== 'paid') return null`:
    // un campo ASSENTE saltava il controllo e passava. Ora si richiede
    // la stringa esatta 'paid' — assente o diversa, blocca sempre.
    expect(corpo).toMatch(/payment_status\s*!==\s*'paid'/);
    expect(corpo, 'il vecchio "campo assente = passa" non deve tornare')
      .not.toMatch(/payment_status\s*&&\s*evento\.data\.object\.payment_status\s*!==\s*'paid'/);
  });

  it('estraiPagamento accetta anche async_payment_succeeded (pagamenti differiti, es. SEPA)', () => {
    // b.158 — CONFERMATO: prima solo 'checkout.session.completed' era
    // ammesso. Per un metodo di pagamento differito, quell'evento
    // arriva con payment_status 'unpaid' (scartato, giustamente) e il
    // pagamento vero va a buon fine DOPO con un evento separato — che
    // prima non era nemmeno nell'elenco ammesso: chi pagava con un
    // metodo differito non riceveva mai i secondi acquistati.
    const src = leggi('app/wallet/stripe.js');
    const i = src.indexOf('export function estraiPagamento');
    const corpo = src.slice(i, i + 2200);
    expect(corpo).toMatch(/checkout\.session\.completed/);
    expect(corpo).toMatch(/checkout\.session\.async_payment_succeeded/);
  });

  it('esiste un vincolo DB di unicita sul Stripe Session ID (migration applicata in produzione)', () => {
    const migrazione = leggi('supabase/migrations/007_wallet_webhook_idempotency.sql');
    expect(migrazione).toContain('CREATE UNIQUE INDEX');
    expect(migrazione).toContain("dettaglio->>'stripe'");
  });
});

describe('Supabase wallet: RPC pubbliche chiuse, importi negativi rifiutati (b.154)', () => {
  const migrazione = leggi('supabase/migrations/006_wallet_security_fix.sql');

  it('wallet_usa rifiuta un p_secondi non positivo', () => {
    expect(migrazione).toMatch(/p_secondi\s+IS\s+NULL\s+OR\s+p_secondi\s*<=\s*0/);
  });

  it('tutte le funzioni wallet_* sono revocate a public/anon/authenticated e concesse solo a service_role', () => {
    const funzioni = ['wallet_saldo', 'wallet_uso', 'wallet_usa', 'wallet_riscatta_voucher', 'wallet_riscatta_regalo', 'wallet_rimborsa_regali'];
    for (const f of funzioni) {
      const re = new RegExp(`REVOKE EXECUTE ON FUNCTION ${f}\\([^)]*\\) FROM PUBLIC, anon, authenticated`);
      expect(migrazione, `manca la REVOKE per ${f}`).toMatch(re);
      const reGrant = new RegExp(`GRANT EXECUTE ON FUNCTION ${f}\\([^)]*\\) TO service_role`);
      expect(migrazione, `manca la GRANT service_role per ${f}`).toMatch(reGrant);
    }
  });

  it('le viste economiche (wallet_economics/totali/per_utente) sono revocate a anon/authenticated', () => {
    for (const v of ['wallet_economics', 'wallet_totali', 'wallet_per_utente']) {
      expect(migrazione).toMatch(new RegExp(`REVOKE ALL ON ${v} FROM PUBLIC, anon, authenticated`));
    }
  });
});

describe('ContenutiChat: la striscia di link condivisi e collegata (b.154)', () => {
  it('RoomView importa e usa ContenutiChat, non e un file orfano', () => {
    const src = leggi('app/components/RoomView.js');
    expect(src).toContain("import ContenutiChat from './ContenutiChat.js'");
    expect(src).toContain('<ContenutiChat');
  });

  it('la scheda aperta dal link riusa SchedaArgomento, gia costruita per Mondo News', () => {
    const src = leggi('app/components/RoomView.js');
    expect(src).toContain("import SchedaArgomento from './SchedaArgomento.js'");
    expect(src).toContain('<SchedaArgomento');
  });

  it('/api/topics/link e SSRF-safe: passa da estraiScheda, non fa fetch dirette senza controllo', () => {
    const src = leggi('app/api/topics/link/route.js');
    expect(src).toContain("from '../../../lib/topics/estrai.js'");
    expect(src).not.toMatch(/\bfetch\(/); // nessuna fetch diretta in questa route: solo tramite estrai.js
  });
});

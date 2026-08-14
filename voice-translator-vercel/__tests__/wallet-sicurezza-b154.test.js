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
    const blocco = src.slice(iCheck, iCheck + 1600);
    // Il vecchio `if (billingEmail && !isOwnKey && !skipCreditCheck)`
    // avvolgeva TUTTO, tetto di piattaforma incluso.
    expect(blocco).toMatch(/if\s*\(!isOwnKey\s*&&\s*!skipCreditCheck\)/);
    expect(blocco).toMatch(/PLATFORM_TOTAL/);
  });

  it('trackDailySpend conta anche le chiamate senza email (solo il contatore di piattaforma)', () => {
    const iFn = src.indexOf('export async function trackDailySpend');
    expect(iFn).toBeGreaterThan(-1);
    const corpo = src.slice(iFn, iFn + 900);
    expect(corpo).toMatch(/if\s*\(!email\)\s*\{/);
    expect(corpo).toContain('daily:platform:');
  });
});

describe('rotte a pagamento: il tracking non e piu condizionato solo a billingEmail (b.154)', () => {
  it('translate: trackDailySpend parte anche senza billingEmail', () => {
    const src = leggi('app/api/translate/route.js');
    const i = src.indexOf('bgTasks.push(trackDailySpend(billingEmail');
    expect(i).toBeGreaterThan(-1);
    const prima = src.slice(Math.max(0, i - 200), i);
    expect(prima).toMatch(/if\s*\(!isOwnKey\s*&&\s*!isReview\)/);
    expect(prima).not.toMatch(/if\s*\(billingEmail\s*&&\s*!isOwnKey\s*&&\s*!isReview\)/);
  });

  it('tts: l\'addebito personale resta condizionato a billingEmail, il tracking no', () => {
    const src = leggi('app/api/tts/route.js');
    expect(src).toMatch(/if\s*\(billingEmail\)\s*\{\s*try\s*\{\s*await deductCredits/);
    expect(src).toMatch(/trackDailySpend\(billingEmail, charge\)\.catch/);
  });

  it('tts-elevenlabs: stessa correzione su entrambi i punti di addebito', () => {
    const src = leggi('app/api/tts-elevenlabs/route.js');
    const occorrenze = src.match(/trackDailySpend\(billingEmail, charge1?\)/g) || [];
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
    const corpo = src.slice(i, i + 700);
    expect(corpo).toMatch(/payment_status/);
    expect(corpo).toMatch(/!==\s*'paid'/);
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

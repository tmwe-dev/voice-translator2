import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// b.636 — LE DOMANDE INDIPENDENTI NON SI ASPETTANO A VICENDA
//
// L'audit del 05/09 ha contato, riga per riga, i viaggi di rete che
// ogni rotta della catena dell'interprete fa PRIMA di rispondere e che
// non c'entrano niente con l'IA: 14 su /api/transcribe, 13 su
// /api/translate. Con un giro che deve stare sotto i 3 secondi, quella
// e la differenza fra un ritardo che resta fermo e uno che cresce.
//
// Qui si tolgono le attese in FILA fra domande che non si leggono a
// vicenda. Nessuna decisione cambia: cambia solo chi aspetta chi.
// ═══════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

// ── Redis finto che REGISTRA L'ORDINE e tiene appese le risposte ──
// Serve a dimostrare il PARALLELISMO: se due comandi risultano gia
// partiti mentre nessuno dei due ha ancora risposto, non erano in fila.
let ordine = [];
let appese = [];
const risolviSubito = new Set(['GET']);
const mockRedis = vi.fn((cmd, chiave) => {
  ordine.push(`${cmd} ${chiave || ''}`.trim());
  if (risolviSubito.has(cmd) && String(chiave).startsWith('session:')) {
    return Promise.resolve(JSON.stringify({ email: 'tizio@esempio.it', created: 1 }));
  }
  return new Promise((res) => appese.push(res));
});
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));
vi.mock('../app/lib/encryption.js', () => ({ encryptKeys: (k) => k, decryptKeys: (k) => k }));

describe('b.636 — la sessione: rinnovo e nome partono insieme', () => {
  beforeEach(() => { ordine = []; appese = []; mockRedis.mockClear(); });

  it('il rinnovo della scadenza e la lettura del profilo sono gia partiti tutti e due', async () => {
    const { getSession } = await import('../app/lib/users.js');
    const p = getSession('gettone');
    // si lascia girare il microtask che parte dopo il GET della sessione
    await new Promise((r) => setTimeout(r, 0));

    // Nessuna delle due risposte e ancora arrivata...
    expect(appese.length, 'due comandi in volo, nessuno risolto').toBeGreaterThanOrEqual(2);
    // ...eppure sono partiti tutti e due: prima erano in fila, e il
    // secondo non esisteva finche il primo non rispondeva.
    expect(ordine).toContain('EXPIRE session:gettone');
    expect(ordine.some((c) => c.startsWith('GET user:')), 'la lettura del profilo e gia partita').toBe(true);

    appese.forEach((r) => r(null));
    await p;
  });

  it('il codice li aspetta insieme, non uno dopo l\'altro', () => {
    const src = leggi('app/lib/users.js');
    const i = src.indexOf('export async function getSession');
    const corpo = src.slice(i, i + 3000);
    expect(corpo, 'il rinnovo non ha piu un await davanti').not.toMatch(/await redis\('EXPIRE', `session:/);
    expect(corpo).toMatch(/const \[, utente\] = await Promise\.all\(\[rinnovo, nome\]\)/);
  });
});

describe('b.636 — resolveAuth: profilo e saldo partono insieme', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('getUser e creditoFinito sono nella stessa Promise.all', () => {
    expect(src).toMatch(/const \[user, senzaCredito\] = await Promise\.all\(\[\s*getUser\(billingEmail\),/);
    expect(src).toMatch(/saldoServe \? creditoFinito\(billingEmail\) : Promise\.resolve\(false\)/);
  });

  it('l\'ordine dei rifiuti non cambia: prima 401 «non esisti», poi 402 «niente credito»', () => {
    const i = src.indexOf('const [user, senzaCredito] = await Promise.all([');
    const dopo = src.slice(i, i + 6000);
    const i401 = dopo.indexOf('ERRORS.UNAUTHORIZED');
    const i402 = dopo.indexOf('ERRORS.NO_CREDITS');
    expect(i401).toBeGreaterThan(-1);
    expect(i402).toBeGreaterThan(i401);
  });

  it('il gate guarda ancora la chiave USATA, non la preferenza (b.159 non si tocca)', () => {
    expect(src).toMatch(/!isOwnKey && !skipCreditCheck && senzaCredito/);
  });
});

describe('b.636 — i due contatori giornalieri si riservano insieme', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('le due INCRBYFLOAT partono nella stessa Promise.all', () => {
    expect(src).toMatch(/const \[grezzoUtente, grezzoPiattaforma\] = await Promise\.all\(\[/);
    expect(src).toMatch(/dailyKey \? redis\('INCRBYFLOAT', dailyKey, BUDGET_RESERVE_CENTS\)/);
    expect(src).toMatch(/redis\('INCRBYFLOAT', platformDailyKey, BUDGET_RESERVE_CENTS\)/);
  });

  it('la riserva resta ATOMICA: sempre INCRBYFLOAT, mai GET + confronto (b.170)', () => {
    const i = src.indexOf('const dailyKey = billingEmail ?');
    const blocco = src.slice(i, src.indexOf('return { apiKey'));
    expect(blocco).not.toMatch(/redis\('GET', dailyKey/);
    expect(blocco).not.toMatch(/redis\('GET', platformDailyKey/);
  });

  it('c\'e UN SOLO posto che rende quello che si e preso, e lo usano tutti e due i rifiuti', () => {
    const i = src.indexOf('const rendiTutto = async () => {');
    expect(i).toBeGreaterThan(-1);
    const blocco = src.slice(i, src.indexOf('return { apiKey'));
    expect(blocco).toMatch(/DAILY_LIMIT[\s\S]{0,80}429/);
    expect(blocco).toMatch(/PLATFORM_LIMIT[\s\S]{0,80}503/);
    const chiamate = (blocco.match(/await rendiTutto\(\);/g) || []).length;
    expect(chiamate, 'tetto personale e tetto di piattaforma').toBe(2);
  });

  it('rendendo, azzera anche i valori che le rotte useranno per il netto (b.632)', () => {
    const i = src.indexOf('const rendiTutto = async () => {');
    const corpo = src.slice(i, i + 700);
    expect(corpo).toMatch(/riservatoUtenteCents = 0;/);
    expect(corpo).toMatch(/riservatoPiattaformaCents = 0;/);
  });
});

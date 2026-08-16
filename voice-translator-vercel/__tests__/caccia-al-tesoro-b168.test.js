// ═══════════════════════════════════════════════════════════════
// b.168 — Seguito dell'audit esterno del 15/8
//
// Round successivo al b.167: qui si chiudono i punti confermati
// nell'assessment ma non ancora corretti — quelli valutati "sicuri e
// necessari" (non toccano un flusso live non verificabile, non
// aspettano una decisione di prodotto). Restano fuori, con le stesse
// motivazioni gia date all'utente: rate-limiter/budget piattaforma
// fail-open, roomId a 32 bit, moderazione per nome (P0-3), doppio
// sistema di storage delle apiKeys, race in updateUser, guardia sulla
// dimensione del body basata solo su Content-Length, CSP unsafe-inline.
//
// Sei correzioni in questo round:
//   1. Taxi: la revoca chiedeva solo l'id (lo stesso che gira nel QR)
//   2. translate-free/translate-consensus: l'email per la quota
//      MyMemory arrivava dal client, mai verificata
//   3. apiAuth.js: sessione valida ma utente sparito => chiave di
//      piattaforma senza controllo credito, nessun rifiuto
//   4. /api/user delete-data: il messaggio dichiarava una cancellazione
//      totale che il codice non fa (wallet e altre sessioni restano)
//   5. OTP: il contatore tentativi viveva nello stesso JSON del codice,
//      tre round-trip non atomici — ora e una chiave separata con INCR
//   6. Service Worker: due funzioni di cache morte (TTS/translate),
//      mai chiamate da codice vivo, rimosse con le loro dipendenze
//
// CLAUDE.md, trappola 1: un difetto (o una correzione) CITATO in un
// commento non e il codice reale. Dove si controlla un testo o una
// forma di storage, questo file toglie le righe di commento PRIMA di
// cercare, cosi da non prendere per buona la propria nota esplicativa.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');

// Toglie le righe che sono SOLO commento (inizio riga, spazi + //),
// senza toccare il codice reale (anche se contiene "//" in una stringa).
const senzaCommentiDiRiga = (src) =>
  src.split('\n').filter((r) => !r.trim().startsWith('//')).join('\n');

// ── Mock Redis (in-memory, comandi realmente usati da users.js) ──
// Dichiarato a livello di modulo: vi.mock viene issato in cima al file
// dal transform di Vitest, quindi la factory non puo chiudere su una
// variabile dichiarata dentro un describe/beforeEach.
const store = {};
const ttls = {};

const mockRedis = vi.fn(async (cmd, ...args) => {
  switch (cmd) {
    case 'GET': return store[args[0]] ?? null;
    case 'SET': {
      store[args[0]] = args[1];
      if (args[2] === 'EX') ttls[args[0]] = Number(args[3]);
      return 'OK';
    }
    case 'DEL': { delete store[args[0]]; delete ttls[args[0]]; return 1; }
    case 'INCR': {
      store[args[0]] = String((parseInt(store[args[0]] || '0', 10)) + 1);
      return parseInt(store[args[0]], 10);
    }
    case 'EXPIRE': { ttls[args[0]] = Number(args[1]); return 1; }
    case 'TTL': return ttls[args[0]] ?? -1;
    default: return null;
  }
});

vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));
vi.mock('../app/lib/encryption.js', () => ({ encryptKeys: (k) => k, decryptKeys: (k) => k }));

// ───────────────────────────────────────────────────────────────
// 1. Taxi: revoca protetta da un segreto che non entra nel QR
// ───────────────────────────────────────────────────────────────
describe('Taxi: la revoca non basta piu conoscere l\'id condiviso via QR', () => {
  const dest = leggi('app/api/taxi/destination/route.js');

  it('POST genera un revokeSecret separato e lo restituisce SOLO al chiamante', () => {
    expect(dest).toContain('randomUUID()');
    expect(dest).toContain("JSON.stringify({ ciphertext, revokeSecret })");
    expect(dest).toContain('NextResponse.json({ id, revokeSecret })');
  });

  it('GET (letto dal tassista) non restituisce mai il segreto di revoca', () => {
    const getBlock = senzaCommentiDiRiga(
      dest.slice(dest.indexOf('async function handleGet'), dest.indexOf('async function handleDelete'))
    );
    expect(getBlock).toContain('NextResponse.json({ ciphertext })');
    expect(getBlock).not.toMatch(/NextResponse\.json\(\{[^}]*revokeSecret/);
  });

  it('DELETE verifica il segreto con un confronto a tempo costante prima di cancellare', () => {
    const delBlock = dest.slice(dest.indexOf('async function handleDelete'));
    expect(delBlock).toContain('safeCompare(revokeSecret, secretSalvato)');
    expect(delBlock).toContain('status: 403');
    // Il confronto avviene PRIMA della DEL, non dopo.
    const idxCompare = delBlock.indexOf('safeCompare(');
    const idxDelete = delBlock.indexOf("redis('DEL', key)");
    expect(idxCompare).toBeGreaterThan(-1);
    expect(idxDelete).toBeGreaterThan(idxCompare);
  });

  it('voci scritte prima di b.168 (ciphertext come stringa nuda) restano leggibili', () => {
    const getBlock = dest.slice(dest.indexOf('async function handleGet'), dest.indexOf('async function handleDelete'));
    expect(getBlock).toContain('ciphertext = raw;');
    const delBlock = dest.slice(dest.indexOf('async function handleDelete'));
    expect(delBlock).toMatch(/if \(secretSalvato && !safeCompare/);
  });

  // b.182 — il QR del Taxi non porta piu dentro la nostra app e non cifra
  // niente: contiene un link diretto alla mappa (Google Maps). Quindi
  // TaxiQRView non genera piu l'URL /taxi ne maneggia un segreto di
  // revoca. Il segreto di revoca resta solo un dettaglio del ROUTE server
  // (verificato dai test qui sopra), non del QR.
  it('TaxiQRView genera un link mappa diretto, non l\'URL della nostra app ne un segreto', () => {
    const view = leggi('app/components/TaxiQRView.js');
    expect(view).toContain('buildMapsUrl');
    expect(view).not.toMatch(/\/taxi\/\$\{id\}/);
    expect(view).not.toContain('revokeSecret');
  });
});

// ───────────────────────────────────────────────────────────────
// 2. translate-free / translate-consensus: email verificata via sessione
// ───────────────────────────────────────────────────────────────
describe('MyMemory non usa piu un\'email dichiarata dal client, non verificata', () => {
  for (const file of ['app/api/translate-free/route.js', 'app/api/translate-consensus/route.js']) {
    it(`${file}: emailVerificata risolve da getSession(userToken), non da body.userEmail`, () => {
      const src = leggi(file);
      expect(src).toContain('async function emailVerificata(userToken)');
      expect(src).toContain('getSession(userToken)');
      expect(src).toContain('await emailVerificata(userToken)');
      const destructureLine = src.split('\n').find((r) => r.includes('const {') && r.includes('userToken') && (r.includes('body') || r.includes('req.json')));
      expect(destructureLine, 'riga di destrutturazione del body non trovata').toBeTruthy();
      expect(destructureLine).not.toMatch(/\buserEmail\b/);
    });

    it(`${file}: senza token, l'email risolve a null (MyMemory salta, non rompe la catena)`, () => {
      const src = leggi(file);
      const fn = src.slice(src.indexOf('async function emailVerificata'), src.indexOf('async function emailVerificata') + 400);
      expect(fn).toMatch(/if \(!userToken .*\) return null;/);
    });
  }

  it('useTranslationAPI.js manda userToken invece di userEmail alle due rotte', () => {
    const src = leggi('app/hooks/useTranslationAPI.js');
    expect(src).toContain('userToken: getEffectiveToken()');
    expect(src).not.toMatch(/userEmail:\s*userEmail/);
  });
});

// ───────────────────────────────────────────────────────────────
// 3. apiAuth.js: sessione valida ma utente sparito non passa piu gratis
// ───────────────────────────────────────────────────────────────
describe('apiAuth.js: un token che punta a un utente inesistente viene rifiutato', () => {
  const src = leggi('app/lib/apiAuth.js');

  it('dopo getUser(billingEmail), user assente fa uscire con 401 PRIMA del controllo credito', () => {
    const path1 = src.slice(src.indexOf('if (userToken) {'), src.indexOf('} else if'));
    const idxGetUser = path1.indexOf('await getUser(billingEmail)');
    const idxGuard = path1.indexOf('if (!user) {');
    const idxThrow = path1.indexOf('ERRORS.UNAUTHORIZED', idxGuard);
    const idxCredito = path1.indexOf('creditoFinito(billingEmail)');
    expect(idxGetUser).toBeGreaterThan(-1);
    expect(idxGuard).toBeGreaterThan(idxGetUser);
    expect(idxThrow).toBeGreaterThan(idxGuard);
    expect(idxCredito).toBeGreaterThan(idxThrow);
  });

  it('le parentesi del blocco restano bilanciate (nessuna graffa persa nell\'inversione della guardia)', () => {
    // +1 sull'estremo destro: lo slice si ferma prima del "}" che apre
    // "} else if", ma quel "}" chiude proprio il blocco "if (userToken)"
    // che si sta misurando, quindi va incluso nel conteggio.
    const endIdx = src.indexOf('} else if') + 1;
    const path1 = src.slice(src.indexOf('if (userToken) {'), endIdx);
    const aperte = (path1.match(/\{/g) || []).length;
    const chiuse = (path1.match(/\}/g) || []).length;
    expect(chiuse).toBe(aperte);
  });
});

// ───────────────────────────────────────────────────────────────
// 4. /api/user delete-data: il messaggio descrive quello che il codice fa davvero
// ───────────────────────────────────────────────────────────────
describe('/api/user delete-data: il messaggio non promette piu una cancellazione totale', () => {
  const src = leggi('app/api/user/route.js');
  const codiceSenzaCommenti = senzaCommentiDiRiga(src);

  it('non dichiara piu "All your data has been deleted" come VALORE del messaggio (solo nella nota che spiega la modifica)', () => {
    expect(codiceSenzaCommenti).not.toContain('All your data has been deleted');
  });

  it('il nuovo messaggio nomina esplicitamente cosa resta: wallet e sessioni su altri dispositivi', () => {
    const block = codiceSenzaCommenti.slice(codiceSenzaCommenti.indexOf("action === 'delete-data'"));
    expect(block).toMatch(/wallet/i);
    expect(block).toMatch(/other devices/i);
  });

  it('deleteUserData continua a cancellare profilo, sessione corrente, referral, prestiti (non di piu)', () => {
    const users = leggi('app/lib/users.js');
    const fn = users.slice(users.indexOf('export async function deleteUserData'));
    expect(fn).toContain("deleted.push('profile')");
    expect(fn).toContain("deleted.push('session')");
    expect(fn).toContain("deleted.push('referrals')");
    expect(fn).toContain("deleted.push('lending-tokens')");
    // Non tocca il ledger Supabase del wallet: nessun riferimento a wallet/credit_ledger qui.
    expect(fn).not.toMatch(/wallet|credit_ledger/i);
  });
});

// ───────────────────────────────────────────────────────────────
// 5. OTP: contatore tentativi atomico (comportamento, non solo codice)
// ───────────────────────────────────────────────────────────────
describe('OTP: il contatore tentativi e atomico e mantiene la stessa soglia di prima (5 sbagli)', () => {
  let users;

  beforeEach(async () => {
    for (const k of Object.keys(store)) delete store[k];
    for (const k of Object.keys(ttls)) delete ttls[k];
    vi.clearAllMocks();
    users = await import('../app/lib/users.js');
  });

  it('createAuthCode azzera il contatore tentativi su una chiave SEPARATA dal codice', async () => {
    const code = await users.createAuthCode('otp@test.com');
    expect(code).toMatch(/^\d{6}$/);
    const raw = JSON.parse(store['authcode:otp@test.com']);
    expect(raw).not.toHaveProperty('attempts'); // b.168: non piu inline
    expect(raw).toHaveProperty('code', code);
    expect(store['authcode:attempts:otp@test.com']).toBeUndefined(); // DEL su chiave inesistente: niente da leggere
  });

  it('5 tentativi sbagliati sono ancora concessi, il 6° e bloccato — stessa soglia di prima', async () => {
    await users.createAuthCode('soglia@test.com');
    for (let i = 0; i < 5; i++) {
      const ok = await users.verifyAuthCode('soglia@test.com', '000000');
      expect(ok, `tentativo ${i + 1} non doveva ancora bloccare il codice`).toBe(false);
    }
    // Il codice deve esistere ancora dopo 5 tentativi sbagliati.
    expect(store['authcode:soglia@test.com']).toBeDefined();
    const ok6 = await users.verifyAuthCode('soglia@test.com', '000000');
    expect(ok6).toBe(false);
    // Il 6° tentativo consuma il codice: anche il valore giusto non passerebbe piu.
    expect(store['authcode:soglia@test.com']).toBeUndefined();
  });

  it('il codice giusto entro i 5 tentativi verifica e ripulisce codice + contatore', async () => {
    const code = await users.createAuthCode('giusto@test.com');
    const ok = await users.verifyAuthCode('giusto@test.com', code);
    expect(ok).toBe(true);
    expect(store['authcode:giusto@test.com']).toBeUndefined();
    expect(store['authcode:attempts:giusto@test.com']).toBeUndefined();
  });

  it('l\'incremento del contatore avviene PRIMA del confronto codice (anche con codice giusto, conta)', async () => {
    const code = await users.createAuthCode('conta@test.com');
    await users.verifyAuthCode('conta@test.com', 'sbagliato-1');
    await users.verifyAuthCode('conta@test.com', 'sbagliato-2');
    // A questo punto due tentativi persi; il codice esiste ancora (sotto soglia).
    expect(store['authcode:conta@test.com']).toBeDefined();
    const ok = await users.verifyAuthCode('conta@test.com', code);
    expect(ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// 6. Service Worker: cache TTS/translate morta rimossa, coda offline viva intoccata
// ───────────────────────────────────────────────────────────────
describe('Service Worker: rimossa la cache morta di TTS/translate, non la coda offline vera', () => {
  const sw = leggi('public/sw.js');
  const swSenzaCommenti = senzaCommentiDiRiga(sw);

  it('le due funzioni di cache (mai chiamate da codice vivo) non esistono piu', () => {
    expect(swSenzaCommenti).not.toContain('function handleTTSEdgeCache');
    expect(swSenzaCommenti).not.toContain('function handleTranslateCache');
  });

  it('le loro dipendenze orfane (simpleHash, openOfflineQueueDB) sono state rimosse insieme', () => {
    expect(swSenzaCommenti).not.toContain('function simpleHash');
    expect(swSenzaCommenti).not.toContain('function openOfflineQueueDB');
    // Lo store IndexedDB dedicato non e piu APERTO/USATO da codice reale
    // (il nome puo restare citato nel commento che spiega cosa e stato tolto).
    expect(swSenzaCommenti).not.toContain("'vt-offline-queue'");
  });

  it('la coda offline VERA (flushOfflineQueue / evento sync) resta intatta', () => {
    expect(sw).toContain('flushOfflineQueue');
    expect(sw).toMatch(/addEventListener\(['"]sync['"]/);
  });

  it('le funzioni di igiene cache (checkCacheSize/trimCacheBySize), non morte, restano e sono ancora chiamate', () => {
    expect(sw).toContain('function checkCacheSize');
    expect(sw).toContain('function trimCacheBySize');
    const usiCheckCacheSize = (sw.match(/checkCacheSize\(/g) || []).length;
    expect(usiCheckCacheSize).toBeGreaterThan(1);
  });

  it('le rotte /api/ restano escluse dalla cache comunque (rete diretta)', () => {
    expect(sw).toMatch(/url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
  });
});

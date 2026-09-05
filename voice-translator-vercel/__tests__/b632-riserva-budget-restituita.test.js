// ═══════════════════════════════════════════════════════════════
// b.632 — LA RISERVA DI BUDGET CHE NESSUNO RESTITUIVA
//
// Trovato dal secondo revisore della bonifica. resolveAuth riserva
// BUDGET_RESERVE_CENTS (5) sul contatore giornaliero personale E su
// quello di piattaforma prima di ogni chiamata a pagamento (b.170, per
// chiudere la finestra di corsa sui tetti). L'UNICO posto che nettava
// quella riserva era trackDailySpend — che si chiama solo quando la
// chiamata e ANDATA A BUON FINE.
//
// Ogni uscita anticipata fra le due (402 credito, 400 corpo non valido,
// 502 fornitore, testo vuoto) lasciava 5 centesimi appesi per ~25 ore.
// Non e denaro: e il TETTO DI SPESA dell'utente. Cento rifiuti di fila
// — e /api/transcribe ne fa 132 in sette giorni per audio corrotto —
// bruciano 500 centesimi su un tetto personale di 500: l'utente resta
// chiuso fuori da TUTTO per un giorno senza aver speso nulla.
//
// E in app/lib/compagni/ponte.js era peggio: trackDailySpend non ci e
// mai stato chiamato, quindi la riserva restava appesa SEMPRE, anche a
// chiamata riuscita.
// ═══════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const RADICE = path.join(__dirname, '..');
const leggi = (p) => fs.readFileSync(path.join(RADICE, p), 'utf8');
const senzaCommenti = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// ── Redis finto: basta INCRBYFLOAT/EXPIRE per i contatori giornalieri ──
const store = {};
const mockRedis = vi.fn(async (cmd, ...a) => {
  switch (cmd) {
    case 'GET': return store[a[0]] ?? null;
    case 'EXPIRE': return 1;
    case 'INCRBYFLOAT': {
      const v = (parseFloat(store[a[0]] || '0') || 0) + parseFloat(a[1]);
      store[a[0]] = String(v);
      return String(v);
    }
    default: return null;
  }
});
vi.mock('../app/lib/redis.js', () => ({ redis: (...args) => mockRedis(...args) }));
vi.mock('../app/lib/encryption.js', () => ({ encryptKeys: (k) => k, decryptKeys: (k) => k }));

const OGGI = () => new Date().toISOString().split('T')[0];

describe('b.632 — la restituzione esiste e riporta i contatori a zero', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('apiAuth esporta rilasciaRiservaGiornaliera', async () => {
    const m = await import('../app/lib/apiAuth.js');
    expect(typeof m.rilasciaRiservaGiornaliera).toBe('function');
  });

  it('storna esattamente quanto era stato riservato, su entrambi i contatori', async () => {
    const { rilasciaRiservaGiornaliera } = await import('../app/lib/apiAuth.js');
    const email = 'tizio@esempio.it';
    const kUtente = `daily:${email}:${OGGI()}`;
    const kPiattaforma = `daily:platform:${OGGI()}`;
    // simula la riserva presa da resolveAuth
    await mockRedis('INCRBYFLOAT', kUtente, 5);
    await mockRedis('INCRBYFLOAT', kPiattaforma, 5);
    expect(parseFloat(store[kUtente])).toBe(5);

    await rilasciaRiservaGiornaliera(email, 5, 5);

    expect(parseFloat(store[kUtente]), 'il tetto personale torna com era').toBe(0);
    expect(parseFloat(store[kPiattaforma]), 'il tetto di piattaforma torna com era').toBe(0);
  });

  it('cento rifiuti di fila non consumano piu il tetto personale', async () => {
    const { rilasciaRiservaGiornaliera } = await import('../app/lib/apiAuth.js');
    const email = 'audio-corrotto@esempio.it';
    const kUtente = `daily:${email}:${OGGI()}`;
    for (let i = 0; i < 100; i++) {
      await mockRedis('INCRBYFLOAT', kUtente, 5);        // resolveAuth riserva
      await rilasciaRiservaGiornaliera(email, 5, 0);      // la rotta esce con 400/402
    }
    // Prima di b.632 qui c'erano 500 centesimi: esattamente DAILY_LIMITS.PER_USER.
    expect(parseFloat(store[kUtente] || '0')).toBe(0);
  });

  it('senza riserva non tocca niente (nessuna scrittura inutile)', async () => {
    const { rilasciaRiservaGiornaliera } = await import('../app/lib/apiAuth.js');
    mockRedis.mockClear();
    await rilasciaRiservaGiornaliera('nessuno@esempio.it', 0, 0);
    expect(mockRedis).not.toHaveBeenCalled();
  });
});

describe('b.632 — ogni rotta che riserva, restituisce', () => {
  const ROTTE = [
    'app/api/transcribe/route.js',
    'app/api/tts/route.js',
    'app/api/tts-elevenlabs/route.js',
    'app/api/chat-action/route.js',
    'app/api/translate/route.js',
  ];

  for (const rotta of ROTTE) {
    it(`${rotta}: ha un finally che rende la riserva non nettata`, () => {
      const src = senzaCommenti(leggi(rotta));
      expect(src, 'deve importare la restituzione').toMatch(/rilasciaRiservaGiornaliera/);
      const iFinally = src.lastIndexOf('} finally {');
      expect(iFinally, 'serve un finally in coda al gestore').toBeGreaterThan(-1);
      const coda = src.slice(iFinally);
      expect(coda).toMatch(/rilasciaRiservaGiornaliera\(/);
    });

    it(`${rotta}: dopo trackDailySpend la riserva risulta gia nettata`, () => {
      const src = senzaCommenti(leggi(rotta));
      const i = src.indexOf('trackDailySpend(');
      expect(i).toBeGreaterThan(-1);
      const dopo = src.slice(i, i + 400);
      expect(dopo, 'la riserva va azzerata subito dopo il netto, o il finally la renderebbe due volte')
        .toMatch(/riservaGiorno = null|riservaGiornoUtente = 0/);
    });
  }

  it('translate: anche la SECONDA riserva (riscatto con gpt-4o) viene contata', () => {
    const src = senzaCommenti(leggi('app/api/translate/route.js'));
    expect(src).toMatch(/riservaGiornoUtente \+= retryAuth\.riservatoUtenteCents/);
    expect(src).toMatch(/riservaGiornoPiattaforma \+= retryAuth\.riservatoPiattaformaCents/);
  });
});

describe('b.632 — i compagni non lasciano piu appesa la riserva', () => {
  it('ponte.js rende la riserva a ognuna delle quattro autorizzazioni', () => {
    const src = senzaCommenti(leggi('app/lib/compagni/ponte.js'));
    const autorizzazioni = (src.match(/await resolveAuth\(/g) || []).length;
    const restituzioni = (src.match(/rilasciaRiservaGiornaliera\(auth\./g) || []).length;
    expect(autorizzazioni).toBeGreaterThanOrEqual(4);
    expect(restituzioni, 'una restituzione per ogni autorizzazione').toBe(autorizzazioni);
  });
});

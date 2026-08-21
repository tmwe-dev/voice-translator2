import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { safeCompare, withApiGuard } from '../../../lib/apiGuard.js';
import { randomUUID } from 'crypto';

const log = createLogger('taxi-dest');

// Max ciphertext size: ~10KB (destination JSON is small, encrypted + base64 adds overhead)
const MAX_CIPHERTEXT_LENGTH = 16_000;
// Default TTL: 4 hours
const DEFAULT_TTL_SECONDS = 14_400;
// Min TTL: 15 minutes, Max TTL: 8 hours
const MIN_TTL = 900;
const MAX_TTL = 28_800;

// ═══════════════════════════════════════════════════════════════
// POST /api/taxi/destination — Store an encrypted taxi destination
//
// PRIVACY: The server NEVER sees cleartext destination data.
// Body: { ciphertext: string, ttl?: number }
//   ciphertext = base64url(IV + AES-256-GCM encrypted JSON)
//   ttl = optional TTL in seconds (default 4h, max 8h)
// Returns: { id }
// ═══════════════════════════════════════════════════════════════
async function handlePost(req) {
  const rl = await checkRateLimit(getRateLimitKey(req, 'taxi'), 30);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  try {
    const body = await req.json();
    const { ciphertext, ttl } = body;

    // Validate ciphertext is a non-empty string within size limit
    if (!ciphertext || typeof ciphertext !== 'string') {
      return NextResponse.json({ error: 'ciphertext required' }, { status: 400 });
    }
    if (ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    // Basic base64url validation (no whitespace, only valid chars)
    if (!/^[A-Za-z0-9_-]+$/.test(ciphertext)) {
      return NextResponse.json({ error: 'Invalid ciphertext encoding' }, { status: 400 });
    }

    // TTL: configurable within bounds
    const effectiveTtl = (typeof ttl === 'number' && ttl >= MIN_TTL && ttl <= MAX_TTL)
      ? Math.floor(ttl) : DEFAULT_TTL_SECONDS;

    const id = randomUUID().split('-').slice(0, 2).join('');
    const key = `taxi:dest:${id}`;
    // b.168 — CONFERMATO (audit esterno 15/8): la revoca (DELETE, sotto)
    // chiedeva solo lo stesso `id` che il passeggero condivide col
    // tassista via QR (per il GET). Chiunque leggesse quel QR — il
    // tassista stesso, o chi lo intercettasse — poteva anche revocare la
    // destinazione al posto del passeggero. Ora POST genera un secondo
    // segreto, che NON entra mai nel QR (vedi TaxiQRView.js: solo `id` e
    // la chiave di cifratura ci vanno) e resta solo nello stato del
    // componente di chi ha creato la destinazione — l'unico che deve
    // poterla revocare.
    const revokeSecret = randomUUID();

    // Store ONLY the opaque ciphertext — no metadata, no coordinates
    await redis('SET', key, JSON.stringify({ ciphertext, revokeSecret }), 'EX', effectiveTtl);

    // Log only the ID and TTL — NEVER log destination content or coordinates
    log.info('Encrypted destination stored', { id, ttlSeconds: effectiveTtl });

    return NextResponse.json({ id, revokeSecret });
  } catch (e) {
    log.error('Store failed', { error: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/taxi/destination?id=xxx — Retrieve & delete (one-time read)
//
// PRIVACY: Returns opaque ciphertext, then DELETES from Redis.
// The server cannot read the ciphertext (no key).
// The destination can only be retrieved ONCE.
// Headers: Cache-Control: no-store (prevent caching of sensitive data)
// ═══════════════════════════════════════════════════════════════
async function handleGet(req) {
  // Rate limit retrievals too
  const rl = await checkRateLimit(getRateLimitKey(req, 'taxi-get'), 20);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id || typeof id !== 'string' || id.length > 40) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const key = `taxi:dest:${id}`;

    // ── INIZIO b.180 — IL TASSISTA VEDEVA SEMPRE "Destinazione scaduta" ──
    //
    // Provato dal vivo (15/8): aprendo il link del QR, la pagina del
    // tassista dava SEMPRE 404 "gia letta o non trovata", e non mostrava
    // ne indirizzo ne mappa. Causa: qui si usava GETDEL, cioe la
    // destinazione veniva CANCELLATA alla PRIMA lettura. Ma una prima
    // lettura non e mai garantita essere quella del tassista: un refresh
    // della pagina, un prefetch, o un ri-render che rifa la fetch bastano
    // a consumarla, e il tassista trova il vuoto. Un link che si
    // autodistrugge alla prima apertura e incompatibile con "dai al
    // tassista un link alla sua mappa": il link deve poter essere riaperto.
    //
    // Ora la lettura NON cancella piu: la destinazione resta leggibile
    // finche non scade (TTL, default 4h) o finche il passeggero non la
    // revoca (DELETE, con segreto). La privacy resta: contenuto cifrato,
    // scadenza breve, revoca a portata del passeggero.
    const raw = await redis('GET', key);

    if (!raw) {
    // ── FINE b.180 ──
      return NextResponse.json(
        { error: 'Destination not found, expired, or already retrieved' },
        { status: 404 }
      );
    }

    // b.168 — il valore salvato ora e { ciphertext, revokeSecret } (vedi
    // POST): al tassista si manda SOLO il ciphertext, il segreto di
    // revoca non deve mai lasciare il server verso chi legge, solo verso
    // chi ha creato la destinazione (gia lo riceve dalla risposta POST).
    let ciphertext;
    try {
      ciphertext = JSON.parse(raw).ciphertext;
    } catch {
      // Compatibilita con voci scritte prima di b.168 (ciphertext salvato
      // come stringa nuda, non JSON): si legge cosi com'e.
      ciphertext = raw;
    }
    if (!ciphertext) {
      return NextResponse.json(
        { error: 'Destination not found, expired, or already retrieved' },
        { status: 404 }
      );
    }

    log.info('Destination retrieved', { id }); // b.180 — non piu cancellata alla lettura

    const response = NextResponse.json({ ciphertext });
    // Prevent any caching of sensitive data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (e) {
    log.error('Retrieve failed', { error: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/taxi/destination?id=xxx — Revoke a destination
//
// Allows the passenger to cancel/revoke a shared destination
// before the driver retrieves it.
// ═══════════════════════════════════════════════════════════════
async function handleDelete(req) {
  const rl = await checkRateLimit(getRateLimitKey(req, 'taxi-del'), 10);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const revokeSecret = url.searchParams.get('revokeSecret') || '';
  if (!id || typeof id !== 'string' || id.length > 40) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const key = `taxi:dest:${id}`;
    // b.168 — CONFERMATO (audit esterno 15/8): prima bastava conoscere lo
    // stesso `id` condiviso col tassista (via QR) per revocare al posto
    // del passeggero. Ora si legge il valore, si verifica il segreto
    // (confronto a tempo costante) PRIMA di cancellare — un id senza il
    // segreto giusto non revoca niente.
    const raw = await redis('GET', key);
    if (!raw) {
      return NextResponse.json({ error: 'Not found or already expired' }, { status: 404 });
    }
    let secretSalvato = null;
    try { secretSalvato = JSON.parse(raw).revokeSecret; } catch { /* voce pre-b.168, senza segreto */ }
    if (secretSalvato && !safeCompare(revokeSecret, secretSalvato)) {
      return NextResponse.json({ error: 'Not authorized to revoke' }, { status: 403 });
    }

    const deleted = await redis('DEL', key);
    if (deleted === 0) {
      return NextResponse.json({ error: 'Not found or already expired' }, { status: 404 });
    }

    log.info('Destination revoked', { id });
    return NextResponse.json({ revoked: true });
  } catch (e) {
    log.error('Revoke failed', { error: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.363 — le tre porte erano esportate nude: il conteggio scritto a mano
// dentro handlePost non copriva ne GET ne DELETE, e nessuna delle tre
// aveva il limite alla dimensione del corpo o il rifiuto pulito di un
// corpo malformato. Ora passano tutte dalla guardia comune, con una
// chiave distinta ('taxi-dest') da quella interna ('taxi') per non
// contare due volte la stessa richiesta.
export const POST = withApiGuard(handlePost, { maxRequests: 60, prefix: 'taxi-dest' });
export const GET = withApiGuard(handleGet, { maxRequests: 60, prefix: 'taxi-dest', skipBodyCheck: true });
export const DELETE = withApiGuard(handleDelete, { maxRequests: 30, prefix: 'taxi-dest' });

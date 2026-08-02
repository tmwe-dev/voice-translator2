import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
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

    // Store ONLY the opaque ciphertext — no metadata, no coordinates
    await redis('SET', key, ciphertext, 'EX', effectiveTtl);

    // Log only the ID and TTL — NEVER log destination content or coordinates
    log.info('Encrypted destination stored', { id, ttlSeconds: effectiveTtl });

    return NextResponse.json({ id });
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

    // Atomic GET + DELETE: retrieve and delete in one operation
    // Use GETDEL (Redis 6.2+) for atomicity
    let ciphertext;
    try {
      ciphertext = await redis('GETDEL', key);
    } catch {
      // Fallback for older Redis: GET then DEL
      ciphertext = await redis('GET', key);
      if (ciphertext) await redis('DEL', key);
    }

    if (!ciphertext) {
      return NextResponse.json(
        { error: 'Destination not found, expired, or already retrieved' },
        { status: 404 }
      );
    }

    log.info('Destination retrieved and deleted', { id });

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
  if (!id || typeof id !== 'string' || id.length > 40) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const key = `taxi:dest:${id}`;
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

export const POST = handlePost;
export const GET = handleGet;
export const DELETE = handleDelete;

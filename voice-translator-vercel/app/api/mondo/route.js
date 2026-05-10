import { NextResponse } from 'next/server';
import { redis } from '../../lib/redis.js';
import { getClientIP } from '../../lib/validate.js';
import { checkRateLimit, getRateLimitKey } from '../../lib/rateLimit.js';

const MONDO_KEY = 'mondo:rooms';
const MONDO_TTL = 3600; // 1 hour

/**
 * GET /api/mondo — List public rooms
 * Returns: { rooms: [{ roomId, host, description, mode, lang, members, createdAt }] }
 */
export async function GET(req) {
  try {
    const rl = await checkRateLimit(getRateLimitKey(req, 'mondo-get'), 30);
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const raw = await redis('LRANGE', MONDO_KEY, 0, 29); // Max 30 rooms
    const rooms = (raw || []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    // Filter out expired rooms (older than 1 hour)
    const now = Date.now();
    const active = rooms.filter(r => (now - r.createdAt) < MONDO_TTL * 1000);

    return NextResponse.json({ rooms: active });
  } catch (e) {
    console.error('[Mondo] GET error:', e);
    return NextResponse.json({ rooms: [] });
  }
}

/**
 * POST /api/mondo — Publish a room as public
 * Body: { roomId, host, description, mode, lang, members }
 */
export async function POST(req) {
  try {
    const rl = await checkRateLimit(getRateLimitKey(req, 'mondo-post'), 10);
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit' }, { status: 429 });

    const { roomId, host, description, mode, lang, members, roomSessionToken, userToken } = await req.json();
    if (!roomId || !host) return NextResponse.json({ error: 'roomId and host required' }, { status: 400 });
    // Require some form of authentication to prevent spam
    if (!roomSessionToken && !userToken) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const entry = {
      roomId,
      host,
      description: (description || '').slice(0, 100),
      mode: mode || 'conversation',
      lang: lang || 'en',
      memberCount: members?.length || 1,
      createdAt: Date.now(),
    };

    // Remove existing entry for this room (prevent duplicates)
    const existing = await redis('LRANGE', MONDO_KEY, 0, -1);
    if (existing) {
      for (const raw of existing) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.roomId === roomId) {
            await redis('LREM', MONDO_KEY, 1, raw);
          }
        } catch (e) { console.warn('[mondo] JSON parse error:', e?.message); }
      }
    }

    // Add to front
    await redis('LPUSH', MONDO_KEY, JSON.stringify(entry));
    await redis('LTRIM', MONDO_KEY, 0, 29); // Keep max 30
    await redis('EXPIRE', MONDO_KEY, MONDO_TTL);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[Mondo] POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

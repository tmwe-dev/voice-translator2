import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis.js';
import { createLogger } from '../../../lib/logger.js';
import { checkRateLimit, getRateLimitKey } from '../../../lib/rateLimit.js';
import { randomUUID } from 'crypto';

const log = createLogger('taxi-dest');

// POST /api/taxi/destination — Save a structured taxi destination
// Returns { id } — a unique ID to build the QR URL
async function handlePost(req) {
  const rl = await checkRateLimit(getRateLimitKey(req, 'taxi'), 30);
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  try {
    const body = await req.json();

    // Validate required fields
    const { lat, lng, normalizedAddress } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }
    if (!normalizedAddress || typeof normalizedAddress !== 'string') {
      return NextResponse.json({ error: 'normalizedAddress required' }, { status: 400 });
    }

    // Build clean destination object (never trust client-side data blindly)
    const dest = {
      destinationName: typeof body.destinationName === 'string' ? body.destinationName.slice(0, 500) : '',
      originalAddress: typeof body.originalAddress === 'string' ? body.originalAddress.slice(0, 1000) : '',
      normalizedAddress: normalizedAddress.slice(0, 500),
      lat,
      lng,
      terminal: typeof body.terminal === 'string' ? body.terminal.slice(0, 200) : null,
      entrance: typeof body.entrance === 'string' ? body.entrance.slice(0, 200) : null,
      stops: Array.isArray(body.stops) ? body.stops.slice(0, 5).map(s => String(s).slice(0, 200)) : null,
      flightNumber: typeof body.flightNumber === 'string' ? body.flightNumber.slice(0, 20) : null,
      hotelName: typeof body.hotelName === 'string' ? body.hotelName.slice(0, 200) : null,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
    };

    const id = randomUUID().split('-').slice(0, 2).join(''); // Short-ish ID
    const key = `taxi:dest:${id}`;

    // Store in Redis with 4-hour TTL
    await redis('SET', key, JSON.stringify(dest), 'EX', 14400);
    log.info('Destination saved', { id, lat, lng });

    return NextResponse.json({ id });
  } catch (e) {
    log.error('Save destination failed', { error: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/taxi/destination?id=xxx — Retrieve a destination
async function handleGet(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id || typeof id !== 'string' || id.length > 40) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const key = `taxi:dest:${id}`;
    const data = await redis('GET', key);
    if (!data) {
      return NextResponse.json({ error: 'Destination not found or expired' }, { status: 404 });
    }

    const dest = JSON.parse(data);
    return NextResponse.json({ destination: dest });
  } catch (e) {
    log.error('Get destination failed', { error: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = handlePost;
export const GET = handleGet;

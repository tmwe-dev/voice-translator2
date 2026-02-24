import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

function genId() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += c[Math.floor(Math.random() * c.length)];
  return id;
}

// POST: create room
export async function POST(req) {
  try {
    const { langA, langB } = await req.json();
    let id;
    for (let i = 0; i < 10; i++) {
      id = genId();
      const exists = await kv.get(`room:${id}`);
      if (!exists) break;
    }
    const room = { id, langA, langB, messages: [], ts: Date.now() };
    await kv.set(`room:${id}`, JSON.stringify(room), { ex: 3600 }); // 1h TTL
    return NextResponse.json({ id, langA, langB });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: check room  ?id=XXXX
export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get('id')?.toUpperCase();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const data = await kv.get(`room:${id}`);
    if (!data) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    const room = typeof data === 'string' ? JSON.parse(data) : data;
    return NextResponse.json({ id: room.id, langA: room.langA, langB: room.langB });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

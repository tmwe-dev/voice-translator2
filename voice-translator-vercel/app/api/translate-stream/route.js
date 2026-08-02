// DEPRECATED — endpoint removed in b.53 (dead code, 0 frontend references)
// Gutted to avoid serving stale logic. Delete this directory on next cleanup.
import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }
export async function GET() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }

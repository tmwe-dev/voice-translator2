// DEPRECATED — endpoint removed in b.53 (replaced by /api/transcribe, only referenced in comment)
import { NextResponse } from 'next/server';
export async function POST() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }

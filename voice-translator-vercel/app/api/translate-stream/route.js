// DEPRECATED — endpoint removed in b.53 (dead code, 0 frontend references)
// Gutted to avoid serving stale logic. Delete this directory on next cleanup.
//
// b.114 — in b.112 qui era stata infilata la guardia della modalita
// Diretta, con `assertCloudProcessingAllowed(req)`. Ma questa funzione
// non riceve nessun `req`: chiamare la rotta sollevava un
// ReferenceError e rispondeva 500 invece del 410 previsto. Una rotta
// morta che si e messa a mentire sul proprio stato.
//
// La guardia non serve: qui non passa nessun contenuto, si risponde
// "rimossa" e basta. E la rotta va cancellata, non curata.
import { NextResponse } from 'next/server';

export async function POST() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }
export async function GET() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }

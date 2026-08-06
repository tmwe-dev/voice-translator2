// DEPRECATED — endpoint removed in b.53 (dead code, 0 frontend references)
// Gutted to avoid serving stale logic. Delete this directory on next cleanup.
import { NextResponse } from 'next/server';
import { assertCloudProcessingAllowed, DirectModeError } from '../../lib/sessionGuard.js';
export async function POST() {
  // b.111 — la guardia mancava proprio qui. Vedi lib/modalitaSessione.js:
  // l'intestazione che la fa scattare non la mandava nessuno, quindi
  // anche dove c'era non e mai servita. Ora arriva davvero.
  try { assertCloudProcessingAllowed(req); } catch (e) {
    if (e instanceof DirectModeError) {
      return NextResponse.json({ error: e.message, direct: true }, { status: 403 });
    }
    throw e;
  }
 return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }
export async function GET() { return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 }); }

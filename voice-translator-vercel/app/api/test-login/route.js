import { NextResponse } from 'next/server';
import { createUser, getUser, createSession, saveApiKeys, maskApiKeys } from '../../lib/users.js';
import { isTestBlocked } from '../../lib/config.js';
import { safeCompare, withApiGuard } from '../../lib/apiGuard.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('testLogin');

const TEST_EMAIL = 'test@bartalk.dev';

// POST /api/test-login — Creates or restores a test account with full access
// SECURITY: requires BOTH TESTING_MODE=true AND correct ADMIN_PASS
async function handlePost(req) {
  const blocked = isTestBlocked();
  if (blocked) return blocked;

  // SECURITY: ADMIN_PASS is MANDATORY for test login — if not configured, block entirely
  const adminPass = process.env.ADMIN_PASS;
  if (!adminPass) {
    return NextResponse.json({ error: 'ADMIN_PASS not configured — test login disabled' }, { status: 403 });
  }
  let body;
  try { body = await req.clone().json(); } catch { body = {}; }
  // b.166 — CONFERMATO (caccia al tesoro): confronto diretto (!==) invece
  // di safeCompare, unica rotta rimasta cosi in tutto il repo. Mitigato dal
  // gate isTestBlocked() in produzione, ma resta rilevante sui deploy
  // preview con TESTING_MODE attivo.
  if (!safeCompare(body.adminPass, adminPass)) {
    return NextResponse.json({ error: 'Admin password required for test login' }, { status: 403 });
  }

  try {
    // Create or get test user
    let user = await getUser(TEST_EMAIL);
    if (!user) {
      user = await createUser(TEST_EMAIL, 'Test User', 'it', '/avatars/1.png');
    }

    // Set up test API keys (use platform keys from env)
    const testKeys = {};
    if (process.env.OPENAI_API_KEY) testKeys.openai = process.env.OPENAI_API_KEY;
    if (process.env.ANTHROPIC_API_KEY) testKeys.anthropic = process.env.ANTHROPIC_API_KEY;
    if (process.env.ELEVENLABS_API_KEY) testKeys.elevenlabs = process.env.ELEVENLABS_API_KEY;
    if (process.env.GOOGLE_GEMINI_KEY) testKeys.gemini = process.env.GOOGLE_GEMINI_KEY;

    if (Object.keys(testKeys).length > 0) {
      user = await saveApiKeys(TEST_EMAIL, testKeys, true);
    }

    // Create a valid session
    const token = await createSession(TEST_EMAIL);

    // Re-fetch user with decrypted keys for response
    user = await getUser(TEST_EMAIL);

    // b.166 — CONFERMATO (caccia al tesoro): questa rotta copia le CHIAVI
    // REALI DI PIATTAFORMA (OPENAI_API_KEY/ANTHROPIC_API_KEY/ecc, non solo
    // una chiave personale) nell'utente di test e le rispediva in chiaro
    // nella risposta — mascherate qui come ovunque.
    return NextResponse.json({
      ok: true,
      token,
      user: maskApiKeys({
        ...user,
        credits: 99999,
        tier: 'pro',
        useOwnKeys: true,
      }),
      platformHasElevenLabs: !!process.env.ELEVENLABS_API_KEY,
    });
  } catch (e) {
    log.error('Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// b.363 — qui si confronta la password di amministrazione, e non c'era
// NESSUN tetto al numero di tentativi: il confronto era a tempo costante
// (safeCompare) ma niente impediva di provare una password al secondo,
// all'infinito, finche non si indovina. Il gate isTestBlocked() copre la
// produzione, ma sui deploy di anteprima con TESTING_MODE acceso la porta
// era spalancata. Cinque tentativi al minuto per indirizzo: chi conosce la
// password non se ne accorge, chi la cerca a tentoni si ferma subito.
export const POST = withApiGuard(handlePost, { maxRequests: 5, prefix: 'test-login' });

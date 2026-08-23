import { CORE_URL, signingSecret } from './config.js';

export async function gatewayHealth() {
  let signingConfigured = false;
  try { signingSecret(); signingConfigured = true; } catch { signingConfigured = false; }

  let coreOk = false;
  let coreStatus = 0;
  try {
    const r = await fetch(`${CORE_URL}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    coreStatus = r.status;
    coreOk = r.ok;
  } catch { /* core non raggiungibile */ }

  return {
    ok: signingConfigured && coreOk,
    apiVersion: 'v1',
    signingConfigured,
    core: { ok: coreOk, status: coreStatus || null },
  };
}

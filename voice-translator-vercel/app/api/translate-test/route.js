import { NextResponse } from 'next/server';
import { withApiGuard, safeCompare } from '../../lib/apiGuard.js';
import { runAllProviders } from '../../lib/providers.js';
import { findConsensus } from '../../lib/consensus.js';
import { isTestBlocked } from '../../lib/config.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('translateTest');

// ═══════════════════════════════════════════════
// Translation Test Endpoint — runs ALL providers in parallel
// Used by the Test Center page to compare translation quality
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {
    const blocked = isTestBlocked();
    if (blocked) return blocked;

    // SECURITY: ADMIN_PASS is MANDATORY for test endpoints — block if not configured
    const adminPass = process.env.ADMIN_PASS;
    if (!adminPass) {
      return NextResponse.json({ error: 'ADMIN_PASS not configured — test endpoint disabled' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const pass = searchParams.get('key') || req.headers.get('x-admin-key');
    if (!safeCompare(pass, adminPass)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // b.363 — il testo veniva mandato a TUTTI i fornitori in parallelo
    // senza che nessuno ne guardasse la lunghezza: un corpo da qualche
    // centinaio di migliaia di caratteri diventava altrettante chiamate a
    // pagamento, moltiplicate per il numero di fornitori. E le due lingue
    // finivano dentro le istruzioni mandate al modello senza controllo di
    // forma. Ottomila caratteri sono gia molto piu di una prova.
    const corpo = await req.json();
    const parola = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);
    const text = parola(corpo?.text, 8000);
    const sourceLang = parola(corpo?.sourceLang, 12);
    const targetLang = parola(corpo?.targetLang, 12);
    const userEmail = parola(corpo?.userEmail, 254);
    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const trimmed = text.trim();

    // Run all providers in parallel
    const results = await runAllProviders(trimmed, sourceLang, targetLang, userEmail);

    // Calculate consensus
    const consensusInput = results
      .filter(r => r.valid)
      .map(r => ({ text: r.text, provider: r.provider, score: r.score }));

    const consensus = findConsensus(consensusInput);

    return NextResponse.json({
      results,
      consensus: {
        text: consensus.text,
        guaranteed: consensus.guaranteed,
        confidence: consensus.confidence,
        agreedProviders: consensus.agreedProviders,
      },
      sourceText: trimmed,
      sourceLang,
      targetLang,
    });
  } catch (e) {
    log.error('Translate test error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'translate-test' });

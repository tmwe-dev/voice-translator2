import { NextResponse } from 'next/server';
import { withApiGuard } from '../../lib/apiGuard.js';
import { runAllProviders } from '../../lib/providers.js';
import { findConsensus } from '../../lib/consensus.js';

// ═══════════════════════════════════════════════
// Translation Test Endpoint — runs ALL providers in parallel
// Used by the Test Center page to compare translation quality
// ═══════════════════════════════════════════════

async function handlePost(req) {
  try {
    // Require admin pass in production to prevent abuse of platform API keys
    if (process.env.NODE_ENV === 'production' && process.env.ADMIN_PASS) {
      const { searchParams } = new URL(req.url);
      const pass = searchParams.get('key') || req.headers.get('x-admin-key');
      if (pass !== process.env.ADMIN_PASS) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const { text, sourceLang, targetLang, userEmail } = await req.json();
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
    console.error('Translate test error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withApiGuard(handlePost, { maxRequests: 30, prefix: 'translate-test' });

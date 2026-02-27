import { NextResponse } from 'next/server';
import { runAllProviders } from '../../lib/providers.js';
import { findConsensus } from '../../lib/consensus.js';

// ═══════════════════════════════════════════════
// Translation Test Endpoint — runs ALL providers in parallel
// Used by the Test Center page to compare translation quality
// ═══════════════════════════════════════════════

export async function POST(req) {
  try {
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

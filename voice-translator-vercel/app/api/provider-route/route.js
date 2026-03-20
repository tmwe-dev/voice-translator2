import { NextResponse } from 'next/server';
import { routeProvider, getRouteDescription } from '../../lib/providerRouter.js';
import { routeTTS, getAvailableTTSEngines } from '../../lib/ttsRouter.js';

/**
 * GET /api/provider-route?source=zh&target=it
 *
 * Returns the optimal provider route for a language pair.
 * Used by ProviderBadge component and debug/admin panels.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceLang = searchParams.get('source') || 'en';
    const targetLang = searchParams.get('target') || 'en';

    const route = routeProvider(sourceLang, targetLang);
    const tts = routeTTS(targetLang);
    const ttsEngines = getAvailableTTSEngines(targetLang);

    return NextResponse.json({
      translation: {
        provider: route.provider,
        reason: route.reason,
        description: getRouteDescription(route),
        confidence: route.confidence,
      },
      tts: {
        engine: tts.engine,
        voice: tts.voice,
        score: tts.score,
        fallback: tts.fallback,
        availableEngines: ttsEngines,
      },
      languages: { source: sourceLang, target: targetLang },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

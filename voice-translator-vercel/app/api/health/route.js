import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════
// Health Check endpoint — for uptime monitoring
// Now with: circuit breaker metrics, DashScope check
//
// GET /api/health
// Returns service status + dependency checks + circuit breaker state
// ═══════════════════════════════════════════════

const coldStartTime = Date.now();

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - coldStartTime) / 1000),
    version: '2.1.0',
    devMode: process.env.DEV_MODE === 'true',
    services: {},
    circuitBreakers: {},
  };

  // Check Redis
  try {
    const { redis } = await import('../../lib/redis.js');
    if (redis) {
      const start = Date.now();
      await redis('PING');
      checks.services.redis = { status: 'ok', latencyMs: Date.now() - start };
    } else {
      checks.services.redis = { status: 'not_configured' };
    }
  } catch (e) {
    checks.services.redis = { status: 'error', error: e.message };
  }

  // Check Supabase
  try {
    const { isSupabaseEnabled } = await import('../../lib/supabase.js');
    checks.services.supabase = { status: isSupabaseEnabled() ? 'ok' : 'not_configured' };
  } catch {
    checks.services.supabase = { status: 'error' };
  }

  // Check API keys (presence, not validity)
  checks.services.openai = { status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured' };
  checks.services.anthropic = { status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured' };
  checks.services.gemini = { status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured' };
  checks.services.dashscope = { status: process.env.DASHSCOPE_API_KEY ? 'configured' : 'not_configured' };
  checks.services.bigmodel = { status: process.env.BIGMODEL_API_KEY ? 'configured' : 'not_configured' };
  checks.services.elevenlabs = { status: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured' };
  checks.services.sentry = { status: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'not_configured' };
  checks.services.stripe = { status: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured' };

  // Circuit breaker metrics
  try {
    const { apiCircuitBreaker } = await import('../../lib/circuitBreaker.js');
    checks.circuitBreakers = apiCircuitBreaker.getMetrics();
    checks.openCircuits = apiCircuitBreaker.openCount;
  } catch (e) { console.warn('[health] Circuit breaker metrics fetch failed:', e?.message); }

  // Overall status
  const hasErrors = Object.values(checks.services).some(v => v.status === 'error');
  const hasOpenCircuits = checks.openCircuits > 0;
  if (hasErrors || hasOpenCircuits) checks.status = 'degraded';

  return NextResponse.json(checks, {
    status: hasErrors ? 503 : 200,
    headers: { 'Cache-Control': 'no-cache, no-store' },
  });
}

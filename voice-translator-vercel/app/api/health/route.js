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

  // Check Redis — direct test bypassing circuit breaker
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  checks.services.redis = { envSet: !!(upstashUrl && upstashToken) };
  if (upstashUrl && upstashToken) {
    try {
      const start = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(upstashUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['PING']),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      checks.services.redis.status = data.result === 'PONG' ? 'ok' : 'error';
      checks.services.redis.latencyMs = Date.now() - start;
      checks.services.redis.response = data.result || data.error || 'unknown';
      checks.services.redis.httpStatus = res.status;
    } catch (e) {
      checks.services.redis.status = 'error';
      checks.services.redis.error = e.message;
    }
  } else {
    checks.services.redis.status = 'not_configured';
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

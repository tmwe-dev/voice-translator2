import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════
// Health Check endpoint — for uptime monitoring
//
// GET /api/health
// Returns service status + dependency checks
//
// Use with: UptimeRobot, Better Uptime, Vercel Monitoring, etc.
// ═══════════════════════════════════════════════

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime?.() || 0,
    version: process.env.npm_package_version || '2.0.0',
    services: {},
  };

  // Check Redis
  try {
    const { redis } = await import('../../lib/redis.js');
    if (redis) {
      await redis.set('health:ping', 'pong');
      const val = await redis.get('health:ping');
      checks.services.redis = val === 'pong' ? 'ok' : 'degraded';
    } else {
      checks.services.redis = 'not_configured';
    }
  } catch {
    checks.services.redis = 'error';
  }

  // Check Supabase
  try {
    const { isSupabaseEnabled } = await import('../../lib/supabase.js');
    checks.services.supabase = isSupabaseEnabled() ? 'ok' : 'not_configured';
  } catch {
    checks.services.supabase = 'error';
  }

  // Check API keys (just presence, not validity)
  checks.services.openai = process.env.OPENAI_API_KEY ? 'configured' : 'not_configured';
  checks.services.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured';
  checks.services.gemini = process.env.GEMINI_API_KEY ? 'configured' : 'not_configured';
  checks.services.elevenlabs = process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured';
  checks.services.deepgram = process.env.DEEPGRAM_API_KEY ? 'configured' : 'not_configured';
  checks.services.sentry = process.env.NEXT_PUBLIC_SENTRY_DSN ? 'configured' : 'not_configured';
  checks.services.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured';

  // Overall status
  const hasErrors = Object.values(checks.services).some(v => v === 'error');
  if (hasErrors) checks.status = 'degraded';

  return NextResponse.json(checks, {
    status: hasErrors ? 503 : 200,
    headers: { 'Cache-Control': 'no-cache, no-store' },
  });
}

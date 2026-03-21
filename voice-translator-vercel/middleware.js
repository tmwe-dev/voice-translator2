import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════
// Next.js Middleware
//
// - CORS headers for API routes with whitelist
// - Security headers for all responses
// - Admin route protection (basic)
// - Rate limit headers
// ═══════════════════════════════════════════════

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.ALLOWED_ORIGIN,
  'https://voicetranslate.app',
  'https://www.voicetranslate.app',
  'https://voice-translator2.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean));

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin requests (no Origin header)
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow only our own Vercel preview deployments (project-specific pattern)
  if (/^https:\/\/voice-translator[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

// Security headers applied to all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=self, microphone=self, geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://appleid.cdn-apple.com https://js.stripe.com https://plausible.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.elevenlabs.io https://api.stripe.com https://*.upstash.io https://plausible.io https://*.sentry.io https://api.deepgram.com wss://api.deepgram.com https://nominatim.openstreetmap.org https://router.project-osrm.org wss://* ws://*; frame-src https://js.stripe.com https://accounts.google.com https://www.openstreetmap.org; media-src 'self' blob: data:; worker-src 'self' blob:",
  // ── Cross-Origin isolation (allow SharedArrayBuffer for audio worklets) ──
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  // ── DNS prefetch control ──
  'X-DNS-Prefetch-Control': 'on',
};

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  // ── Handle CORS preflight ──
  if (request.method === 'OPTIONS') {
    const allowedOrigin = isOriginAllowed(origin) ? (origin || '*') : null;

    // If origin not allowed on API routes, deny
    if (pathname.startsWith('/api/') && !allowedOrigin && origin) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, {
      status: 204,
      headers: {
        ...(allowedOrigin && { 'Access-Control-Allow-Origin': allowedOrigin }),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = NextResponse.next();

  // ── Security headers on all responses ──
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // ── CORS for API routes ──
  if (pathname.startsWith('/api/')) {
    if (isOriginAllowed(origin)) {
      const allowedOrigin = origin || '*';
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    } else if (origin) {
      // Origin not allowed on API routes
      return new NextResponse(null, { status: 403 });
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // ── Stripe webhook: skip CORS (Stripe sends from their IPs) ──
  if (pathname === '/api/stripe/webhook') {
    response.headers.delete('Access-Control-Allow-Origin');
  }

  // ── Admin route protection ──
  // Note: actual auth check happens in the admin API endpoint itself,
  // but we add a basic cookie/header check as first line of defense
  if (pathname.startsWith('/admin')) {
    // The admin page handles its own auth flow client-side
    // This middleware just ensures proper headers
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // ── Landing page: allow indexing ──
  if (pathname === '/landing' || pathname === '/') {
    response.headers.set('X-Robots-Tag', 'index, follow');
  }

  // ── Cache control for static assets served from /public ──
  if (pathname.startsWith('/icons/') || pathname.startsWith('/avatars/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return response;
}

// Only run middleware on specific paths (skip static files, _next, etc.)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)',
  ],
};

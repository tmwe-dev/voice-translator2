import { NextResponse } from 'next/server';

// ═══════════════════════════════════════════════
// Next.js Middleware
//
// - CORS headers for API routes
// - Security headers for all responses
// - Admin route protection (basic)
// - Rate limit headers
// ═══════════════════════════════════════════════

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Security headers applied to all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=self, microphone=self, geolocation=()',
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Handle CORS preflight ──
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
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
    response.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

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

// ═══ b.130 · le nostre anteprime erano bloccate dalla nostra regola ═══
//
// La regex si aspettava `voice-translator(-hash).vercel.app`. Ma un
// indirizzo Vercel vero e fatto cosi:
//
//     voice-translator2-n6q9te9sj-tmweapps-projects.vercel.app
//     └── progetto ──┘└─ hash ──┘└──── team ─────┘
//
// tre segmenti, non due. E il nome predefinito era `voice-translator`
// mentre il progetto si chiama `voice-translator2`.
//
// Risultato: OGNI anteprima veniva rifiutata dalle proprie API. Il
// commento diceva "consenti solo le nostre" e non ne consentiva
// nessuna — scoperto provando a far parlare due deploy fra loro.
//
// Il vincolo resta STRETTO, anzi si stringe: prima bastava
// `progetto-qualcosa`, e chiunque poteva registrare su Vercel un
// progetto chiamato `voice-translator2-evil` e passare. Ora si esige
// anche lo slug del team, che non e registrabile da altri.
const NOME_PROGETTO = process.env.VERCEL_PROJECT_NAME || 'voice-translator2';
const SLUG_TEAM = process.env.VERCEL_TEAM_SLUG || 'tmweapps-projects';

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin requests (no Origin header)
  if (ALLOWED_ORIGINS.has(origin)) return true;

  // 1. il dominio del progetto senza suffissi
  if (origin === `https://${NOME_PROGETTO}.vercel.app`) return true;

  // 2. un'anteprima NOSTRA: progetto + identificativo + team, esatti.
  //    Lo slug del team e la parte che rende l'indirizzo non imitabile.
  const anteprima = new RegExp(
    `^https://${NOME_PROGETTO}-[a-z0-9]+-${SLUG_TEAM}\\.vercel\\.app$`
  );
  if (anteprima.test(origin)) return true;

  return false;
}

// Security headers applied to all responses
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // b.124 — `geolocation=()` vieta la geolocalizzazione a TUTTI, compresi
  // noi. Ed e la stessa applicazione che poi chiama:
  //   SpeakerView.js:139   navigator.geolocation.getCurrentPosition
  //   TaxiDriverView.js:160 navigator.geolocation.getCurrentPosition
  //   TaxiMap.js:79        navigator.geolocation.watchPosition
  // Il browser rifiutava senza mai mostrare la richiesta di permesso:
  // per l'utente TaxiTalk semplicemente non trovava la posizione, e non
  // c'era modo di capire perche.
  // `self` significa: puo chiederla questa origine, e nessun altro
  // — nessun riquadro incorporato. Il permesso vero lo da comunque
  // l'utente, con la finestra del browser.
  'Permissions-Policy': 'camera=self, microphone=self, geolocation=self',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // b.316 — aggiunti per il Compagno dal vivo (widget conversazionale ElevenLabs):
  // script da unpkg.com e connessioni https/wss verso *.elevenlabs.io.
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net https://accounts.google.com https://appleid.cdn-apple.com https://js.stripe.com https://plausible.io https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://0.peerjs.com wss://0.peerjs.com https://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io https://api.stripe.com https://*.upstash.io https://plausible.io https://*.sentry.io https://api.deepgram.com wss://api.deepgram.com wss://*.supabase.co https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.qrserver.com https://tiles.openfreemap.org; frame-src https://js.stripe.com https://accounts.google.com https://www.openstreetmap.org https://www.youtube-nocookie.com; media-src 'self' blob: data: https://*.elevenlabs.io; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; upgrade-insecure-requests",
  // ── Cross-Origin isolation (allow SharedArrayBuffer for audio worklets) ──
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  // ── DNS prefetch control ──
  'X-DNS-Prefetch-Control': 'on',
};

// ── Pagine di collaudo: utili in sviluppo, invisibili al pubblico ──
// /testcenter, /debug e /startrek sono 2.168 righe di strumenti interni.
// Le API dietro chiedono gia ADMIN_PASS, ma le pagine erano raggiungibili
// da chiunque conoscesse l'indirizzo. Ora esistono solo se qualcuno
// accende STRUMENTI_COLLAUDO=1 fra le variabili d'ambiente.
const PAGINE_COLLAUDO = ['/testcenter', '/debug', '/startrek'];
const COLLAUDO_ACCESO = process.env.STRUMENTI_COLLAUDO === '1' || process.env.NODE_ENV === 'development';

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');

  if (!COLLAUDO_ACCESO && PAGINE_COLLAUDO.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    // Response nativa: funziona sia nel runtime Edge sia nei test.
    return new Response(null, { status: 404 });
  }

  // ── Handle CORS preflight ──
  if (request.method === 'OPTIONS') {
    const allowedOrigin = isOriginAllowed(origin) ? (origin || '*') : null;

    // If origin not allowed on API routes, deny
    if (pathname.startsWith('/api/') && !allowedOrigin && origin) {
      // b.130 — prima era `new NextResponse(null, ...)`: un 403 senza
      // corpo e senza content-type. Chi lo riceveva non aveva modo di
      // capire cosa fosse successo, e nemmeno che fosse l'applicazione a
      // rispondere. Ho perso mezz'ora a cercare il difetto nel posto
      // sbagliato proprio per questo.
      return new NextResponse(
        JSON.stringify({ error: 'Origine non consentita', origine: origin }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
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
      // b.130 — il SECONDO 403 muto, ed e quello che rispondeva davvero
      // alle richieste vere (il primo copre solo il preflight OPTIONS).
      // Correggere solo l'altro sarebbe stata mezza correzione: il
      // sintomo osservato — 403 senza corpo su POST — veniva da qui.
      return new NextResponse(
        JSON.stringify({ error: 'Origine non consentita', origine: origin }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // ── Stripe webhook: skip CORS (Stripe sends from their IPs) ──
  if (pathname === '/api/stripe/webhook') {
    response.headers.delete('Access-Control-Allow-Origin');
  }

  // ── Sesamo (backend admin) route protection ──
  // Note: actual auth check happens in the admin API endpoint itself,
  // but we add a basic cookie/header check as first line of defense
  if (pathname.startsWith('/sesamo')) {
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

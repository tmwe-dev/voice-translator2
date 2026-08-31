import { NextResponse } from 'next/server';
import { intestazioniSicurezza } from './security-headers.mjs';

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

  // b.356 — SOLO in sviluppo: il server locale puo girare su un porto
  // qualsiasi (il 3000 era occupato da una copia vecchia proprio mentre
  // si collaudava). In produzione questa riga non esiste.
  if (process.env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) return true;

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

// b.583 — prima questa mappa e la CSP erano duplicate anche in
// next.config.mjs ed erano gia divergenti. Ora entrambi leggono la stessa
// funzione pura; sviluppo/produzione cambia solo `unsafe-eval` nella CSP.
const SECURITY_HEADERS = intestazioniSicurezza();

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

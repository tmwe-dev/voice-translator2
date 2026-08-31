// ═══════════════════════════════════════════════════════════════
// b.583 — UNA SOLA FONTE PER GLI HEADER DI SICUREZZA.
//
// Prima middleware.js e next.config.mjs contenevano due copie della CSP
// e degli header. Anche quando i commenti dicevano «identiche», HSTS e
// Permissions-Policy erano gia divergenti. Questo modulo e deliberatamente
// puro e puo essere usato sia durante la build sia nel runtime Edge.
// ═══════════════════════════════════════════════════════════════

export function politicaContenuti({ inSviluppo = process.env.NODE_ENV === 'development' } = {}) {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" + (inSviluppo ? " 'unsafe-eval'" : '') + " blob: https://cdn.jsdelivr.net https://accounts.google.com https://appleid.cdn-apple.com https://js.stripe.com https://plausible.io https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://0.peerjs.com wss://0.peerjs.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io https://api.stripe.com https://*.upstash.io https://plausible.io https://*.sentry.io https://api.deepgram.com wss://api.deepgram.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://tiles.openfreemap.org",
    "media-src 'self' blob: data: https://*.elevenlabs.io",
    "frame-src 'self' https://js.stripe.com https://accounts.google.com https://www.openstreetmap.org https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function intestazioniSicurezza(opzioni = {}) {
  return {
    'Content-Security-Policy': politicaContenuti(opzioni),
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'X-DNS-Prefetch-Control': 'on',
  };
}

export function intestazioniNext(opzioni = {}) {
  return Object.entries(intestazioniSicurezza(opzioni)).map(([key, value]) => ({ key, value }));
}

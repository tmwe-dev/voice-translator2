import { withSentryConfig } from '@sentry/nextjs';

// ═══════════════════════════════════════════════════════════════
// b.363 · DUE POLITICHE DIVERSE, E NESSUNO SAPEVA QUALE VALESSE
//
// Questo elenco esisteva in DUE copie che non coincidevano: una qui e
// una in next.config.mjs (o, se stai leggendo l'altro file, viceversa).
// Non erano varianti dello stesso testo: si contraddicevano.
//
//   · qui c'era      accounts.google.com e appleid.cdn-apple.com fra gli
//                    script, tiles.openfreemap.org fra le connessioni,
//                    i caratteri di Google
//   · nell'altro     cdnjs.cloudflare.com fra gli script, *.google.com e
//                    *.googleapis.com (interi!) fra le connessioni,
//                    hooks.stripe.com fra i riquadri
//
// Il browser riceve tutte e due le intestazioni e applica la SOMMA dei
// divieti — cioe il risultato vero non era ne l'una ne l'altra, ma un
// terzo elenco che nessuno aveva mai scritto ne letto. Con l'aggravante
// che bastava toccare un file solo per credere di aver cambiato qualcosa
// e non aver cambiato niente.
//
// Ora e' UN elenco solo, copiato identico nei due file. Per ogni voce si
// e' presa la versione piu stretta delle due, e si e' buttato tutto cio
// che non risulta usato da nessuna parte nel programma:
//   cdnjs.cloudflare.com, *.google.com, *.googleapis.com,
//   hooks.stripe.com, fonts.googleapis.com, fonts.gstatic.com.
// Sono rimasti solo gli indirizzi che una pagina carica per davvero
// (accesso Google e Apple, mappe, Stripe, ElevenLabs...): un elenco che
// vieta cio che serve non e' piu severo, e' solo rotto.
//
// ATTENZIONE: se cambi qualcosa qui, cambialo anche nell'altro file.
// Non si possono mettere in comune: uno gira nel motore Edge, l'altro
// viene letto quando si costruisce il programma.
//
// L'unica differenza ammessa e' `unsafe-eval` in sviluppo: Next carica i
// suoi pezzi con `eval` e senza quel permesso la pagina locale resta
// sulla rotellina per sempre. In produzione non c'e'.
// ═══════════════════════════════════════════════════════════════
function politicaContenuti() {
  const inSviluppo = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" + (inSviluppo ? " 'unsafe-eval'" : '') + " blob: https://cdn.jsdelivr.net https://accounts.google.com https://appleid.cdn-apple.com https://js.stripe.com https://plausible.io https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://accounts.google.com https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://0.peerjs.com wss://0.peerjs.com https://*.supabase.co wss://*.supabase.co https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io https://api.stripe.com https://*.upstash.io https://plausible.io https://*.sentry.io https://api.deepgram.com wss://api.deepgram.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.qrserver.com https://tiles.openfreemap.org",
    "media-src 'self' blob: data: https://*.elevenlabs.io",
    "frame-src 'self' https://js.stripe.com https://accounts.google.com https://www.openstreetmap.org https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from bundling ws + native addons (breaks in Vercel serverless)
  serverExternalPackages: ['ws', 'bufferutil', 'utf-8-validate', '@andresaya/edge-tts'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark native ws addons as external so webpack doesn't try to bundle them
      config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate'];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: politicaContenuti() },
          // ── Prevent clickjacking ──
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // b.346 — Business incornicia lo Scanner
          // ── Prevent MIME type sniffing ──
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // ── Referrer policy: don't leak full URL to third parties ──
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // ── Permissions policy: only allow camera/mic for self ──
          {
            key: 'Permissions-Policy',
            // b.124 — vedi middleware.js: TaxiTalk usa la geolocalizzazione,
            // e qui era vietata. Le due configurazioni devono concordare.
            value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
          },
          // ── HSTS: force HTTPS ──
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // ── XSS Protection (legacy browsers) ──
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  // b.403 — il ripiego puntava a 'voicetranslate', un nome che su Sentry
  // non esiste: il conto di Luca e `bartalk`. Finche non c'e il gettone di
  // caricamento non se ne accorge nessuno (non si carica niente), ma il
  // giorno che lo si aggiunge il caricamento fallirebbe contro un progetto
  // inesistente, e il guasto arriverebbe travestito da guasto di
  // compilazione. Meglio scriverlo giusto adesso che c'e sotto gli occhi.
  org: process.env.SENTRY_ORG || 'bartalk',
  project: process.env.SENTRY_PROJECT || 'bartalk',

  // Silently skip source map upload in dev
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Don't widen the upload scope
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger
  disableLogger: true,

  // Hide source maps from browser
  hideSourceMaps: true,
});

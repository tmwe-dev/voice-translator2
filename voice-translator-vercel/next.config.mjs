import { withSentryConfig } from '@sentry/nextjs';

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
          // ── CSP: restrict resource loading to same-origin + trusted CDNs ──
          // Note: unsafe-inline for scripts is required by Next.js runtime
          // Remove 'unsafe-eval' to prevent arbitrary code execution
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://js.stripe.com https://plausible.io https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://accounts.google.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://api.openai.com https://*.google.com https://*.googleapis.com https://plausible.io https://*.sentry.io https://api.deepgram.com wss://api.deepgram.com wss://*.supabase.co https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.qrserver.com https://*.upstash.io https://api.anthropic.com https://api.elevenlabs.io https://*.elevenlabs.io wss://*.elevenlabs.io",
              "media-src 'self' blob: data:",
              "frame-src https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://www.openstreetmap.org https://www.youtube-nocookie.com",
              "worker-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // ── Prevent clickjacking ──
          { key: 'X-Frame-Options', value: 'DENY' },
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
  org: process.env.SENTRY_ORG || 'voicetranslate',
  project: process.env.SENTRY_PROJECT || 'voicetranslate',

  // Silently skip source map upload in dev
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Don't widen the upload scope
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger
  disableLogger: true,

  // Hide source maps from browser
  hideSourceMaps: true,
});

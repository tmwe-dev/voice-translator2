import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ── CSP: restrict resource loading to same-origin + trusted CDNs ──
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com https://js.stripe.com https://plausible.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.stripe.com https://api.openai.com https://*.google.com https://*.googleapis.com https://plausible.io https://*.sentry.io wss: ws:",
              "media-src 'self' blob: data:",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
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
            value: 'camera=(self), microphone=(self), geolocation=(), payment=(self)',
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

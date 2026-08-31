import { withSentryConfig } from '@sentry/nextjs';
import { intestazioniNext } from './security-headers.mjs';

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
        // b.583 — stessa fonte del middleware: non esistono piu due HSTS,
        // due Permissions-Policy o due copie della CSP da tenere a mente.
        headers: intestazioniNext(),
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

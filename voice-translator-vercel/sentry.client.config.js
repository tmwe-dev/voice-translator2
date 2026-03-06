import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session replay (errors only)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  // Filter out known noise
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'AbortError',
    'Network request failed',
    'Load failed',
    'ChunkLoadError',
  ],

  // Breadcrumbs configuration
  beforeBreadcrumb(breadcrumb) {
    // Don't log console.debug
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    return breadcrumb;
  },

  environment: process.env.NODE_ENV,
});

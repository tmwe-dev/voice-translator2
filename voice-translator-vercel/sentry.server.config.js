import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,

  ignoreErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],

  // Custom alert tags for server-side errors
  beforeSend(event) {
    if (!event.tags) event.tags = {};
    event.tags.app = 'voicetranslate';
    event.tags.app_version = '2.0.0';
    event.tags.runtime = 'server';

    // Tag by API endpoint
    const url = event.request?.url || '';
    if (url.includes('/api/translate')) event.tags.endpoint = 'translate';
    else if (url.includes('/api/room')) event.tags.endpoint = 'room';
    else if (url.includes('/api/messages')) event.tags.endpoint = 'messages';
    else if (url.includes('/api/tts')) event.tags.endpoint = 'tts';
    else if (url.includes('/api/process')) event.tags.endpoint = 'process';

    return event;
  },

  environment: process.env.NODE_ENV,
});

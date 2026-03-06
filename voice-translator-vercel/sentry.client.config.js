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
    'NotAllowedError',  // Mic permission denied (expected)
    'NotFoundError',    // No mic found (expected on desktop)
  ],

  // Breadcrumbs configuration
  beforeBreadcrumb(breadcrumb) {
    // Don't log console.debug
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    return breadcrumb;
  },

  // Tag errors with useful context before sending
  beforeSend(event) {
    // Add custom tags for filtering in Sentry dashboard
    if (!event.tags) event.tags = {};
    event.tags.app = 'voicetranslate';
    event.tags.app_version = '2.0.0';

    // Detect WebRTC errors
    if (event.exception?.values?.some(v => v.value?.includes('WebRTC') || v.value?.includes('RTCPeer'))) {
      event.tags.feature = 'webrtc';
    }
    // Detect STT errors
    if (event.exception?.values?.some(v => v.value?.includes('SpeechRecognition') || v.value?.includes('Deepgram'))) {
      event.tags.feature = 'stt';
    }
    // Detect TTS errors
    if (event.exception?.values?.some(v => v.value?.includes('TTS') || v.value?.includes('ElevenLabs'))) {
      event.tags.feature = 'tts';
    }
    return event;
  },

  environment: process.env.NODE_ENV,
});

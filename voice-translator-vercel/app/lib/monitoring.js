// ═══════════════════════════════════════════════
// Monitoring utilities — Sentry integration + health tracking
//
// Usage:
//   import { trackApiError, trackPerformance, trackUserAction } from './monitoring';
//   trackApiError('translate', error, { model: 'gpt-4o-mini' });
//   trackPerformance('stt-latency', 450, { lang: 'it' });
// ═══════════════════════════════════════════════

let Sentry = null;

async function getSentry() {
  if (Sentry) return Sentry;
  try {
    Sentry = await import('@sentry/nextjs');
    return Sentry;
  } catch {
    return null;
  }
}

/**
 * Track API errors with context
 */
export async function trackApiError(endpoint, error, extra = {}) {
  console.error(`[Monitor] API error on ${endpoint}:`, error);
  const S = await getSentry();
  if (S) {
    S.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { endpoint, source: 'api' },
      extra,
    });
  }
}

/**
 * Track performance metrics
 */
export async function trackPerformance(metric, durationMs, extra = {}) {
  const S = await getSentry();
  if (S) {
    S.addBreadcrumb({
      category: 'performance',
      message: `${metric}: ${durationMs}ms`,
      level: 'info',
      data: { metric, durationMs, ...extra },
    });
    // Custom measurement
    if (S.getActiveSpan) {
      const span = S.getActiveSpan();
      if (span) {
        span.setAttribute(`voicetranslate.${metric}`, durationMs);
      }
    }
  }
}

/**
 * Track user actions for debugging
 */
export async function trackUserAction(action, data = {}) {
  const S = await getSentry();
  if (S) {
    S.addBreadcrumb({
      category: 'user-action',
      message: action,
      level: 'info',
      data,
    });
  }
}

/**
 * Set user context for error tracking
 */
export async function setMonitoringUser(email, name) {
  const S = await getSentry();
  if (S) {
    S.setUser({
      email: email || undefined,
      username: name || undefined,
    });
  }
}

/**
 * Track WebRTC connection quality
 */
export async function trackWebRTCMetric(metric, value, extra = {}) {
  const S = await getSentry();
  if (S) {
    S.addBreadcrumb({
      category: 'webrtc',
      message: `${metric}: ${value}`,
      level: 'info',
      data: { metric, value, ...extra },
    });
  }
}

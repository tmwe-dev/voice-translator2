// ═══════════════════════════════════════════════
// Structured Logger — replaces raw console.* calls
//
// In production: only warn + error emit (debug/info silenced).
// In dev/test: all levels emit.
// All output is JSON for log aggregation (Vercel, Sentry, etc.)
// ═══════════════════════════════════════════════

const IS_PROD = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.VITEST;

// In test environment, silence everything to avoid noise in test output
// In production, only warn and error
// In dev, everything
const LOG_LEVEL = IS_TEST ? 'silent' : IS_PROD ? 'warn' : 'debug';

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const currentLevel = LEVELS[LOG_LEVEL] || LEVELS.info;

function formatMsg(level, tag, message, data) {
  if (IS_TEST) return; // silent in tests

  const entry = {
    level,
    tag,
    msg: typeof message === 'string' ? message : JSON.stringify(message),
    ...(data && typeof data === 'object' && !(data instanceof Error) ? data : {}),
    ...(data instanceof Error ? { error: data.message, stack: data.stack } : {}),
  };

  // In dev, use readable format; in prod, JSON for log aggregation
  if (!IS_PROD) {
    const prefix = `[${tag}]`;
    if (level === 'error') console.error(prefix, message, data || '');
    else if (level === 'warn') console.warn(prefix, message, data || '');
    else console.log(prefix, message, data || '');
    return;
  }

  // Production: structured JSON
  const out = JSON.stringify(entry);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

/**
 * Create a tagged logger instance.
 * @param {string} tag - component/module name, e.g. 'auth', 'tts', 'stripe'
 * @returns {Object} logger with debug/info/warn/error methods
 *
 * Usage:
 *   import { createLogger } from './logger.js';
 *   const log = createLogger('auth');
 *   log.info('Login successful', { email });
 *   log.error('OAuth failed', error);
 */
export function createLogger(tag) {
  return {
    debug: (msg, data) => currentLevel >= LEVELS.debug && formatMsg('debug', tag, msg, data),
    info:  (msg, data) => currentLevel >= LEVELS.info  && formatMsg('info',  tag, msg, data),
    warn:  (msg, data) => currentLevel >= LEVELS.warn  && formatMsg('warn',  tag, msg, data),
    error: (msg, data) => currentLevel >= LEVELS.error && formatMsg('error', tag, msg, data),
  };
}

// Default logger for quick use
export const log = createLogger('app');

// ═══════════════════════════════════════════════
// Unified API Error Response
// ═══════════════════════════════════════════════
import { NextResponse } from 'next/server';

/**
 * Create a standardized JSON error response.
 * All API routes should use this for error responses.
 *
 * @param {string} message - Human-readable error message
 * @param {number} status - HTTP status code (default 500)
 * @param {Object} [extra] - Additional fields to include in the response body
 * @returns {NextResponse}
 *
 * Usage:
 *   return apiError('Not found', 404);
 *   return apiError('Insufficient credits', 402, { credits: 0 });
 */
export function apiError(message, status = 500, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

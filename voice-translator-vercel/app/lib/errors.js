// ═══════════════════════════════════════════════════════════════
// Structured Error System — consistent error codes + messages
// Every API route uses these instead of raw strings
// Edge-compatible (no require, uses import at top)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';

export const ErrorCode = {
  // Auth
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  CREDITS_LOW: 'CREDITS_LOW',
  TIER_REQUIRED: 'TIER_REQUIRED',

  // Rate limiting
  RATE_LIMIT: 'RATE_LIMIT',
  RATE_LIMIT_USER: 'RATE_LIMIT_USER',

  // Input validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  BODY_TOO_LARGE: 'BODY_TOO_LARGE',

  // Provider errors
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TRANSLATION_FAILED: 'TRANSLATION_FAILED',
  TTS_FAILED: 'TTS_FAILED',

  // Room errors
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ENDED: 'ROOM_ENDED',
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  NOT_HOST: 'NOT_HOST',

  // General
  INTERNAL: 'INTERNAL',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  CACHE_ERROR: 'CACHE_ERROR',
};

const STATUS_MAP = {
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.CREDITS_LOW]: 402,
  [ErrorCode.TIER_REQUIRED]: 403,
  [ErrorCode.RATE_LIMIT]: 429,
  [ErrorCode.RATE_LIMIT_USER]: 429,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_FIELD]: 400,
  [ErrorCode.BODY_TOO_LARGE]: 413,
  [ErrorCode.PROVIDER_ERROR]: 502,
  [ErrorCode.PROVIDER_TIMEOUT]: 504,
  [ErrorCode.PROVIDER_UNAVAILABLE]: 503,
  [ErrorCode.TRANSLATION_FAILED]: 502,
  [ErrorCode.TTS_FAILED]: 502,
  [ErrorCode.ROOM_NOT_FOUND]: 404,
  [ErrorCode.ROOM_FULL]: 409,
  [ErrorCode.ROOM_ENDED]: 410,
  [ErrorCode.NOT_A_MEMBER]: 403,
  [ErrorCode.NOT_HOST]: 403,
  [ErrorCode.INTERNAL]: 500,
  [ErrorCode.CIRCUIT_OPEN]: 503,
  [ErrorCode.CACHE_ERROR]: 500,
};

/**
 * Create a structured API error response.
 * @param {string} code - ErrorCode enum value
 * @param {string} [message] - Human-readable message (optional override)
 * @param {object} [extra] - Additional fields (retryAfter, remaining, field, etc.)
 * @returns {{ error: { code, message, ...extra } }}
 */
export function apiError(code, message, extra = {}) {
  const status = STATUS_MAP[code] || 500;
  const body = {
    error: {
      code,
      message: message || defaultMessage(code),
      ...extra,
    },
  };

  const headers = {};
  if (extra.retryAfter) {
    headers['Retry-After'] = String(extra.retryAfter);
  }
  if (extra.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = String(extra.remaining);
  }

  return NextResponse.json(body, { status, headers });
}

function defaultMessage(code) {
  const messages = {
    [ErrorCode.AUTH_REQUIRED]: 'Authentication required',
    [ErrorCode.AUTH_INVALID]: 'Invalid authentication token',
    [ErrorCode.CREDITS_LOW]: 'Insufficient credits',
    [ErrorCode.TIER_REQUIRED]: 'This feature requires a higher tier',
    [ErrorCode.RATE_LIMIT]: 'Too many requests. Please try again later.',
    [ErrorCode.RATE_LIMIT_USER]: 'User rate limit exceeded. Please slow down.',
    [ErrorCode.INVALID_INPUT]: 'Invalid input',
    [ErrorCode.MISSING_FIELD]: 'Required field missing',
    [ErrorCode.BODY_TOO_LARGE]: 'Request body too large',
    [ErrorCode.PROVIDER_ERROR]: 'Translation provider error',
    [ErrorCode.PROVIDER_TIMEOUT]: 'Provider timed out',
    [ErrorCode.PROVIDER_UNAVAILABLE]: 'Provider temporarily unavailable',
    [ErrorCode.TRANSLATION_FAILED]: 'Translation failed validation',
    [ErrorCode.TTS_FAILED]: 'Text-to-speech failed',
    [ErrorCode.ROOM_NOT_FOUND]: 'Room not found',
    [ErrorCode.ROOM_FULL]: 'Room is full',
    [ErrorCode.ROOM_ENDED]: 'Room has ended',
    [ErrorCode.NOT_A_MEMBER]: 'Not a member of this room',
    [ErrorCode.NOT_HOST]: 'Only the host can do this',
    [ErrorCode.INTERNAL]: 'Internal server error',
    [ErrorCode.CIRCUIT_OPEN]: 'Service temporarily unavailable. Retry later.',
    [ErrorCode.CACHE_ERROR]: 'Cache error',
  };
  return messages[code] || 'An error occurred';
}

/**
 * Get HTTP status for an error code
 */
export function getErrorStatus(code) {
  return STATUS_MAP[code] || 500;
}

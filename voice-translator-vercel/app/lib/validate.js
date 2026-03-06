// ═══════════════════════════════════════════════════════════════
// Input Validation & Sanitization
// Lightweight, no external dependencies
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize a string: strip HTML tags, null bytes, and trim.
 * Prevents XSS when values are stored/rendered.
 */
export function sanitize(str, maxLen = 5000) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\0/g, '')           // null bytes
    .replace(/<[^>]*>/g, '')      // HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // control chars (keep \n \r \t)
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitize a room ID: alphanumeric + hyphens only, max 20 chars
 */
export function sanitizeRoomId(id) {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9\-]/g, '').slice(0, 20);
}

/**
 * Validate a language code: 2-5 chars, lowercase alpha + hyphens
 */
export function isValidLangCode(code) {
  if (typeof code !== 'string') return false;
  return /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(code);
}

/**
 * Sanitize a username: strip dangerous chars, max 50 chars
 */
export function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`\\]/g, '')
    .trim()
    .slice(0, 50);
}

/**
 * Validate email format (basic)
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  // Reject dangerous characters (HTML injection, null bytes, control chars)
  if (/[<>"'`\\;\x00-\x1f]/.test(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Sanitize translation text: allow most chars but strip script tags and event handlers
 */
export function sanitizeText(text, maxLen = 10000) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\0/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Rate limiter helper for API routes (IP-based, in-memory)
 * Returns { allowed, remaining, resetIn }
 */
const rateLimitStore = new Map();

export function rateLimit(ip, { maxRequests = 60, windowMs = 60000 } = {}) {
  const now = Date.now();
  const key = ip || 'unknown';
  let entry = rateLimitStore.get(key);

  // Clean expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) {
      if (now - v.start > windowMs * 2) rateLimitStore.delete(k);
    }
  }

  if (!entry || now - entry.start > windowMs) {
    entry = { count: 0, start: now };
    rateLimitStore.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetIn = Math.max(0, windowMs - (now - entry.start));

  return {
    allowed: entry.count <= maxRequests,
    remaining,
    resetIn,
  };
}

/**
 * Get client IP from Next.js request
 */
export function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || '127.0.0.1';
}

/**
 * Validate and sanitize a translations object: { langCode: translatedText }
 */
export function sanitizeTranslations(translations) {
  if (!translations || typeof translations !== 'object') return null;
  const clean = {};
  for (const [key, val] of Object.entries(translations)) {
    if (isValidLangCode(key) && typeof val === 'string') {
      clean[key] = sanitizeText(val, 10000);
    }
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

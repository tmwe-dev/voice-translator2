import { createLogger } from './logger.js';
import { checkRateLimit, getRateLimitKey } from './rateLimit.js';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const log = createLogger('apiGuard');

/**
 * Timing-safe string comparison to prevent timing attacks on secrets.
 * Returns false if either value is missing/empty.
 */
export function safeCompare(a, b) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const MAX_BODY_SIZE = 256 * 1024; // 256KB

/**
 * Extract user email from token in request body or Authorization header.
 * Used for per-user rate limiting (stricter/looser limits by tier).
 * Returns null if no user can be identified.
 */
function extractUserKey(req) {
  try {
    // Try Authorization header first (least invasive — doesn't consume body)
    const auth = req.headers.get('authorization');
    if (auth) {
      // Use a hash of the token as key (don't store raw tokens in Redis)
      const token = auth.replace('Bearer ', '');
      if (token && token.length > 10) {
        // Simple fast hash: take first 8 + last 4 chars as fingerprint
        return `usr:${token.substring(0, 8)}${token.substring(token.length - 4)}`;
      }
    }
  } catch (e) { log.warn('extractUserKey failed:', e?.message || e); }
  return null;
}

/**
 * Universal API guard — dual rate limiting (IP + user) + body size check
 * Wraps a route handler with security checks
 *
 * Rate limiting strategy:
 *  - IP-based: catches abuse from a single IP (default: 60/min)
 *  - User-based: prevents token abuse across IPs (default: 120/min, more generous)
 *  - Both must pass for the request to proceed
 *
 * @param {Function} handler - async (req) => NextResponse
 * @param {Object} opts
 * @param {number} opts.maxRequests - max requests per minute per IP (default: 60)
 * @param {number} opts.maxUserRequests - max requests per minute per user (default: 120)
 * @param {string} opts.prefix - rate limit key prefix
 * @param {number} opts.maxBodySize - max body size in bytes (default: 256KB)
 * @param {boolean} opts.skipBodyCheck - skip body size check (e.g. for GET-only)
 */
/**
 * b.118 — l'errore viene dal corpo della richiesta?
 * Si riconosce dal tipo e dal testo: sono i messaggi che i browser e
 * Node usano quando un corpo non si lascia leggere nella forma attesa.
 */
function eColpaDelCorpo(e) {
  if (!e) return false;
  if (e instanceof SyntaxError) return true;          // JSON rotto
  const m = String(e.message || '').toLowerCase();
  return /json|formdata|form data|unexpected end of|body|multipart|boundary/.test(m);
}

export function withApiGuard(handler, opts = {}) {
  const {
    maxRequests = 60,
    maxUserRequests = 120,
    prefix = 'api',
    maxBodySize = MAX_BODY_SIZE,
    skipBodyCheck = false,
  } = opts;

  return async function guardedHandler(req) {
    // 1. IP-based rate limiting
    const ipKey = getRateLimitKey(req, prefix);
    const ipRl = await checkRateLimit(ipKey, maxRequests);

    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(ipRl.retryAfterMs / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // 2. Per-user rate limiting (if identifiable)
    const userKey = extractUserKey(req);
    let userRl = { allowed: true, remaining: maxUserRequests };
    if (userKey) {
      userRl = await checkRateLimit(`${prefix}:${userKey}`, maxUserRequests);
      if (!userRl.allowed) {
        return NextResponse.json(
          { error: 'User rate limit exceeded. Please slow down.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(userRl.retryAfterMs / 1000)),
              'X-RateLimit-Limit': String(maxUserRequests),
              'X-RateLimit-Remaining': '0',
            }
          }
        );
      }
    }

    // 3. Body size check (for POST/PUT/PATCH)
    if (!skipBodyCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > maxBodySize) {
        return NextResponse.json(
          { error: `Request body too large. Maximum size is ${Math.round(maxBodySize / 1024)}KB.` },
          { status: 413 }
        );
      }
    }

    // ══════════════════════════════════════════════════════════
    // 3-bis. b.118 · UN CORPO SBAGLIATO NON E UN GUASTO NOSTRO
    //
    // Provate una per una: DODICI rotte su dodici rispondevano 500 a un
    // corpo malformato o vuoto. Nessuna esclusa. Chiunque, senza
    // credenziali, poteva farle "esplodere" a comando.
    //
    // Il danno non e il messaggio d'errore: e che quei 500 finiscono
    // nei registri e in Sentry insieme ai guasti VERI, e li seppelliscono.
    // Il monitor interno dell'app segnalava gia "High error count
    // detected" — si stava lamentando di se stesso, e nessuno guardava
    // piu quella spia.
    //
    // Un corpo che non si legge e colpa di chi lo manda: 400, non 500.
    // ══════════════════════════════════════════════════════════
    if (!skipBodyCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const tipo = req.headers.get('content-type') || '';
      if (tipo.includes('application/json')) {
        // ATTENZIONE ALLA DIFFERENZA, che i test gia scritti hanno
        // trovato prima di me: "non riesco nemmeno a PROVARE a leggere"
        // non e la stessa cosa di "ho letto ed e sbagliato".
        //
        // La prima volta avevo scritto un try/catch solo, e bastava che
        // `clone` non ci fosse perche OGNI richiesta prendesse 400:
        // l'applicazione intera, ferma. Un rimedio peggiore del male.
        //
        // Ora: se non si puo controllare, si lascia passare — sara il
        // gestore a dire la sua. Si rifiuta solo cio che si e letto e
        // che e davvero malformato.
        let copia = null;
        try { copia = req.clone(); } catch { copia = null; }
        if (copia && typeof copia.json === 'function') {
          let valido = true;
          try { await copia.json(); } catch { valido = false; }
          if (!valido) {
            return NextResponse.json(
              { error: 'Corpo della richiesta non valido: atteso JSON.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // 4. Call the actual handler with error tracking
    const startTime = Date.now();
    let response;
    try {
      response = await handler(req);
    } catch (e) {
      // b.118 — seconda rete: se il corpo era leggibile ma di forma
      // sbagliata (JSON dove serviva un modulo, per esempio), la
      // lettura fallisce DENTRO il gestore. Anche quello e un errore di
      // chi chiama, non nostro: 400, e fuori dai registri dei guasti.
      if (eColpaDelCorpo(e)) {
        return NextResponse.json(
          { error: 'Corpo della richiesta non valido o di formato inatteso.' },
          { status: 400 }
        );
      }
      // ═══ b.566 — «RIPROVA FRA POCO» NON E' «GUASTO DEL SERVER» ═══
      // Dai registri: tutti i 500 dell'applicazione erano l'interruttore
      // di Redis che si apriva. Ma un magazzino che rallenta per otto
      // secondi non e' un guasto nostro: e' un'attesa. Dirlo con un 503
      // e col tempo di riposo permette a chi chiama di riprovare da solo
      // — e a noi di distinguere, nei registri, un difetto vero da un
      // inciampo del fornitore. Con tutto uguale a 500, il difetto vero
      // resta nascosto in mezzo al rumore, che e' esattamente cosa e'
      // successo per settimane.
      if (e?.code === 'CIRCUIT_OPEN') {
        log.warn(`${prefix}: magazzino non disponibile, riprova fra ${e.retryAfterSec || 8}s`);
        return NextResponse.json(
          { error: 'Servizio momentaneamente non disponibile, riprova fra poco.', riprova: true },
          { status: 503, headers: { 'Retry-After': String(e.retryAfterSec || 8) } },
        );
      }
      // Track unhandled errors via Sentry
      trackError(prefix, e, req);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // 5. Track slow responses (>3s) and server errors (5xx)
    const duration = Date.now() - startTime;
    if (duration > 3000 || (response?.status >= 500)) {
      trackSlow(prefix, duration, response?.status, req);
    }

    // 6. Add rate limit headers to response (use the more restrictive remaining count)
    // Wrapped in try/catch: NextResponse headers can be immutable (e.g. redirect responses)
    if (response?.headers) {
      try {
        const effectiveRemaining = Math.min(ipRl.remaining, userRl.remaining);
        response.headers.set('X-RateLimit-Limit', String(maxRequests));
        response.headers.set('X-RateLimit-Remaining', String(effectiveRemaining));
      } catch { /* risposta senza intestazioni modificabili (un flusso, per esempio): i conteggi non si allegano */ }
    }

    return response;
  };
}

// ── Monitoring helpers (lazy-load Sentry to avoid import overhead) ──
let _sentry = null;
async function getSentry() {
  if (_sentry) return _sentry;
  try { _sentry = await import('@sentry/nextjs'); return _sentry; } catch (e) { log.warn('sentry import failed:', e?.message || e); return null; }
}

function trackError(endpoint, error, req) {
  log.error(`Unhandled error in ${endpoint}:`, error);
  getSentry().then(S => {
    if (!S) return;
    S.captureException(error, {
      tags: { endpoint, source: 'apiGuard', runtime: 'server' },
      extra: { method: req.method, url: req.url },
    });
  }).catch(() => {});
}

function trackSlow(endpoint, durationMs, status, req) {
  getSentry().then(S => {
    if (!S) return;
    S.addBreadcrumb({
      category: 'performance',
      message: `Slow API: ${endpoint} ${durationMs}ms (${status})`,
      level: durationMs > 5000 ? 'warning' : 'info',
      data: { endpoint, durationMs, status, method: req.method },
    });
  }).catch(() => {});
}

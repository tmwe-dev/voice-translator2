// ═══════════════════════════════════════════════════════════════
// sessionGuard — Enforces BarTalk Direct mode restrictions
//
// In Direct mode, the server MUST NOT process, store, or relay
// any message content. This guard throws if a cloud-processing
// API is called with a Direct mode session.
//
// Usage in API routes:
//   assertCloudProcessingAllowed(req)
//   → reads X-Session-Mode header
//   → throws if mode === 'direct'
//
// Usage on client:
//   isDirectMode(sessionMode)
//   → returns true if the session forbids cloud processing
// ═══════════════════════════════════════════════════════════════

import { createLogger } from './logger.js';

const log = createLogger('session-guard');

/**
 * Server-side guard. Call at the top of every API route that
 * touches message content (translate, messages, transcribe, tts, summary, etc.)
 *
 * @param {Request} req — Next.js request object
 * @throws {Error} if session is in Direct mode
 */
export function assertCloudProcessingAllowed(req) {
  const mode = req.headers.get('x-session-mode');
  if (mode === 'direct') {
    log.warn('Cloud processing blocked — Direct mode', {
      url: req.url,
      mode,
    });
    throw new DirectModeError('Cloud processing is forbidden in Direct mode');
  }
}

/**
 * Custom error class for Direct mode violations.
 * API routes can catch this to return a specific 403 response.
 */
export class DirectModeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DirectModeError';
    this.statusCode = 403;
  }
}

/**
 * Client-side check.
 * @param {string} mode — 'direct' | 'translate' | undefined
 * @returns {boolean}
 */
export function isDirectMode(mode) {
  return mode === 'direct';
}

/**
 * List of API paths that MUST be blocked in Direct mode.
 * Used by client-side code to skip requests entirely
 * (don't even send them — defense in depth with server guard).
 */
export const BLOCKED_IN_DIRECT = [
  '/api/messages',
  '/api/translate',
  '/api/translate-free',
  '/api/translate-consensus',
  '/api/transcribe',
  '/api/tts',
  '/api/tts-edge',
  '/api/tts-elevenlabs',
  '/api/summary',
  '/api/conversation',
  '/api/chat-action',
  // ── b.111 · quattro che mancavano, e non erano le meno gravi ──
  // stt-token consegna al telefono un gettone per aprire un flusso
  // audio DIRETTO verso Deepgram: in modalita Diretta e la voce, dal
  // vivo, verso un terzo. Era la falla piu grande e non era nell'elenco.
  '/api/stt-token',
  '/api/translate-stream',
  // La clonazione carica una registrazione della propria voce.
  '/api/voice-clone',
  // Le reazioni conservano il TESTO del messaggio per la vetrina
  // Community. Giusto li, sbagliato in una conversazione riservata.
  '/api/reazioni',
];

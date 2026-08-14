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
import {
  eModalitaDiretta,
  ROTTE_VIETATE_IN_DIRETTA,
  modalitaAutorevole,
} from './decisioni.js';

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
  // b.139 — il confronto non si scrive piu qui: la regola su cosa sia
  // "modalita Diretta" vive in decisioni.js, ed e la stessa che usano il
  // cancello davanti a fetch e la guardia sulla conservazione.
  if (eModalitaDiretta(mode)) {
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
  return eModalitaDiretta(mode);
}

/**
 * ── LA GUARDIA CHE NON SI FIDA DEL CLIENT (b.139) ──
 *
 * `assertCloudProcessingAllowed` sopra legge l'intestazione, che manda
 * il client: ferma il caso normale ma non difende da chi mente. Questa
 * versione chiede anche alla STANZA, quando la richiesta porta con se il
 * codice o il gettone di sessione.
 *
 * Per un client onesto non cambia niente: in una stanza Diretta queste
 * richieste non partono. Cambia per uno che non lo e.
 *
 * @param {Request} req
 * @param {{roomId?: string, roomSessionToken?: string}} riferimento
 * @throws {DirectModeError}
 */
export async function assertElaborazioneConsentita(req, riferimento = {}) {
  const modo = await modalitaAutorevole(req, riferimento);
  if (eModalitaDiretta(modo)) {
    log.warn('Elaborazione bloccata — stanza in modalita Diretta', { url: req?.url });
    throw new DirectModeError('Cloud processing is forbidden in Direct mode');
  }
}

/**
 * List of API paths that MUST be blocked in Direct mode.
 * Used by client-side code to skip requests entirely
 * (don't even send them — defense in depth with server guard).
 */
// b.139 — l'elenco stava qui, e il server non poteva confrontarlo perche
// il confronto era scritto dentro il cancello del client. Ora la copia
// buona e in decisioni.js; questo nome resta per chi lo importa gia.
export const BLOCKED_IN_DIRECT = ROTTE_VIETATE_IN_DIRETTA;

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
import { eModalitaDiretta, modalitaDiStanza } from './decisioni.js';

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
// buona e in decisioni.js.
// b.601 — l'alias `BLOCKED_IN_DIRECT` (= ROTTE_VIETATE_IN_DIRETTA) e'
// stato tolto: lo importavano SOLO tre prove, e due nomi per la stessa
// lista sono il modo in cui le copie ricominciano a divergere. Chi la
// vuole la importa da decisioni.js con il suo nome.

/**
 * ── IL SERVER NON DEVE FIDARSI DELL'INTESTAZIONE ──
 *
 * `assertCloudProcessingAllowed()` legge `x-session-mode`, che arriva
 * dal client. Va benissimo come PRIMO filtro — costa niente e ferma il
 * caso normale — ma non e una difesa: chi manda la richiesta sceglie
 * cosa scriverci dentro. Una promessa sulla riservatezza non puo
 * poggiare su un dato che decide la parte da cui ci si difende.
 *
 * Questa funzione risponde alla stessa domanda leggendo la STANZA,
 * quando la richiesta porta con se un modo di identificarla (il codice
 * della stanza o il gettone di sessione). Se la stanza risulta Diretta,
 * e Diretta — qualunque cosa dica l'intestazione.
 *
 * Non cambia nulla per un client onesto: in una stanza Diretta queste
 * richieste non partono proprio. Cambia tutto per uno che mente.
 *
 * Torna 'direct' | 'translate'.
 */
export async function modalitaAutorevole(req, riferimento = {}) {
  // 1. Quel che dice il client. Se dice "direct", ci si crede subito:
  //    dichiararsi piu riservati di quello che si e non fa danno.
  const dichiarata = req && req.headers && typeof req.headers.get === 'function'
    ? req.headers.get('x-session-mode')
    : null;
  if (eModalitaDiretta(dichiarata)) return 'direct';

  // 2. Quel che dice la stanza. Questa e la parola che conta.
  const { roomId, roomSessionToken } = riferimento;
  if (!roomId && !roomSessionToken) return 'translate';

  try {
    // b.601 — l'import dello store resta PIGRO, ma per un altro motivo di
    // prima: non piu' per nascondere un ciclo (non c'e': questo file sta
    // sopra lo store e nessuno sotto lo importa), ma perche' sessionGuard
    // e' importato anche dal client (useTranslationAPI → isDirectMode) e
    // lo store tira dentro Redis: nel pacchetto del browser non deve
    // finire. Un import pigro in un ramo che il client non percorre mai
    // resta fuori dal bundle.
    const { getRoom, verifyRoomSession } = await import('./store.js');
    let codice = roomId;
    if (!codice && roomSessionToken) {
      const sessione = await verifyRoomSession(roomSessionToken);
      codice = sessione && sessione.roomId;
    }
    if (!codice) return 'translate';
    const stanza = await getRoom(codice);
    return modalitaDiStanza(stanza);
  } catch {
    // Archivio irraggiungibile: non si INVENTA una modalita Diretta che
    // bloccherebbe una stanza normale, e non si nega quella dichiarata —
    // il passo 1 l'ha gia onorata. Resta il comportamento di sempre.
    return 'translate';
  }
}


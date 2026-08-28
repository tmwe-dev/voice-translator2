// Circuit Breaker pattern for API calls
// CLOSED → OPEN (after N failures) → HALF_OPEN (after cooldown) → CLOSED (on success)
// Now with: TTL auto-cleanup, maxCircuits limit, metrics

import { createLogger } from './logger.js';

const log = createLogger('circuitBreaker');
const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

const MAX_CIRCUITS = 100;
const CIRCUIT_TTL_MS = 5 * 60 * 1000; // Auto-delete inactive circuits after 5min

class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 30000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.circuits = new Map(); // key → { state, failures, lastFailure, lastAccess }
    this._cleanupTimer = null;
  }

  _getCircuit(key) {
    if (!this.circuits.has(key)) {
      // Enforce max size — evict oldest accessed
      if (this.circuits.size >= MAX_CIRCUITS) {
        let oldest = null;
        let oldestTime = Infinity;
        for (const [k, v] of this.circuits) {
          if (v.lastAccess < oldestTime) {
            oldest = k;
            oldestTime = v.lastAccess;
          }
        }
        if (oldest) this.circuits.delete(oldest);
      }
      this.circuits.set(key, { state: STATE.CLOSED, failures: 0, lastFailure: 0, lastAccess: Date.now() });
    }
    const c = this.circuits.get(key);
    c.lastAccess = Date.now();
    return c;
  }

  /**
   * Periodically clean up expired circuits (call in long-running processes)
   */
  startAutoCleanup(intervalMs = 60000) {
    if (this._cleanupTimer) return;
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, c] of this.circuits) {
        if (now - c.lastAccess > CIRCUIT_TTL_MS && c.state === STATE.CLOSED) {
          this.circuits.delete(key);
        }
      }
    }, intervalMs);
    // Don't prevent Node.js exit
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }

  canExecute(key) {
    const c = this._getCircuit(key);
    if (c.state === STATE.CLOSED) return true;
    if (c.state === STATE.OPEN) {
      if (Date.now() - c.lastFailure > this.cooldownMs) {
        c.state = STATE.HALF_OPEN;
        return true;
      }
      return false;
    }
    // HALF_OPEN: allow one attempt
    return true;
  }

  async execute(key, fn) {
    if (!this.canExecute(key)) {
      const c = this._getCircuit(key);
      const retryIn = Math.ceil((this.cooldownMs - (Date.now() - c.lastFailure)) / 1000);
      const err = new Error(`Circuit OPEN for ${key} — retry after ${retryIn}s`);
      err.code = 'CIRCUIT_OPEN';
      err.retryAfterSec = retryIn;
      throw err;
    }
    const c = this._getCircuit(key);
    try {
      const result = await fn();
      // Success: reset circuit
      c.state = STATE.CLOSED;
      c.failures = 0;
      return result;
    } catch (err) {
      c.failures++;
      c.lastFailure = Date.now();
      if (c.failures >= this.failureThreshold) {
        c.state = STATE.OPEN;
        log.warn(`${key} OPEN after ${c.failures} failures`);
      }
      throw err;
    }
  }

  reset(key) {
    this.circuits.delete(key);
  }

  getState(key) {
    return this._getCircuit(key).state;
  }

  /**
   * Get metrics for all circuits (for /api/health)
   */
  getMetrics() {
    const metrics = {};
    for (const [key, c] of this.circuits) {
      metrics[key] = { state: c.state, failures: c.failures, lastFailure: c.lastFailure };
    }
    return metrics;
  }

  /**
   * Total open circuits count
   */
  get openCount() {
    let count = 0;
    for (const [, c] of this.circuits) {
      if (c.state === STATE.OPEN) count++;
    }
    return count;
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this.circuits.clear();
  }
}

export const apiCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 30000 });

// ═══ b.566 — REDIS HA UN INTERRUTTORE SUO, PIU PAZIENTE ═══
// Dai registri di produzione: TUTTI i 500 dell'applicazione — stanze,
// messaggi, reazioni — avevano una sola causa, «Circuit OPEN for
// redis:upstash». Non e' Redis che si rompe: e' che con tre inciampi
// l'interruttore restava aperto TRENTA SECONDI, e in quei trenta
// secondi ogni chiamata falliva in partenza. Un rallentamento di un
// istante diventava mezzo minuto di applicazione ferma.
// Cinque tentativi prima di aprire (Redis inciampa e si riprende), e
// otto secondi di riposo invece di trenta: si apre a fatica e si
// richiude in fretta. I trenta secondi restano per i fornitori di
// intelligenza, dove un errore costa davvero e ritentare costa di piu.
export const redisCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 8000 });
export default CircuitBreaker;

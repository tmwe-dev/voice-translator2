// Circuit Breaker pattern for API calls
// CLOSED → OPEN (after N failures) → HALF_OPEN (after cooldown) → CLOSED (on success)

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  constructor({ failureThreshold = 3, cooldownMs = 30000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.circuits = new Map(); // key → { state, failures, lastFailure }
  }

  _getCircuit(key) {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, { state: STATE.CLOSED, failures: 0, lastFailure: 0 });
    }
    return this.circuits.get(key);
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
      throw new Error(`Circuit OPEN for ${key} — retry after ${Math.ceil((this.cooldownMs - (Date.now() - this._getCircuit(key).lastFailure)) / 1000)}s`);
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
        console.warn(`[CircuitBreaker] ${key} OPEN after ${c.failures} failures`);
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
}

export const apiCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 30000 });
export default CircuitBreaker;

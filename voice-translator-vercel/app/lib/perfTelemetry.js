// ═══════════════════════════════════════════════
// Performance Telemetry — Measure latency at every pipeline stage
//
// Tracks:
// - STT latency (recording stop → transcription ready)
// - Translation latency (text ready → translation ready)
// - Message delivery latency (send → partner receives)
// - TTS latency (translation ready → first audio byte)
// - Total end-to-end latency (user speaks → partner hears translation)
//
// Data is logged to console and optionally sent to a monitoring endpoint.
// Uses Performance API for high-resolution timestamps.
// ═══════════════════════════════════════════════

const PERF_LOG_SIZE = 50; // Keep last 50 measurements per metric

class PerfTelemetry {
  constructor() {
    this.metrics = new Map(); // metric name → array of { value, ts }
    this.marks = new Map();   // active timing marks
  }

  /**
   * Start timing a named operation.
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }

  /**
   * End timing and record the measurement.
   * @returns {number} elapsed milliseconds
   */
  measure(name) {
    const start = this.marks.get(name);
    if (start === undefined) return -1;
    const elapsed = Math.round(performance.now() - start);
    this.marks.delete(name);

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const arr = this.metrics.get(name);
    arr.push({ value: elapsed, ts: Date.now() });
    if (arr.length > PERF_LOG_SIZE) arr.shift();

    // Log significant measurements
    if (elapsed > 100) {
      console.log(`[Perf] ${name}: ${elapsed}ms`);
    }

    return elapsed;
  }

  /**
   * Record a measurement directly (no mark/measure pair).
   */
  record(name, valueMs) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const arr = this.metrics.get(name);
    arr.push({ value: Math.round(valueMs), ts: Date.now() });
    if (arr.length > PERF_LOG_SIZE) arr.shift();
  }

  /**
   * Get average latency for a metric (last N measurements).
   */
  getAverage(name, lastN = 10) {
    const arr = this.metrics.get(name);
    if (!arr || arr.length === 0) return 0;
    const slice = arr.slice(-lastN);
    return Math.round(slice.reduce((a, b) => a + b.value, 0) / slice.length);
  }

  /**
   * Get P95 latency for a metric.
   */
  getP95(name) {
    const arr = this.metrics.get(name);
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a.value - b.value);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)].value;
  }

  /**
   * Get a summary of all metrics (for display in debug panel).
   */
  getSummary() {
    const summary = {};
    for (const [name, arr] of this.metrics) {
      if (arr.length === 0) continue;
      const last = arr[arr.length - 1].value;
      const avg = this.getAverage(name);
      const p95 = this.getP95(name);
      summary[name] = { last, avg, p95, count: arr.length };
    }
    return summary;
  }

  /**
   * Reset all metrics.
   */
  reset() {
    this.metrics.clear();
    this.marks.clear();
  }
}

// Singleton
let instance = null;
export function getPerf() {
  if (!instance) instance = new PerfTelemetry();
  return instance;
}

// ── Predefined metric names ──
export const PERF = {
  STT_LATENCY: 'stt_latency',           // recording stop → text ready
  TRANSLATE_LATENCY: 'translate_latency', // text ready → translation ready
  PHASE1_SEND: 'phase1_send',           // text ready → partner sees original
  PHASE2_SEND: 'phase2_send',           // translation ready → partner sees translation
  TTS_LATENCY: 'tts_latency',           // translation → first audio byte
  E2E_LATENCY: 'e2e_total',             // user stops recording → partner hears TTS
  MSG_DELIVERY: 'msg_delivery',         // send → ack received
};

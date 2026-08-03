// ═══════════════════════════════════════════════
// ticker — Single shared scheduler for background polling
//
// Problem it solves: every hook/component had its own setInterval,
// all firing even when the tab is hidden (battery + API waste).
//
// One 1s heartbeat drives all subscribers. When the document is
// hidden, the heartbeat PAUSES — no polling in background tabs.
// On return to visibility, subscribers marked `immediate` fire
// right away so data is fresh when the user comes back.
//
// Usage:
//   import { subscribeTick } from '../lib/ticker.js';
//   useEffect(() => subscribeTick(30000, fetchContacts, { immediate: true }), []);
//
// The returned function unsubscribes (perfect for useEffect cleanup).
// Activity-scoped timers (VAD frames, call duration, recording) should
// NOT use this — they are lifecycle-bound and must keep running.
// ═══════════════════════════════════════════════

const subscribers = new Set();
let heartbeat = null;

function tick() {
  const now = Date.now();
  for (const sub of subscribers) {
    if (now - sub.last >= sub.intervalMs) {
      sub.last = now;
      try { sub.fn(); } catch { /* subscriber errors must not kill the ticker */ }
    }
  }
}

function start() {
  if (heartbeat || typeof window === 'undefined') return;
  heartbeat = setInterval(tick, 1000);
}

function stop() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
}

function handleVisibility() {
  if (document.hidden) {
    stop(); // pause ALL polling in background
  } else {
    // Refresh immediately on return, then resume
    const now = Date.now();
    for (const sub of subscribers) {
      if (sub.immediate) { sub.last = now; try { sub.fn(); } catch { /* ignore */ } }
    }
    if (subscribers.size > 0) start();
  }
}

let visibilityHooked = false;
function ensureVisibilityHook() {
  if (visibilityHooked || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibility);
  visibilityHooked = true;
}

/**
 * Subscribe a function to the shared ticker.
 * @param {number} intervalMs - how often to run (min 1000)
 * @param {Function} fn - callback
 * @param {Object} [opts]
 * @param {boolean} [opts.immediate] - also run right away on subscribe and on tab return
 * @returns {Function} unsubscribe
 */
export function subscribeTick(intervalMs, fn, opts = {}) {
  const sub = {
    intervalMs: Math.max(1000, intervalMs),
    fn,
    immediate: !!opts.immediate,
    last: opts.immediate ? 0 : Date.now(),
  };
  subscribers.add(sub);
  ensureVisibilityHook();
  if (typeof document === 'undefined' || !document.hidden) start();
  if (sub.immediate) { sub.last = Date.now(); try { fn(); } catch { /* ignore */ } }
  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) stop();
  };
}

/** Test/debug helper: current subscriber count */
export function tickerSubscriberCount() {
  return subscribers.size;
}

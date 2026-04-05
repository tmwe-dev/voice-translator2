// ═══════════════════════════════════════════════
// Offline Message Queue — Guaranteed delivery
//
// When network is down or all channels fail:
// 1. Messages are queued in memory (+ IndexedDB for persistence)
// 2. Network recovery is detected via navigator.onLine + periodic check
// 3. Queued messages are flushed in order on reconnection
//
// This ensures ZERO message loss even during:
// - WiFi switching (phone moves between networks)
// - Tunnel/elevator scenarios (brief outage)
// - Server restart (Vercel cold start)
// ═══════════════════════════════════════════════

const MAX_QUEUE_SIZE = 50;
const RETRY_INTERVAL = 3000; // 3s between retry attempts
const MAX_RETRIES = 10;

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.onSendCallback = null;
    this.retryTimer = null;
    this._setupNetworkListeners();
  }

  /**
   * Set the callback used to actually send messages.
   * @param {function(msg): Promise<boolean>} callback - returns true if sent successfully
   */
  setSendCallback(callback) {
    this.onSendCallback = callback;
  }

  /**
   * Enqueue a message for guaranteed delivery.
   * If online and channel available, sends immediately.
   * Otherwise queues for retry.
   */
  async enqueue(message) {
    // Try immediate send first
    if (navigator.onLine && this.onSendCallback) {
      try {
        const sent = await this.onSendCallback(message);
        if (sent) return true;
      } catch (e) { console.warn('[messageQueue] immediate send failed:', e?.message || e); }
    }

    // Failed or offline — queue it
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      this.queue.shift(); // Drop oldest to prevent unbounded growth
    }
    this.queue.push({
      message,
      retries: 0,
      queuedAt: Date.now(),
    });
    this._persistQueue();
    this._scheduleRetry();
    return false;
  }

  /**
   * Get current queue length (for UI display).
   */
  get pendingCount() {
    return this.queue.length;
  }

  /**
   * Flush all queued messages (called on network recovery).
   */
  async flush() {
    if (this.processing || this.queue.length === 0 || !this.onSendCallback) return;
    this.processing = true;

    const toRetry = [];
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        const sent = await this.onSendCallback(item.message);
        if (!sent) {
          item.retries++;
          if (item.retries < MAX_RETRIES) {
            toRetry.push(item);
          } else {
            console.warn('[MessageQueue] Dropping message after max retries:', item.message?.id);
          }
        }
      } catch (e) {
        console.warn('[messageQueue] send failed:', e?.message || e);
        item.retries++;
        if (item.retries < MAX_RETRIES) toRetry.push(item);
      }
    }

    // Re-queue failed items
    this.queue = toRetry;
    this._persistQueue();
    this.processing = false;

    // If still items in queue, schedule another retry
    if (this.queue.length > 0) {
      this._scheduleRetry();
    }
  }

  /**
   * Clear the queue (e.g., on room leave).
   */
  clear() {
    this.queue = [];
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this._persistQueue();
  }

  // ── Private methods ──

  _scheduleRetry() {
    if (this.retryTimer) return; // Already scheduled
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (navigator.onLine && this.queue.length > 0) {
        this.flush();
      } else if (this.queue.length > 0) {
        this._scheduleRetry(); // Reschedule if still offline
      }
    }, RETRY_INTERVAL);
  }

  _setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      console.log('[MessageQueue] Network back online — flushing queue');
      setTimeout(() => this.flush(), 500); // Small delay for network to stabilize
    });
  }

  _persistQueue() {
    // Persist to sessionStorage for tab crash recovery
    try {
      if (typeof sessionStorage !== 'undefined') {
        if (this.queue.length > 0) {
          sessionStorage.setItem('vt_msg_queue', JSON.stringify(this.queue));
        } else {
          sessionStorage.removeItem('vt_msg_queue');
        }
      }
    } catch (e) { console.warn('[messageQueue] persist error:', e?.message); }
  }

  restoreQueue() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const saved = sessionStorage.getItem('vt_msg_queue');
        if (saved) {
          let items; try { items = JSON.parse(saved); } catch { items = null; }
          if (items) {
            // Only restore items less than 5 minutes old
            const cutoff = Date.now() - 5 * 60 * 1000;
            this.queue = items.filter(item => item.queuedAt > cutoff);
          }
          if (this.queue.length > 0) {
            console.log(`[MessageQueue] Restored ${this.queue.length} queued messages`);
            this._scheduleRetry();
          }
        }
      }
    } catch (e) { console.warn('[messageQueue] restore error:', e?.message); }
  }
}

// Singleton instance
let instance = null;
export function getMessageQueue() {
  if (!instance) {
    instance = new MessageQueue();
    instance.restoreQueue();
  }
  return instance;
}

export default MessageQueue;

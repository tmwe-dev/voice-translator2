/**
 * Offline Message Queue — IndexedDB-based queue for messages that fail to send
 * Automatically registers for background sync and flushes when connection returns
 */

const DB_NAME = 'vt-offline-queue';
const STORE_NAME = 'pending-messages';

class OfflineQueue {
  constructor() {
    this.db = null;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.init();
  }

  /**
   * Initialize IndexedDB and set up event listeners
   */
  async init() {
    try {
      this.db = await this.openDB();
      this.setupEventListeners();
    } catch (e) {
      console.warn('[OfflineQueue] Failed to initialize:', e);
    }
  }

  /**
   * Open IndexedDB with auto-upgrade
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);

      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);

      req.onupgradeneeded = (evt) => {
        const db = evt.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { autoIncrement: true, keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Set up online/offline listeners and SW message listeners
   */
  setupEventListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[OfflineQueue] Back online, flushing queue');
      this.flush();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[OfflineQueue] Connection lost');
    });

    // Listen for SW flush message (background sync trigger)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'FLUSH_OFFLINE_QUEUE') {
          console.log('[OfflineQueue] SW triggered flush');
          this.flush();
        }
      });
    }
  }

  /**
   * Add a message to the queue
   * @param {string} body - Request body (JSON string)
   * @returns {Promise<number>} - ID of the queued message
   */
  async enqueue(body) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const msg = {
        body,
        timestamp: Date.now(),
        retries: 0
      };

      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(msg);

      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          console.log(`[OfflineQueue] Queued message ${req.result}`);
          // Register for background sync
          this.registerBackgroundSync();
          resolve(req.result);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[OfflineQueue] Enqueue failed:', e);
      throw e;
    }
  }

  /**
   * Remove and return the oldest message from the queue
   * @returns {Promise<Object|null>} - Message object or null if queue is empty
   */
  async dequeue() {
    if (!this.db) return null;

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const messages = req.result;
          if (messages.length === 0) {
            resolve(null);
            return;
          }
          // Get the first (oldest) message
          const msg = messages[0];
          store.delete(msg.id);
          resolve(msg);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[OfflineQueue] Dequeue failed:', e);
      return null;
    }
  }

  /**
   * Peek at all pending messages without removing them
   * @returns {Promise<Array>} - Array of all pending messages
   */
  async peekAll() {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[OfflineQueue] PeekAll failed:', e);
      return [];
    }
  }

  /**
   * Get count of pending messages
   * @returns {Promise<number>}
   */
  async getCount() {
    if (!this.db) return 0;

    try {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[OfflineQueue] GetCount failed:', e);
      return 0;
    }
  }

  /**
   * Flush all pending messages using provided send function
   * @param {Function} sendFn - Async function that takes (body) and sends the request
   *                            Should resolve if successful or reject if it fails
   */
  async flush(sendFn = null) {
    if (!sendFn) {
      // Default: use fetch to POST to /api/translate
      sendFn = async (body) => {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response;
      };
    }

    const count = await this.getCount();
    if (count === 0) {
      console.log('[OfflineQueue] Queue is empty, nothing to flush');
      return;
    }

    console.log(`[OfflineQueue] Flushing ${count} pending messages...`);
    let flushed = 0;
    let failed = 0;

    while (true) {
      const msg = await this.dequeue();
      if (!msg) break;

      try {
        await sendFn(msg.body);
        flushed++;
        console.log(`[OfflineQueue] Sent message ${msg.id}`);
      } catch (e) {
        failed++;
        console.warn(`[OfflineQueue] Failed to send message ${msg.id}, re-queueing:`, e);
        // Re-queue the message for retry
        msg.retries = (msg.retries || 0) + 1;
        if (msg.retries < 3) {
          try {
            await this.enqueue(msg.body);
          } catch (reqErr) {
            console.error('[OfflineQueue] Failed to re-queue message:', reqErr);
          }
        } else {
          console.error(`[OfflineQueue] Message ${msg.id} exceeded max retries (3), discarding`);
        }
      }
    }

    console.log(`[OfflineQueue] Flush complete: ${flushed} sent, ${failed} failed`);
  }

  /**
   * Register for background sync
   */
  async registerBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      console.warn('[OfflineQueue] Background Sync API not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('flush-offline-queue');
      console.log('[OfflineQueue] Background sync registered');
    } catch (e) {
      console.warn('[OfflineQueue] Failed to register background sync:', e);
    }
  }

  /**
   * Clear all pending messages (destructive)
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          console.log('[OfflineQueue] Queue cleared');
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('[OfflineQueue] Clear failed:', e);
    }
  }
}

// Singleton instance
let queueInstance = null;

/**
 * Get or create the singleton OfflineQueue instance
 */
export function getOfflineQueue() {
  if (!queueInstance) {
    queueInstance = new OfflineQueue();
  }
  return queueInstance;
}

export default OfflineQueue;

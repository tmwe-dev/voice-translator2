'use client';
// ═══════════════════════════════════════════════
// Chat Storage — IndexedDB persistence (WhatsApp model)
//
// Zero server memory: all chat history lives on the user's device.
// Database: "barchat" with stores: chats, messages, settings
// ═══════════════════════════════════════════════

const DB_NAME = 'barchat';
const DB_VERSION = 1;
const STORE_CHATS = 'chats';
const STORE_MESSAGES = 'messages';
const STORE_SETTINGS = 'settings';

let _db = null;

/**
 * Open (or create) the IndexedDB database
 */
function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Chats store: metadata per conversation
      if (!db.objectStoreNames.contains(STORE_CHATS)) {
        const chatStore = db.createObjectStore(STORE_CHATS, { keyPath: 'id' });
        chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Messages store: individual messages, indexed by chatId
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
        msgStore.createIndex('chatId_timestamp', ['chatId', 'timestamp'], { unique: false });
      }

      // Settings store: key-value pairs
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      _db = request.result;
      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a chat's metadata
 * @param {object} chat - { id, roomId, members, mode, context, createdAt, updatedAt, lastMessage, msgCount }
 */
export async function saveChat(chat) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHATS, 'readwrite');
    tx.objectStore(STORE_CHATS).put({
      ...chat,
      updatedAt: chat.updatedAt || Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save a single message
 * @param {string} chatId
 * @param {object} msg - Message object (must have .id and .timestamp)
 */
export async function saveMessage(chatId, msg) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    tx.objectStore(STORE_MESSAGES).put({ ...msg, chatId });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Bulk save messages
 * @param {string} chatId
 * @param {object[]} msgs
 */
export async function saveMessages(chatId, msgs) {
  if (!msgs?.length) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    for (const msg of msgs) {
      store.put({ ...msg, chatId });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get chat metadata by ID
 */
export async function getChat(chatId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const req = tx.objectStore(STORE_CHATS).get(chatId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get messages for a chat with optional pagination
 * @param {string} chatId
 * @param {object} [opts] - { limit, before (timestamp) }
 * @returns {object[]} Messages sorted oldest-first
 */
export async function getMessages(chatId, opts = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const index = tx.objectStore(STORE_MESSAGES).index('chatId_timestamp');
    const results = [];

    const lower = [chatId, 0];
    const upper = [chatId, opts.before || Infinity];
    const range = IDBKeyRange.bound(lower, upper, false, true);

    const cursor = index.openCursor(range, 'prev'); // newest first for pagination
    let count = 0;
    const limit = opts.limit || 200;

    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c && count < limit) {
        results.unshift(c.value); // Restore oldest-first order
        count++;
        c.continue();
      } else {
        resolve(results);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

/**
 * Get all chats sorted by most recently updated
 * @returns {object[]} Chat metadata array
 */
export async function getAllChats() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHATS, 'readonly');
    const index = tx.objectStore(STORE_CHATS).index('updatedAt');
    const results = [];

    const cursor = index.openCursor(null, 'prev'); // newest first
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        results.push(c.value);
        c.continue();
      } else {
        resolve(results);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

/**
 * Delete a chat and all its messages
 */
export async function deleteChat(chatId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CHATS, STORE_MESSAGES], 'readwrite');

    // Delete chat metadata
    tx.objectStore(STORE_CHATS).delete(chatId);

    // Delete all messages for this chat
    const msgIndex = tx.objectStore(STORE_MESSAGES).index('chatId');
    const cursor = msgIndex.openCursor(IDBKeyRange.only(chatId));
    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Export a chat as JSON or TXT
 * @param {string} chatId
 * @param {'json'|'txt'} format
 * @returns {string} Exported content
 */
export async function exportChat(chatId, format = 'json') {
  const chat = await getChat(chatId);
  const messages = await getMessages(chatId);

  if (format === 'txt') {
    const header = `BarChat — ${chat?.members?.map(m => m.name).join(', ') || chatId}\n`;
    const divider = '═'.repeat(50) + '\n';
    const lines = messages.map(m => {
      const time = new Date(m.timestamp).toLocaleString();
      const text = m.translated ? `${m.original}\n  → ${m.translated}` : m.original;
      return `[${time}] ${m.sender}: ${text}`;
    });
    return header + divider + lines.join('\n');
  }

  return JSON.stringify({ chat, messages }, null, 2);
}

/**
 * Import a chat from JSON file content
 * @param {string} jsonString - JSON content from exportChat
 */
export async function importChat(jsonString) {
  let data; try { data = JSON.parse(jsonString); } catch { throw new Error('Invalid JSON format'); }
  if (!data.chat?.id) throw new Error('Invalid chat export format');
  await saveChat(data.chat);
  if (data.messages?.length) {
    await saveMessages(data.chat.id, data.messages);
  }
  return data.chat;
}

/**
 * Get storage usage estimate
 * @returns {{ used: number, quota: number, percentage: number }}
 */
export async function getStorageUsage() {
  if (!navigator.storage?.estimate) return { used: 0, quota: 0, percentage: 0 };
  const { usage, quota } = await navigator.storage.estimate();
  return {
    used: usage || 0,
    quota: quota || 0,
    percentage: quota ? Math.round((usage / quota) * 100) : 0,
  };
}

/**
 * Save a user setting
 */
export async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite');
    tx.objectStore(STORE_SETTINGS).put({ key, value, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a user setting
 */
export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly');
    const req = tx.objectStore(STORE_SETTINGS).get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ═══════════════════════════════════════════════
// Offline Message Queue
//
// When user is offline, messages are queued locally.
// When connection returns, queue is flushed via provided send function.
// ═══════════════════════════════════════════════

const OFFLINE_QUEUE_KEY = 'offline_queue';

/**
 * Queue a message for sending when back online
 */
export async function queueOfflineMessage(message) {
  let queue; try { queue = JSON.parse(await getSetting(OFFLINE_QUEUE_KEY) || '[]'); } catch { queue = []; }
  queue.push({ ...message, _queuedAt: Date.now() });
  await saveSetting(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

/**
 * Get all queued offline messages
 */
export async function getOfflineQueue() {
  const raw = await getSetting(OFFLINE_QUEUE_KEY);
  let queue; try { queue = JSON.parse(raw || '[]'); } catch { queue = []; }
  return queue;
}

/**
 * Clear the offline queue (after successful flush)
 */
export async function clearOfflineQueue() {
  await saveSetting(OFFLINE_QUEUE_KEY, '[]');
}

/**
 * Flush offline queue — sends all queued messages via provided function
 * @param {Function} sendFn - async function(message) that sends a single message
 * @returns {{ sent: number, failed: number }}
 */
export async function flushOfflineQueue(sendFn) {
  const queue = await getOfflineQueue();
  if (!queue.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const remaining = [];

  for (const msg of queue) {
    try {
      await sendFn(msg);
      sent++;
    } catch {
      failed++;
      remaining.push(msg);
    }
  }

  await saveSetting(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return { sent, failed };
}

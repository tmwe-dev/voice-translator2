'use client';
// ═══════════════════════════════════════════════
// Push Manager — Web Push subscription management
//
// Handles VAPID key fetching, subscription creation,
// and server-side registration.
// ═══════════════════════════════════════════════

let _vapidKey = null;

/**
 * Get VAPID public key from server
 */
async function getVapidKey() {
  if (_vapidKey) return _vapidKey;
  try {
    const res = await fetch('/api/push-subscribe');
    if (!res.ok) return null;
    const { publicKey } = await res.json();
    _vapidKey = publicKey;
    return publicKey;
  } catch { return null; }
}

/**
 * Convert VAPID key string to Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push is supported and permission granted
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

/**
 * Get current push permission state
 */
export function getPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Request notification permission
 */
export async function requestPushPermission() {
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Subscribe to push notifications
 * @param {string} userId - Optional user identifier
 * @param {string} roomId - Optional room identifier
 * @returns {PushSubscription|null}
 */
export async function subscribeToPush(userId, roomId) {
  if (!isPushSupported()) return null;

  try {
    // 1. Ensure permission
    const perm = await requestPushPermission();
    if (perm !== 'granted') return null;

    // 2. Get VAPID key
    const vapidKey = await getVapidKey();
    if (!vapidKey) return null;

    // 3. Get SW registration
    const reg = await navigator.serviceWorker.ready;

    // 4. Check existing subscription
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // 5. Send subscription to server
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), userId, roomId }),
    });

    return subscription;
  } catch (e) {
    console.warn('[Push] Subscribe failed:', e);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await fetch('/api/push-subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint, userId }),
      });
    }
    return true;
  } catch { return false; }
}

/**
 * Check if currently subscribed
 */
export async function isSubscribedToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

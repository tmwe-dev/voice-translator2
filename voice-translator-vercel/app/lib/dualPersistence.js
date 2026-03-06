// ═══════════════════════════════════════════════
// Dual Persistence — localStorage + Supabase Sync
//
// Pattern from BarTalk v79:
// - Every write goes to BOTH localStorage AND Supabase
// - Reads always from localStorage (zero latency)
// - On login, merge cloud data with local data (local wins for conflicts)
// - Background sync is non-blocking
// ═══════════════════════════════════════════════

const PREFS_KEY = 'vt-prefs';
const SYNC_KEY = 'vt-last-sync';

/**
 * Save preferences to localStorage (always) and queue Supabase sync
 * @param {Object} prefs - User preferences object
 * @param {string|null} userToken - Auth token (if authenticated)
 */
export function savePrefs(prefs, userToken = null) {
  if (!prefs || typeof prefs !== 'object') return;

  // 1. Always save to localStorage (instant, works offline)
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    localStorage.setItem(SYNC_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('[DualPersist] localStorage write failed:', e.message);
  }

  // 2. Sync to Supabase in background (non-blocking)
  if (userToken) {
    syncToCloud(prefs, userToken).catch(e => {
      console.warn('[DualPersist] Cloud sync failed (will retry):', e.message);
    });
  }
}

/**
 * Load preferences from localStorage
 * @returns {Object|null}
 */
export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Sync local prefs to Supabase (background, non-blocking)
 */
async function syncToCloud(prefs, userToken) {
  try {
    const response = await fetch('/api/user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        action: 'sync-prefs',
        prefs: {
          lang: prefs.lang,
          name: prefs.name,
          avatar: prefs.avatar,
          tier: prefs.tier,
          voice: prefs.voice,
          ttsEngine: prefs.ttsEngine,
          autoSpeak: prefs.autoSpeak,
          provider: prefs.provider,
          model: prefs.model,
          theme: prefs.theme,
        },
      }),
    });

    if (!response.ok) {
      console.warn('[DualPersist] Cloud sync returned', response.status);
    }
  } catch (e) {
    // Silently fail — localStorage is the source of truth
    console.warn('[DualPersist] Cloud sync error:', e.message);
  }
}

/**
 * On login: merge cloud prefs with local prefs
 * Local preferences win in case of conflicts (user's device is the latest)
 * Cloud data fills in any missing fields
 *
 * @param {string} userToken
 * @returns {Object} Merged preferences
 */
export async function mergeOnLogin(userToken) {
  const localPrefs = loadPrefs() || {};

  try {
    const response = await fetch('/api/user?action=get-prefs', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    if (!response.ok) return localPrefs;

    const cloudData = await response.json();
    const cloudPrefs = cloudData?.prefs || {};

    // Merge: local wins, cloud fills gaps
    const merged = { ...cloudPrefs, ...localPrefs };

    // Save merged result to both
    savePrefs(merged, userToken);

    return merged;
  } catch {
    return localPrefs;
  }
}

/**
 * Clear all stored preferences (for logout/account deletion)
 */
export function clearPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(SYNC_KEY);
  } catch {}
}

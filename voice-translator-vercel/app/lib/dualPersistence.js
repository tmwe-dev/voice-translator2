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
          // Map localStorage field names → camelCase names matching Supabase user_settings
          sourceLang: prefs.lang || prefs.sourceLang,
          targetLang: prefs.targetLang,
          ttsEnabled: prefs.ttsEnabled,
          ttsEngine: prefs.ttsEngine,
          ttsVoice: prefs.voice || prefs.ttsVoice,
          ttsAutoPlay: prefs.autoSpeak !== undefined ? prefs.autoSpeak : prefs.ttsAutoPlay,
          sttEngine: prefs.sttEngine,
          aiModel: prefs.model || prefs.aiModel,
          theme: prefs.theme,
          contextType: prefs.contextType,
          voiceSpeed: prefs.voiceSpeed,
          autoTranslate: prefs.autoTranslate,
          showOriginal: prefs.showOriginal,
          notificationSound: prefs.notificationSound,
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
    const response = await fetch(`/api/user?action=get-prefs&token=${encodeURIComponent(userToken)}`);

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

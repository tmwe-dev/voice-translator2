// ═══════════════════════════════════════════════
// Analytics — Plausible event tracking
// Privacy-first: no cookies, no personal data, GDPR compliant
// ═══════════════════════════════════════════════

/**
 * Track a custom event in Plausible
 * @param {string} name - Event name (e.g., 'Signup', 'Room Created', 'Translation')
 * @param {Object} props - Optional event properties
 */
export function trackEvent(name, props = {}) {
  try {
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible(name, { props });
    }
  } catch (e) {
    // Silent fail — analytics should never break the app
    console.warn('[analytics] trackEvent failed:', e?.message || e);
  }
}

/**
 * Track page view (automatic with Plausible script, but useful for SPA navigation)
 */
export function trackPageView(url) {
  try {
    if (typeof window !== 'undefined' && window.plausible) {
      window.plausible('pageview', { u: url });
    }
  } catch (e) { console.warn('[analytics] trackPageView failed:', e?.message || e); }
}

// Pre-defined events for BarTalk
export const EVENTS = {
  SIGNUP: 'Signup',
  LOGIN: 'Login',
  ROOM_CREATED: 'Room Created',
  ROOM_JOINED: 'Room Joined',
  TRANSLATION: 'Translation',
  TTS_PLAYED: 'TTS Played',
  VOICE_CLONED: 'Voice Cloned',
  SUBSCRIPTION_STARTED: 'Subscription Started',
  CREDITS_PURCHASED: 'Credits Purchased',
  SETTINGS_CHANGED: 'Settings Changed',
  CLASSROOM_STARTED: 'Classroom Started',
  LENDING_CREATED: 'Lending Created',
};

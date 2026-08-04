'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { savePrefs, loadPrefs, mergeOnLogin, clearPrefs } from '../lib/dualPersistence.js';

/**
 * Hook for dual-persistence preferences
 * Wraps localStorage + Supabase sync in a React-friendly API
 *
 * @param {string|null} userToken - Current auth token (null = guest)
 * @returns {{ prefs, setPrefs, updatePref, resetPrefs }}
 */
export function useDualPersist(userToken = null) {
  const [prefs, setPrefsState] = useState(() => loadPrefs() || {});
  const tokenRef = useRef(userToken);

  // Keep token ref updated
  useEffect(() => {
    tokenRef.current = userToken;
  }, [userToken]);

  // On login: merge cloud + local
  useEffect(() => {
    if (userToken) {
      mergeOnLogin(userToken).then(merged => {
        if (merged) setPrefsState(merged);
      });
    }
  }, [userToken]);

  // Save prefs (writes to localStorage + queues cloud sync)
  const setPrefs = useCallback((newPrefs) => {
    const resolved = typeof newPrefs === 'function' ? newPrefs(loadPrefs() || {}) : newPrefs;
    setPrefsState(resolved);
    savePrefs(resolved, tokenRef.current);
  }, []);

  // Update a single preference
  const updatePref = useCallback((key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }, [setPrefs]);

  // Reset all prefs (logout)
  const resetPrefs = useCallback(() => {
    clearPrefs();
    setPrefsState({});
  }, []);

  return { prefs, setPrefs, updatePref, resetPrefs };
}

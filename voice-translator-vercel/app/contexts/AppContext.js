'use client';
// ═══════════════════════════════════════════════════════════════
// AppContext — Shared state provider
// Eliminates prop drilling for: L, S, theme, prefs, myLang, setView, auth
// Components import { useApp } from './contexts/AppContext' instead of 30+ props
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useCallback, useMemo } from 'react';
import { t, preloadLang } from '../lib/i18n.js';

const AppContext = createContext(null);

/**
 * AppProvider wraps the entire app and exposes shared state.
 * page.js passes all values; child components consume via useApp().
 */
export function AppProvider({ children, value }) {
  // Memoize the L function so it doesn't change on every render
  const L = useCallback((key) => t(value.prefs?.lang || 'it', key), [value.prefs?.lang]);

  const ctx = useMemo(() => ({
    // ── i18n ──
    L,
    // ── Styles & Theme ──
    S: value.S,
    theme: value.theme,
    setTheme: value.setTheme,
    // ── Preferences ──
    prefs: value.prefs,
    setPrefs: value.setPrefs,
    savePrefs: value.savePrefs,
    // ── Language ──
    myLang: value.myLang,
    setMyLang: value.setMyLang,
    // ── Navigation ──
    view: value.view,
    setView: value.setView,
    // ── Status ──
    status: value.status,
    setStatus: value.setStatus,
    // ── Auth (read-only summary) ──
    auth: {
      userToken: value.auth?.userToken,
      isTrial: value.auth?.isTrial,
      isTopPro: value.auth?.isTopPro,
      creditBalance: value.auth?.creditBalance,
      userAccount: value.auth?.userAccount,
      useOwnKeys: value.auth?.useOwnKeys,
    },
  }), [
    L, value.S, value.theme, value.setTheme,
    value.prefs, value.setPrefs, value.savePrefs,
    value.myLang, value.setMyLang,
    value.view, value.setView,
    value.status, value.setStatus,
    value.auth?.userToken, value.auth?.isTrial, value.auth?.isTopPro,
    value.auth?.creditBalance, value.auth?.userAccount, value.auth?.useOwnKeys,
  ]);

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

/**
 * useApp() — access shared app state from any component.
 * Usage: const { L, S, theme, prefs, setView, auth } = useApp();
 */
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp() must be used within <AppProvider>');
  return ctx;
}

export default AppContext;

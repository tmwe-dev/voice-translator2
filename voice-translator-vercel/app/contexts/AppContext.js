'use client';
// ═══════════════════════════════════════════════════════════════
// AppContext — Shared state provider
// Eliminates prop drilling for: L, S, theme, prefs, myLang, setView, auth
// Components import { useApp } from './contexts/AppContext' instead of 30+ props
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useCallback, useMemo } from 'react';
import { t, mapLang } from '../lib/i18n.js';

const AppContext = createContext(null);

/**
 * AppProvider wraps the entire app and exposes shared state.
 * page.js passes all values; child components consume via useApp().
 */
export function AppProvider({ children, value }) {
  // ── b.136 · L() SEGUE LA LINGUA DELL'INTERFACCIA, NON QUELLA PARLATA ──
  //
  // Questa riga diceva:
  //     t(value.prefs?.lang || 'it', key)
  //
  // cioe traduceva i menu nella lingua in cui l'utente PARLA. Sono due
  // cose diverse e servono a due scopi opposti: un italiano che parla
  // con un americano mette "en" perche vuole le TRADUZIONI in inglese,
  // e si ritrovava tutta l'applicazione in inglese.
  //
  // Il ripiego su 'it' era il secondo difetto: chi non aveva ancora
  // scelto niente vedeva l'italiano, non la sua lingua. Ora si ripiega
  // sulla lingua parlata (mappata sulle 15 dell'interfaccia) e solo in
  // ultima istanza sull'inglese, che e la lingua di riserva di t().
  const linguaInterfaccia = value.prefs?.uiLang || mapLang(value.prefs?.lang || 'en');
  const L = useCallback((key) => t(linguaInterfaccia, key), [linguaInterfaccia]);

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

'use client';
// ═══════════════════════════════════════════════════════════════
// AppContext — Shared state provider
// Eliminates prop drilling for: L, S, theme, prefs, myLang, setView, auth
// Components import { useApp } from './contexts/AppContext' instead of 30+ props
// ═══════════════════════════════════════════════════════════════

import { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { t, mapLang, preloadLang, ascoltaLingueCaricate } from '../lib/i18n.js';
import { entra } from '../lib/scaffale.js';

const AppContext = createContext(null);

/**
 * AppProvider wraps the entire app and exposes shared state.
 * page.js passes all values; child components consume via useApp().
 */
export function AppProvider({ children, value }) {
  // b.410 (P0.7) — CHI STA USANDO IL TELEFONO, detto una volta sola e in
  // un posto solo. Lo scaffale della memoria locale (chat con l'Amico,
  // obiettivi di vita) ha bisogno di sapere di chi sono le cose che
  // conserva: senza, sullo stesso telefono un account leggeva quelle
  // dell'altro. Qui passa ogni cambio di accesso, quindi e il punto
  // giusto — non ce n'e un secondo da tenere allineato.
  const emailInCorso = value.auth?.userAccount?.email || '';
  useEffect(() => { entra(emailInCorso); }, [emailInCorso]);

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

  // ═══ INIZIO b.256 — aspettare il pacchetto lingua, e poi ridisegnare ═══
  // Solo inglese e italiano stanno dentro il programma: le altre tredici
  // arrivano a parte. `t()` ripiega sull'inglese finche il pacchetto non
  // c'e — ed e giusto — ma nessuno tornava a disegnare quando arrivava:
  // chi sceglieva tedesco o spagnolo restava con i menu in inglese.
  // Qui si chiede il pacchetto e ci si sveglia quando entra in memoria.
  const [versioneLingua, setVersioneLingua] = useState(0);
  useEffect(() => { preloadLang(linguaInterfaccia); }, [linguaInterfaccia]);

  // b.363 — LA PAGINA DICEVA A TUTTI DI ESSERE IN ITALIANO. `<html lang="it">`
  // e scritto fisso nel guscio (layout.js), che gira sul server e non puo
  // sapere la lingua scelta. Risultato: a un giapponese il lettore di schermo
  // leggeva la sua interfaccia con la pronuncia italiana, e il traduttore
  // automatico del browser si offriva di tradurre dall'italiano una pagina
  // che italiana non era. Qui, dove la lingua si sa, si corregge.
  useEffect(() => {
    try { document.documentElement.lang = linguaInterfaccia; } catch { /* fuori dal browser non c'e un documento da correggere */ }
  }, [linguaInterfaccia]);
  useEffect(() => ascoltaLingueCaricate((codice) => {
    // Ci si ridisegna solo per la lingua che si sta mostrando: il
    // precaricamento di un'altra non deve far ridisegnare mezza app.
    if (codice === linguaInterfaccia) setVersioneLingua((v) => v + 1);
  }), [linguaInterfaccia]);

  // `versioneLingua` non si legge: serve a far rinascere L() (e quindi a
  // ridisegnare chi la usa) quando il pacchetto e finalmente pronto.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `versioneLingua`
  // non si legge dentro: e proprio il suo cambiare che deve far rinascere
  // L() quando il pacchetto lingua arriva. Toglierla rimetterebbe il difetto.
  const L = useCallback((key) => t(linguaInterfaccia, key), [linguaInterfaccia, versioneLingua]);
  // ═══ FINE b.256 ═══

  const ctx = useMemo(() => ({
    // ── i18n ──
    L,
    // b.139 — non basta tradurre le parole: le DATE si formattano da
    // sole, e chi le scriveva passava 'it-IT' a mano. Un coreano vedeva
    // "12 nov" nel proprio archivio. Chi deve formattare una data ora
    // ha qui la lingua dell'interfaccia, la stessa che usa L().
    uiLang: linguaInterfaccia,
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
    // b.216 — CAUSA RADICE (trovata dal vivo): LifeView e 4 componenti di
    // Mondo leggono `userToken` dal LIVELLO TOP di useApp(), ma qui era
    // solo dentro `auth`. Risultato: userToken = undefined ovunque in Life,
    // e Amico/Tavolo/salvataggio Compagni tornavano 401 anche da loggato,
    // mentre Podcast/generazione reggevano perché l'endpoint tollera l'ospite.
    // Lo espongo anche al top level. Il sotto-oggetto `auth` resta perché
    // BatteryPill legge `useApp().auth`.
    userToken: value.auth?.userToken,
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
    L, linguaInterfaccia, value.S, value.theme, value.setTheme,
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

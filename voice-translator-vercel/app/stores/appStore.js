'use client';
// ═══════════════════════════════════════════════════════════════
// Zustand-lite App Store — zero dependencies
// Replaces 30+ useState in page.js with surgical re-renders
// Uses useSyncExternalStore (React 18 built-in) instead of zustand package
// ═══════════════════════════════════════════════════════════════

import { useSyncExternalStore, useCallback, useRef } from 'react';

/**
 * Create a minimal Zustand-like store without external deps.
 * Uses React 18's useSyncExternalStore for tear-free reads.
 */
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;
  const setState = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    const merged = { ...state, ...next };
    // Skip if nothing changed (shallow compare top-level keys)
    let changed = false;
    for (const k of Object.keys(next)) {
      if (merged[k] !== state[k]) { changed = true; break; }
    }
    if (!changed) return;
    state = merged;
    listeners.forEach(fn => fn());
  };
  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  return { getState, setState, subscribe };
}

// ═══ APP STORE: view, theme, preferences ═══

const appStore = createStore({
  view: 'home',       // 'home' | 'lobby' | 'room' | 'settings' | 'mondo' | 'profile'
  theme: 'dark',
  prefs: {
    lang: 'en',
    voice: 'nova',
    aiModel: 'gpt-4o-mini',
    autoTTS: true,
    subtitles: true,
    showOriginal: false,
  },
  showChatActions: false,
  interpreterActive: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
});

export function useAppStore(selector) {
  return useSyncExternalStore(
    appStore.subscribe,
    () => selector(appStore.getState()),
    () => selector(appStore.getState()), // SSR snapshot
  );
}
export const setAppState = appStore.setState;
export const getAppState = appStore.getState;

// ═══ ROOM STORE: room state, members, messages ═══

const roomStore = createStore({
  roomId: null,
  roomInfo: null,       // { id, host, mode, members, ... }
  messages: [],
  members: [],
  isConnected: false,
  connectionState: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  unreadCount: 0,
  classroomHands: [],   // raised hands for classroom mode
});

export function useRoomStore(selector) {
  return useSyncExternalStore(
    roomStore.subscribe,
    () => selector(roomStore.getState()),
    () => selector(roomStore.getState()),
  );
}
export const setRoomState = roomStore.setState;
export const getRoomState = roomStore.getState;

// ═══ AUTH STORE: user, token, tier, credits ═══

const authStore = createStore({
  user: null,
  userToken: null,
  tier: 'FREE',          // 'FREE' | 'PRO' | 'TOP_PRO'
  credits: 0,
  isAuthenticated: false,
  isTrial: false,
  email: null,
});

export function useAuthStore(selector) {
  return useSyncExternalStore(
    authStore.subscribe,
    () => selector(authStore.getState()),
    () => selector(authStore.getState()),
  );
}
export const setAuthState = authStore.setState;
export const getAuthState = authStore.getState;

// ═══ Convenience hooks ═══

export function useView() { return useAppStore(s => s.view); }
export function usePrefs() { return useAppStore(s => s.prefs); }
export function useRoomId() { return useRoomStore(s => s.roomId); }
export function useMessages() { return useRoomStore(s => s.messages); }
export function useMembers() { return useRoomStore(s => s.members); }
export function useTier() { return useAuthStore(s => s.tier); }
export function useCredits() { return useAuthStore(s => s.credits); }
export function useIsOnline() { return useAppStore(s => s.isOnline); }

// ═══ Actions ═══

export function addMessage(msg) {
  setRoomState(s => ({ messages: [...s.messages, msg] }));
}

export function updateMessage(id, updates) {
  setRoomState(s => ({
    messages: s.messages.map(m => m.id === id ? { ...m, ...updates } : m),
  }));
}

export function clearRoom() {
  setRoomState({
    roomId: null, roomInfo: null, messages: [], members: [],
    isConnected: false, connectionState: 'disconnected', unreadCount: 0, classroomHands: [],
  });
}

export function setView(view) {
  setAppState({ view });
}

export function updatePrefs(partial) {
  setAppState(s => ({ prefs: { ...s.prefs, ...partial } }));
}

// Listen for online/offline
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setAppState({ isOnline: true }));
  window.addEventListener('offline', () => setAppState({ isOnline: false }));
}

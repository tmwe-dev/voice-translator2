'use client';
import { useState, useEffect, useMemo } from 'react';
import { THEMES, THEME_MIGRATION } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

/**
 * useTheme — Manages theme state with localStorage persistence.
 * Migrates legacy theme ids (dark/light/brown/orange) to the new
 * Spatial Design themes (deep/ember/dawn).
 */
export default function useTheme() {
  const [theme, setTheme] = useState(THEMES.DEEP);

  // Load from localStorage (with legacy migration)
  useEffect(() => {
    try {
      let saved = localStorage.getItem('vt-theme');
      if (saved && THEME_MIGRATION[saved]) {
        saved = THEME_MIGRATION[saved];
        localStorage.setItem('vt-theme', saved);
      }
      if (saved && Object.values(THEMES).includes(saved)) setTheme(saved);
    } catch (e) { console.warn('[useTheme] localStorage error:', e?.message); }
  }, []);

  // Save on change
  useEffect(() => {
    try { localStorage.setItem('vt-theme', theme); } catch (e) { console.warn('[useTheme] localStorage error:', e?.message); }
  }, [theme]);

  const S = useMemo(() => getStyles(theme), [theme]);

  return { theme, setTheme, S };
}

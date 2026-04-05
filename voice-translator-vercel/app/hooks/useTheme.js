'use client';
import { useState, useEffect, useMemo } from 'react';
import { THEMES } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

/**
 * useTheme — Manages theme state with localStorage persistence.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(THEMES.DARK);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-theme');
      if (saved && Object.values(THEMES).includes(saved)) setTheme(saved);
    } catch {}
  }, []);

  // Save on change
  useEffect(() => {
    try { localStorage.setItem('vt-theme', theme); } catch {}
  }, [theme]);

  const S = useMemo(() => getStyles(theme), [theme]);

  return { theme, setTheme, S };
}

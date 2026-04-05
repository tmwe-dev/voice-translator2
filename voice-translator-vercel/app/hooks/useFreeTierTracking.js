'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FREE_DAILY_LIMIT } from '../lib/constants.js';

/**
 * useFreeTierTracking — Manages free tier character usage with daily reset.
 * Persists usage to localStorage, resets at midnight UTC.
 */
export default function useFreeTierTracking() {
  const [freeCharsUsed, setFreeCharsUsed] = useState(0);
  const [freeLimitExceeded, setFreeLimitExceeded] = useState(false);
  const [freeResetTime, setFreeResetTime] = useState('');
  const freeCharsRef = useRef(0);

  // Load saved usage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-free-usage');
      if (saved) {
        let data; try { data = JSON.parse(saved); } catch { data = null; }
        if (data) {
          const savedDate = data.date || '';
          const todayUTC = new Date().toISOString().split('T')[0];
          if (savedDate === todayUTC) {
            setFreeCharsUsed(data.chars || 0);
            freeCharsRef.current = data.chars || 0;
            if ((data.chars || 0) >= FREE_DAILY_LIMIT) setFreeLimitExceeded(true);
          } else {
            localStorage.setItem('vt-free-usage', JSON.stringify({ date: todayUTC, chars: 0 }));
            setFreeCharsUsed(0); freeCharsRef.current = 0; setFreeLimitExceeded(false);
          }
        }
      }
    } catch (e) { console.warn('[useFreeTierTracking] localStorage error:', e?.message); }
  }, []);

  // Persist usage changes
  useEffect(() => {
    if (freeCharsUsed > 0) {
      const todayUTC = new Date().toISOString().split('T')[0];
      localStorage.setItem('vt-free-usage', JSON.stringify({ date: todayUTC, chars: freeCharsUsed }));
      freeCharsRef.current = freeCharsUsed;
    }
  }, [freeCharsUsed]);

  // Countdown to reset
  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const midnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diff = midnightUTC - now;
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      setFreeResetTime(`${hours}h ${mins}m`);
      if (hours === 0 && mins === 0) {
        setFreeCharsUsed(0); freeCharsRef.current = 0; setFreeLimitExceeded(false);
      }
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  const trackFreeChars = useCallback((chars) => {
    setFreeCharsUsed(prev => {
      const newTotal = prev + chars;
      if (newTotal >= FREE_DAILY_LIMIT) setFreeLimitExceeded(true);
      return newTotal;
    });
  }, []);

  return {
    freeCharsUsed, freeLimitExceeded, freeResetTime, freeCharsRef, trackFreeChars,
  };
}

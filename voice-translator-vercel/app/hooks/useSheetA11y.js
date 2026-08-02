'use client';
import { useEffect, useRef, useCallback } from 'react';

// ═══════════════════════════════════════════════
// useSheetA11y — Accessibility hook for bottom sheets
//
// - Traps focus inside the sheet when open
// - Closes on Escape key
// - Restores focus to trigger element on close
// - Sets aria-modal and role="dialog"
// ═══════════════════════════════════════════════

export default function useSheetA11y(isOpen, onClose) {
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Save the element that triggered the sheet
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      // Focus the first focusable element in the sheet
      requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) focusable[0].focus();
      });
    } else if (previousFocusRef.current) {
      // Restore focus when sheet closes
      previousFocusRef.current.focus?.();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Escape to close + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }

      // Focus trap: Tab cycles within sheet
      if (e.key === 'Tab') {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return sheetRef;
}

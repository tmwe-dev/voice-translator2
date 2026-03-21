'use client';
import { memo, useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════
// Toast Notification System
// Non-blocking error/info/success messages
// Auto-dismiss, stackable, with retry action
// ═══════════════════════════════════════════════

const TOAST_DURATION = 4000;
const MAX_TOASTS = 3;

// Global toast queue — components call addToast()
let _listeners = new Set();
let _toasts = [];
let _nextId = 1;

export function addToast(toast) {
  const id = _nextId++;
  const full = {
    id,
    type: toast.type || 'info', // 'info' | 'error' | 'success' | 'warning'
    message: toast.message,
    action: toast.action || null, // { label, onClick }
    duration: toast.duration || TOAST_DURATION,
    ts: Date.now(),
  };
  _toasts = [..._toasts, full].slice(-MAX_TOASTS);
  _listeners.forEach(fn => fn([..._toasts]));

  // Auto-dismiss
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    _listeners.forEach(fn => fn([..._toasts]));
  }, full.duration);

  return id;
}

export function dismissToast(id) {
  _toasts = _toasts.filter(t => t.id !== id);
  _listeners.forEach(fn => fn([..._toasts]));
}

// Convenience shortcuts
export const toast = {
  info: (msg, opts) => addToast({ type: 'info', message: msg, ...opts }),
  error: (msg, opts) => addToast({ type: 'error', message: msg, duration: 6000, ...opts }),
  success: (msg, opts) => addToast({ type: 'success', message: msg, ...opts }),
  warning: (msg, opts) => addToast({ type: 'warning', message: msg, duration: 5000, ...opts }),
  // Error with retry button
  errorRetry: (msg, onRetry) => addToast({
    type: 'error', message: msg, duration: 8000,
    action: { label: 'Riprova', onClick: onRetry },
  }),
  // Offline notification
  offline: () => addToast({
    type: 'warning',
    message: 'Sei offline — i messaggi saranno inviati quando torni online',
    duration: 10000,
  }),
};

const COLORS = {
  info: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', icon: 'ℹ️' },
  error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#f87171', icon: '⚠️' },
  success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#4ade80', icon: '✓' },
  warning: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)', text: '#facc15', icon: '⚡' },
};

const ToastContainer = memo(function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (newToasts) => setToasts(newToasts);
    _listeners.add(handler);
    return () => _listeners.delete(handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 'calc(100vw - 32px)', width: 360,
      pointerEvents: 'none',
    }} role="alert" aria-live="assertive">
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', borderRadius: 12,
            background: c.bg, border: `1px solid ${c.border}`,
            backdropFilter: 'blur(16px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'vtSlideIn 0.2s ease-out',
            pointerEvents: 'auto',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{c.icon}</span>
            <span style={{ flex: 1, fontSize: 13, color: c.text, lineHeight: 1.4 }}>
              {t.message}
            </span>
            {t.action && (
              <button
                onClick={() => { t.action.onClick(); dismissToast(t.id); }}
                style={{
                  padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.1)', border: `1px solid ${c.border}`,
                  color: c.text, cursor: 'pointer', flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              aria-label="Chiudi notifica"
              style={{
                background: 'none', border: 'none', color: c.text, cursor: 'pointer',
                fontSize: 14, padding: '2px 4px', opacity: 0.6, flexShrink: 0,
              }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
});

export default ToastContainer;

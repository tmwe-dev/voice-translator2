'use client';
import { useState, useEffect } from 'react';

/**
 * usePWAInstall — Manages PWA install prompt, notifications, and badge.
 */
export default function usePWAInstall() {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');

  // Capture install prompt
  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      if (!localStorage.getItem('vt-install-dismissed')) {
        setShowInstallBanner(true);
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    if ('Notification' in window) setNotifPermission(Notification.permission);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  async function handleInstallApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredInstallPrompt(null);
    }
  }

  function dismissInstallBanner() {
    setShowInstallBanner(false);
    localStorage.setItem('vt-install-dismissed', '1');
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    return perm;
  }

  return {
    showInstallBanner, notifPermission,
    handleInstallApp, dismissInstallBanner, requestNotifPermission,
  };
}

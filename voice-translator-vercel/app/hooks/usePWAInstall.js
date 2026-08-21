'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { memGet, memSet } from '../lib/memoria.js';

// ═══════════════════════════════════════════════════════════════
// INSTALLAZIONE E NOTIFICHE (b.134)
//
// Questo file era gia scritto, e giusto, e SCOLLEGATO. Restituiva cinque
// cose e in page.js ne veniva presa una:
//
//     const { notifPermission } = pwa;
//
// `showInstallBanner`, `handleInstallApp`, `dismissInstallBanner` e
// `requestNotifPermission` non li usava nessuno — cercato in tutta la
// cartella `app/`, zero riscontri. Conseguenze a catena:
//
//   · il banner "installa l'applicazione" non compariva mai;
//   · il permesso per le notifiche non veniva MAI chiesto;
//   · quindi `notifPermission` restava per sempre 'default';
//   · quindi in useNotifications.js:27 la condizione `=== 'granted'`
//     non era mai vera, e non partiva nemmeno la notifica LOCALE del
//     messaggio arrivato a scheda nascosta.
//
// Una funzione spenta da un `const` che prendeva un campo solo.
//
// ── E MANCAVA IL PEZZO PIU IMPORTANTE ──
//
// Anche collegando tutto, il permesso concesso da solo non fa arrivare
// niente da un altro dispositivo. Serve ISCRIVERSI: chiedere al browser
// un recapito (PushManager.subscribe) e mandarlo al nostro server.
// Nessuno lo faceva — /api/push-subscribe esisteva e non la chiamava
// nessuno. Ora lo fa `iscriviAllePush`.
// ═══════════════════════════════════════════════════════════════

// La chiave VAPID viaggia in base64 per URL; PushManager la vuole in byte.
function chiaveInByte(base64) {
  const riempimento = '='.repeat((4 - (base64.length % 4)) % 4);
  const normale = (base64 + riempimento).replace(/-/g, '+').replace(/_/g, '/');
  const grezzo = atob(normale);
  const byte = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) byte[i] = grezzo.charCodeAt(i);
  return byte;
}

export function eInstallata() {
  if (typeof window === 'undefined') return false;
  return !!(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    // Safari su iPhone non implementa display-mode: usa una sua proprieta.
    || window.navigator?.standalone === true
  );
}

export function eIPhone() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

export default function usePWAInstall() {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notifPermission, setNotifPermission] = useState('default');
  const [installata, setInstallata] = useState(false);
  const iscrittaRef = useRef(false);

  // Capture install prompt
  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      if (!memGet('vt-install-dismissed')) {
        setShowInstallBanner(true);
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    if ('Notification' in window) setNotifPermission(Notification.permission);
    setInstallata(eInstallata());

    // ── b.134-bis · PROVATO DAL VIVO, E NON COMPARIVA ──
    //
    // Aperta la produzione su Chrome da computer, il banner non c'era.
    // Interrogando la pagina: non era stato rifiutato (`vt-install-
    // dismissed` nullo), l'applicazione non era installata, il service
    // worker girava. Mancava una cosa sola:
    //
    //     beforeinstallprompt: MAI ARRIVATO
    //
    // Chrome quell'evento lo emette quando vuole lui — dopo che
    // considera l'utente "abbastanza coinvolto" — e su desktop spesso
    // non lo emette affatto. Safari non lo implementa proprio.
    //
    // Avevo appeso tutto il banner a un evento che non e garantito:
    // esattamente la classe di difetto che stavo correggendo, cioe una
    // funzione che esiste e non si accende mai.
    //
    // Ora la regola non dipende da nessun evento: se l'applicazione non
    // e installata e nessuno ha detto di no, si propone. L'evento, se
    // arriva, serve solo a decidere se il bottone puo installare da solo
    // o se bisogna spiegare come si fa a mano.
    if (!eInstallata() && !memGet('vt-install-dismissed')) {
      // Un attimo di respiro: comparire nello stesso istante in cui la
      // pagina si disegna la fa sembrare un cartello pubblicitario.
      setTimeout(() => setShowInstallBanner(true), 2500);
    }

    // Se l'utente installa dal menu del browser invece che dal nostro
    // banner, il banner deve sparire lo stesso.
    const installato = () => { setInstallata(true); setShowInstallBanner(false); };
    window.addEventListener('appinstalled', installato);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', installato);
    };
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
    memSet('vt-install-dismissed', '1');
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    return perm;
  }

  /**
   * Chiede al browser un recapito e lo consegna al nostro server.
   *
   * Va chiamata a ogni avvio con il permesso gia concesso, non solo
   * quando lo si concede: il browser puo revocare o rigenerare
   * l'iscrizione, e il TTL su Redis e di trenta giorni. Chi apre
   * l'applicazione la rinnova senza accorgersene.
   *
   * Non solleva mai. Se le notifiche non si possono attivare,
   * l'applicazione funziona esattamente come prima.
   */
  const iscriviAllePush = useCallback(async (token) => {
    if (!token) return { ok: false, motivo: 'senza sessione non si sa a chi recapitare' };
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, motivo: 'browser senza notifiche push' };
    }
    if (Notification.permission !== 'granted') {
      return { ok: false, motivo: 'permesso non concesso' };
    }
    if (iscrittaRef.current) return { ok: true, motivo: 'gia iscritta in questa sessione' };

    try {
      // b.363 — chiamata senza scadenza: se restava appesa l'iscrizione
      // alle notifiche non finiva mai, e l'avvio dell'app la aspettava.
      const risp = await fetch('/api/push-subscribe', { signal: AbortSignal.timeout(10000) });
      if (!risp.ok) {
        // 503 = chiavi VAPID non impostate sul server. Non e un guasto
        // del telefono: non ha senso riprovare a ogni avvio in silenzio.
        return { ok: false, motivo: 'notifiche non configurate sul server' };
      }
      // b.363 — prima si leggeva il corpo come JSON senza rete di
      // sicurezza: una pagina d'errore faceva saltare tutta l'iscrizione
      // con un'eccezione invece del motivo leggibile qui sotto.
      const { publicKey } = await risp.json().catch(() => ({}));
      if (!publicKey) return { ok: false, motivo: 'chiave pubblica assente' };

      const reg = await navigator.serviceWorker.ready;
      // Se c'e gia un'iscrizione la si riusa: chiedere due volte con
      // chiavi diverse lascia un recapito morto sul server.
      let iscrizione = await reg.pushManager.getSubscription();
      if (!iscrizione) {
        iscrizione = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chiaveInByte(publicKey),
        });
      }

      const salvata = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, subscription: iscrizione.toJSON() }),
        // b.363 — anche il salvataggio dell'iscrizione era senza scadenza.
        signal: AbortSignal.timeout(10000),
      });
      if (!salvata.ok) return { ok: false, motivo: 'il server non ha salvato l\'iscrizione' };

      iscrittaRef.current = true;
      return { ok: true };
    } catch (e) {
      return { ok: false, motivo: e?.message || 'iscrizione non riuscita' };
    }
  }, []);

  return {
    showInstallBanner, notifPermission, installata,
    puoInstallare: !!deferredInstallPrompt,
    handleInstallApp, dismissInstallBanner, requestNotifPermission,
    iscriviAllePush,
  };
}

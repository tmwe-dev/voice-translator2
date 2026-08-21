'use client';
import { useState, useEffect } from 'react';
import { ascoltaPannelloPieno } from '../lib/pannelloPieno.js';
import Icon from './Icon.js';
import { FONT } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import { PALETTE } from '../lib/palette.js';
import { eIPhone } from '../hooks/usePWAInstall.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// ISTRUZIONI CERTE, NON "CERCA NEL MENU" (b.139)
//
// Luca, guardando il pannello sul suo telefono:
//   "NON C'e NESSUN INSTALLA DENTRO GOOGLE, FORSE IN SAFARI.
//    DEVI DARE ISTRUZIONI CERTE."
//
// Aveva ragione. Il testo diceva "apri il menu del browser e cerca
// Installa BarTalk": su Chrome da computer quella voce NEL MENU NON
// C'E — l'installazione sta nella barra dell'indirizzo, a destra. Su
// Android invece e' davvero nei tre puntini. Su Safari da iPhone si
// passa da Condividi. Su Firefox non si puo' installare affatto.
//
// Un'istruzione sbagliata e' peggio di nessuna istruzione: manda la
// persona a cercare una voce che non esiste e le fa credere di aver
// sbagliato lei.
// ═══════════════════════════════════════════════════════════════
function riconosciPiattaforma() {
  if (typeof navigator === 'undefined') return 'chrome';
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/firefox\//i.test(ua)) return 'firefox';
  // Safari da Mac: c'e' "Safari" ma non "Chrome" ne' "Chromium".
  if (/safari/i.test(ua) && !/chrome|chromium|edg/i.test(ua)) return 'safariMac';
  return 'chrome';
}

// ═══════════════════════════════════════════════════════════════
// INSTALLA, OPPURE RESTA NEL BROWSER (b.134)
//
// La scelta che Luca ha chiesto di dare al cliente. Il punto e che sia
// una scelta VERA, non una spinta travestita: chi resta nel browser
// deve poter continuare senza sentirsi mancante, perche su Android e su
// computer non gli manca quasi niente.
//
// L'unica differenza sostanziale, e va detta perche e decisiva:
//
//   Su iPhone le notifiche web funzionano SOLO se l'applicazione e
//   stata aggiunta alla schermata Home. Lo impone Apple da iOS 16.4.
//   Restando in Safari, un iPhone non ricevera mai un avviso — non per
//   un limite nostro.
//
// Percio il testo cambia col dispositivo. Su iPhone si spiega come si
// fa, perche `beforeinstallprompt` non esiste su Safari e non c'e
// nessun bottone da premere: si passa dal menu Condividi. Un banner con
// scritto "Installa" e nessun modo di installare sarebbe una presa in
// giro.
//
// Due colori soli, come per l'intestazione in b.129: l'accento per la
// via principale, il neutro per tutto il resto.
// ═══════════════════════════════════════════════════════════════

export default function InstallaApp({ pwa, theme }) {
  // b.139 — i testi erano in italiano fisso. Questo pannello e la prima
  // cosa che vede chi apre l'applicazione da un telefono nuovo: se parla
  // italiano a un turista tailandese, la scelta fra installare e restare
  // nel browser non e piu una scelta, e un indovinello.
  const { L } = useApp();
  const [istruzioniAperte, setIstruzioniAperte] = useState(false);
  // b.255 — non ci si mette davanti a un pannello che sta gia coprendo lo
  // schermo. Succedeva nel Mondo: i pannelli (discussione, persona,
  // scheda) non cambiano schermata, quindi la guardia per VISTA di page.js
  // non li vedeva, e questo banner atterrava sul campo di scrittura e sul
  // pulsante di invio proprio mentre si stava commentando.
  const [pannelloPieno, setPannelloPieno] = useState(false);
  useEffect(() => ascoltaPannelloPieno(setPannelloPieno), []);
  const S = getStyles(theme);
  const col = S.colors || {};

  const C = {
    card: col.glassCard || 'rgba(12,16,30,0.92)',
    bordo: col.cardBorder || 'rgba(255,255,255,0.08)',
    testo: col.textPrimary || PALETTE.grayLight,
    testoTenue: col.textMuted || 'rgba(242,244,247,0.60)',
    accento: col.accent1 || PALETTE.teal,
    velo: col.overlayBg || 'rgba(255,255,255,0.06)',
  };

  const suIPhone = eIPhone();

  if (!pwa?.showInstallBanner || pannelloPieno) return null;

  // ── b.134-bis · TRE SITUAZIONI DIVERSE, NON UNA ──
  //
  // Provando dal vivo su Chrome da computer ho trovato due cose.
  //
  // 1. `beforeinstallprompt` non era arrivato, quindi `puoInstallare`
  //    era falso: un bottone "Installa l'app" li non avrebbe avuto
  //    niente da chiamare. Non e un caso raro riservato a Safari — su
  //    desktop capita normalmente.
  //
  // 2. Il permesso delle notifiche risultava gia `denied`. E la
  //    situazione peggiore da gestire male: una volta negato, il
  //    browser NON lo richiede piu, e `requestNotifPermission()` torna
  //    subito 'denied' senza mostrare niente. L'utente premerebbe un
  //    bottone che non fa assolutamente nulla, per sempre.
  //    L'unico modo di riaprirla e il lucchetto accanto all'indirizzo,
  //    e va detto, perche nessuno lo indovina.
  const bloccate = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const aMano = !bloccate && !pwa.puoInstallare;

  // b.139 — LE ISTRUZIONI ERANO SBAGLIATE PER MEZZO MONDO.
  //
  // C'erano due sole varianti: iPhone e "tutto il resto". E il "tutto
  // il resto" diceva di aprire il menu del browser e cercare "Installa
  // BarTalk" — voce che su Chrome da COMPUTER nel menu non esiste:
  // l'installazione sta nella barra dell'indirizzo, a destra. Luca l'ha
  // trovato subito: "NON C'E NESSUN INSTALLA DENTRO GOOGLE".
  //
  // Un'istruzione sbagliata e peggio di nessuna: manda la persona a
  // cercare qualcosa che non c'e e le fa credere di aver sbagliato lei.
  //
  // Ora sono cinque percorsi veri, uno per piattaforma. Firefox ne ha
  // uno solo perche non permette di installare: e giusto dirlo invece
  // di far cercare a vuoto.
  const PASSI = {
    ios: ['instIos1', 'instIos2', 'instIos3'],
    android: ['instAndroid1', 'instAndroid2', 'instAndroid3'],
    chrome: ['instChrome1', 'instChrome2', 'instChrome3'],
    safariMac: ['instSafariMac1', 'instSafariMac2'],
    firefox: ['instFirefox'],
  };
  const istruzioni = (PASSI[riconosciPiattaforma()] || PASSI.chrome).map((k) => L(k));

  return (
    <div
      role="dialog"
      aria-label={L('installAppAria')}
      style={{
        // b.134-ter — PROVATO NEL BROWSER: COPRIVA LA NAVIGAZIONE.
        //
        // Con `bottom: 0` e zIndex 900 questo pannello si sedeva sopra la
        // BottomNav (fissa, alta 94px dal b.363, zIndex 50). Home, Chat, Community
        // e Profilo diventavano tutti inarrivabili: il banner non era un
        // fastidio, era un muro. Non me ne ero accorto perche l'avevo
        // provato leggendo il codice, non premendo i pulsanti.
        //
        // Ora si appoggia SOPRA la barra invece che addosso. L'altezza e
        // l'altezza dichiarata in BottomNav.js:98 — se cambia li, va
        // cambiata anche qui, e il commento serve a ricordarlo.
        position: 'fixed', left: 0, right: 0, zIndex: 900,
        bottom: 'calc(94px + env(safe-area-inset-bottom))', // b.363 — la barra sta a 94
        padding: '16px',
        background: C.card, borderTop: `1px solid ${C.bordo}`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        fontFamily: FONT,
        animation: 'vtSaleSu 0.28s ease-out',
      }}
    >
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: C.velo, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Non esiste un'icona "download" in Icon.js: su iPhone si usa
                quella di Condividi, che e' letteralmente il pulsante da
                cercare, altrove il piu di "aggiungi". */}
            <Icon name={suIPhone ? 'share' : 'plus'} size={20} color={C.accento} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.testo, marginBottom: 4 }}>
              {bloccate ? L('notifBlockedTitle') : L('installOnDeviceTitle')}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.testoTenue }}>
              {bloccate
                ? L('notifBlockedDesc')
                : suIPhone
                  ? L('installIphoneDesc')
                  : L('installGenericDesc')}
            </div>
          </div>
        </div>

        {istruzioniAperte && (
          <ol style={{
            margin: '0 0 14px', paddingLeft: 20,
            fontSize: 13, lineHeight: 1.7, color: C.testoTenue,
          }}>
            {(bloccate
              ? [L('notifFixStep1'), L('notifFixStep2'), L('notifFixStep3')]
              : istruzioni
            ).map((passo) => <li key={passo}>{passo}</li>)}
          </ol>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={async () => {
              // Se non c'e niente da chiamare — permesso gia negato, o
              // il browser non ci ha dato l'invito a installare — si
              // spiega. Un bottone che non fa niente e peggio di un
              // bottone che non c'e.
              if (bloccate || aMano || suIPhone) { setIstruzioniAperte((v) => !v); return; }
              await pwa.handleInstallApp();
              // Installare NON concede le notifiche: sono due permessi
              // distinti, e il primo non implica il secondo. Si chiede
              // qui perche e l'unico momento in cui l'utente ha appena
              // detto che li vuole — chiederlo all'avvio significa
              // farselo negare, e il browser non lo richiede piu.
              await pwa.requestNotifPermission?.();
            }}
            style={{
              flex: 1, padding: '13px 16px', borderRadius: 14, border: 'none',
              background: C.accento, color: '#fff',
              fontSize: 15, fontWeight: 700, fontFamily: FONT, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {(bloccate || aMano || suIPhone)
              ? (istruzioniAperte ? L('gotItWord') : L('howToDoIt'))
              : L('installTheApp')}
          </button>
          <button
            onClick={pwa.dismissInstallBanner}
            style={{
              padding: '13px 16px', borderRadius: 14,
              border: `1px solid ${C.bordo}`, background: C.velo, color: C.testoTenue,
              fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent', whiteSpace: 'nowrap',
            }}
          >
            {L('stayInBrowser')}
          </button>
        </div>
      </div>

      <style>{`@keyframes vtSaleSu { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

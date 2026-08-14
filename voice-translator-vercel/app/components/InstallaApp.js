'use client';
import { useState } from 'react';
import Icon from './Icon.js';
import { FONT } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import { PALETTE } from '../lib/palette.js';
import { eIPhone } from '../hooks/usePWAInstall.js';

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
  const [istruzioniAperte, setIstruzioniAperte] = useState(false);
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

  if (!pwa?.showInstallBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Installa BarTalk"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
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
              Installa BarTalk sul dispositivo
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: C.testoTenue }}>
              {suIPhone
                ? 'Su iPhone gli avvisi dei tuoi contatti arrivano solo con l’app aggiunta alla Home. In Safari non arriveranno.'
                : 'Ricevi gli avvisi dei tuoi contatti anche ad app chiusa, e apri BarTalk a schermo intero. Nel browser funziona tutto il resto.'}
            </div>
          </div>
        </div>

        {suIPhone && istruzioniAperte && (
          <ol style={{
            margin: '0 0 14px', paddingLeft: 20,
            fontSize: 13, lineHeight: 1.7, color: C.testoTenue,
          }}>
            <li>Tocca <strong style={{ color: C.testo }}>Condividi</strong> in basso in Safari</li>
            <li>Scorri e scegli <strong style={{ color: C.testo }}>Aggiungi a Home</strong></li>
            <li>Conferma con <strong style={{ color: C.testo }}>Aggiungi</strong></li>
          </ol>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={async () => {
              if (suIPhone) { setIstruzioniAperte((v) => !v); return; }
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
            {suIPhone ? (istruzioniAperte ? 'Ho capito' : 'Come si fa') : 'Installa l’app'}
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
            Resta nel browser
          </button>
        </div>
      </div>

      <style>{`@keyframes vtSaleSu { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}

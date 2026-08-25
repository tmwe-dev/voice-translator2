'use client';
import { memo } from 'react';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

/**
 * ConnectionQuality — Glassmorphism signal bars indicator
 * Shows connection status with gradient bars and glow effects.
 *
 * @param {string} webrtcState - 'idle' | 'connecting' | 'connected' | 'failed'
 * @param {boolean} partnerConnected - whether partner is in the room
 * @param {boolean} realtimeConnected - whether Supabase Realtime WebSocket is active
 * @param {object} [style] - optional style overrides
 */
const ConnectionQuality = memo(function ConnectionQuality({ webrtcState, partnerConnected, realtimeConnected, style }) {
  // b.138 — "Offline", "In attesa" e "Connessione..." erano italiano
  // fisso in mezzo a etichette tecniche (P2P, Realtime, Polling) che
  // restano uguali in tutte le lingue. Il suggerimento diceva
  // "Connessione: In attesa" anche a chi leggeva l'app in coreano.
  // b.394 — L'INDICATORE ERA INVISIBILE SUL TEMA CHIARO. Il pannellino,
  // le barre spente e la scritta di stato erano disegnati con bianchi e
  // un grigio fissi, decisi quando i temi erano tutti scuri: sul tema
  // chiaro il pannellino faceva 1,06 contro 1 (cioe niente) e la scritta
  // 3,34 contro 1, sotto il minimo leggibile. Ora seguono il tema come
  // tutto il resto.
  const { L, S } = useApp();
  // Determine quality level (0-4)
  let level = 0;
  let label = L('offlineWord');
  let color = S.colors.statusError || PALETTE.coral;

  if (!partnerConnected) {
    level = 0;
    label = L('connWaiting');
    color = S.colors.textTertiary;
  // b.482 — TRE SIGLE TECNICHE DIVENTANO TRE PAROLE. P2P, Realtime e
  // Polling sono nomi di protocolli: dicono come viaggia la voce, che
  // non e una cosa che chi parla debba sapere ne possa cambiare. E
  // restavano in inglese in tutte e trentotto le lingue, dentro un
  // suggerimento che il resto della frase traduce. Luca, guardando
  // questo indicatore dentro la chat: «a cosa serve qui dentro?».
  // Serve a una cosa sola — dire se la linea regge — e adesso lo dice
  // con una parola. I colori vengono dai token del tema, non piu da
  // quattro hex scelti a mano quando i temi erano tutti scuri.
  } else if (webrtcState === 'connected') {
    level = 4;
    label = L('connDirect');
    color = S.colors.statusOk;
  } else if (webrtcState === 'connecting') {
    level = 1;
    label = L('connConnecting');
    color = S.colors.statusWarning;
  } else if (realtimeConnected) {
    level = 3;
    label = L('connGood');
    color = S.colors.accent1;
  } else if (partnerConnected) {
    level = 2;
    label = L('connWeak');
    color = S.colors.statusWarning;
  }

  const barHeights = [5, 9, 13, 17];
  const barWidth = 3.5;
  const gap = 2.5;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'flex-end', gap,
      padding: '3px 8px', borderRadius: 8,
      background: S.colors.overlayBg,
      backdropFilter: 'blur(8px)',
      border: `1px solid ${S.colors.overlayBorder}`,
      transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      ...style,
    }}
      title={`${L('connectionWord')}: ${label}`}
      aria-label={`${L('connQualityAria')}: ${label}`}
    >
      {barHeights.map((h, i) => {
        const isActive = i < level;
        return (
          <div key={i} style={{
            width: barWidth,
            height: h,
            borderRadius: 2,
            background: isActive
              ? `linear-gradient(to top, ${color}CC, ${color})`
              : S.colors.toggleOff,
            boxShadow: isActive ? `0 0 6px ${color}40` : 'none',
            transform: isActive ? 'scaleY(1)' : 'scaleY(0.85)',
            transformOrigin: 'bottom',
            transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          }} />
        );
      })}
      <span style={{
        // otto pixel erano troppo pochi perche la scritta stesse in
        // riga dentro il menu: si spezzava in due e finiva addosso a
        // quella accanto.
        fontSize: 10, fontWeight: 600, color, whiteSpace: 'nowrap',
        marginLeft: 4, letterSpacing: 0.3,
        transition: 'color 0.3s ease',
        textShadow: level > 0 ? `0 0 8px ${color}40` : 'none',
      }}>
        {label}
      </span>
    </div>
  );
});

export default ConnectionQuality;

'use client';
import { useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { eSensibile } from '../../lib/sensibile.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// L'ANTEPRIMA COPERTA — c'e, ma la scopri tu.
//
// b.364, ordine di Luca: «l'anteprima coperta, che si scopre con un
// tocco: perfetto per tutti i contenuti sensibili».
//
// E' la sua stessa frase resa un gesto: «io non distribuisco a nessuno
// cio che non sceglie di osservare». Non e una censura — il contenuto
// e li, intero, a un dito di distanza. E' che quel dito lo mette la
// persona, non noi.
//
// E risolve anche il punto che ci avrebbe fatto togliere dai negozi:
// finche l'immagine e coperta, l'app non MOSTRA niente. La differenza
// fra un'app che espone e un'app che custodisce passa esattamente qui.
//
// COSA VA COPERTO NON SI DECIDE QUI: si decide in un posto solo
// (sensibile.js), cosi il giorno che il giudizio lo fa un'AI non si
// tocca nessuna schermata.
//
// IL RIQUADRO NON CAMBIA MAI DI MISURA. Coperta o scoperta, l'immagine
// occupa lo stesso identico spazio: scoprirla non fa scivolare in basso
// niente di quello che c'e sotto.
// ═══════════════════════════════════════════════════════════════

export default function AnteprimaCoperta({ src, contenuto, stile = {}, alt = '', L, C, ...resto }) {
  const [scoperta, setScoperta] = useState(false);
  if (!src) return null;

  const daCoprire = eSensibile(contenuto) && !scoperta;

  if (!daCoprire) {
    return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" style={stile} {...resto} />;
  }

  const raggio = stile.borderRadius ?? 0;
  const piccola = (typeof stile.width === 'number' && stile.width <= 90);

  return (
    <span
      role="button" tabIndex={0}
      aria-label={L ? L('tapToReveal') : 'Tocca per vedere'}
      // il tocco NON deve arrivare alla scheda sotto: scoprire e una
      // cosa, aprire l'articolo e un'altra.
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); vibrate(6); setScoperta(true); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setScoperta(true); }
      }}
      style={{
        ...stile,
        // se chi ci mette qui dentro aveva gia deciso la posizione
        // (le miniature grandi stanno 'absolute' dentro il loro
        // riquadro), quella si rispetta: se no l'immagine schizza
        // fuori dal posto suo.
        position: stile.position || 'relative', display: 'block', overflow: 'hidden',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        background: 'rgba(9,13,24,0.9)',
      }}>
      {/* l'immagine c'e, ma sfocata forte. Ingrandita di poco perche la
          sfocatura non lasci un alone chiaro sui bordi. */}
      <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
        aria-hidden="true"
        // b.365 — anche coperta puo essere un'immagine morta (parecchi
        // giornali le rifiutano a chi non e loro): se muore si toglie e
        // resta il velo, non l'icona di rotto del browser.
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
          filter: 'blur(18px) saturate(0.6)', transform: 'scale(1.25)',
        }} />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: raggio,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, background: 'rgba(6,9,18,0.52)', textAlign: 'center', padding: 4,
      }}>
        <Icon name="eye" size={piccola ? 15 : 20} color="rgba(226,236,252,0.92)" />
        {/* sul riquadro piccolo delle liste ci sta solo l'occhio: la
            parola andrebbe a capo tre volte e diventerebbe sporcizia. */}
        {!piccola && (
          <span style={{
            fontSize: 11, fontWeight: 700, fontFamily: FONT,
            color: 'rgba(226,236,252,0.92)', letterSpacing: 0.2,
          }}>
            {L ? L('tapToReveal') : 'Tocca per vedere'}
          </span>
        )}
      </span>
    </span>
  );
}

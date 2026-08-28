'use client';

// ═══════════════════════════════════════════════════════════════
// ASCOLTA — l'unico modo di chiedere «fammi sentire questo».
//
// b.404, ordine di Luca: «una sola grafica per i player». Il censimento
// ne ha trovate SETTE per la stessa azione:
//
//   Life          pillola in basso, tasti da 42
//   MessageList   icona da 14 dentro la riga del messaggio
//   Lettura       bottone di testo «▶ Ascolta»
//   Pronuncia     «▶ Ascolta la frase», «▶ Lenta», «▶ parola», 13px
//   Compagni      «▶ Prova voce», pieno, colore accento
//   Archivio      «▶ Riprendi» e «▶» per messaggio
//   TaxiTalk      «Ascolta» grigio, riga intera
//
// In tre casi il triangolo era scritto A MANO nel testo, invece di
// essere l'icona del sistema: per questo cambiava forma da una pagina
// all'altra.
//
// DUE TAGLIE, PERCHE I GESTI SONO DUE — e non si possono unire:
//
//   compatta   solo l'icona, per le righe fitte (un messaggio, una
//              parola, una frase in una lista)
//   estesa     icona piu parola, dove c'e spazio e serve dire cosa fa
//              («Ascolta», «Prova voce», «Riprendi»)
//
// Il TELECOMANDO invece e un'altra cosa e sta altrove (TelecomandoVoce):
// questo dice COSA far partire, quello governa cio che sta suonando.
// Metterli nello stesso posto vorrebbe dire o un telecomando che non sai
// cosa comanda, o cinquanta pulsanti fissi in fondo allo schermo.
// ═══════════════════════════════════════════════════════════════

import { IconPlay, IconVolume } from './Icons.js';
import { FONT, vibrate } from '../lib/constants.js';

export default function Ascolta({
  onAscolta,
  suona = false,          // sta suonando proprio questo?
  preparando = false,     // la voce e in arrivo
  parola = null,          // se c'e, la taglia e estesa
  colore = 'currentColor',
  sfondo = 'transparent',
  bordo = null,
  etichetta = 'Ascolta',  // per chi usa il lettore di schermo
  disabilitato = false,
}) {
  const esteso = Boolean(parola);
  const misura = esteso ? 15 : 20;

  return (
    <button
      type="button"
      onClick={() => { if (disabilitato || preparando) return; vibrate(6); onAscolta?.(); }}
      disabled={disabilitato}
      aria-label={etichetta}
      aria-pressed={suona}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: esteso ? 7 : 0,
        // b.404 — la mano ha bisogno di 32 pixel anche quando il segno ne
        // occupa 20: sotto quella misura il tocco manca il bersaglio, ed e
        // il motivo per cui le icone da 13 e 14 sembravano non rispondere.
        minWidth: esteso ? 'auto' : 32, minHeight: 32,
        padding: esteso ? '7px 12px' : 0,
        borderRadius: esteso ? 10 : 16,
        background: sfondo,
        border: bordo || 'none',
        color: colore,
        cursor: disabilitato ? 'default' : 'pointer',
        opacity: disabilitato ? 0.45 : 1,
        fontFamily: FONT, fontSize: 13, fontWeight: 500,
        WebkitTapHighlightColor: 'transparent',
        transition: 'opacity .15s, background .15s',
      }}>
      {preparando
        ? <span style={{ fontSize: misura, lineHeight: 1 }}>…</span>
        : suona
          ? <IconVolume size={misura} />
          : <IconPlay size={misura} />}
      {esteso && <span>{parola}</span>}
    </button>
  );
}

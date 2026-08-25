'use client';

// ═══════════════════════════════════════════════════════════════
// IL TELECOMANDO DELLA VOCE — uno solo, per tutta la piattaforma.
//
// b.404, ordine di Luca: «verifichiamo se possiamo usare solo una
// grafica e una sola posizione per i player».
//
// Il censimento ha trovato SETTE interfacce diverse per la stessa
// azione — dalla pillola di Life coi tasti da 42 pixel all'icona da 14
// dentro la riga di un messaggio — e SEDICI punti che fanno suonare
// qualcosa, di cui solo quattro passavano dal registro.
//
// Questo componente e la pillola di Life, presa com'era (b.305) e
// portata fuori: da `LifeView` a `page.js`, cosi vale anche nella
// stanza, nel taxi, nell'archivio e nelle notizie. Non e stata
// ridisegnata: era gia quella giusta — compare solo se qualcosa suona,
// ti segue mentre cambi pagina, e i suoi due tasti si leggono.
//
// L'UNICA aggiunta e la quota: sta SOPRA la barra in basso invece che
// sul bordo, perche fuori da Life sotto c'e il menu dell'app e li
// finiva a coprirlo.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { FONT } from '../lib/constants.js';
import { stato as statoVoce, ascolta, pausa, riprendi, ferma } from '../lib/voce.js';
import Icon from './Icon.js';

export default function TelecomandoVoce({ L, accent = '#26D9B0', testoP = '#eaf0ff', sopraLaBarra = true }) {
  const [voce, setVoce] = useState(statoVoce);
  useEffect(() => ascolta(setVoce), []);

  if (!voce.attivo) return null;

  const parola = (chiave, difetto) => {
    try { return L ? L(chiave) : difetto; } catch { return difetto; }
  };

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      // b.404 — dentro Life sotto non c'e niente e la pillola sta sul
      // bordo; fuori c'e il menu dell'app, e li sopra ci deve stare.
      bottom: sopraLaBarra
        ? 'calc(76px + max(12px, env(safe-area-inset-bottom)))'
        : 'max(16px, env(safe-area-inset-bottom))',
      zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 16px',
      borderRadius: 999, background: 'rgba(8,11,22,0.94)', backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: `1px solid ${accent}55`, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontFamily: FONT,
    }}>
      {/* b.482 — era un'EMOJI. La disegna il telefono, a colori e con la sua
          faccia: in mezzo a icone monocrome sembra incollata da un'altra
          applicazione, e dove non esiste compare un rettangolo vuoto. */}
      <span style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 13, fontWeight: 600, color: testoP, maxWidth: 120,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        <Icon name="speaker" size={13} /> {voce.etichetta || parola('lifeAudio', 'Audio')}
      </span>

      {/* Mentre prepara la voce dopo, il telecomando resta ma non finge
          di poter mettere in pausa il silenzio (b.376). */}
      <button onClick={() => (voce.inPausa ? riprendi() : pausa())}
        disabled={voce.preparando}
        aria-label={voce.preparando
          ? parola('lifePreparing', 'Preparo')
          : (voce.inPausa ? parola('lifeResumeWord', 'Riprendi') : parola('lifePauseWord', 'Pausa'))}
        style={{
          width: 44, height: 44, borderRadius: 22, border: 'none',
          cursor: voce.preparando ? 'default' : 'pointer',
          background: voce.preparando ? `${accent}44` : accent,
          color: '#04121c', fontSize: 18, fontWeight: 900,
        }}>
        {voce.preparando ? '…' : voce.inPausa ? '▶' : '⏸'}
      </button>

      {/* Stop ferma anche la FABBRICA dei turni, non solo la voce in
          corso: i cicli si iscrivono a `suInterruzione` (b.363). */}
      <button onClick={() => ferma()} aria-label={parola('stopAudio', 'Interrompi')}
        style={{
          width: 44, height: 44, borderRadius: 22, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${testoP}44`, color: testoP, fontSize: 15,
        }}>
        {'⏹'}
      </button>
    </div>
  );
}

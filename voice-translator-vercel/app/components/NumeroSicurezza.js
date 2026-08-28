'use client';
import { useState } from 'react';
import { FONT } from '../lib/constants.js';
import { useApp } from '../contexts/AppContext.js';
import { COSTANTI_IMPRONTA } from '../lib/improntaChiavi.js';

// ═══════════════════════════════════════════════════════════════
// IL NUMERO DI SICUREZZA, MOSTRATO (b.113)
//
// La cosa piu importante di questo pannello non e il numero: e la
// distinzione fra due frasi che sembrano uguali e non lo sono.
//
//   "I messaggi sono cifrati."
//        Vero appena le chiavi si sono scambiate. Protegge da chi
//        ascolta la rete e dal relay che inoltra i pacchetti.
//
//   "Sto parlando con la persona giusta."
//        NON lo sa nessuno finche le due persone non confrontano
//        questo numero. Chi controlla il signaling potrebbe essersi
//        messo in mezzo, con due conversazioni cifrate benissimo e se
//        stesso nel centro.
//
// Molti programmi mostrano un lucchetto e si fermano li, lasciando
// credere la seconda cosa mentre garantiscono solo la prima. Qui le
// due frasi stanno separate, e la seconda si accende solo quando
// qualcuno l'ha davvero verificata.
//
// La spunta si mette a mano, e resta solo per questa conversazione:
// le chiavi sono effimere, quindi la prossima volta il numero sara un
// altro e andra confrontato di nuovo. Ricordarlo sarebbe comodo e
// falso.
// ═══════════════════════════════════════════════════════════════

// b.138 — il pannello che spiega la cifratura era interamente in
// italiano. E il testo che deve convincere uno sconosciuto che nessuno
// sta ascoltando: letto in una lingua che non si capisce non convince
// nessuno, e chi apriva l'app in inglese lo trovava cosi.
export default function NumeroSicurezza({ numero, C, compatto = false }) {
  const { L } = useApp();
  const [aperto, setAperto] = useState(false);
  const [verificato, setVerificato] = useState(false);

  const pronto = !!numero;
  const testoMuto = C?.textMuted || '#8B93A7';
  const testoVivo = C?.textPrimary || '#E8ECF4';
  const bordo = C?.cardBorder || 'rgba(255,255,255,0.08)';
  const fondo = C?.cardBg || 'rgba(255,255,255,0.04)';
  const verde = '#26D9B0';
  const ambra = '#F59E0B';

  if (compatto && !aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px',
          borderRadius: 8, cursor: 'pointer', fontFamily: FONT, fontSize: 10,
          fontWeight: 500, background: 'transparent', border: `1px solid ${bordo}`,
          color: verificato ? verde : testoMuto,
        }}
        aria-label={verificato ? L('secVerifiedAria') : L('secVerifyAria')}
      >
        <span aria-hidden="true">{verificato ? '✓' : '·'}</span>
        {verificato ? L('secVerified') : L('secEncrypted')}
      </button>
    );
  }

  return (
    <div style={{
      padding: 14, borderRadius: 12, background: fondo,
      border: `1px solid ${verificato ? `${verde}40` : bordo}`, fontFamily: FONT,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: testoVivo, marginBottom: 8 }}>
        {L('secWhoTitle')}
      </div>

      {/* Le due frasi, tenute separate apposta. */}
      <div style={{ fontSize: 11, color: testoMuto, lineHeight: 1.6, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <span aria-hidden="true" style={{ color: verde, fontWeight: 500 }}>✓</span>
          <span>{L('secLine1')}</span>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
          <span aria-hidden="true" style={{ color: verificato ? verde : ambra, fontWeight: 500 }}>
            {verificato ? '✓' : '!'}
          </span>
          <span style={{ color: verificato ? testoMuto : testoVivo }}>
            {verificato ? L('secLine2Ok') : L('secLine2No')}
          </span>
        </div>
      </div>

      {pronto ? (
        <>
          {/* b.490 — tavola 20: il numero e LA COSA GRANDE. Era 17 punti,
              da leggere a voce strizzando gli occhi; ora e 28, a gruppi
              (li fa gia improntaChiavi), cifre tabulari, e va a capo da
              solo se i gruppi non stanno in una riga — «si legge a voce
              senza perdere il segno». */}
          <div style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 28, fontWeight: 500, letterSpacing: 3, color: testoVivo,
            lineHeight: 1.5, padding: '12px 12px', borderRadius: 9,
            background: 'rgba(0,0,0,0.22)', textAlign: 'center', userSelect: 'all',
            fontVariantNumeric: 'tabular-nums', overflowWrap: 'break-word',
          }}>
            {numero}
          </div>

          <div style={{ fontSize: 10, color: testoMuto, lineHeight: 1.5, marginTop: 9 }}>
            {L('secReadAloud')}
            <br />
            <span style={{ opacity: 0.75 }}>
              {L('secOnlyThisChat')}
            </span>
          </div>

          {/* b.490 — tavola 20: quando i numeri combaciano lo si LEGGE,
              col pallino verde — prima il bottone spariva e restava solo
              un bordo piu verde, che non dice niente a voce alta. */}
          {verificato && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 11, color: verde, fontSize: 14, fontWeight: 500 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: verde }} />
              {L('secNumbersMatch')}
            </div>
          )}
          {!verificato && (
            <button
              onClick={() => setVerificato(true)}
              style={{
                marginTop: 11, width: '100%', padding: '9px 12px', borderRadius: 9,
                cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 500,
                background: `${verde}18`, border: `1px solid ${verde}40`, color: verde,
              }}
            >
              {L('secNumbersMatch')}
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: testoMuto, fontStyle: 'italic' }}>
          {L('secKeysExchanging')}
        </div>
      )}

      {compatto && (
        <button
          onClick={() => setAperto(false)}
          style={{
            marginTop: 9, width: '100%', padding: '7px', borderRadius: 8,
            cursor: 'pointer', fontFamily: FONT, fontSize: 11,
            background: 'transparent', border: `1px solid ${bordo}`, color: testoMuto,
          }}
        >
          {L('closeWord')}
        </button>
      )}
    </div>
  );
}

export { COSTANTI_IMPRONTA };

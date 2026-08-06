'use client';
import { useState } from 'react';
import { FONT } from '../lib/constants.js';
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

export default function NumeroSicurezza({ numero, C, compatto = false }) {
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
          fontWeight: 700, background: 'transparent', border: `1px solid ${bordo}`,
          color: verificato ? verde : testoMuto,
        }}
        aria-label={verificato ? 'Conversazione verificata' : 'Verifica con chi stai parlando'}
      >
        <span aria-hidden="true">{verificato ? '✓' : '·'}</span>
        {verificato ? 'Verificata' : 'Cifrata'}
      </button>
    );
  }

  return (
    <div style={{
      padding: 14, borderRadius: 12, background: fondo,
      border: `1px solid ${verificato ? `${verde}40` : bordo}`, fontFamily: FONT,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: testoVivo, marginBottom: 8 }}>
        Con chi stai parlando
      </div>

      {/* Le due frasi, tenute separate apposta. */}
      <div style={{ fontSize: 11, color: testoMuto, lineHeight: 1.6, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <span aria-hidden="true" style={{ color: verde, fontWeight: 800 }}>✓</span>
          <span>I messaggi sono cifrati fra i due telefoni. Chi inoltra il
            traffico non può leggerli.</span>
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 6 }}>
          <span aria-hidden="true" style={{ color: verificato ? verde : ambra, fontWeight: 800 }}>
            {verificato ? '✓' : '!'}
          </span>
          <span style={{ color: verificato ? testoMuto : testoVivo }}>
            {verificato
              ? 'Avete confrontato il numero: nessuno si è messo in mezzo.'
              : 'Che sia davvero la persona giusta, però, non lo sa nemmeno il programma. Lo potete sapere solo voi due, confrontando questo numero.'}
          </span>
        </div>
      </div>

      {pronto ? (
        <>
          <div style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 17, letterSpacing: 1.5, color: testoVivo,
            padding: '10px 12px', borderRadius: 9,
            background: 'rgba(0,0,0,0.22)', textAlign: 'center', userSelect: 'all',
          }}>
            {numero}
          </div>

          <div style={{ fontSize: 10, color: testoMuto, lineHeight: 1.5, marginTop: 9 }}>
            Leggetelo a voce, o guardate lo schermo dell’altro. Se i due numeri
            sono uguali, state parlando davvero fra voi. Se sono diversi,
            qualcuno è in mezzo: chiudete la conversazione.
            <br />
            <span style={{ opacity: 0.75 }}>
              Vale solo per questa conversazione: le chiavi cambiano ogni volta.
            </span>
          </div>

          {!verificato && (
            <button
              onClick={() => setVerificato(true)}
              style={{
                marginTop: 11, width: '100%', padding: '9px 12px', borderRadius: 9,
                cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 700,
                background: `${verde}18`, border: `1px solid ${verde}40`, color: verde,
              }}
            >
              I numeri combaciano
            </button>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: testoMuto, fontStyle: 'italic' }}>
          Le chiavi si stanno ancora scambiando. Il numero compare fra un istante.
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
          Chiudi
        </button>
      )}
    </div>
  );
}

export { COSTANTI_IMPRONTA };

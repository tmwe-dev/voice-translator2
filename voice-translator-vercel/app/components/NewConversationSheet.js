'use client';

import { memo, useState, useEffect } from 'react';
import { vibrate } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════════════════════
// Pannello del tasto "+" — b.93
//
// Prima ripeteva ESATTAMENTE le quattro voci gia presenti in Home:
// il tasto piu in vista dell'app non aggiungeva nulla.
//
// Ora fa le cose che da nessun'altra parte si possono fare. La prima
// e la piu importante: ENTRARE CON UN CODICE. La pagina esisteva gia
// ma era irraggiungibile — ci si arrivava solo da un link o da un QR.
// Se un amico ti detta il codice a voce, prima non c'era modo di usarlo.
// ═══════════════════════════════════════════════════════════════

// b.138 — le quattro voci erano scritte a mano in italiano. E il
// pannello del tasto "+", il piu premuto dell'app: chi lo apriva con
// l'interfaccia in un'altra lingua trovava quattro righe italiane.
// b.442 — in testa le porte per parlare, arrivate dalla Home (il template
// non le mostra piu li). Il gestore in page.js le instradava gia da b.93
// come «voci storiche»: qui vengono solo rese visibili.
// b.458, collaudo di Luca. Sono spariti tre tasti, e ognuno per un motivo
// suo:
//   «Chat di gruppo» e «Invita una persona» → aprivano la STESSA cosa che
//   apre il barcode qui sopra: una stanza, e da li si invita chi si vuole,
//   quante persone si vuole. Tre porte per una stanza sola. Ne resta una.
//   «TaxiTalk» → esiste gia in Home: e «Parla ora», che si ribalta verso
//   chi hai davanti e sa dire dove vuoi andare. Una seconda porta per la
//   stessa cosa fa solo dubitare che siano due cose diverse.
// ═══ b.551 — IL «+» DIMAGRISCE ANCORA, e stavolta per un motivo nuovo ═══
// Difetto che avevo dichiarato io e Luca ha confermato: «il + della barra
// mescola cinque cose di tre famiglie diverse». Era vero, ma nel
// frattempo e' successo qualcosa che lo rende peggio: da b.537 il tasto
// «Chat» della barra apre le STANZE, e dentro quella schermata ci sono
// gia, in alto, la porta «entra col codice» e quella dell'archivio.
// Tenerle anche qui vuol dire due strade per la stessa cosa a un
// centimetro di distanza — il doppione che abbiamo tolto tre volte
// altrove. Restano le due porte che il «+» apre DA SOLO:
//   · una stanza pubblica nuova (creare e' un gesto suo)
//   · i contatti (che non vivono in nessuna delle quattro schede)
const OPTIONS = [
  { id: 'stanza-community', icona: 'globe', titleKey: 'optPublicTitle', descKey: 'optPublicDesc' },
  { id: 'contatti', icona: 'user', titleKey: 'optContactsTitle', descKey: 'optContactsDesc' },
];

const NewConversationSheet = ({ open, onClose, onSelect }) => {
  const { L, S } = useApp();
  const C = S?.colors || {};
  const sheetRef = useSheetA11y(open, onClose);

  // ═══════════════════════════════════════════════════════════════
  // b.461 — LA HOME NON DEVE PIU LAMPEGGIARE.
  //
  // Collaudo di Luca: «quando schiaccio il logo per il QR, invece di aprire
  // il QR mostra per due secondi la home e poi apre il popup».
  //
  // La maschera si chiudeva SUBITO, mentre la stanza si stava ancora
  // creando sul server: per quei due secondi sotto non c'era ancora niente,
  // e si vedeva la Home. Non era un ritardo da togliere — la stanza ci
  // mette quel che ci mette — era una tenda tirata via troppo presto.
  //
  // Adesso la maschera resta su finche non si e arrivati: la chiude il
  // cambio di schermata, cioe il momento in cui SOTTO c'e qualcosa da
  // vedere. Nel frattempo spegne le altre voci, cosi si vede che sta
  // lavorando e non lo si tocca due volte.
  // ═══════════════════════════════════════════════════════════════
  const [inCorso, setInCorso] = useState(null);
  // se dopo dodici secondi non e successo niente — rete caduta, server muto
  // — la maschera non resta incastrata: si riapre alla scelta.
  useEffect(() => {
    if (!inCorso) return undefined;
    const t = setTimeout(() => setInCorso(null), 12000);
    return () => clearTimeout(t);
  }, [inCorso]);
  useEffect(() => { if (!open) setInCorso(null); }, [open]);
  const scegli = (id) => { vibrate(15); setInCorso(id); onSelect(id); };

  if (!open) return null;

  const accentColor = C.accent1 || PALETTE.purple;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        // b.442, ordine di Luca: «il + apre una lista con anche il barcode,
        // e deve andare A TUTTA PAGINA, cosi da contenerli comodamente».
        position: 'fixed', inset: 0, zIndex: 100,
        backgroundColor: C.bg || '#05070f',
        display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        animation: 'ncsOverlayIn 0.2s ease-out',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={L('newConversation')}
    >
      <div ref={sheetRef} style={{
        width: '100%', maxWidth: '520px', height: '100%',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>
        {/* testata: titolo e chiudi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, padding: '4px 20px 8px' }}>
          <h2 style={{
            flex: 1, minWidth: 0, margin: 0, fontSize: '20px', fontWeight: 500,
            color: C.textPrimary || '#fff',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          }}>
            {L('whatToDo')}
          </h2>
          <button onClick={() => { vibrate(); onClose(); }} aria-label={L('close')}
            style={{
              width: 44, height: 44, borderRadius: 22, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.cardBg || 'rgba(255,255,255,0.05)',
              border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
            <Icon name="x" size={20} color={C.textMuted || 'rgba(255,255,255,0.6)'} />
          </button>
        </div>

        {/* il corpo scorre: in cima il barcode, sotto le porte */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '4px 20px calc(24px + env(safe-area-inset-bottom))' }}>

        {/* b.442 — IL BARCODE, la porta faccia-a-faccia: grande, in cima. */}
        <button
          onClick={() => scegli('face-to-face')}
          aria-label={L('actFaceTitle')}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 6, padding: '8px 8px 18px', marginBottom: 8,
            opacity: inCorso && inCorso !== 'face-to-face' ? 0.35 : 1,
            pointerEvents: inCorso ? 'none' : 'auto',
            background: 'none', border: 'none', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- immagine locale */}
          <img src="/qr-faccia-a-faccia.webp" alt="" aria-hidden width={1200} height={619}
            style={{ width: '82%', maxWidth: 320, height: 'auto', display: 'block' }} />
          <span style={{ fontSize: 18, fontWeight: 500, color: C.textPrimary || '#fff',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", textAlign: 'center' }}>
            {L('actFaceTitle')}
          </span>
          <span style={{ fontSize: 12.5, color: C.textMuted || 'rgba(255,255,255,0.5)',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            textAlign: 'center', lineHeight: 1.4, maxWidth: 300 }}>
            {L('actFaceDesc')}
          </span>
        </button>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => scegli(opt.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '14px',
                backgroundColor: C.inputBg || 'rgba(255,255,255,0.05)',
                border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'background-color 0.15s, transform 0.1s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(139,92,246,0.12)`;
                e.currentTarget.style.borderColor = accentColor;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = C.inputBg || 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = C.cardBorder || 'rgba(255,255,255,0.06)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ lineHeight: 0, flexShrink: 0, color: (S.colors?.accent2 || '#38e1ff') }}>
                <Icon name={opt.icona} size={24} color={C.accent1 || '#5b8cff'} />
              </span>
              <div>
                <div style={{
                  fontSize: '15px', fontWeight: 500,
                  color: C.text || '#fff', marginBottom: '2px',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  {L(opt.titleKey)}
                </div>
                <div style={{
                  fontSize: '13px', color: C.textMuted || 'rgba(255,255,255,0.5)',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}>
                  {L(opt.descKey)}
                </div>
              </div>
            </button>
          ))}
        </div>
        </div>
      </div>

      <style>{`
        @keyframes ncsOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ncsSheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default memo(NewConversationSheet);

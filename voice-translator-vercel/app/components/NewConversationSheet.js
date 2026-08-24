'use client';

import { memo } from 'react';
import { vibrate, FONT } from '../lib/constants.js';
import useSheetA11y from '../hooks/useSheetA11y.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';
import Icon from './Icon.js';
import { IconCar } from './Icons.js';

// ═══════════════════════════════════════════════════════════════
// Il tasto "+" — b.93 → b.436
//
// b.436, ordine di Luca: «il + apre una lista con anche il barcode.
// Questa lista deve andare A TUTTA PAGINA, cosi da contenere direttamente
// il barcode e le altre opzioni in modo comodo».
//
// Prima erano due superfici separate: il barcode faccia-a-faccia stava in
// Home, il "+" apriva un foglietto in basso con altre quattro voci. Ora e
// una sola, a pagina piena: in cima il barcode (faccia-a-faccia), sotto
// TUTTI i modi per connettersi. La Home resta il microfono e le sezioni.
//
// Il gestore (handleNewConversationSelect in page.js) instradava gia
// face-to-face, invite, videocall e taxitalk: qui vengono solo mostrati.
// ═══════════════════════════════════════════════════════════════

// b.138 — ogni voce e una chiave dei pacchetti lingua, mai testo cablato.
// b.436 — in testa le porte per parlare (venivano dalla Home), poi quelle
// che solo il "+" sa aprire.
const OPTIONS = [
  { id: 'videocall', icona: 'video', titleKey: 'actRoomTitle', descKey: 'actRoomDesc' },
  { id: 'invite', icona: 'share', titleKey: 'actInviteTitle', descKey: 'actInviteDesc' },
  { id: 'taxitalk', speciale: 'car', title: 'TaxiTalk', descKey: 'actTaxiDesc' },
  { id: 'entra-codice', icona: 'doorOpen', titleKey: 'optCodeTitle', descKey: 'optCodeDesc' },
  { id: 'stanza-community', icona: 'globe', titleKey: 'optPublicTitle', descKey: 'optPublicDesc' },
  { id: 'contatti', icona: 'user', titleKey: 'optContactsTitle', descKey: 'optContactsDesc' },
  { id: 'cronologia', icona: 'history', titleKey: 'optSavedTitle', descKey: 'optSavedDesc' },
];

const NewConversationSheet = ({ open, onClose, onSelect }) => {
  const { L, S } = useApp();
  const C = S?.colors || {};
  const sheetRef = useSheetA11y(open, onClose);

  if (!open) return null;

  const accentColor = C.accent1 || PALETTE.purple;
  const scegli = (id) => { vibrate(15); onSelect(id); onClose(); };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={L('newConversation')}
      style={{
        // b.436 — A TUTTA PAGINA, non piu un foglietto in basso.
        position: 'fixed', inset: 0, zIndex: 100,
        background: C.bg || '#05070f',
        animation: 'ncsPageIn 0.22s ease-out',
      }}
    >
      <div ref={sheetRef} style={{
        height: '100%', width: '100%', maxWidth: 520, margin: '0 auto',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
      }}>

        {/* testata: titolo a sinistra, chiudi a destra */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          padding: '4px 16px 8px',
        }}>
          <h2 style={{
            flex: 1, minWidth: 0, margin: 0, fontFamily: FONT,
            fontSize: 20, fontWeight: 600, color: C.textPrimary || '#fff',
          }}>
            {L('whatToDo')}
          </h2>
          <button
            onClick={() => { vibrate(); onClose(); }}
            aria-label={L('close') || '✕'}
            style={{
              width: 44, height: 44, borderRadius: 22, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: C.cardBg || 'rgba(255,255,255,0.05)',
              border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon name="x" size={20} color={C.textMuted || 'rgba(255,255,255,0.6)'} />
          </button>
        </div>

        {/* il corpo scorre: in cima il barcode, sotto la lista */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none',
          padding: '4px 16px calc(24px + env(safe-area-inset-bottom))',
        }}>

          {/* b.436 — IL BARCODE: e la porta faccia-a-faccia, la piu
              importante. Grande in cima, si tocca e apre la stanza. */}
          <button
            onClick={() => scegli('face-to-face')}
            aria-label={L('actFaceTitle')}
            style={{
              width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: '8px 8px 18px', marginBottom: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- immagine locale, non serve next/image */}
            <img
              src="/qr-faccia-a-faccia.webp"
              alt=""
              aria-hidden
              width={1200} height={619}
              style={{ width: '82%', maxWidth: 320, height: 'auto', display: 'block' }}
            />
            <span style={{
              fontFamily: FONT, fontSize: 18, fontWeight: 600,
              color: C.textPrimary || '#fff', textAlign: 'center',
            }}>
              {L('actFaceTitle')}
            </span>
            <span style={{
              fontFamily: FONT, fontSize: 12.5, color: C.textMuted || 'rgba(255,255,255,0.5)',
              textAlign: 'center', lineHeight: 1.4, maxWidth: 300,
            }}>
              {L('actFaceDesc')}
            </span>
          </button>

          {/* le altre porte, una sotto l'altra */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => scegli(opt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  backgroundColor: C.inputBg || 'rgba(255,255,255,0.05)',
                  border: `1px solid ${C.cardBorder || 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background-color 0.15s, transform 0.1s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = `${accentColor}1f`;
                  e.currentTarget.style.borderColor = accentColor;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = C.inputBg || 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = C.cardBorder || 'rgba(255,255,255,0.06)';
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <span style={{ lineHeight: 0, flexShrink: 0, color: accentColor }}>
                  {opt.speciale === 'car'
                    ? <span style={{ color: C.goldAccent || '#ffc44d', lineHeight: 0 }}><IconCar size={24} /></span>
                    : <Icon name={opt.icona} size={24} color={accentColor} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600, marginBottom: 2,
                    color: C.textPrimary || '#fff', fontFamily: FONT,
                  }}>
                    {opt.title || L(opt.titleKey)}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.textMuted || 'rgba(255,255,255,0.5)', fontFamily: FONT,
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
        @keyframes ncsPageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default memo(NewConversationSheet);

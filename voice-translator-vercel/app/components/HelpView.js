'use client';
import { memo, useState } from 'react';
import { FONT } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// HelpView — FAQ + Quick Tutorial
//
// Accordion FAQ, feature cards, version info.
// Glassmorphism design, ambient orb, stagger anim.
// ═══════════════════════════════════════════════

// ── b.138 · la guida era scritta in italiano, per chiunque ──
//
// Le dieci domande e le sei funzioni stavano qui come testo fisso:
// chi apriva l'Aiuto con l'interfaccia in inglese, in cinese o in
// arabo si trovava davanti dieci paragrafi in italiano — proprio
// nella pagina che si apre quando NON si e capito qualcosa. Ora le
// due liste portano solo i nomi delle chiavi.
const FAQ_ITEMS = [
  { qKey: 'faqHowQ', aKey: 'faqHowA', icon: '' },
  { qKey: 'faqTaxiQ', aKey: 'faqTaxiA', icon: '' },
  { qKey: 'faqPriceQ', aKey: 'faqPriceA', icon: '🆓' },
  { qKey: 'faqRoomQ', aKey: 'faqRoomA', icon: '' },
  { qKey: 'faqLangsQ', aKey: 'faqLangsA', icon: '' },
  { qKey: 'faqLiveQ', aKey: 'faqLiveA', icon: '' },
  { qKey: 'faqMirrorQ', aKey: 'faqMirrorA', icon: '' },
  { qKey: 'faqCloneQ', aKey: 'faqCloneA', icon: '' },
  { qKey: 'faqInviteQ', aKey: 'faqInviteA', icon: '' },
  { qKey: 'faqPrivacyQ', aKey: 'faqPrivacyA', icon: '' },
];

// TaxiTalk e Voice Clone sono nomi propri e restano tali: non hanno chiave.
const FEATURES = [
  { icon: '', titleKey: 'helpFeatVoiceTitle', descKey: 'helpFeatVoiceDesc' },
  { icon: '', title: 'TaxiTalk', descKey: 'helpFeatTaxiDesc' },
  { icon: '', titleKey: 'helpFeatRoomsTitle', descKey: 'helpFeatRoomsDesc' },
  { icon: '', titleKey: 'helpFeatWorldTitle', descKey: 'helpFeatWorldDesc' },
  { icon: '', titleKey: 'helpFeatMirrorTitle', descKey: 'helpFeatMirrorDesc' },
  { icon: '', title: 'Voice Clone', descKey: 'helpFeatCloneDesc' },
];

function HelpView() {
  const { L, S, prefs, setView, theme } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    // Fondo dal TEMA: prima era fisso e il tema chiaro restava nero.
    bg: col.bg || PALETTE.bgDeep,
    textPrimary: col.textPrimary || PALETTE.grayLight,
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
  };

  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-20%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={() => setView('settings')} style={{
          width: 44, height: 44, borderRadius: 12, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.textMuted, fontSize: 18, WebkitTapHighlightColor: 'transparent',
        }}>‹</button>
        <div style={{ flex: 1 }}>
          {/* b.482 — l'emoji del punto interrogativo se ne va: il titolo
              basta da solo, e sotto c'e gia il sottotitolo che spiega. */}
          <div style={{ fontSize: 17, fontWeight: 500, color: C.textPrimary, letterSpacing: -0.5 }}>
            {L('helpTitle')}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{L('helpSubtitle')}</div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      {/* b.206 — bottom alzato: fine contenuto finiva sotto la BottomNav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px calc(88px + env(safe-area-inset-bottom))', scrollbarWidth: 'none' }}>

        {/* Feature cards grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5,
            color: C.textMuted, marginBottom: 10, padding: '0 2px',
          }}>
            {L('helpFeaturesTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                padding: '14px 12px', borderRadius: 16,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                animation: `vtSlideUp 0.3s ease-out ${i * 0.05}s both`,
              }}>
                {f.icon && <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>}
                <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, marginBottom: 2 }}>{f.title || L(f.titleKey)}</div>
                <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4 }}>{L(f.descKey)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Accordion */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5,
            color: C.textMuted, marginBottom: 10, padding: '0 2px',
          }}>
            {L('landingFaqTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FAQ_ITEMS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{
                  borderRadius: 16, overflow: 'hidden',
                  background: C.card, border: `1px solid ${isOpen ? `${C.accent}20` : C.cardBorder}`,
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  transition: 'border-color 0.2s',
                  animation: `vtSlideUp 0.3s ease-out ${(i + FEATURES.length) * 0.04}s both`,
                }}>
                  <button onClick={() => setOpenFaq(isOpen ? null : i)} style={{
                    width: '100%', padding: '12px 14px', cursor: 'pointer',
                    background: 'none', border: 'none', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    {faq.icon && <span style={{ fontSize: 20, flexShrink: 0 }}>{faq.icon}</span>}
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.textPrimary, lineHeight: 1.3 }}>
                      {L(faq.qKey)}
                    </span>
                    <span style={{
                      fontSize: 12, color: C.textMuted, flexShrink: 0,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }}>▼</span>
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '0 14px 14px 44px',
                      fontSize: 12, color: C.textSecondary, lineHeight: 1.6,
                      animation: 'vtFadeIn 0.2s ease-out',
                    }}>
                      {L(faq.aKey)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Version info */}
        <div style={{
          textAlign: 'center', padding: '16px 0',
          fontSize: 10, color: C.textMuted, opacity: 0.5,
        }}>
          {L('helpFooter')}
        </div>
      </div>

      <style>{`
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vtFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

export default memo(HelpView);

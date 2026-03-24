'use client';
import { memo, useState } from 'react';
import { FONT } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

// ═══════════════════════════════════════════════
// HelpView — FAQ + Quick Tutorial
//
// Accordion FAQ, feature cards, version info.
// Glassmorphism design, ambient orb, stagger anim.
// ═══════════════════════════════════════════════

const FAQ_ITEMS = [
  {
    q: 'Come funziona la traduzione?',
    a: 'Parla o scrivi nella tua lingua. BarChat traduce automaticamente il testo e lo legge ad alta voce nella lingua del destinatario usando voci neurali di alta qualità.',
    icon: '🌐',
  },
  {
    q: 'TaxiTalk — come si usa?',
    a: 'Apri TaxiTalk dalla home. Seleziona le lingue, tieni premuto il microfono per parlare, rilascia per tradurre. Usa 🪞 per mostrare la traduzione specchiata al tassista. Puoi anche aggiungere una destinazione con mappa.',
    icon: '🚕',
  },
  {
    q: 'Posso usare BarChat gratis?',
    a: 'Sì! Tutte le funzionalità sono gratuite: traduzione, voci neurali, stanze multilingue, TaxiTalk, e contatti. Nessun abbonamento richiesto.',
    icon: '🆓',
  },
  {
    q: 'Come creo una stanza?',
    a: 'Dalla home, tocca "Crea Stanza". Scegli la lingua principale, la modalità (Chat, Classroom, Conference...) e condividi il codice o il QR con gli invitati.',
    icon: '🏠',
  },
  {
    q: 'Quante lingue sono supportate?',
    a: 'BarChat supporta 25+ lingue con traduzione e voci neurali: italiano, inglese, spagnolo, francese, tedesco, portoghese, cinese, giapponese, coreano, arabo, hindi, russo, turco, tailandese, vietnamita e altre.',
    icon: '🗣️',
  },
  {
    q: 'La modalità Live è diversa dalla Batch?',
    a: 'Batch: tieni premuto il mic, parla, rilascia → traduzione completa. Live: tap per attivare traduzione continua in tempo reale con Deepgram. La Live è ideale per conversazioni fluide faccia-a-faccia.',
    icon: '⚡',
  },
  {
    q: 'Come funziona la modalità Mirror?',
    a: 'In TaxiTalk, tocca 🪞 per mostrare lo schermo specchiato. Il testo tradotto appare capovolto così la persona di fronte può leggerlo. Si attiva anche automaticamente capovolgendo il telefono.',
    icon: '🪞',
  },
  {
    q: 'Posso clonare la mia voce?',
    a: 'Sì! Vai in Impostazioni → Voice Clone. Registra 30 secondi della tua voce e le traduzioni verranno lette con un timbro simile al tuo. Funziona con ElevenLabs.',
    icon: '🎭',
  },
  {
    q: 'Come invito qualcuno?',
    a: 'Dopo aver creato una stanza, usa il pulsante "Invita" per generare un link. Condividilo via WhatsApp, Telegram, SMS o email. L\'invitato si unirà con un click, senza bisogno di account.',
    icon: '📨',
  },
  {
    q: 'I messaggi sono privati?',
    a: 'I messaggi nelle stanze sono crittografati in transito. Le stanze si cancellano automaticamente dopo l\'inattività. Nessun messaggio viene conservato sui nostri server a lungo termine.',
    icon: '🔒',
  },
];

const FEATURES = [
  { icon: '🎙️', title: 'Traduzione vocale', desc: 'Parla e ascolta traduzioni in tempo reale' },
  { icon: '🚕', title: 'TaxiTalk', desc: 'Comunica con tassisti e stranieri faccia a faccia' },
  { icon: '👥', title: 'Stanze multilingue', desc: 'Chat di gruppo con traduzione automatica' },
  { icon: '🌍', title: 'Mondo', desc: 'Scopri stanze pubbliche da tutto il mondo' },
  { icon: '🪞', title: 'Modalità Mirror', desc: 'Mostra la traduzione specchiata a chi hai davanti' },
  { icon: '🎭', title: 'Voice Clone', desc: 'Le traduzioni parlano con la tua voce' },
];

function HelpView({ L, S, prefs, setView, theme }) {
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: '#060810',
    textPrimary: col.textPrimary || '#F2F4F7',
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    accent: col.accent1 || '#26D9B0',
    purple: col.accent2 || '#8B6AFF',
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
        <button onClick={() => setView('home')} style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.textMuted, fontSize: 18, WebkitTapHighlightColor: 'transparent',
        }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>
            ❓ Aiuto
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>FAQ e guida rapida</div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', scrollbarWidth: 'none' }}>

        {/* Feature cards grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
            color: C.textMuted, marginBottom: 10, padding: '0 2px',
          }}>
            Funzionalità
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                padding: '14px 12px', borderRadius: 16,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                animation: `vtSlideUp 0.3s ease-out ${i * 0.05}s both`,
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Accordion */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
            color: C.textMuted, marginBottom: 10, padding: '0 2px',
          }}>
            Domande Frequenti
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
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{faq.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.textPrimary, lineHeight: 1.3 }}>
                      {faq.q}
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
                      {faq.a}
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
          BarChat v2.0 — Traduzione vocale universale
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

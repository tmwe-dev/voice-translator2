'use client';
import { useState, useRef, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

// ═══════════════════════════════════════════════
// TutorialOverlay — Dark Ambient Onboarding
// ═══════════════════════════════════════════════

const STEPS = [
  {
    iconName: 'doorOpen',
    title: 'Benvenuto in BarChat',
    desc: 'Il traduttore vocale in tempo reale. Parla nella tua lingua, il tuo interlocutore sente nella sua.',
    accent: '#26D9B0',
  },
  {
    iconName: 'link',
    title: 'Crea o Entra in una Stanza',
    desc: 'Condividi il codice stanza con chi vuoi. Si connette in P2P, senza server intermediari.',
    accent: '#8B6AFF',
  },
  {
    iconName: 'mic',
    title: 'Parla e Traduci',
    desc: 'Premi il microfono e parla. La traduzione appare istantaneamente con audio AI premium.',
    accent: '#E8924A',
  },
  {
    iconName: 'swap',
    title: 'TaxiTalk Mode',
    desc: 'Perfetto per conversazioni dal vivo. Lo schermo si divide in due: tu da un lato, l\'interlocutore dall\'altro.',
    accent: '#26D9B0',
  },
  {
    iconName: 'refresh',
    title: 'Mirror Automatico',
    desc: 'Inclina il telefono oltre 120° e lo schermo si capovolge automaticamente per chi è di fronte a te.',
    accent: '#8B6AFF',
  },
  {
    iconName: 'star',
    title: 'Tutto Gratuito',
    desc: 'Voci AI premium, ElevenLabs, traduzioni illimitate in 140+ lingue. Nessun limite, nessun abbonamento.',
    accent: '#26D9B0',
  },
];

export default function TutorialOverlay({ L, tutorialStep, setTutorialStep, setShowTutorial, theme }) {
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(null);

  const totalSteps = STEPS.length;
  const current = STEPS[tutorialStep];
  const isFirstStep = tutorialStep === 0;
  const isLastStep = tutorialStep === totalSteps - 1;

  const goNext = useCallback(() => {
    if (!isLastStep) {
      setDirection(1);
      setTutorialStep(tutorialStep + 1);
    } else {
      setShowTutorial(false);
      try { localStorage.setItem('vt-tutorial-done', '1'); } catch {}
    }
  }, [isLastStep, tutorialStep, setTutorialStep, setShowTutorial]);

  const goBack = useCallback(() => {
    if (!isFirstStep) {
      setDirection(-1);
      setTutorialStep(tutorialStep - 1);
    }
  }, [isFirstStep, tutorialStep, setTutorialStep]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff < 0) goNext();
      else goBack();
    }
  }, [goNext, goBack]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
    else if (e.key === 'ArrowLeft') goBack();
    else if (e.key === 'Escape') setShowTutorial(false);
  }, [goNext, goBack, setShowTutorial]);

  const keyframes = `
    @keyframes tutorialPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @keyframes tutorialFadeIn {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes tutorialGlow {
      0%, 100% { box-shadow: 0 0 40px ${current.accent}15, 0 24px 64px rgba(0,0,0,0.5); }
      50% { box-shadow: 0 0 60px ${current.accent}25, 0 24px 64px rgba(0,0,0,0.5); }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, background: 'rgba(4,6,14,0.92)',
          backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20, boxSizing: 'border-box', outline: 'none',
        }}
        onClick={() => setShowTutorial(false)}
      >
        <div
          key={tutorialStep}
          style={{
            maxWidth: 380, width: '100%', textAlign: 'center',
            borderRadius: 28, padding: '44px 32px 36px',
            background: `linear-gradient(160deg, rgba(14,18,35,0.90) 0%, rgba(10,14,28,0.95) 50%, ${current.accent}08 100%)`,
            border: `1px solid ${current.accent}18`,
            backdropFilter: 'blur(40px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.1)',
            animation: 'tutorialFadeIn 0.35s ease-out, tutorialGlow 4s ease-in-out infinite',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step counter */}
          <div style={{
            fontSize: 11, fontWeight: 600, color: current.accent,
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24,
            opacity: 0.8,
          }}>
            {tutorialStep + 1} / {totalSteps}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
            {STEPS.map((s, i) => (
              <div key={i}
                onClick={(e) => { e.stopPropagation(); setTutorialStep(i); }}
                style={{
                  width: tutorialStep === i ? 28 : 10, height: 10, borderRadius: 5,
                  background: tutorialStep === i ? current.accent : (i < tutorialStep ? `${current.accent}80` : 'rgba(255,255,255,0.12)'),
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  cursor: 'pointer',
                  boxShadow: tutorialStep === i ? `0 0 12px ${current.accent}40` : 'none',
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div style={{
            marginBottom: 20,
            animation: 'tutorialPulse 3s ease-in-out infinite', display: 'inline-block',
            filter: `drop-shadow(0 4px 20px ${current.accent}30)`,
          }}>
            <Icon name={current.iconName} size={48} color={current.accent} />
          </div>

          {/* Title */}
          <div style={{
            fontSize: 22, fontWeight: 300, marginBottom: 14, letterSpacing: -0.5,
            background: `linear-gradient(135deg, #fff 0%, ${current.accent} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', fontFamily: FONT,
          }}>
            {current.title}
          </div>

          {/* Description */}
          <div style={{
            fontSize: 14, color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.7, marginBottom: 36,
            fontFamily: FONT, fontWeight: 300,
          }}>
            {current.desc}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
            {!isFirstStep && (
              <button onClick={goBack}
                style={{
                  padding: '12px 18px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: FONT, transition: 'all 0.3s',
                  backdropFilter: 'blur(12px)',
                }}>
                ←
              </button>
            )}

            <button onClick={() => setShowTutorial(false)}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.60)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: FONT, transition: 'all 0.3s',
                backdropFilter: 'blur(12px)',
              }}>
              Salta
            </button>

            <button onClick={goNext}
              style={{
                padding: '12px 32px', borderRadius: 12,
                border: 'none',
                background: `linear-gradient(135deg, ${current.accent}, ${current.accent}cc)`,
                color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT,
                boxShadow: `0 8px 24px ${current.accent}35`,
                transition: 'all 0.3s',
              }}>
              {isLastStep ? 'Inizia!' : 'Avanti →'}
            </button>
          </div>

          {/* Swipe hint */}
          <div style={{
            marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.30)',
            fontFamily: FONT,
          }}>
            {'← swipe →'}
          </div>
        </div>
      </div>
    </>
  );
}

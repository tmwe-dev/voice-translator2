'use client';
import { useState, useRef, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

// ═══════════════════════════════════════════════
// TutorialOverlay — Onboarding interattivo
//
// Miglioramenti:
// - Swipe gesture support (touch)
// - Back button per tornare indietro
// - Animazione transizione tra step
// - Step counter numerico
// - Keyboard navigation (frecce)
// ═══════════════════════════════════════════════

export default function TutorialOverlay({ L, tutorialStep, setTutorialStep, setShowTutorial, theme }) {
  const S = getStyles(theme);
  const [direction, setDirection] = useState(0); // -1 left, 0 none, 1 right
  const touchStartX = useRef(null);

  const stepConfig = [
    {
      emoji: '🏠', title: 'tutorialStep1Title', desc: 'tutorialStep1Desc',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      emoji: '🔗', title: 'tutorialStep2Title', desc: 'tutorialStep2Desc',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      emoji: '🎙️', title: 'tutorialStep3Title', desc: 'tutorialStep3Desc',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      emoji: '🚕', title: 'tutorialStep4Title', desc: 'tutorialStep4Desc',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
    {
      emoji: '🪞', title: 'tutorialStep5Title', desc: 'tutorialStep5Desc',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
      emoji: '📋', title: 'tutorialStep6Title', desc: 'tutorialStep6Desc',
      gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    },
  ];

  const totalSteps = stepConfig.length;
  const currentConfig = stepConfig[tutorialStep];
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

  // Touch swipe handling
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff < 0) goNext(); // Swipe left → next
      else goBack(); // Swipe right → back
    }
  }, [goNext, goBack]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
    else if (e.key === 'ArrowLeft') goBack();
    else if (e.key === 'Escape') setShowTutorial(false);
  }, [goNext, goBack, setShowTutorial]);

  const keyframes = `
    @keyframes pulse-scale {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
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
          zIndex: 9999, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 20, boxSizing: 'border-box', outline: 'none',
        }}
        onClick={() => setShowTutorial(false)}
      >
        <div
          key={tutorialStep} // force re-mount for animation
          style={{
            maxWidth: 380, width: '100%', textAlign: 'center',
            borderRadius: 28, padding: '44px 36px 36px',
            background: currentConfig.gradient,
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            animation: 'fadeSlideIn 0.35s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step counter */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
            letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24,
          }}>
            {tutorialStep + 1} / {totalSteps}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 28 }}>
            {stepConfig.map((_, i) => (
              <div key={i}
                onClick={(e) => { e.stopPropagation(); setTutorialStep(i); }}
                style={{
                  width: tutorialStep === i ? 28 : 10, height: 10, borderRadius: 5,
                  background: tutorialStep === i ? 'rgba(255,255,255,1)' : (i < tutorialStep ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'),
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Emoji */}
          <div style={{
            fontSize: 60, marginBottom: 20,
            animation: 'pulse-scale 2s ease-in-out infinite', display: 'inline-block',
          }}>
            {currentConfig.emoji}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 24, fontWeight: 800, marginBottom: 12,
            color: '#ffffff', textShadow: '0 2px 8px rgba(0,0,0,0.2)',
            fontFamily: FONT,
          }}>
            {L(currentConfig.title)}
          </div>

          {/* Description */}
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.95)',
            lineHeight: 1.7, marginBottom: 36,
            textShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}>
            {L(currentConfig.desc)}
          </div>

          {/* Navigation Buttons — 3 buttons: Back, Skip, Next */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
            {/* Back button */}
            {!isFirstStep && (
              <button onClick={goBack}
                style={{
                  padding: '12px 18px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: FONT, transition: 'all 0.3s',
                }}>
                ←
              </button>
            )}

            {/* Skip */}
            <button onClick={() => setShowTutorial(false)}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                color: '#ffffff', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: FONT, transition: 'all 0.3s',
              }}>
              {L('skip')}
            </button>

            {/* Next / Inizia */}
            <button onClick={goNext}
              style={{
                padding: '12px 32px', borderRadius: 12, border: 'none',
                background: 'rgba(255,255,255,0.95)', color: '#000000',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: FONT,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                transition: 'all 0.3s',
              }}>
              {isLastStep ? '🎉 Inizia!' : `${L('next')} →`}
            </button>
          </div>

          {/* Swipe hint on mobile */}
          <div style={{
            marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.75)',
          }}>
            {'← swipe →'}
          </div>
        </div>
      </div>
    </>
  );
}

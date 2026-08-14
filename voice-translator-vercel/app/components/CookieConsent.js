'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PALETTE } from '../lib/palette.js';
import { t, mapLang } from '../lib/i18n.js';

// ═══════════════════════════════════════════════════════════════
// L'AVVISO COOKIE PARLAVA SOLO INGLESE (b.136-bis)
//
// Trovato al primo avvio pulito, subito dopo aver passato una
// sessione intera a togliere l'inglese dal resto dell'applicazione:
// questo pannello diceva "We use cookies to enhance your
// experience", "Only Essential", "Accept All" — sopra un'interfaccia
// italiana. Ed e la PRIMA cosa che legge chi arriva.
//
// Era sfuggito a tutti e due i giri perche non usa `L()`: vive in
// layout.js, FUORI da AppProvider, quindi il contesto non ce l'ha.
// Percio la lingua se la legge da solo dalle preferenze salvate, e
// se non ce ne sono ancora (e al primo avvio non ce ne sono) la
// prende dal browser.
//
// E l'arancione: era l'unico punto dell'applicazione con un terzo
// colore. Luca era stato esplicito in b.129 — "non voglio piu di due
// colori nella pagina". Ora usa l'accento di casa.
// ═══════════════════════════════════════════════════════════════

function linguaSalvata() {
  if (typeof window === 'undefined') return 'en';
  try {
    const p = JSON.parse(localStorage.getItem('vt-prefs') || 'null');
    if (p?.uiLang) return p.uiLang;
  } catch { /* preferenze illeggibili: si ripiega sul browser */ }
  return mapLang((navigator.language || 'en').split('-')[0]);
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [lingua, setLingua] = useState('en');
  const T = (k) => t(lingua, k);

  useEffect(() => {
    try {
      setLingua(linguaSalvata());
      const consent = localStorage.getItem('vt-cookie-consent');
      if (!consent) {
        setTimeout(() => setVisible(true), 1500);
      }
    } catch (e) { console.warn('[CookieConsent] localStorage error:', e?.message); }
  }, []);

  const handleConsent = (type) => {
    try {
      localStorage.setItem('vt-cookie-consent', type);
      localStorage.setItem('vt-cookie-consent-date', new Date().toISOString());
    } catch (e) { console.warn('[CookieConsent] localStorage error:', e?.message); }
    setVisible(false);
  };

  if (!visible) return null;

  const containerStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    padding: '16px',
    display: 'flex',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
  };

  const bannerStyle = {
    background: '#18181b',
    borderTop: '1px solid #27272a',
    borderRadius: '16px 16px 0 0',
    padding: '20px',
    maxWidth: '600px',
    width: '100%',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    animation: 'slideUp 0.3s ease-out',
  };

  const textStyle = {
    fontSize: '13px',
    color: '#a1a1aa',
    marginBottom: '16px',
    lineHeight: '1.6',
  };

  const buttonsContainerStyle = {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  };

  const acceptButtonStyle = {
    padding: '10px 16px',
    background: PALETTE.teal,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: '1',
    minWidth: '140px',
  };

  const declineButtonStyle = {
    padding: '10px 16px',
    background: 'transparent',
    color: '#71717a',
    border: '1px solid #27272a',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flex: '1',
    minWidth: '140px',
  };

  const linkStyle = {
    color: PALETTE.teal,
    textDecoration: 'none',
    cursor: 'pointer',
    borderBottom: `1px solid ${PALETTE.teal}`,
  };

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={bannerStyle}>
          <p style={textStyle}>
            {T('cookieText')}{' '}
            <Link href="/privacy" style={linkStyle}>
              {T('cookiePrivacy')}
            </Link>{' '}
            for more details.
          </p>
          <div style={buttonsContainerStyle}>
            <button
              style={declineButtonStyle}
              onClick={() => handleConsent('essential')}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(113, 113, 122, 0.1)';
                e.target.style.borderColor = '#3f3f46';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = '#27272a';
              }}
            >
              {T('cookieEssential')}
            </button>
            <button
              style={acceptButtonStyle}
              onClick={() => handleConsent('all')}
              onMouseEnter={(e) => {
                e.target.style.background = '#ea580c';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = PALETTE.teal;
              }}
            >
              {T('cookieAccept')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

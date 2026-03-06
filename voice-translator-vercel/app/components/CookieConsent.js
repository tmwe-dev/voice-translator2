'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('vt-cookie-consent');
      if (!consent) {
        setTimeout(() => setVisible(true), 1500);
      }
    } catch {}
  }, []);

  const handleConsent = (type) => {
    try {
      localStorage.setItem('vt-cookie-consent', type);
      localStorage.setItem('vt-cookie-consent-date', new Date().toISOString());
    } catch {}
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
    background: '#f97316',
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
    color: '#f97316',
    textDecoration: 'none',
    cursor: 'pointer',
    borderBottom: '1px solid #f97316',
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
            We use cookies to enhance your experience. Essential cookies are always enabled. You can review our{' '}
            <Link href="/privacy" style={linkStyle}>
              Privacy Policy
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
              Only Essential
            </button>
            <button
              style={acceptButtonStyle}
              onClick={() => handleConsent('all')}
              onMouseEnter={(e) => {
                e.target.style.background = '#ea580c';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f97316';
              }}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

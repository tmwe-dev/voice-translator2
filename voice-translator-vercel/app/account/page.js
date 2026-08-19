'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { t, linguaInterfacciaFuoriContesto } from '../lib/i18n.js';
import { memGet } from '../lib/memoria.js';

// b.139 — pagina in inglese fisso. Sta fuori da AppProvider (e una
// rotta a se, /account) quindi non ha L(): legge la lingua da sola,
// come CookieConsent e come la 404.
export default function AccountPage() {
  const [prefs, setPrefs] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lingua, setLingua] = useState('en');
  const T = (k) => t(lingua, k);

  useEffect(() => { setLingua(linguaInterfacciaFuoriContesto()); }, []);

  useEffect(() => {
    // Load prefs from localStorage
    try {
      const saved = memGet('vt-prefs');
      if (saved) setPrefs(JSON.parse(saved));
    } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }

    // Fetch user data if authenticated
    const token = memGet('vt-token');
    if (token) {
      fetch('/api/user?action=profile', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUser(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const tier = user?.tier || prefs?.tier || 'free';
  const tierColors = {
    free: { bg: 'rgba(113,113,122,0.15)', text: '#a1a1aa' },
    starter: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    pro: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
  };
  const tc = tierColors[tier] || tierColors.free;

  return (
    <div style={{
      minHeight: '100vh', background: '#09090b', color: '#e4e4e7',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      padding: '20px', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Back button */}
      <Link href="/" style={{ color: '#71717a', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
        {'←'} {T('backWord')}
      </Link>

      {/* Avatar + Name */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{prefs?.avatar || '🌐'}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>
          {prefs?.name || user?.name || T('accountGuest')}
        </h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: 0 }}>
          {user?.email || T('notSignedIn')}
        </p>
      </div>

      {/* Plan badge */}
      <div style={{
        background: '#18181b', borderRadius: 16, padding: 20,
        border: '1px solid #27272a', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{T('planWord')}</span>
          <span style={{
            padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
            background: tc.bg, color: tc.text, textTransform: 'uppercase',
          }}>
            {tier}
          </span>
        </div>

        {/* Credits */}
        {user && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71717a', marginBottom: 6 }}>
              <span>{T('creditsWord')}</span>
              <span>{user.credits || 0} {T('creditsRemaining')}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#27272a', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #f97316, #fb923c)',
                width: `${Math.min(100, ((user.credits || 0) / 1000) * 100)}%`,
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Voice Clone status */}
      <div style={{
        background: '#18181b', borderRadius: 16, padding: 20,
        border: '1px solid #27272a', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{T('voiceCloneLabel')}</span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: user?.clonedVoiceId ? '#4ade80' : '#71717a',
          }}>
            {user?.clonedVoiceId ? `✓ ${T('voiceCloneActive')}` : T('voiceCloneNone')}
          </span>
        </div>
        {user?.clonedVoiceName && (
          <p style={{ fontSize: 12, color: '#71717a', margin: '8px 0 0' }}>
            {T('voiceLabelPrefix')}: {user.clonedVoiceName}
          </p>
        )}
      </div>

      {/* Language */}
      <div style={{
        background: '#18181b', borderRadius: 16, padding: 20,
        border: '1px solid #27272a', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{T('languageWord')}</span>
          <span style={{ fontSize: 13, color: '#a1a1aa' }}>
            {prefs?.lang?.toUpperCase() || 'EN'}
          </span>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {[
          { href: '/terms', label: T('termsOfServiceLink') },
          { href: '/privacy', label: T('privacyPolicyLink') },
        ].map(link => (
          <a key={link.href} href={link.href} style={{
            display: 'block', padding: '14px 16px', borderRadius: 12,
            background: '#18181b', border: '1px solid #27272a',
            color: '#a1a1aa', fontSize: 13, textDecoration: 'none',
          }}>
            {link.label} →
          </a>
        ))}
      </div>

      {/* Version */}
      <p style={{ textAlign: 'center', fontSize: 11, color: '#3f3f46', marginTop: 32 }}>
        BarTalk v2.0
      </p>
    </div>
  );
}

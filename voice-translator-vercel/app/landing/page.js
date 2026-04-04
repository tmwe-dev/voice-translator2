'use client';
import { useState, useEffect } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import { t, mapLang, preloadLang } from '../lib/i18n.js';

// ═══════════════════════════════════════════════
// VoiceTranslate Landing Page — Fully i18n
// Detects language from: localStorage → navigator → defaults to 'en'
// ═══════════════════════════════════════════════

const FEATURE_KEYS = [
  { icon: '\u{1F3A4}', titleKey: 'landingFeat1Title', descKey: 'landingFeat1Desc' },
  { icon: '\u{1F916}', titleKey: 'landingFeat2Title', descKey: 'landingFeat2Desc' },
  { icon: '\u{1F30D}', titleKey: 'landingFeat3Title', descKey: 'landingFeat3Desc' },
  { icon: '\u{1F50A}', titleKey: 'landingFeat4Title', descKey: 'landingFeat4Desc' },
  { icon: '\u{1F3AD}', titleKey: 'landingFeat5Title', descKey: 'landingFeat5Desc' },
  { icon: '\u{1F4DA}', titleKey: 'landingFeat6Title', descKey: 'landingFeat6Desc' },
  { icon: '\u{1F512}', titleKey: 'landingFeat7Title', descKey: 'landingFeat7Desc' },
  { icon: '\u{1F4CA}', titleKey: 'landingFeat8Title', descKey: 'landingFeat8Desc' },
];

function detectLang() {
  if (typeof window === 'undefined') return 'en';
  // 1. Check URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang')) return mapLang(params.get('lang'));
  // 2. Check localStorage (user's saved preference from the app)
  try {
    const rawPrefs = localStorage.getItem('vt-prefs') || '{}';
    let prefs; try { prefs = JSON.parse(rawPrefs); } catch { prefs = null; }
    if (prefs?.lang) return mapLang(prefs.lang);
  } catch {}
  // 3. Browser language
  const browserLang = (navigator.language || 'en').split('-')[0];
  return mapLang(browserLang);
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [lang, setLang] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    const detected = detectLang();
    setLang(detected);
    preloadLang(detected);
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = ''; };
  }, []);

  // Preload when user switches language via picker
  useEffect(() => { preloadLang(lang); }, [lang]);

  const L = (key) => t(lang, key);
  const currentFlag = LANGS.find(l => l.code === lang)?.flag || '\u{1F30D}';

  const PLAN_DATA = [
    {
      id: 'free', nameKey: 'landingPlanFree', price: '0', periodKey: '',
      featureKeys: ['landingFreeF1','landingFreeF2','landingFreeF3','landingFreeF4','landingFreeF5'],
      ctaKey: 'landingStartFree', highlight: false,
    },
    {
      id: 'pro', nameKey: 'landingPlanPro', price: '9.90', periodKey: 'landingPerMonth',
      featureKeys: ['landingProF1','landingProF2','landingProF3','landingProF4','landingProF5','landingProF6','landingProF7','landingProF8','landingProF9'],
      ctaKey: 'landingTryPro', highlight: true, badgeKey: 'landingMostPopular',
    },
    {
      id: 'business', nameKey: 'landingPlanBusiness', price: '29.90', periodKey: 'landingPerMonth',
      featureKeys: ['landingBizF1','landingBizF2','landingBizF3','landingBizF4','landingBizF5','landingBizF6','landingBizF7','landingBizF8','landingBizF9'],
      ctaKey: 'landingContactUs', highlight: false,
    },
  ];

  const FAQ_KEYS = [
    { qKey: 'landingFaq1Q', aKey: 'landingFaq1A' },
    { qKey: 'landingFaq2Q', aKey: 'landingFaq2A' },
    { qKey: 'landingFaq3Q', aKey: 'landingFaq3A' },
    { qKey: 'landingFaq4Q', aKey: 'landingFaq4A' },
    { qKey: 'landingFaq5Q', aKey: 'landingFaq5A' },
    { qKey: 'landingFaq6Q', aKey: 'landingFaq6A' },
  ];

  return (
    <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh' }}>

      {/* ── Navbar ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          <span style={{ color: '#f97316' }}>Voice</span>Translate
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#features" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>{L('landingFeatures')}</a>
          <a href="#pricing" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>{L('landingPricing')}</a>
          <a href="#faq" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>{L('landingFaq')}</a>

          {/* Language switcher */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowLangPicker(!showLangPicker)} style={{
              background: '#18181b', border: '1px solid #27272a', borderRadius: 8,
              padding: '6px 12px', cursor: 'pointer', fontSize: 14, color: '#e4e4e7', fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {currentFlag} <span style={{ fontSize: 10, color: '#71717a' }}>{'\u25BC'}</span>
            </button>
            {showLangPicker && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: '#18181b', border: '1px solid #27272a', borderRadius: 12,
                padding: 8, zIndex: 1000, maxHeight: 300, overflowY: 'auto', minWidth: 180,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setShowLangPicker(false); }}
                    style={{
                      display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                      background: l.code === lang ? '#27272a' : 'transparent', borderRadius: 6,
                      color: '#e4e4e7', cursor: 'pointer', fontSize: 14, textAlign: 'left', fontFamily: FONT,
                    }}>
                    {l.flag} {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <a href="/" style={{ background: '#f97316', color: '#000', padding: '8px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            {L('landingOpenApp')}
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px' }}>
          {L('landingHeroTitle')}
        </h1>
        <p style={{ fontSize: 18, color: '#a1a1aa', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
          {L('landingHeroSubtitle')}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={{ background: '#f97316', color: '#000', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            {L('landingStartFree')}
          </a>
          <a href="#pricing" style={{ background: '#27272a', color: '#e4e4e7', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
            {L('landingPricing')}
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 48, flexWrap: 'wrap' }}>
          {[
            { num: '31', label: L('landingFeat3Title').replace(/[^0-9]/g, '') ? L('landingFeat3Title').split(' ').pop() : 'Languages' },
            { num: '<500ms', label: 'Latency' },
            { num: '6', label: 'AI Models' },
            { num: '99.9%', label: 'Uptime' },
          ].map(s => (
            <div key={s.num} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f97316' }}>{s.num}</div>
              <div style={{ fontSize: 13, color: '#71717a' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '60px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 48 }}>{L('landingEverythingYouNeed')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {FEATURE_KEYS.map(f => (
            <div key={f.titleKey} style={{ background: '#18181b', borderRadius: 16, padding: 24, border: '1px solid #27272a' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{L(f.titleKey)}</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>{L(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 32 }}>{L('landingPricing')}</h2>

        {/* Billing toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ background: '#18181b', borderRadius: 10, padding: 4, display: 'flex', gap: 4 }}>
            {['monthly', 'yearly'].map(p => (
              <button key={p} onClick={() => setBillingPeriod(p)} style={{
                background: billingPeriod === p ? '#f97316' : 'transparent',
                color: billingPeriod === p ? '#000' : '#a1a1aa',
                border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
                fontWeight: billingPeriod === p ? 700 : 500, fontSize: 14, fontFamily: FONT,
              }}>
                {p === 'monthly' ? L('landingBillingMonthly') : `${L('landingBillingYearly')} (${L('landingSave20')})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {PLAN_DATA.map(plan => {
            const displayPrice = billingPeriod === 'yearly' && plan.price !== '0'
              ? (parseFloat(plan.price.replace(',', '.')) * 10 / 12).toFixed(2).replace('.', ',')
              : plan.price;
            return (
              <div key={plan.id} style={{
                background: plan.highlight ? 'linear-gradient(135deg, #1a0f00, #18181b)' : '#18181b',
                borderRadius: 16, padding: 28, position: 'relative',
                border: plan.highlight ? '2px solid #f97316' : '1px solid #27272a',
              }}>
                {plan.badgeKey && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: '#f97316', color: '#000', padding: '4px 16px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700 }}>
                    {L(plan.badgeKey)}
                  </div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{L(plan.nameKey)}</h3>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 36, fontWeight: 800 }}>{'\u20AC'}{displayPrice}</span>
                  {plan.periodKey && <span style={{ color: '#71717a', fontSize: 14 }}>{L(plan.periodKey)}</span>}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.featureKeys.map(fk => (
                    <li key={fk} style={{ padding: '6px 0', fontSize: 14, color: '#d4d4d8', display: 'flex', gap: 8 }}>
                      <span style={{ color: '#22c55e' }}>{'\u2713'}</span> {L(fk)}
                    </li>
                  ))}
                </ul>
                <a href="/" style={{
                  display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: 10,
                  background: plan.highlight ? '#f97316' : '#27272a',
                  color: plan.highlight ? '#000' : '#e4e4e7',
                  textDecoration: 'none', fontWeight: 700, fontSize: 15,
                }}>
                  {L(plan.ctaKey)}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '60px 24px 80px', maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 32 }}>{L('landingFaqTitle')}</h2>
        {FAQ_KEYS.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid #27272a', marginBottom: 4 }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 0', background: 'none', border: 'none', color: '#e4e4e7',
              cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'left', fontFamily: FONT,
            }}>
              {L(item.qKey)}
              <span style={{ color: '#71717a', fontSize: 18, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
            </button>
            {openFaq === i && (
              <div style={{ padding: '0 0 16px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.6 }}>
                {L(item.aKey)}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #27272a', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#52525b' }}>
          {'\u00A9'} {new Date().getFullYear()} VoiceTranslate
        </div>
        <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>
          <a href="/privacy" style={{ color: '#3f3f46', marginRight: 16 }}>{L('landingFooterPrivacy')}</a>
          <a href="/terms" style={{ color: '#3f3f46', marginRight: 16 }}>{L('landingFooterTerms')}</a>
          <a href="mailto:support@voicetranslate.app" style={{ color: '#3f3f46' }}>{L('landingFooterContact')}</a>
        </div>
      </footer>
    </div>
  );
}

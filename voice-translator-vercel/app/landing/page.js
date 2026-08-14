'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FONT, LANGS } from '../lib/constants.js';
import { t, mapLang, preloadLang } from '../lib/i18n.js';
import Icon from '../components/Icon.js';
import { PACCHETTI, MOLTIPLICATORE_PREMIUM, BONUS_BENVENUTO_SECONDI, formattaDurata } from '../wallet/tariffe.js';

// ═══════════════════════════════════════════════
// BarTalk — pagina pubblica.
//
// REGOLA: i prezzi NON si scrivono qui. Arrivano da wallet/tariffe.js,
// lo stesso file che alimenta Stripe e il portafoglio. Così la pagina
// non può mai vendere un listino diverso da quello che l'utente paga.
// ═══════════════════════════════════════════════

// Icone MONO a filo sottile (mai emoji).
const FEATURE_KEYS = [
  { icona: 'mic', titleKey: 'landingFeat1Title', descKey: 'landingFeat1Desc' },
  { icona: 'zap', titleKey: 'landingFeat2Title', descKey: 'landingFeat2Desc' },
  { icona: 'globe', titleKey: 'landingFeat3Title', descKey: 'landingFeat3Desc' },
  { icona: 'speaker', titleKey: 'landingFeat4Title', descKey: 'landingFeat4Desc' },
  { icona: 'wave', titleKey: 'landingFeat5Title', descKey: 'landingFeat5Desc' },
  { icona: 'graduation', titleKey: 'landingFeat6Title', descKey: 'landingFeat6Desc' },
  { icona: 'lock', titleKey: 'landingFeat7Title', descKey: 'landingFeat7Desc' },
  { icona: 'battery', titleKey: 'landingFeat8Title', descKey: 'landingFeat8Desc' },
];

// I tre pacchetti veri, con il nome tradotto e il consigliato in evidenza.
const NOMI_PACCHETTO = { pack_s: 'landingPackStart', pack_m: 'landingPackTravel', pack_l: 'landingPackWorld' };

// TODO Luca: sostituire con l'indirizzo di assistenza reale.
const EMAIL_CONTATTO = 'support@voicetranslate.app';

function detectLang() {
  if (typeof window === 'undefined') return 'en';
  // 1. Check URL param
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang')) return mapLang(params.get('lang'));
  // 2. Check localStorage (user's saved preference from the app)
  try {
    const rawPrefs = localStorage.getItem('vt-prefs') || '{}';
    let prefs; try { prefs = JSON.parse(rawPrefs); } catch { prefs = null; }
    // b.136 — leggeva solo `prefs.lang`, la lingua PARLATA: chi ha i
    // menu in italiano e parla inglese si vedeva la pagina pubblica in
    // inglese. `uiLang` e la lingua in cui legge; `lang` resta come
    // ripiego per chi ha preferenze salvate da prima di b.136.
    if (prefs?.uiLang) return mapLang(prefs.uiLang);
    if (prefs?.lang) return mapLang(prefs.lang);
  } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }
  // 3. Browser language
  const browserLang = (navigator.language || 'en').split('-')[0];
  return mapLang(browserLang);
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
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

  // Le schede prezzo sono generate dai pacchetti reali: prezzo, ore standard
  // e ore con voce premium sono tutti calcolati, mai scritti a mano.
  const SCHEDE = PACCHETTI.map(p => ({
    id: p.id,
    nome: L(NOMI_PACCHETTO[p.id]) || p.nome,
    euro: p.euro.toFixed(2).replace('.', ','),
    ore: formattaDurata(p.secondi),
    orePremium: formattaDurata(Math.floor(p.secondi / MOLTIPLICATORE_PREMIUM)),
    inRilievo: !!p.consigliato,
  }));

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
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>
          <span style={{ color: '#f97316' }}>Bar</span>Talk
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

          <Link href="/" style={{ background: '#f97316', color: '#000', padding: '8px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            {L('landingOpenApp')}
          </Link>
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
          <Link href="/" style={{ background: '#f97316', color: '#000', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            {L('landingStartFree')}
          </Link>
          <a href="#pricing" style={{ background: '#27272a', color: '#e4e4e7', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
            {L('landingPricing')}
          </a>
        </div>

        {/* Numeri veri, nessuna promessa non verificabile (via "99,9% uptime") */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 48, flexWrap: 'wrap' }}>
          {[
            { num: String(LANGS.length), label: L('landingStatLangs') },
            { num: formattaDurata(BONUS_BENVENUTO_SECONDI), label: L('landingStatGift') },
            { num: '0', label: L('landingStatNoSub') },
            { num: '<500ms', label: L('landingStatLatency') },
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
              <div style={{ marginBottom: 14, opacity: 0.9 }}>
                <Icon name={f.icona} size={26} color="#f97316" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{L(f.titleKey)}</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>{L(f.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 10 }}>{L('landingPlansTitle')}</h2>
        <p style={{ textAlign: 'center', fontSize: 16, color: '#a1a1aa', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
          {L('landingPlansSub')}
        </p>

        {/* Il regalo di benvenuto, che \u00E8 la vera porta d'ingresso */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: 'linear-gradient(135deg, #1a0f00, #18181b)', border: '1px solid #f9731640',
          borderRadius: 14, padding: '14px 20px', maxWidth: 460, margin: '0 auto 36px',
        }}>
          <Icon name="gift" size={20} color="#f97316" />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{L('landingGiftBanner')}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {SCHEDE.map(s => (
            <div key={s.id} style={{
              background: s.inRilievo ? 'linear-gradient(135deg, #1a0f00, #18181b)' : '#18181b',
              borderRadius: 16, padding: 28, position: 'relative',
              border: s.inRilievo ? '2px solid #f97316' : '1px solid #27272a',
            }}>
              {s.inRilievo && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#f97316', color: '#000', padding: '4px 16px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {L('landingMostPopular')}
                </div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{s.nome}</h3>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 800 }}>{'\u20AC'}{s.euro}</span>
              </div>
              {/* Quello che compri davvero: TEMPO, non un abbonamento */}
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f97316', marginBottom: 2 }}>{s.ore}</div>
              <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 18 }}>{L('landingOfTalk')}</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                {[
                  `${s.orePremium} ${L('landingWithPremium')}`,
                  L('landingNoExpiry'),
                  L('landingNoSubscription'),
                ].map(riga => (
                  <li key={riga} style={{ padding: '6px 0', fontSize: 14, color: '#d4d4d8', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#22c55e' }}>{'\u2713'}</span> {riga}
                  </li>
                ))}
              </ul>
              <Link href="/" style={{
                display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: 10,
                background: s.inRilievo ? '#f97316' : '#27272a',
                color: s.inRilievo ? '#000' : '#e4e4e7',
                textDecoration: 'none', fontWeight: 700, fontSize: 15,
              }}>
                {L('landingRecharge')}
              </Link>
            </div>
          ))}
        </div>

        {/* La via d'uscita gratuita: chiavi proprie */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginTop: 28, fontSize: 14, color: '#a1a1aa',
        }}>
          <Icon name="key" size={18} color="#71717a" />
          {L('landingOwnKeysFree')}
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
          {'\u00A9'} {new Date().getFullYear()} BarTalk
        </div>
        <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>
          <a href="/privacy" style={{ color: '#3f3f46', marginRight: 16 }}>{L('landingFooterPrivacy')}</a>
          <a href="/terms" style={{ color: '#3f3f46', marginRight: 16 }}>{L('landingFooterTerms')}</a>
          <a href={`mailto:${EMAIL_CONTATTO}`} style={{ color: '#3f3f46' }}>{L('landingFooterContact')}</a>
        </div>
      </footer>
    </div>
  );
}

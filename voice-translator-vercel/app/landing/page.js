'use client';
import { useState, useEffect } from 'react';
import { FONT } from '../lib/constants.js';

// ═══════════════════════════════════════════════
// VoiceTranslate Landing Page
// Professional landing with features, pricing, FAQ
// ═══════════════════════════════════════════════

const FEATURES = [
  { icon: '🎤', title: 'Traduzione Vocale Real-Time', desc: 'Parla nella tua lingua e il tuo interlocutore sentirà nella sua. Latenza sotto i 500ms.' },
  { icon: '🤖', title: 'AI Multi-Provider', desc: 'GPT-4o, Claude, Gemini — il miglior modello per ogni coppia linguistica, automaticamente.' },
  { icon: '🌍', title: '31 Lingue', desc: 'Dall\'italiano al thai, dal cinese al portoghese. Ogni combinazione, ogni direzione.' },
  { icon: '🔊', title: 'Voci Naturali', desc: 'ElevenLabs, OpenAI TTS, Edge — voci che suonano umane, non robotiche.' },
  { icon: '🎭', title: 'Voice Clone', desc: 'Clona la tua voce e parla in qualsiasi lingua con il tuo timbro originale.' },
  { icon: '📚', title: 'Glossari di Dominio', desc: 'Terminologia medica, legale, tecnica — traduzioni precise per ogni settore.' },
  { icon: '🔒', title: 'Privacy & GDPR', desc: 'Dati crittografati, cancellazione completa su richiesta, nessun tracking invasivo.' },
  { icon: '📊', title: 'Analytics Personali', desc: 'Quante traduzioni, in quali lingue, quanto spendi — tutto sotto controllo.' },
];

const PLANS = [
  {
    id: 'free', name: 'Free', price: '0', period: '',
    features: ['50.000 caratteri/giorno', '2 partecipanti per stanza', '3 stanze simultanee', 'Edge TTS (gratuito)', 'Cronologia 7 giorni'],
    cta: 'Inizia Gratis', highlight: false,
  },
  {
    id: 'pro', name: 'Pro', price: '9.90', period: '/mese',
    features: ['Traduzioni illimitate', '5 partecipanti per stanza', '50 stanze', 'OpenAI + ElevenLabs TTS', 'AI Models (GPT-4o Mini, Claude Haiku, Gemini Flash)', 'Voice Clone', '5 Glossari', '500 crediti/mese inclusi', 'Cronologia 90 giorni'],
    cta: 'Prova Pro', highlight: true, badge: 'Più Popolare',
  },
  {
    id: 'business', name: 'Business', price: '29.90', period: '/mese',
    features: ['Tutto di Pro +', 'Partecipanti illimitati', 'Stanze illimitate', 'AI Premium (GPT-4o, Claude Sonnet, Gemini Pro)', 'Glossari illimitati', '3.000 crediti/mese inclusi', 'API Access', 'Supporto prioritario', 'Cronologia illimitata'],
    cta: 'Contattaci', highlight: false,
  },
];

const FAQ = [
  { q: 'Posso provare gratuitamente?', a: 'Sì! Il piano Free è completamente gratuito con 50.000 caratteri al giorno. Nessuna carta di credito richiesta.' },
  { q: 'Come funziona la traduzione vocale?', a: 'Parli nella tua lingua, il tuo audio viene convertito in testo (STT), tradotto con AI, e riprodotto nella lingua del tuo interlocutore (TTS). Tutto in meno di mezzo secondo.' },
  { q: 'Quali lingue sono supportate?', a: 'Supportiamo 31 lingue incluse italiano, inglese, spagnolo, francese, tedesco, portoghese, cinese, giapponese, coreano, thai, arabo, hindi, russo, e molte altre.' },
  { q: 'Cosa sono i crediti?', a: 'I crediti sono la nostra moneta interna. Ogni traduzione AI, TTS premium, o voice clone consuma crediti. Il piano Pro include 500 crediti/mese, il Business 3.000.' },
  { q: 'Posso usare le mie API key?', a: 'Sì! Puoi collegare le tue chiavi OpenAI, Anthropic, Gemini ed ElevenLabs per non consumare crediti.' },
  { q: 'I miei dati sono al sicuro?', a: 'Assolutamente. Le API key sono crittografate con AES-256, le connessioni sono HTTPS, e rispettiamo il GDPR con cancellazione completa dei dati su richiesta.' },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = ''; };
  }, []);

  return (
    <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh' }}>

      {/* ── Navbar ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          <span style={{ color: '#f97316' }}>Voice</span>Translate
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#features" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>Funzionalità</a>
          <a href="#pricing" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>Prezzi</a>
          <a href="#faq" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14 }}>FAQ</a>
          <a href="/" style={{ background: '#f97316', color: '#000', padding: '8px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            Apri App
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '80px 24px 60px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: 13, color: '#f97316', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          Traduzione Vocale AI in Tempo Reale
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px' }}>
          Parla nella tua lingua.<br/>
          <span style={{ color: '#f97316' }}>Il mondo ti capisce.</span>
        </h1>
        <p style={{ fontSize: 18, color: '#a1a1aa', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
          VoiceTranslate converte la tua voce in 31 lingue in tempo reale.
          AI di ultima generazione, voci naturali, latenza sotto il mezzo secondo.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/" style={{ background: '#f97316', color: '#000', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 700, fontSize: 16 }}>
            Prova Gratis
          </a>
          <a href="#pricing" style={{ background: '#27272a', color: '#e4e4e7', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
            Vedi Prezzi
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 48, flexWrap: 'wrap' }}>
          {[
            { num: '31', label: 'Lingue' },
            { num: '<500ms', label: 'Latenza' },
            { num: '6', label: 'Modelli AI' },
            { num: '99.9%', label: 'Uptime' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f97316' }}>{s.num}</div>
              <div style={{ fontSize: 13, color: '#71717a' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: '60px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 48 }}>Tutto quello che serve</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: '#18181b', borderRadius: 16, padding: 24, border: '1px solid #27272a' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Prezzi semplici e trasparenti</h2>
        <p style={{ textAlign: 'center', color: '#71717a', marginBottom: 32, fontSize: 15 }}>
          Inizia gratis. Passa a Pro quando vuoi di più.
        </p>

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
                {p === 'monthly' ? 'Mensile' : 'Annuale (-17%)'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {PLANS.map(plan => {
            const displayPrice = billingPeriod === 'yearly' && plan.price !== '0'
              ? (parseFloat(plan.price.replace(',', '.')) * 10 / 12).toFixed(2).replace('.', ',')
              : plan.price;
            return (
              <div key={plan.id} style={{
                background: plan.highlight ? 'linear-gradient(135deg, #1a0f00, #18181b)' : '#18181b',
                borderRadius: 16, padding: 28, position: 'relative',
                border: plan.highlight ? '2px solid #f97316' : '1px solid #27272a',
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: '#f97316', color: '#000', padding: '4px 16px', borderRadius: 20,
                    fontSize: 12, fontWeight: 700 }}>
                    {plan.badge}
                  </div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{plan.name}</h3>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 36, fontWeight: 800 }}>€{displayPrice}</span>
                  <span style={{ color: '#71717a', fontSize: 14 }}>{plan.period}</span>
                  {billingPeriod === 'yearly' && plan.price !== '0' && (
                    <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>
                      Risparmi €{(parseFloat(plan.price.replace(',', '.')) * 2).toFixed(2).replace('.', ',')} all'anno
                    </div>
                  )}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ padding: '6px 0', fontSize: 14, color: '#d4d4d8', display: 'flex', gap: 8 }}>
                      <span style={{ color: '#22c55e' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a href="/" style={{
                  display: 'block', textAlign: 'center', padding: '12px 20px', borderRadius: 10,
                  background: plan.highlight ? '#f97316' : '#27272a',
                  color: plan.highlight ? '#000' : '#e4e4e7',
                  textDecoration: 'none', fontWeight: 700, fontSize: 15,
                }}>
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ padding: '60px 24px 80px', maxWidth: 700, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 32 }}>Domande Frequenti</h2>
        {FAQ.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid #27272a', marginBottom: 4 }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 0', background: 'none', border: 'none', color: '#e4e4e7',
              cursor: 'pointer', fontSize: 15, fontWeight: 600, textAlign: 'left', fontFamily: FONT,
            }}>
              {item.q}
              <span style={{ color: '#71717a', fontSize: 18, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
            </button>
            {openFaq === i && (
              <div style={{ padding: '0 0 16px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.6 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid #27272a', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#52525b' }}>
          © {new Date().getFullYear()} VoiceTranslate — Traduzione vocale AI in tempo reale
        </div>
        <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>
          <a href="/privacy" style={{ color: '#3f3f46', marginRight: 16 }}>Privacy</a>
          <a href="/terms" style={{ color: '#3f3f46', marginRight: 16 }}>Termini</a>
          <a href="mailto:support@voicetranslate.app" style={{ color: '#3f3f46' }}>Supporto</a>
        </div>
      </footer>
    </div>
  );
}

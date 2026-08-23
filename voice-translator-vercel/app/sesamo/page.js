'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FONT } from '../lib/constants.js';
import { t, mapLang } from '../lib/i18n.js';
import AdminWallet from '../components/AdminWallet.js';
import { memGet } from '../lib/memoria.js';

// ═══════════════════════════════════════════════
// Admin Dashboard — i18n
// ═══════════════════════════════════════════════

function detectLang() {
  if (typeof window === 'undefined') return 'en';
  try { let p; try { p = JSON.parse(memGet('vt-prefs') || '{}'); } catch { p = null; } if (p?.lang) return mapLang(p.lang); } catch { /* memoria del browser piena o navigazione privata: si prosegue senza salvare */ }
  return mapLang((typeof navigator !== 'undefined' ? navigator.language : 'en').split('-')[0]);
}

// ═══════════════════════════════════════════════════════════════
// b.422 — TRE PANNELLI SU CINQUE MOSTRAVANO ZERI FINTI.
//
// "Panoramica", "Utenti" e "Incassi" leggevano `profiles`, `rooms`,
// `usage_daily` e `payments`: verificato sul database vivo di
// produzione, nessuna di quelle tabelle esiste. Il pannello si apriva
// lo stesso, con zero utenti, zero stanze e zero incassi — e aveva
// l'aria del cruscotto di un servizio senza clienti, invece che di un
// cruscotto rotto. Sono stati tolti insieme alle azioni che li
// alimentavano (vedi app/api/admin/route.js).
//
// Restano i due che leggono dati veri: le coppie di lingue (tabella
// `translations`) e il Wallet, che ha sempre avuto una sua rotta —
// /api/wallet/admin — ed e li che stanno i conti del prodotto.
// ═══════════════════════════════════════════════════════════════
const TAB_KEYS = [
  { id: 'languages', labelKey: 'adminLanguages', icon: '\u{1F30D}' },
  { id: 'wallet', label: 'Wallet', icon: '\u{1F4B6}' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('languages');
  const [adminEmail, setAdminEmail] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [lang, setLang] = useState('en');
  useEffect(() => { setLang(detectLang()); }, []);
  const L = (key) => t(lang, key);
  const [topLanguages, setTopLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  // b.92 — chi e collegato davvero, e perche l'accesso e stato rifiutato
  const [sessione, setSessione] = useState('');
  const [errore, setErrore] = useState('');

  // Get session token from localStorage (set by auth flow)
  const getToken = () => {
    try { return memGet('vt-token') || ''; } catch { return ''; }
  };

  // b.92 — mostra subito con quale account si entrerebbe
  useEffect(() => {
    const t = (() => { try { return memGet('vt-token') || ''; } catch { return ''; } })();
    if (!t) return;
    // La rotta /api/user smista per `action`: senza, risponde 400 "Invalid
    // action" e il pannello resta convinto che tu non sia collegato.
    fetch('/api/user?action=profile', { headers: { Authorization: `Bearer ${t}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.email) setSessione(d.email); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = ''; };
  }, []);

  const fetchAdmin = useCallback(async (action, extra = {}) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminEmail, token: getToken(), ...extra }),
    });
    return res.json();
  }, [adminEmail]);

  async function login() {
    setLoading(true);
    setErrore('');
    // b.422 — si entra chiedendo le coppie di lingue: era 'stats', che
    // non esiste piu. Serve solo a farsi riconoscere dal server, che
    // rifiuta con 403 chi non e in ADMIN_EMAILS.
    const data = await fetchAdmin('top-languages', { days: 30 });
    if (data.error) {
      // b.92 — prima era un alert col messaggio tecnico inglese
      setErrore(/admin/i.test(data.error)
        ? `L${'\u2019'}account ${sessione || 'in uso'} non e fra gli amministratori. Aggiungilo alla variabile ADMIN_EMAILS su Vercel e rifai il deploy.`
        : data.error);
      setLoading(false);
      return;
    }
    setTopLanguages(data.pairs || []);
    setAuthenticated(true);
    setLoading(false);
  }

  if (!authenticated) {
    return (
      <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* ── INIZIO b.92 — il campo email illudeva ──
            Chiedeva un indirizzo che il server IGNORA: l'accesso dipende
            dall'account con cui sei collegato nell'app e dall'elenco
            ADMIN_EMAILS. Si poteva restare bloccati qui per sempre senza
            capire perche. Ora la schermata dice la verita. */}
        <div style={{ background: '#18181b', borderRadius: 16, padding: 32, width: 380 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>{L('adminTitle')}</h1>
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.55, margin: '0 0 18px' }}>
            L{'\u2019'}accesso usa l{'\u2019'}account con cui sei collegato all{'\u2019'}app.
          </p>

          <div style={{
            background: '#09090b', border: '1px solid #27272a', borderRadius: 10,
            padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: '#71717a', marginBottom: 4 }}>
              SEI COLLEGATO COME
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: sessione ? '#e4e4e7' : '#f97316' }}>
              {sessione || 'nessun account \u2014 accedi prima nell\u2019app'}
            </div>
          </div>

          <button onClick={login} disabled={loading || !sessione} style={{
            width: '100%', background: sessione ? '#f97316' : '#27272a',
            color: sessione ? '#000' : '#71717a', border: 'none', borderRadius: 8,
            padding: '11px 20px', fontWeight: 700, fontSize: 15,
            cursor: sessione ? 'pointer' : 'default', fontFamily: FONT,
          }}>
            {loading ? L('adminVerifying') : L('adminLogin')}
          </button>

          {!sessione && (
            <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 13, color: '#f97316' }}>
              Vai all{'\u2019'}app e accedi
            </Link>
          )}
          {errore && (
            <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.55, color: '#f87171' }}>
              {errore}
            </div>
          )}
        </div>
        {/* ── FINE b.92 ── */}
      </div>
    );
  }

  const fmt = (n) => (n || 0).toLocaleString('it-IT');

  return (
    <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh', padding: 20 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Link href="/" style={{ color: '#71717a', textDecoration: 'none', fontSize: 14 }}>← App</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, flex: 1 }}>{'\u{1F4CA}'} {L('adminTitle')}</h1>
          <span style={{ fontSize: 13, color: '#71717a' }}>{adminEmail}</span>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#18181b', borderRadius: 12, padding: 4 }}>
          {TAB_KEYS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8,
              background: activeTab === tab.id ? '#f97316' : 'transparent',
              color: activeTab === tab.id ? '#000' : '#a1a1aa',
              fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 14, cursor: 'pointer', fontFamily: FONT,
            }}>
              {tab.icon} {tab.label || L(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* ── Wallet Tab: economics reali, servizi AI, voucher ── */}
        {activeTab === 'wallet' && <AdminWallet />}

        {/* ── Languages Tab ── */}
        {activeTab === 'languages' && (
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{'\u{1F30D}'} {L('adminTopLangPairs')}</h3>
            {topLanguages.map((lp, i) => {
              const maxCount = topLanguages[0]?.count || 1;
              return (
                <div key={lp.pair} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span style={{ width: 30, textAlign: 'right', fontSize: 13, color: '#71717a' }}>#{i + 1}</span>
                  <span style={{ width: 100, fontSize: 14, fontWeight: 600 }}>{lp.pair}</span>
                  <div style={{ flex: 1, background: '#27272a', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                    <div style={{ width: `${(lp.count / maxCount) * 100}%`, height: '100%', background: '#f97316', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ width: 60, textAlign: 'right', fontSize: 13, color: '#a1a1aa' }}>{fmt(lp.count)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

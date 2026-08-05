'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FONT } from '../lib/constants.js';
import { t, mapLang } from '../lib/i18n.js';
import AdminWallet from '../components/AdminWallet.js';

// ═══════════════════════════════════════════════
// Admin Dashboard — i18n
// ═══════════════════════════════════════════════

function detectLang() {
  if (typeof window === 'undefined') return 'en';
  try { let p; try { p = JSON.parse(localStorage.getItem('vt-prefs') || '{}'); } catch { p = null; } if (p?.lang) return mapLang(p.lang); } catch {}
  return mapLang((typeof navigator !== 'undefined' ? navigator.language : 'en').split('-')[0]);
}

const TAB_KEYS = [
  { id: 'overview', labelKey: 'adminOverview', icon: '\u{1F4CA}' },
  { id: 'users', labelKey: 'adminUsers', icon: '\u{1F465}' },
  { id: 'revenue', labelKey: 'adminRevenue', icon: '\u{1F4B0}' },
  { id: 'languages', labelKey: 'adminLanguages', icon: '\u{1F30D}' },
  { id: 'wallet', label: 'Wallet', icon: '\u{1F4B6}' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [adminEmail, setAdminEmail] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [lang, setLang] = useState('en');
  useEffect(() => { setLang(detectLang()); }, []);
  const L = (key) => t(lang, key);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usageChart, setUsageChart] = useState([]);
  const [revenueChart, setRevenueChart] = useState([]);
  const [topLanguages, setTopLanguages] = useState([]);
  const [loading, setLoading] = useState(false);
  // b.92 — chi e collegato davvero, e perche l'accesso e stato rifiutato
  const [sessione, setSessione] = useState('');
  const [errore, setErrore] = useState('');

  // Get session token from localStorage (set by auth flow)
  const getToken = () => {
    try { return localStorage.getItem('vt-token') || ''; } catch { return ''; }
  };

  // b.92 — mostra subito con quale account si entrerebbe
  useEffect(() => {
    const t = (() => { try { return localStorage.getItem('vt-token') || ''; } catch { return ''; } })();
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
    const data = await fetchAdmin('stats');
    if (data.error) {
      // b.92 — prima era un alert col messaggio tecnico inglese
      setErrore(/admin/i.test(data.error)
        ? `L${'\u2019'}account ${sessione || 'in uso'} non e fra gli amministratori. Aggiungilo alla variabile ADMIN_EMAILS su Vercel e rifai il deploy.`
        : data.error);
      setLoading(false);
      return;
    }
    setStats(data);
    setAuthenticated(true);
    // Load all data
    const [usage, revenue, langs, userList] = await Promise.all([
      fetchAdmin('usage-chart', { days: 30 }),
      fetchAdmin('revenue', { days: 30 }),
      fetchAdmin('top-languages', { days: 30 }),
      fetchAdmin('users', { limit: 50 }),
    ]);
    setUsageChart(usage.chart || []);
    setRevenueChart(revenue.revenue || []);
    setTopLanguages(langs.pairs || []);
    setUsers(userList.users || []);
    setLoading(false);
  }

  async function searchUsers() {
    const data = await fetchAdmin('users', { search: userSearch, limit: 50 });
    setUsers(data.users || []);
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
  const fmtEur = (cents) => `€${((cents || 0) / 100).toFixed(2)}`;

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

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && stats && (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: L('adminTotalUsers'), value: fmt(stats.totalUsers), color: '#3b82f6' },
                { label: 'Pro', value: fmt(stats.proUsers), color: '#f97316' },
                { label: 'Business', value: fmt(stats.businessUsers), color: '#a855f7' },
                { label: L('adminActiveToday'), value: fmt(stats.activeRooms), color: '#22c55e' },
                { label: L('adminTranslations30d'), value: fmt(stats.today?.translations), color: '#06b6d4' },
                { label: 'Cost Today', value: fmtEur(stats.today?.costCents), color: '#ef4444' },
                { label: 'Revenue Today', value: fmtEur(stats.today?.revenue), color: '#22c55e' },
                { label: L('adminRevenue30d'), value: fmtEur(stats.monthlyRevenue), color: '#f59e0b' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#18181b', borderRadius: 12, padding: 16, borderLeft: `3px solid ${kpi.color}` }}>
                  <div style={{ fontSize: 12, color: '#71717a', marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Usage Chart (text-based sparkline) */}
            <div style={{ background: '#18181b', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>{'\u{1F4C8}'} {L('adminTranslations30d')}</h3>
              <div style={{ display: 'flex', gap: 2, alignItems: 'end', height: 80 }}>
                {usageChart.slice(-30).map((d, i) => {
                  const max = Math.max(...usageChart.map(x => x.translations || 1));
                  const h = Math.max(4, ((d.translations || 0) / max) * 72);
                  return (
                    <div key={i} style={{ flex: 1, background: '#f97316', borderRadius: '2px 2px 0 0', height: h, minWidth: 3, opacity: 0.4 + (i / 30) * 0.6 }}
                      title={`${d.date}: ${d.translations} traduzioni`} />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder={L('adminSearch') + '...'} onKeyDown={e => e.key === 'Enter' && searchUsers()}
                style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 12px', color: '#e4e4e7', fontSize: 14, fontFamily: FONT }} />
              <button onClick={searchUsers} style={{ background: '#f97316', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                {'\u{1F50D}'} {L('adminSearch')}
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #27272a' }}>
                    {[L('adminEmail'), L('adminName'), L('adminPlan'), L('adminCredits'), 'Spent', 'Messages', L('adminLastLogin')].map(h => (
                      <th key={h} style={{ padding: 8, textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1a1a1e' }}>
                      <td style={{ padding: 8, fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: 8, color: '#a1a1aa' }}>{u.name}</td>
                      <td style={{ padding: 8 }}>
                        <span style={{ background: u.subscription_plan === 'business' ? '#a855f7' : u.subscription_plan === 'pro' ? '#f97316' : '#27272a',
                          color: u.subscription_plan !== 'free' ? '#fff' : '#71717a', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {u.subscription_plan || 'free'}
                        </span>
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{fmt(u.credits)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{fmtEur(u.total_spent)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{fmt(u.total_messages)}</td>
                      <td style={{ padding: 8, color: '#71717a', fontSize: 12 }}>{u.created_at?.split('T')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Revenue Tab ── */}
        {activeTab === 'revenue' && (
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{'\u{1F4B0}'} {L('adminRevenueLast30')}</h3>
            {revenueChart.length === 0 ? (
              <div style={{ color: '#71717a', fontSize: 14 }}>Nessun pagamento nel periodo</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #27272a' }}>
                      <th style={{ padding: 8, textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Data</th>
                      <th style={{ padding: 8, textAlign: 'right', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Crediti</th>
                      <th style={{ padding: 8, textAlign: 'right', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Abbonamenti</th>
                      <th style={{ padding: 8, textAlign: 'right', color: '#71717a', fontWeight: 500, fontSize: 11, textTransform: 'uppercase' }}>Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueChart.map(r => (
                      <tr key={r.date} style={{ borderBottom: '1px solid #1a1a1e' }}>
                        <td style={{ padding: 8 }}>{r.date}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{fmtEur(r.credits)}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{fmtEur(r.subscriptions)}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 600, color: '#22c55e' }}>{fmtEur(r.total)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #27272a' }}>
                      <td style={{ padding: 8, fontWeight: 700 }}>TOTALE</td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fmtEur(revenueChart.reduce((s, r) => s + r.credits, 0))}</td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{fmtEur(revenueChart.reduce((s, r) => s + r.subscriptions, 0))}</td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{fmtEur(revenueChart.reduce((s, r) => s + r.total, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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

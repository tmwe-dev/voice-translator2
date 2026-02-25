'use client';
import { useState, useEffect, useCallback } from 'react';

const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff/1000)}s fa`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m fa`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h fa`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}g fa`;
  return new Date(ts).toLocaleDateString('it-IT');
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('it-IT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export default function StartrekPage() {
  const [pass, setPass] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState('bridge');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const api = useCallback(async (action) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/startrek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, pass })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      return await res.json();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [pass]);

  const loadAll = useCallback(async () => {
    const [s, u, r, c] = await Promise.all([
      api('ship-status'),
      api('crew-manifest'),
      api('active-missions'),
      api('active-comms'),
    ]);
    if (s) setStats(s);
    if (u) setUsers(u.users);
    if (r) setRooms(r.rooms);
    if (c) setSessions(c.sessions);
  }, [api]);

  async function handleLogin(e) {
    e.preventDefault();
    const data = await api('ship-status');
    if (data) {
      setAuthenticated(true);
      setStats(data);
      // Load everything
      const [u, r, c] = await Promise.all([
        api('crew-manifest'),
        api('active-missions'),
        api('active-comms'),
      ]);
      if (u) setUsers(u.users);
      if (r) setRooms(r.rooms);
      if (c) setSessions(c.sessions);
    }
  }

  // Auto refresh every 30s
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [authenticated, loadAll]);

  const filteredUsers = searchTerm
    ? users.filter(u => u.email.includes(searchTerm.toLowerCase()) || (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : users;

  // ── STYLES ──
  const S = {
    page: { minHeight:'100vh', background:'linear-gradient(145deg, #0a0a1a 0%, #0d1033 30%, #1a0a2e 60%, #0a0a1a 100%)',
      color:'#c8d0ff', fontFamily:FONT, position:'relative', overflow:'hidden' },
    stars: { position:'fixed', top:0, left:0, right:0, bottom:0, pointerEvents:'none', zIndex:0 },
    content: { position:'relative', zIndex:1, padding:'20px', maxWidth:900, margin:'0 auto' },
    header: { textAlign:'center', marginBottom:24, padding:'20px 0' },
    title: { fontSize:28, fontWeight:900, letterSpacing:2,
      background:'linear-gradient(135deg, #ffd700, #ff6b35, #ffd700)',
      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' },
    subtitle: { fontSize:11, color:'rgba(200,208,255,0.3)', letterSpacing:4, textTransform:'uppercase', marginTop:4 },
    card: { background:'rgba(13,16,51,0.8)', borderRadius:16, padding:'16px 18px',
      border:'1px solid rgba(200,208,255,0.08)', marginBottom:16, backdropFilter:'blur(20px)' },
    statGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12 },
    statCard: { padding:'14px', borderRadius:14, background:'rgba(200,208,255,0.03)',
      border:'1px solid rgba(200,208,255,0.06)', textAlign:'center' },
    statNum: { fontSize:28, fontWeight:800, color:'#ffd700', fontFamily:'monospace' },
    statLabel: { fontSize:9, fontWeight:700, color:'rgba(200,208,255,0.3)', textTransform:'uppercase',
      letterSpacing:1.5, marginTop:4 },
    tabs: { display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' },
    tab: (active) => ({ padding:'8px 16px', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:700,
      fontFamily:FONT, border:'none', transition:'all 0.2s', letterSpacing:0.5,
      background: active ? 'rgba(255,215,0,0.15)' : 'rgba(200,208,255,0.03)',
      color: active ? '#ffd700' : 'rgba(200,208,255,0.4)',
      borderBottom: active ? '2px solid #ffd700' : '2px solid transparent' }),
    table: { width:'100%', borderCollapse:'collapse', fontSize:12 },
    th: { textAlign:'left', padding:'8px 10px', borderBottom:'1px solid rgba(200,208,255,0.1)',
      color:'rgba(200,208,255,0.35)', fontWeight:700, fontSize:10, letterSpacing:1, textTransform:'uppercase' },
    td: { padding:'8px 10px', borderBottom:'1px solid rgba(200,208,255,0.04)', color:'rgba(200,208,255,0.7)' },
    badge: (color) => ({ display:'inline-block', padding:'2px 8px', borderRadius:6, fontSize:9, fontWeight:800,
      background:`rgba(${color},0.12)`, color:`rgb(${color})`, letterSpacing:0.5 }),
    input: { width:'100%', padding:'12px 16px', borderRadius:14, background:'rgba(200,208,255,0.04)',
      border:'1px solid rgba(200,208,255,0.1)', color:'#c8d0ff', fontSize:14, outline:'none',
      fontFamily:FONT, boxSizing:'border-box' },
    btn: { padding:'12px 24px', borderRadius:14, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
      fontFamily:FONT, background:'linear-gradient(135deg, #ffd700, #ff6b35)', color:'#0a0a1a',
      boxShadow:'0 4px 20px rgba(255,215,0,0.3)' },
    refresh: { padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:700,
      fontFamily:FONT, background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.15)',
      color:'#ffd700' },
    searchInput: { padding:'8px 14px', borderRadius:10, background:'rgba(200,208,255,0.04)',
      border:'1px solid rgba(200,208,255,0.08)', color:'#c8d0ff', fontSize:12, outline:'none',
      fontFamily:FONT, width:220 },
  };

  // ── LOGIN SCREEN ──
  if (!authenticated) {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <div style={{...S.header, marginTop:'15vh'}}>
            <div style={{fontSize:50, marginBottom:12}}>{'🖖'}</div>
            <div style={S.title}>STARTREK</div>
            <div style={S.subtitle}>United Federation of VoiceTranslate</div>
          </div>
          <form onSubmit={handleLogin} style={{maxWidth:340, margin:'0 auto'}}>
            <div style={{marginBottom:16}}>
              <input style={S.input} type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="Codice di accesso, Capitano..." autoFocus />
            </div>
            <button type="submit" style={{...S.btn, width:'100%'}} disabled={loading}>
              {loading ? 'Verificando...' : 'Engage \u{1F680}'}
            </button>
            {error && <div style={{color:'#ff6b6b', fontSize:12, textAlign:'center', marginTop:12}}>{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──
  return (
    <div style={S.page}>
      <div style={S.content}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <div>
            <div style={S.title}>STARTREK</div>
            <div style={S.subtitle}>Ponte di Comando</div>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button style={S.refresh} onClick={loadAll} disabled={loading}>
              {loading ? '...' : '\u{1F504} Refresh'}
            </button>
            <div style={{width:10, height:10, borderRadius:5, background:'#00ff88',
              boxShadow:'0 0 8px rgba(0,255,136,0.5)', animation:'pulse 2s infinite'}} />
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div style={{...S.card, borderColor:'rgba(255,215,0,0.1)'}}>
            <div style={S.statGrid}>
              <div style={S.statCard}>
                <div style={S.statNum}>{stats.userCount}</div>
                <div style={S.statLabel}>{'\u{1F469}\u200D\u{1F680}'} Equipaggio</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#00d2ff'}}>{stats.sessionCount}</div>
                <div style={S.statLabel}>{'\u{1F4E1}'} Sessioni Attive</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#00ff88'}}>{stats.roomCount}</div>
                <div style={S.statLabel}>{'\u{1F30D}'} Stanze</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#ff6b9d'}}>{stats.convCount}</div>
                <div style={S.statLabel}>{'\u{1F4AC}'} Conversazioni</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#ffd700'}}>{(stats.totalCredits / 100).toFixed(2)}</div>
                <div style={S.statLabel}>{'\u{1F4B0}'} Crediti Tot ({'\u20AC'})</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#ff6b35'}}>{(stats.totalSpent / 100).toFixed(2)}</div>
                <div style={S.statLabel}>{'\u{1F4B8}'} Speso Tot ({'\u20AC'})</div>
              </div>
              <div style={S.statCard}>
                <div style={{...S.statNum, color:'#c8d0ff'}}>{stats.totalMessages}</div>
                <div style={S.statLabel}>{'\u{1F4E8}'} Messaggi Tot</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={S.tabs}>
          <button style={S.tab(tab === 'bridge')} onClick={() => setTab('bridge')}>{'\u{1F469}\u200D\u{1F680}'} Equipaggio ({users.length})</button>
          <button style={S.tab(tab === 'missions')} onClick={() => setTab('missions')}>{'\u{1F30D}'} Missioni ({rooms.length})</button>
          <button style={S.tab(tab === 'comms')} onClick={() => setTab('comms')}>{'\u{1F4E1}'} Comunicazioni ({sessions.length})</button>
        </div>

        {/* ── CREW / Users ── */}
        {tab === 'bridge' && (
          <div style={S.card}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
              <div style={{fontSize:14, fontWeight:700, color:'#ffd700'}}>{'\u{1F469}\u200D\u{1F680}'} Equipaggio Registrato</div>
              <input style={S.searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Cerca email o nome..." />
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>#</th>
                    <th style={S.th}>Utente</th>
                    <th style={S.th}>Tier</th>
                    <th style={S.th}>Crediti</th>
                    <th style={S.th}>Speso</th>
                    <th style={S.th}>Msg</th>
                    <th style={S.th}>Registrato</th>
                    <th style={S.th}>Ultimo Login</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u, i) => (
                    <tr key={u.email} style={{background: i % 2 === 0 ? 'transparent' : 'rgba(200,208,255,0.01)'}}>
                      <td style={{...S.td, color:'rgba(200,208,255,0.25)', fontSize:10}}>{i + 1}</td>
                      <td style={S.td}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          {u.avatar && <img src={u.avatar} alt="" style={{width:24, height:24, borderRadius:8, objectFit:'contain'}} />}
                          <div>
                            <div style={{fontWeight:600, color:'#c8d0ff', fontSize:12}}>{u.name || '—'}</div>
                            <div style={{fontSize:10, color:'rgba(200,208,255,0.35)'}}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        {u.useOwnKeys
                          ? <span style={S.badge('0,210,255')}>OWN KEYS</span>
                          : u.credits > 0
                            ? <span style={S.badge('108,99,255')}>PRO</span>
                            : <span style={S.badge('0,255,148')}>FREE</span>}
                      </td>
                      <td style={{...S.td, fontFamily:'monospace', fontWeight:600,
                        color: u.credits > 100 ? '#00ff88' : u.credits > 0 ? '#ffd700' : 'rgba(200,208,255,0.25)'}}>
                        {u.credits > 0 ? `${(u.credits/100).toFixed(2)}\u20AC` : '0'}
                      </td>
                      <td style={{...S.td, fontFamily:'monospace', color:'#ff6b35'}}>
                        {u.totalSpent > 0 ? `${(u.totalSpent/100).toFixed(2)}\u20AC` : '—'}
                      </td>
                      <td style={{...S.td, fontFamily:'monospace', fontWeight:600, color:'#c8d0ff'}}>
                        {u.totalMessages || 0}
                      </td>
                      <td style={{...S.td, fontSize:10, color:'rgba(200,208,255,0.4)'}}>
                        {formatDate(u.created)}
                      </td>
                      <td style={S.td}>
                        <span style={{fontSize:11, color: (Date.now() - u.lastLogin) < 86400000 ? '#00ff88' : 'rgba(200,208,255,0.4)'}}>
                          {timeAgo(u.lastLogin)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div style={{textAlign:'center', padding:30, color:'rgba(200,208,255,0.2)', fontSize:13}}>
                Nessun membro trovato
              </div>
            )}
          </div>
        )}

        {/* ── MISSIONS / Rooms ── */}
        {tab === 'missions' && (
          <div style={S.card}>
            <div style={{fontSize:14, fontWeight:700, color:'#00d2ff', marginBottom:14}}>
              {'\u{1F30D}'} Missioni Attive (Stanze)
            </div>
            {rooms.length === 0 ? (
              <div style={{textAlign:'center', padding:30, color:'rgba(200,208,255,0.2)', fontSize:13}}>
                Nessuna missione attiva
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>ID</th>
                      <th style={S.th}>Host</th>
                      <th style={S.th}>Tier</th>
                      <th style={S.th}>Modo</th>
                      <th style={S.th}>Contesto</th>
                      <th style={S.th}>Membri</th>
                      <th style={S.th}>Msg</th>
                      <th style={S.th}>Costo</th>
                      <th style={S.th}>Creata</th>
                      <th style={S.th}>Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r, i) => (
                      <tr key={r.id} style={{background: i % 2 === 0 ? 'transparent' : 'rgba(200,208,255,0.01)'}}>
                        <td style={{...S.td, fontFamily:'monospace', fontWeight:700, color:'#00d2ff', letterSpacing:1}}>{r.id}</td>
                        <td style={{...S.td, fontWeight:600}}>{r.host}</td>
                        <td style={S.td}>
                          <span style={S.badge(r.hostTier === 'TOP PRO' ? '255,215,0' : r.hostTier === 'PRO' ? '108,99,255' : '0,255,148')}>
                            {r.hostTier}
                          </span>
                        </td>
                        <td style={{...S.td, fontSize:11}}>{r.mode}</td>
                        <td style={{...S.td, fontSize:11}}>{r.context}</td>
                        <td style={S.td}>
                          {r.members.map((m, j) => (
                            <span key={j} style={{fontSize:10, marginRight:4,
                              color: m.role === 'host' ? '#ffd700' : '#00d2ff'}}>
                              {m.name} ({m.lang})
                            </span>
                          ))}
                        </td>
                        <td style={{...S.td, fontFamily:'monospace'}}>{r.msgCount}</td>
                        <td style={{...S.td, fontFamily:'monospace', fontSize:10, color:'#ff6b35'}}>
                          {r.totalCost > 0 ? `${(r.totalCost/100).toFixed(3)}\u20AC` : '—'}
                        </td>
                        <td style={{...S.td, fontSize:10, color:'rgba(200,208,255,0.4)'}}>{timeAgo(r.created)}</td>
                        <td style={S.td}>
                          {r.ended
                            ? <span style={S.badge('255,107,107')}>ENDED</span>
                            : <span style={S.badge('0,255,136')}>LIVE</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── COMMS / Sessions ── */}
        {tab === 'comms' && (
          <div style={S.card}>
            <div style={{fontSize:14, fontWeight:700, color:'#ff6b9d', marginBottom:14}}>
              {'\u{1F4E1}'} Comunicazioni Attive (Sessioni)
            </div>
            {sessions.length === 0 ? (
              <div style={{textAlign:'center', padding:30, color:'rgba(200,208,255,0.2)', fontSize:13}}>
                Nessuna comunicazione attiva
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Email</th>
                      <th style={S.th}>Login</th>
                      <th style={S.th}>Scadenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i} style={{background: i % 2 === 0 ? 'transparent' : 'rgba(200,208,255,0.01)'}}>
                        <td style={{...S.td, color:'rgba(200,208,255,0.25)', fontSize:10}}>{i + 1}</td>
                        <td style={{...S.td, fontWeight:600}}>{s.email}</td>
                        <td style={{...S.td, fontSize:11, color:'rgba(200,208,255,0.5)'}}>
                          {formatDate(s.created)}
                        </td>
                        <td style={{...S.td, fontSize:11}}>
                          <span style={{color: (s.created + 604800000) > Date.now() ? '#00ff88' : '#ff6b6b'}}>
                            {timeAgo(s.created + 604800000).replace(' fa', '')} restanti
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{textAlign:'center', padding:'20px 0', fontSize:10, color:'rgba(200,208,255,0.15)'}}>
          STARTREK Admin Console {'\u2022'} VoiceTranslate {'\u2022'} Auto-refresh ogni 30s
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}

'use client';
import { memo, useState, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

// ═══════════════════════════════════════════════
// HistoryView — Conversation history
//
// Redesigned: glassmorphism, ambient orb,
// date groups, search, sort toggle, stagger anim.
// ═══════════════════════════════════════════════

function HistoryView({ L, S, prefs, convHistory, viewConversation, setView, status, theme, setTheme, verifiedName }) {
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: '#060810',
    textPrimary: col.textPrimary || '#F2F4F7',
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || '#26D9B0',
    purple: col.accent2 || '#8B6AFF',
  };

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '🌍';

  const filtered = useMemo(() => {
    let list = [...convHistory];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.members?.join(' ').toLowerCase().includes(q) || c.lastMessage?.toLowerCase().includes(q));
    }
    if (sortBy === 'messages') list.sort((a, b) => (b.msgCount || 0) - (a.msgCount || 0));
    else list.sort((a, b) => (b.created || 0) - (a.created || 0));
    return list;
  }, [convHistory, search, sortBy]);

  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const weekAgo = today - 7 * 86400000;
    const groups = { today: [], yesterday: [], week: [], older: [] };
    filtered.forEach(c => {
      const ts = c.created || 0;
      if (ts >= today) groups.today.push(c);
      else if (ts >= yesterday) groups.yesterday.push(c);
      else if (ts >= weekAgo) groups.week.push(c);
      else groups.older.push(c);
    });
    return groups;
  }, [filtered]);

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatDuration = (c) => {
    if (!c.created || !c.lastActive) return '';
    const mins = Math.floor((c.lastActive - c.created) / 60000);
    if (mins < 1) return '<1m';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  let globalIdx = 0;
  const renderGroup = (label, items) => {
    if (items.length === 0) return null;
    return (
      <div key={label} style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
          color: C.textMuted, marginBottom: 8, padding: '0 4px',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((c, i) => {
            const idx = globalIdx++;
            const isHost = c.host === (verifiedName || prefs.name);
            const memberNames = c.members?.filter(m => m !== (verifiedName || prefs.name)) || [];
            return (
              <button key={c.id + i} onClick={() => viewConversation(c.id)} style={{
                width: '100%', padding: '14px 16px', borderRadius: 18, cursor: 'pointer',
                background: C.card, border: `1px solid ${C.cardBorder}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                color: C.textPrimary, textAlign: 'left', fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', gap: 14,
                animation: `vtSlideUp 0.3s ease-out ${idx * 0.04}s both`,
              }}>
                {/* Flag */}
                <div style={{
                  width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.accent}12, ${C.purple}12)`,
                  border: `1px solid ${C.accent}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {getLangFlag(c.lang)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      {memberNames.length > 0 ? memberNames.join(', ') : 'Conversazione'}
                    </span>
                    <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{formatTime(c.created)}</span>
                  </div>
                  {c.lastMessage && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                      background: `${C.accent}15`, color: C.accent,
                    }}>
                      {c.msgCount || 0} msg
                    </span>
                    {c.mode && c.mode !== 'conversation' && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                        background: `${C.purple}15`, color: C.purple,
                      }}>
                        {c.mode}
                      </span>
                    )}
                    {isHost && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                        background: `${C.accent}12`, color: C.accent,
                      }}>
                        Host
                      </span>
                    )}
                    {formatDuration(c) && (
                      <span style={{ fontSize: 9, color: C.textMuted }}>⏱ {formatDuration(c)}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-25%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* ═══ HEADER ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5,
      }}>
        <button onClick={() => setView('home')} style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.textMuted, fontSize: 18, WebkitTapHighlightColor: 'transparent',
        }}>
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>
            📋 Cronologia
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {convHistory.length} conversazioni
          </div>
        </div>
        <button onClick={() => setSortBy(sortBy === 'date' ? 'messages' : 'date')} style={{
          padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
          background: `${C.accent}12`, border: `1px solid ${C.accent}20`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: C.accent, fontSize: 10, fontWeight: 700, fontFamily: FONT,
          WebkitTapHighlightColor: 'transparent',
        }}>
          {sortBy === 'date' ? '🕐 Data' : '💬 Messaggi'}
        </button>
      </header>

      {/* ═══ SEARCH ═══ */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 14, opacity: 0.4 }}>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca conversazioni..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.textPrimary, fontSize: 13, fontFamily: FONT }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
          )}
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', scrollbarWidth: 'none' }}>
        {convHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}>
              📋
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
              Nessuna conversazione
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              Le tue conversazioni appariranno qui. Inizia una chat o usa TaxiTalk!
            </div>
            <button onClick={() => setView('home')} style={{
              padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              🎙️ Inizia a parlare
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Nessun risultato per "{search}"</div>
          </div>
        ) : (
          <>
            {renderGroup('Oggi', grouped.today)}
            {renderGroup('Ieri', grouped.yesterday)}
            {renderGroup('Questa settimana', grouped.week)}
            {renderGroup('Più vecchie', grouped.older)}
          </>
        )}
      </div>

      {status && <div style={{ textAlign: 'center', padding: '8px 16px', fontSize: 12, color: C.accent }}>{status}</div>}

      <style>{`
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default memo(HistoryView);

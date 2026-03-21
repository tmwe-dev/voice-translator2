'use client';
import { memo, useState, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';

// ═══════════════════════════════════════════════
// HistoryView — Cronologia conversazioni
//
// Features:
// - Ricerca per nome/membro
// - Raggruppamento per data (Oggi, Ieri, Questa settimana, Mese)
// - Badge lingua, durata, modalità
// - Anteprima ultimo messaggio
// - Empty state illustrato
// - Animazioni smooth
// ═══════════════════════════════════════════════

function HistoryView({ L, S, prefs, convHistory, viewConversation, setView, status, theme, setTheme, verifiedName }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'messages'
  const isIT = L('createRoom') === 'Crea Stanza';

  const getLangFlag = (code) => {
    const lang = LANGS.find(l => l.code === code);
    return lang?.flag || '🌍';
  };

  // Filter + sort conversations
  const filtered = useMemo(() => {
    let list = [...convHistory];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.members?.join(' ').toLowerCase().includes(q)) ||
        (c.lastMessage?.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'messages') {
      list.sort((a, b) => (b.msgCount || 0) - (a.msgCount || 0));
    } else {
      list.sort((a, b) => (b.created || 0) - (a.created || 0));
    }
    return list;
  }, [convHistory, search, sortBy]);

  // Group by date
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

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const formatDuration = (c) => {
    if (!c.created || !c.lastActive) return '';
    const mins = Math.floor((c.lastActive - c.created) / 60000);
    if (mins < 1) return '<1m';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const renderGroup = (label, items) => {
    if (items.length === 0) return null;
    return (
      <div key={label} style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2,
          color: S.colors.textMuted, marginBottom: 8, padding: '0 4px',
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((c, i) => {
            const isHost = c.host === (verifiedName || prefs.name);
            const memberNames = c.members?.filter(m => m !== (verifiedName || prefs.name)) || [];
            return (
              <button key={c.id + i} onClick={() => viewConversation(c.id)}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 18, cursor: 'pointer',
                  background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
                  border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.06)'}`,
                  color: S.colors.textPrimary, textAlign: 'left', fontFamily: FONT,
                  backdropFilter: 'blur(8px)', WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                {/* Language flag badge */}
                <div style={{
                  width: 48, height: 48, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${S.colors.accent1Bg || 'rgba(38,217,176,0.1)'}, ${S.colors.accent2Bg || 'rgba(0,210,255,0.1)'})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {getLangFlag(c.lang)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      {memberNames.length > 0 ? memberNames.join(', ') : (isIT ? 'Conversazione' : 'Conversation')}
                    </span>
                    <span style={{ fontSize: 11, color: S.colors.textMuted, flexShrink: 0 }}>
                      {formatTime(c.created)}
                    </span>
                  </div>
                  {/* Last message preview */}
                  {c.lastMessage && (
                    <div style={{
                      fontSize: 12, color: S.colors.textMuted, marginBottom: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.lastMessage}
                    </div>
                  )}
                  {/* Badges row */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Message count */}
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                      background: S.colors.accent1Bg || 'rgba(38,217,176,0.15)',
                      color: S.colors.accent1 || '#26D9B0',
                    }}>
                      {c.msgCount || 0} msg
                    </span>
                    {/* Mode badge */}
                    {c.mode && c.mode !== 'conversation' && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                        background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                      }}>
                        {c.mode}
                      </span>
                    )}
                    {/* Host badge */}
                    {isHost && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                        background: S.colors.accent4Bg || 'rgba(0,255,148,0.1)',
                        color: S.colors.accent4 || '#26D9B0',
                      }}>
                        Host
                      </span>
                    )}
                    {/* Duration */}
                    {formatDuration(c) && (
                      <span style={{ fontSize: 10, color: S.colors.textMuted }}>
                        {'⏱'} {formatDuration(c)}
                      </span>
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
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px',
        borderBottom: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.06)'}`,
      }}>
        <button onClick={() => setView('home')}
          style={{ background: 'none', border: 'none', color: S.colors.textPrimary, cursor: 'pointer', padding: 4, fontSize: 20 }}>
          {'←'}
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: S.colors.textPrimary, fontFamily: FONT }}>
            {'📋'} {isIT ? 'Cronologia' : 'History'}
          </h2>
          <div style={{ fontSize: 12, color: S.colors.textMuted }}>
            {convHistory.length} {isIT ? 'conversazioni' : 'conversations'}
          </div>
        </div>
        {/* Sort toggle */}
        <button onClick={() => setSortBy(sortBy === 'date' ? 'messages' : 'date')}
          style={{
            padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
            background: S.colors.accent1Bg || 'rgba(38,217,176,0.15)',
            border: `1px solid ${S.colors.accent1Border || 'rgba(38,217,176,0.3)'}`,
            color: S.colors.accent1 || '#26D9B0', fontSize: 11, fontWeight: 600,
            fontFamily: FONT,
          }}>
          {sortBy === 'date' ? '🕐' : '💬'} {sortBy === 'date' ? (isIT ? 'Data' : 'Date') : (isIT ? 'Messaggi' : 'Messages')}
        </button>
      </div>

      {/* Search bar */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
          border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>{'🔍'}</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isIT ? 'Cerca conversazioni...' : 'Search conversations...'}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: S.colors.textPrimary, fontSize: 14, fontFamily: FONT,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: S.colors.textMuted, cursor: 'pointer', fontSize: 16, padding: 0 }}>
              {'×'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {convHistory.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.8 }}>{'📋'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.colors.textPrimary, marginBottom: 8 }}>
              {isIT ? 'Nessuna conversazione' : 'No conversations yet'}
            </div>
            <div style={{ fontSize: 14, color: S.colors.textMuted, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
              {isIT
                ? 'Le tue conversazioni appariranno qui. Inizia una chat o usa TaxiTalk!'
                : 'Your conversations will appear here. Start a chat or use TaxiTalk!'}
            </div>
            <button onClick={() => setView('home')}
              style={{
                marginTop: 24, padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
                background: `linear-gradient(135deg, ${S.colors.accent1 || '#26D9B0'}, ${S.colors.accent2 || '#8B6AFF'})`,
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                fontFamily: FONT, boxShadow: `0 4px 16px ${S.colors.accent1 || '#26D9B0'}40`,
              }}>
              {'🎙️'} {isIT ? 'Inizia a parlare' : 'Start talking'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          /* No search results */
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>{'🔍'}</div>
            <div style={{ fontSize: 14, color: S.colors.textMuted }}>
              {isIT ? 'Nessun risultato per' : 'No results for'} "{search}"
            </div>
          </div>
        ) : (
          /* Grouped list */
          <>
            {renderGroup(isIT ? 'Oggi' : 'Today', grouped.today)}
            {renderGroup(isIT ? 'Ieri' : 'Yesterday', grouped.yesterday)}
            {renderGroup(isIT ? 'Questa settimana' : 'This week', grouped.week)}
            {renderGroup(isIT ? 'Più vecchie' : 'Older', grouped.older)}
          </>
        )}
      </div>

      {status && <div style={S.statusMsg}>{status}</div>}
    </div>
  );
}

export default memo(HistoryView);

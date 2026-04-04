'use client';
import { memo, useState, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import AvatarImg from './AvatarImg.js';

// ═══════════════════════════════════════════════
// HistoryView — Archivio (P4 Archive)
//
// P4 Manifesto design: Title, search bar,
// filter chips, conversation list with avatars
// ═══════════════════════════════════════════════

function HistoryView({ L, S, prefs, convHistory, viewConversation, setView, status, theme, setTheme, verifiedName }) {
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: S?.bg || col.bg || '#060810',
    textPrimary: S?.textPrimary || col.textPrimary || '#F2F4F7',
    textSecondary: S?.textSecondary || col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: S?.textMuted || col.textMuted || 'rgba(242,244,247,0.60)',
    card: S?.card || col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: S?.cardBorder || col.cardBorder || 'rgba(255,255,255,0.05)',
    input: S?.input || col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: S?.inputBorder || col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: S?.accent || col.accent1 || '#26D9B0',
    purple: S?.purple || col.accent2 || '#8B6AFF',
  };

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '🌍';
  const getLangName = (code) => LANGS.find(l => l.code === code)?.name || code;

  // Extract language filters from conversations
  const langFilters = useMemo(() => {
    const langs = new Set(convHistory.map(c => c.lang).filter(Boolean));
    return Array.from(langs).map(code => ({ code, name: getLangName(code) }));
  }, [convHistory]);

  // Extract time filters
  const timeFilters = [
    { id: 'today', label: 'Oggi' },
    { id: 'week', label: 'Questa settimana' },
    { id: 'month', label: 'Questo mese' },
  ];

  const filtered = useMemo(() => {
    let list = [...convHistory];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.members?.join(' ').toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q) ||
        c.topic?.toLowerCase().includes(q)
      );
    }

    // Language filter
    if (activeFilter !== 'all' && langFilters.some(f => f.code === activeFilter)) {
      list = list.filter(c => c.lang === activeFilter);
    }

    // Time filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (activeFilter === 'today') {
      list = list.filter(c => (c.created || 0) >= today);
    } else if (activeFilter === 'week') {
      const weekAgo = today - 7 * 86400000;
      list = list.filter(c => (c.created || 0) >= weekAgo);
    } else if (activeFilter === 'month') {
      const monthAgo = today - 30 * 86400000;
      list = list.filter(c => (c.created || 0) >= monthAgo);
    }

    // Sort by date (newest first)
    list.sort((a, b) => (b.created || 0) - (a.created || 0));
    return list;
  }, [convHistory, search, activeFilter, langFilters]);

  const formatDate = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Oggi';
    if (date.toDateString() === yesterday.toDateString()) return 'Ieri';
    return date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
  };

  const renderConversationCard = (c, index) => {
    const memberNames = c.members?.filter(m => m !== (verifiedName || prefs.name)) || [];
    const displayName = c.topic || memberNames.join(', ') || 'Conversazione';

    return (
      <button
        key={c.id || index}
        onClick={() => viewConversation(c.id)}
        style={{
          width: '100%',
          padding: '14px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: C.textPrimary,
          textAlign: 'left',
          fontFamily: FONT,
          WebkitTapHighlightColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: `vtSlideUp 0.3s ease-out ${index * 0.04}s both`,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `rgba(255,255,255,0.05)`;
          e.currentTarget.style.borderColor = `${C.accent}40`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = C.card;
          e.currentTarget.style.borderColor = C.cardBorder;
        }}
      >
        {/* Avatar */}
        <div style={{ flexShrink: 0 }}>
          <AvatarImg
            name={displayName}
            size={48}
            style={{ borderRadius: 10 }}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + topic */}
          <div style={{
            fontWeight: 700,
            fontSize: 14,
            color: C.textPrimary,
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </div>

          {/* Last message preview */}
          {c.lastMessage && (
            <div style={{
              fontSize: 12,
              color: C.textMuted,
              marginBottom: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {c.lastMessage}
            </div>
          )}

          {/* Meta: badge + date */}
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  background: `${C.accent}15`,
                  color: C.accent,
                }}
              >
                {c.msgCount || 0} msg
              </span>
              {c.lang && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    background: `${C.purple}15`,
                    color: C.purple,
                  }}
                >
                  {getLangFlag(c.lang)}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
              {formatDate(c.created)}
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: C.bg,
        fontFamily: FONT,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '-25%',
          width: '60vw',
          height: '60vw',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ═══ HEADER ═══ */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px 8px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 5,
        }}
      >
        <button
          onClick={() => setView('home')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            cursor: 'pointer',
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.textMuted,
            fontSize: 16,
            fontWeight: 700,
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
        >
          ‹
        </button>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.textPrimary,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Archivio
        </h1>
        <div style={{ flex: 1 }} />
        {convHistory.length > 0 && (
          <span
            style={{
              fontSize: 11,
              color: C.textMuted,
              padding: '4px 8px',
              borderRadius: 6,
              background: `${C.accent}10`,
            }}
          >
            {filtered.length} / {convHistory.length}
          </span>
        )}
      </header>

      {/* ═══ SEARCH BAR ═══ */}
      <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: C.card,
            border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 12,
            padding: '10px 14px',
          }}
        >
          <span style={{ fontSize: 14, opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca conversazioni, frasi, contatti..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: C.textPrimary,
              fontSize: 13,
              fontFamily: FONT,
              '::placeholder': { color: C.textMuted },
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: C.textMuted,
                cursor: 'pointer',
                fontSize: 16,
                padding: 0,
                fontWeight: 700,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ═══ FILTER CHIPS ═══ */}
      {convHistory.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 16px 12px',
            overflowX: 'auto',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none',
            flexShrink: 0,
          }}
        >
          {/* Tutte */}
          <button
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: activeFilter === 'all' ? `2px solid ${C.accent}` : `1px solid ${C.cardBorder}`,
              background: activeFilter === 'all' ? `${C.accent}15` : C.card,
              color: activeFilter === 'all' ? C.accent : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: FONT,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.background = `${C.accent}08`;
              }
            }}
            onMouseLeave={(e) => {
              if (activeFilter !== 'all') {
                e.currentTarget.style.background = C.card;
              }
            }}
          >
            Tutte
          </button>

          {/* Language filters */}
          {langFilters.map((filter) => (
            <button
              key={filter.code}
              onClick={() => setActiveFilter(filter.code)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeFilter === filter.code ? `2px solid ${C.accent}` : `1px solid ${C.cardBorder}`,
                background: activeFilter === filter.code ? `${C.accent}15` : C.card,
                color: activeFilter === filter.code ? C.accent : C.textMuted,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== filter.code) {
                  e.currentTarget.style.background = `${C.accent}08`;
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== filter.code) {
                  e.currentTarget.style.background = C.card;
                }
              }}
            >
              {getLangFlag(filter.code)} {filter.name}
            </button>
          ))}

          {/* Time filters */}
          {timeFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: activeFilter === filter.id ? `2px solid ${C.accent}` : `1px solid ${C.cardBorder}`,
                background: activeFilter === filter.id ? `${C.accent}15` : C.card,
                color: activeFilter === filter.id ? C.accent : C.textMuted,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: FONT,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (activeFilter !== filter.id) {
                  e.currentTarget.style.background = `${C.accent}08`;
                }
              }}
              onMouseLeave={(e) => {
                if (activeFilter !== filter.id) {
                  e.currentTarget.style.background = C.card;
                }
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══ CONVERSATION LIST ═══ */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 16px 16px',
          scrollbarWidth: 'none',
        }}
      >
        {convHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                margin: '0 auto 16px',
                background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
                border: `1px solid ${C.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
              }}
            >
              📋
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.textPrimary,
                marginBottom: 6,
              }}
            >
              Nessuna conversazione
            </div>
            <div
              style={{
                fontSize: 12,
                color: C.textMuted,
                lineHeight: 1.6,
                maxWidth: 260,
                margin: '0 auto 20px',
              }}
            >
              Le tue conversazioni appariranno qui. Inizia una chat o usa TaxiTalk!
            </div>
            <button
              onClick={() => setView('home')}
              style={{
                padding: '12px 28px',
                borderRadius: 14,
                cursor: 'pointer',
                background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONT,
                boxShadow: `0 4px 20px ${C.accent}35`,
              }}
            >
              🎙️ Inizia a parlare
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>
              🔍
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Nessun risultato
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((c, i) => renderConversationCard(c, i))}
          </div>
        )}
      </div>

      {status && (
        <div
          style={{
            textAlign: 'center',
            padding: '8px 16px',
            fontSize: 12,
            color: C.accent,
          }}
        >
          {status}
        </div>
      )}

      <style>{`
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

export default memo(HistoryView);

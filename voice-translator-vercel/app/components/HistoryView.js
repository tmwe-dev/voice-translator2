'use client';
import { memo, useState, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import getStyles from '../lib/styles.js';
import AvatarImg from './AvatarImg.js';
import PageHeader from './ui/PageHeader.js';
import EmptyState from './ui/EmptyState.js';
import { PALETTE } from '../lib/palette.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════
// HistoryView — Archivio (P4 Archive)
//
// P4 Manifesto design: Title, search bar,
// filter chips, conversation list with avatars
// ═══════════════════════════════════════════════

function HistoryView({ convHistory, viewConversation, verifiedName, archivioSoloLocale = false, guasto = false, suRiprova }) {
  const { L, S, prefs, setView, status, theme, setTheme, uiLang } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: col.bg || '#09090b',
    textPrimary: col.textPrimary || '#fafafa',
    textSecondary: col.textSecondary || 'rgba(250,250,250,0.90)',
    textMuted: col.textMuted || 'rgba(250,250,250,0.60)',
    card: col.glassCard || 'rgba(17,17,19,0.65)',
    cardBorder: col.cardBorder || 'rgba(250,250,250,0.05)',
    input: col.inputBg || 'rgba(17,17,19,0.6)',
    inputBorder: col.inputBorder || 'rgba(250,250,250,0.07)',
    accent: col.accent1 || PALETTE.purple,
    purple: col.accent2 || PALETTE.cyan,
    headerBg: col.headerBg || 'rgba(9,9,11,0.85)',
    headerBorder: col.headerBorder || 'rgba(250,250,250,0.04)',
  };

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '';
  const getLangName = (code) => LANGS.find(l => l.code === code)?.name || code;

  // Extract language filters from conversations
  const langFilters = useMemo(() => {
    const langs = new Set(convHistory.map(c => c.lang).filter(Boolean));
    return Array.from(langs).map(code => ({ code, name: getLangName(code) }));
  }, [convHistory]);

  // Extract time filters
  const timeFilters = [
    // b.138 — le tre etichette erano italiano fisso sopra un archivio
    // per il resto gia tradotto.
    { id: 'today', label: L('todayWord') },
    { id: 'week', label: L('histWeek') },
    { id: 'month', label: L('thisMonth') },
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

    if (date.toDateString() === today.toDateString()) return L('todayWord');
    if (date.toDateString() === yesterday.toDateString()) return L('yesterdayWord');
    return date.toLocaleDateString(uiLang, { month: 'short', day: 'numeric' });
  };

  const renderConversationCard = (c, index) => {
    const memberNames = c.members?.filter(m => m !== (verifiedName || prefs.name)) || [];
    const displayName = c.topic || memberNames.join(', ') || L('conversation');

    // b.353 — l'esportazione dal posto giusto (Luca: «esporta conversazione
    // dovrebbe essere dentro l'elenco delle conversazioni»): il testo del
    // dialogo scende in un file, senza dover aprire nulla.
    const esporta = (ev) => {
      ev.stopPropagation();
      const righe = (c.messages || []).map((m) => {
        const chi = m.sender || '';
        const che = m.original || m.text || '';
        const trad = m.translated ? ('  \u2192  ' + m.translated) : '';
        return chi + ': ' + che + trad;
      });
      const testo = displayName + String.fromCharCode(10) + '\u2550'.repeat(30) + String.fromCharCode(10, 10) + righe.join(String.fromCharCode(10)) + String.fromCharCode(10);
      const blob = new Blob([testo], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `conversazione-${(displayName || 'chat').replace(/[^\w-]+/g, '_').slice(0, 40)}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    };

    return (
      <div
        role="button" tabIndex={0}
        key={c.id || index}
        onClick={() => viewConversation(c.id)}
        onKeyDown={(e) => { if (e.key === 'Enter') viewConversation(c.id); }}
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
              {/* b.433 — DA CHE LINGUA A CHE LINGUA (layout completo, pagina
                  07). Fra due conversazioni la cosa che le distingue non e
                  chi c'era: e fra quali lingue si e parlato, ed e proprio
                  quello che non si vedeva. Prima compariva una bandiera
                  sola, quella della stanza.
                  Le righe scritte prima di oggi non portano le lingue: per
                  loro resta la bandiera singola di prima, che e meglio di
                  niente e non finge di essere due. */}
              {Array.isArray(c.lingue) && c.lingue.length > 0 ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  background: `${C.purple}15`, color: C.purple,
                }}>
                  {c.lingue.slice(0, 3).map((l, i) => (
                    <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <span style={{ opacity: 0.6 }}>{'\u2192'}</span>}
                      {getLangFlag(l)}
                    </span>
                  ))}
                </span>
              ) : c.lang ? (
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
              ) : null}
            </div>
            <span style={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
              {formatDate(c.created)}
            </span>
          </div>
        </div>

        {/* b.353 — Esporta, sulla riga: il posto giusto per portarsi via
            il testo (prima viveva sepolto nel menu della stanza). */}
        <button onClick={esporta} aria-label={L('exportConversation')} title={L('exportConversation')}
          style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
            border: `1px solid ${C.cardBorder}`, background: 'transparent', color: C.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
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
      <PageHeader
        title={L('archiveTitle')}
        subtitle={convHistory.length > 0 ? `${filtered.length} / ${convHistory.length}` : undefined}
        onBack={() => setView('home')}
        S={{ colors: C }}
      />

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
          <span style={{ fontSize: 14, opacity: 0.5 }}></span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('searchConversations')}
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
            {/* b.363 — italiano fisso in un archivio per il resto tradotto */}
            {L('allWord')}
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
          // b.206 — bottom alzato: le ultime conversazioni finivano sotto la BottomNav
          padding: '8px 16px calc(106px + env(safe-area-inset-bottom))',
          scrollbarWidth: 'none',
        }}
      >
        {/* b.434 — PRIMA IL GUASTO, POI IL VUOTO. Sono due cose diverse e
            finora si vedevano uguali: a chi non riusciva a leggere
            l'archivio si diceva «nessuna conversazione, comincia a
            parlare» — cioe gli si diceva che i suoi dati non ci sono.
            Un guasto detto bene ha tre cose: cosa non ha funzionato, che
            non e colpa tua, e cosa si puo fare adesso. */}
        {guasto ? (
          <EmptyState
            icon=""
            title={L('loadError')}
            desc={L('connErrorRetry')}
            actionLabel={L('retryWord')}
            onAction={() => suRiprova?.()}
            S={{ colors: C }}
          />
        ) : convHistory.length === 0 ? (
          <EmptyState
            icon=""
            title={archivioSoloLocale ? L('archiveLocalOnly') : L('noConversations')}
            desc={archivioSoloLocale ? L('archiveLocalDesc') : L('noConversationsDesc')}
            actionLabel={archivioSoloLocale ? L('signInWord') : L('startTalking')}
            onAction={() => setView(archivioSoloLocale ? 'profile' : 'home')}
            S={{ colors: C }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon=""
            title={L('noResults')}
            desc={L('noResultsDesc')}
            S={{ colors: C }}
          />
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

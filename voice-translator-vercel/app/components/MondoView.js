'use client';
// ═══════════════════════════════════════════════
// MondoView — Public room discovery
//
// Browse and join public chat rooms from around the world.
// Features:
// - Language filter pills
// - Search rooms by host/description
// - Category filter (mode)
// - Pull-to-refresh visual indicator
// - Auto-refresh every 30s
// - Better empty state with CTA
// - Animated loading skeleton
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';

const MODE_LABELS = {
  conversation: { label: 'Chat', icon: '💬', color: '#26D9B0' },
  classroom: { label: 'Classroom', icon: '🏫', color: '#10B981' },
  interview: { label: 'Interview', icon: '🎤', color: '#F59E0B' },
  conference: { label: 'Conference', icon: '🏛️', color: '#8B5CF6' },
  freetalk: { label: 'Free Talk', icon: '🎉', color: '#EC4899' },
  simultaneous: { label: 'Live', icon: '⚡', color: '#EF4444' },
};

// Popular language filters
const LANG_FILTERS = [
  { code: 'all', flag: '🌍', name: 'Tutte' },
  { code: 'it', flag: '🇮🇹', name: 'IT' },
  { code: 'en', flag: '🇺🇸', name: 'EN' },
  { code: 'es', flag: '🇪🇸', name: 'ES' },
  { code: 'fr', flag: '🇫🇷', name: 'FR' },
  { code: 'de', flag: '🇩🇪', name: 'DE' },
  { code: 'pt', flag: '🇧🇷', name: 'PT' },
  { code: 'zh', flag: '🇨🇳', name: 'ZH' },
  { code: 'ja', flag: '🇯🇵', name: 'JA' },
  { code: 'ko', flag: '🇰🇷', name: 'KO' },
  { code: 'ar', flag: '🇸🇦', name: 'AR' },
  { code: 'th', flag: '🇹🇭', name: 'TH' },
];

function MondoView({ L, S, prefs, setView, onJoinRoom, theme }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [refreshAnim, setRefreshAnim] = useState(false);
  const isIT = L('createRoom') === 'Crea Stanza';

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        setError(null);
      }
    } catch (e) {
      setError(isIT ? 'Impossibile caricare le stanze' : 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, [isIT]);

  // Fetch on mount + auto-refresh every 30s
  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 30000);
    return () => clearInterval(timer);
  }, [fetchRooms]);

  const handleRefresh = useCallback(() => {
    setRefreshAnim(true);
    fetchRooms().finally(() => setTimeout(() => setRefreshAnim(false), 600));
  }, [fetchRooms]);

  const getLangFlag = (code) => {
    const lang = LANGS.find(l => l.code === code);
    return lang?.flag || '🌍';
  };

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return isIT ? 'ora' : 'now';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  // Filter rooms
  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    if (langFilter !== 'all') {
      list = list.filter(r => r.lang === langFilter);
    }
    if (modeFilter !== 'all') {
      list = list.filter(r => r.mode === modeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.host?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rooms, langFilter, modeFilter, search]);

  // Available modes from current rooms
  const availableModes = useMemo(() => {
    const modes = new Set(rooms.map(r => r.mode));
    return ['all', ...modes];
  }, [rooms]);

  const skeletonStyle = {
    background: `linear-gradient(90deg, ${S.colors.overlayBg || 'rgba(255,255,255,0.03)'} 25%, rgba(255,255,255,0.06) 50%, ${S.colors.overlayBg || 'rgba(255,255,255,0.03)'} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 16, height: 80, marginBottom: 10,
  };

  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spinRefresh { to { transform: rotate(360deg); } }`}</style>

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
            {'🌍'} Mondo
          </h2>
          <div style={{ fontSize: 12, color: S.colors.textMuted }}>
            {rooms.length} {rooms.length === 1 ? (isIT ? 'stanza attiva' : 'active room') : (isIT ? 'stanze attive' : 'active rooms')}
          </div>
        </div>
        <button onClick={handleRefresh}
          style={{
            width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
            background: S.colors.accent1Bg || 'rgba(38,217,176,0.15)',
            border: `1px solid ${S.colors.accent1Border || 'rgba(38,217,176,0.3)'}`,
            color: S.colors.accent1 || '#26D9B0', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: refreshAnim ? 'spinRefresh 0.6s linear' : 'none',
          }}>
          {'↻'}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 16px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: S.colors.overlayBg || 'rgba(255,255,255,0.03)',
          border: `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>{'🔍'}</span>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isIT ? 'Cerca stanze...' : 'Search rooms...'}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
              color: S.colors.textPrimary, fontSize: 14, fontFamily: FONT }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: S.colors.textMuted, cursor: 'pointer', fontSize: 16, padding: 0 }}>
              {'×'}
            </button>
          )}
        </div>
      </div>

      {/* Language filter pills */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        {LANG_FILTERS.map(lf => {
          const active = langFilter === lf.code;
          return (
            <button key={lf.code} onClick={() => setLangFilter(lf.code)}
              style={{
                padding: '6px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                background: active
                  ? `linear-gradient(135deg, ${S.colors.accent1 || '#26D9B0'}, ${S.colors.accent2 || '#8B6AFF'})`
                  : (S.colors.overlayBg || 'rgba(255,255,255,0.03)'),
                border: active ? 'none' : `1px solid ${S.colors.overlayBorder || 'rgba(255,255,255,0.08)'}`,
                color: active ? '#fff' : S.colors.textSecondary,
                fontSize: 12, fontWeight: 600, fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.2s',
              }}>
              <span>{lf.flag}</span>
              <span>{lf.name}</span>
            </button>
          );
        })}
      </div>

      {/* Mode filter (if multiple modes exist) */}
      {availableModes.length > 2 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {availableModes.map(mode => {
            const active = modeFilter === mode;
            const info = MODE_LABELS[mode];
            return (
              <button key={mode} onClick={() => setModeFilter(mode)}
                style={{
                  padding: '4px 10px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                  background: active ? `${info?.color || S.colors.accent1}20` : 'transparent',
                  border: active ? `1px solid ${info?.color || S.colors.accent1}40` : '1px solid transparent',
                  color: active ? (info?.color || S.colors.accent1) : S.colors.textMuted,
                  fontSize: 11, fontWeight: 600, fontFamily: FONT,
                }}>
                {mode === 'all' ? (isIT ? 'Tutte' : 'All') : `${info?.icon || ''} ${info?.label || mode}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Room list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {/* Loading skeleton */}
        {loading && rooms.length === 0 && (
          <div>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ ...skeletonStyle, opacity: 1 - i * 0.15 }} />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: 20, color: S.colors.accent3 || '#FF6B6B', fontSize: 13 }}>
            {error}
            <button onClick={handleRefresh}
              style={{
                display: 'block', margin: '12px auto 0', padding: '8px 20px', borderRadius: 10,
                background: S.colors.accent1Bg, border: `1px solid ${S.colors.accent1Border}`,
                color: S.colors.accent1, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}>
              {isIT ? 'Riprova' : 'Retry'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && rooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.8 }}>{'🌍'}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.colors.textPrimary, marginBottom: 8 }}>
              {isIT ? 'Nessuna stanza al momento' : 'No rooms right now'}
            </div>
            <div style={{ fontSize: 14, color: S.colors.textMuted, lineHeight: 1.6, maxWidth: 280, margin: '0 auto', marginBottom: 24 }}>
              {isIT
                ? 'Crea una stanza pubblica per farti trovare da persone in tutto il mondo!'
                : 'Create a public room to be found by people around the world!'}
            </div>
            <button onClick={() => setView('home')}
              style={{
                padding: '14px 28px', borderRadius: 16, cursor: 'pointer',
                background: `linear-gradient(135deg, ${S.colors.accent1 || '#26D9B0'}, ${S.colors.accent2 || '#8B6AFF'})`,
                border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                fontFamily: FONT, boxShadow: `0 4px 16px ${S.colors.accent1 || '#26D9B0'}40`,
              }}>
              {'💬'} {isIT ? 'Crea stanza pubblica' : 'Create public room'}
            </button>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>{'🔍'}</div>
            <div style={{ fontSize: 14, color: S.colors.textMuted }}>
              {isIT ? 'Nessuna stanza trovata con questi filtri' : 'No rooms match these filters'}
            </div>
            <button onClick={() => { setSearch(''); setLangFilter('all'); setModeFilter('all'); }}
              style={{
                marginTop: 12, padding: '8px 20px', borderRadius: 10,
                background: 'none', border: `1px solid ${S.colors.overlayBorder}`,
                color: S.colors.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: FONT,
              }}>
              {isIT ? 'Resetta filtri' : 'Reset filters'}
            </button>
          </div>
        )}

        {/* Room cards */}
        {filteredRooms.map((room) => {
          const modeInfo = MODE_LABELS[room.mode] || { label: room.mode, icon: '💬', color: '#26D9B0' };
          return (
            <button
              key={room.roomId}
              onClick={() => onJoinRoom(room.roomId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '16px 18px', marginBottom: 8,
                background: S.colors.cardBg || 'rgba(255,255,255,0.03)',
                border: `1px solid ${S.colors.cardBorder || 'rgba(255,255,255,0.06)'}`,
                borderRadius: 18, cursor: 'pointer', textAlign: 'left',
                fontFamily: FONT,
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {/* Language flag */}
              <div style={{
                fontSize: 28, width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: `${modeInfo.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${modeInfo.color}25`,
              }}>
                {getLangFlag(room.lang)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: S.colors.textPrimary }}>
                    {room.host}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    background: `${modeInfo.color}20`, color: modeInfo.color,
                  }}>
                    {modeInfo.icon} {modeInfo.label}
                  </span>
                </div>
                {room.description && (
                  <div style={{
                    fontSize: 13, color: S.colors.textSecondary, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {room.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: S.colors.textMuted }}>
                  <span>{'👥'} {room.memberCount}</span>
                  <span>{'🕐'} {timeAgo(room.createdAt)}</span>
                  {room.targetLangs?.length > 0 && (
                    <span>{room.targetLangs.map(l => getLangFlag(l)).join(' ')}</span>
                  )}
                </div>
              </div>

              {/* Join arrow */}
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                background: `${modeInfo.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: modeInfo.color, fontSize: 16, fontWeight: 700,
              }}>
                {'→'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(MondoView);

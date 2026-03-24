'use client';
// ═══════════════════════════════════════════════
// MondoView — Public room discovery
//
// Redesigned: glassmorphism cards, ambient orb,
// horizontal lang/mode pills, skeleton shimmer,
// search bar, room cards with gradient accents.
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import getStyles from '../lib/styles.js';

const MODE_LABELS = {
  conversation: { label: 'Chat', icon: '💬', color: '#26D9B0' },
  classroom:    { label: 'Classroom', icon: '🏫', color: '#10B981' },
  interview:    { label: 'Interview', icon: '🎤', color: '#F59E0B' },
  conference:   { label: 'Conference', icon: '🏛️', color: '#8B5CF6' },
  freetalk:     { label: 'Free Talk', icon: '🎉', color: '#EC4899' },
  simultaneous: { label: 'Live', icon: '⚡', color: '#EF4444' },
};

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
    red: col.accent3 || '#FF6B6B',
    divider: col.dividerColor || 'rgba(255,255,255,0.04)',
  };

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [refreshAnim, setRefreshAnim] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo');
      if (res.ok) { const data = await res.json(); setRooms(data.rooms || []); setError(null); }
    } catch { setError('Impossibile caricare le stanze'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 30000);
    return () => clearInterval(timer);
  }, [fetchRooms]);

  const handleRefresh = useCallback(() => {
    setRefreshAnim(true);
    fetchRooms().finally(() => setTimeout(() => setRefreshAnim(false), 600));
  }, [fetchRooms]);

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '🌍';

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'ora';
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    if (langFilter !== 'all') list = list.filter(r => r.lang === langFilter);
    if (modeFilter !== 'all') list = list.filter(r => r.mode === modeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.host?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }
    return list;
  }, [rooms, langFilter, modeFilter, search]);

  const availableModes = useMemo(() => {
    const modes = new Set(rooms.map(r => r.mode));
    return ['all', ...modes];
  }, [rooms]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>

      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-20%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.purple}0A 0%, transparent 70%)`,
        pointerEvents: 'none', animation: 'vtOrbBreathe 8s ease-in-out infinite',
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
          {'‹'}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>
            🌍 Mondo
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {rooms.length} {rooms.length === 1 ? 'stanza attiva' : 'stanze attive'}
          </div>
        </div>
        <button onClick={handleRefresh} style={{
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          background: `${C.accent}12`, border: `1px solid ${C.accent}20`,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          color: C.accent, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: refreshAnim ? 'vtSpin 0.6s linear' : 'none',
          WebkitTapHighlightColor: 'transparent',
        }}>
          {'↻'}
        </button>
      </header>

      {/* ═══ SEARCH BAR ═══ */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 14, opacity: 0.4 }}>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca stanze..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: C.textPrimary, fontSize: 13, fontFamily: FONT,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16, padding: 0,
            }}>×</button>
          )}
        </div>
      </div>

      {/* ═══ LANGUAGE PILLS ═══ */}
      <div style={{
        display: 'flex', gap: 6, padding: '0 16px 6px', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexShrink: 0,
      }}>
        {LANG_FILTERS.map(lf => {
          const active = langFilter === lf.code;
          return (
            <button key={lf.code} onClick={() => setLangFilter(lf.code)} style={{
              padding: '5px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
              background: active ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card,
              border: active ? 'none' : `1px solid ${C.cardBorder}`,
              color: active ? '#fff' : C.textSecondary,
              fontSize: 11, fontWeight: 600, fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 4,
              WebkitTapHighlightColor: 'transparent',
              boxShadow: active ? `0 2px 10px ${C.accent}30` : 'none',
            }}>
              <span>{lf.flag}</span>
              <span>{lf.name}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ MODE PILLS ═══ */}
      {availableModes.length > 2 && (
        <div style={{
          display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {availableModes.map(mode => {
            const active = modeFilter === mode;
            const info = MODE_LABELS[mode];
            return (
              <button key={mode} onClick={() => setModeFilter(mode)} style={{
                padding: '4px 10px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
                background: active ? `${info?.color || C.accent}18` : 'transparent',
                border: active ? `1px solid ${info?.color || C.accent}35` : '1px solid transparent',
                color: active ? (info?.color || C.accent) : C.textMuted,
                fontSize: 10, fontWeight: 600, fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent',
              }}>
                {mode === 'all' ? 'Tutte' : `${info?.icon || ''} ${info?.label || mode}`}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ ROOM LIST ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px', scrollbarWidth: 'none' }}>

        {/* Loading skeleton */}
        {loading && rooms.length === 0 && (
          <div>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                background: `linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 75%)`,
                backgroundSize: '200% 100%', animation: 'vtShimmer 1.5s infinite',
                borderRadius: 18, height: 80, marginBottom: 10, opacity: 1 - i * 0.2,
              }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>
            <button onClick={handleRefresh} style={{
              padding: '8px 20px', borderRadius: 12,
              background: `${C.accent}15`, border: `1px solid ${C.accent}25`,
              color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}>
              Riprova
            </button>
          </div>
        )}

        {/* Empty state — no rooms at all */}
        {!loading && !error && rooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
            }}>
              🌍
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
              Nessuna stanza al momento
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              Crea una stanza pubblica per farti trovare da persone in tutto il mondo!
            </div>
            <button onClick={() => setView('create')} style={{
              padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              💬 Crea stanza pubblica
            </button>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              Nessuna stanza con questi filtri
            </div>
            <button onClick={() => { setSearch(''); setLangFilter('all'); setModeFilter('all'); }} style={{
              padding: '7px 18px', borderRadius: 10,
              background: 'none', border: `1px solid ${C.cardBorder}`,
              color: C.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT,
            }}>
              Resetta filtri
            </button>
          </div>
        )}

        {/* Room cards */}
        {filteredRooms.map((room, idx) => {
          const modeInfo = MODE_LABELS[room.mode] || { label: room.mode, icon: '💬', color: '#26D9B0' };
          return (
            <button key={room.roomId} onClick={() => onJoinRoom(room.roomId)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                padding: '14px 16px', marginBottom: 8,
                background: C.card, border: `1px solid ${C.cardBorder}`,
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 18, cursor: 'pointer', textAlign: 'left', fontFamily: FONT,
                WebkitTapHighlightColor: 'transparent',
                animation: `vtSlideUp 0.3s ease-out ${idx * 0.05}s both`,
              }}>
              {/* Flag avatar */}
              <div style={{
                fontSize: 26, width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                background: `${modeInfo.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${modeInfo.color}20`,
              }}>
                {getLangFlag(room.lang)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>
                    {room.host}
                  </span>
                  <span style={{
                    padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                    background: `${modeInfo.color}18`, color: modeInfo.color,
                  }}>
                    {modeInfo.icon} {modeInfo.label}
                  </span>
                </div>
                {room.description && (
                  <div style={{
                    fontSize: 12, color: C.textSecondary, marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {room.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: C.textMuted }}>
                  <span>👥 {room.memberCount}</span>
                  <span>🕐 {timeAgo(room.createdAt)}</span>
                  {room.targetLangs?.length > 0 && (
                    <span>{room.targetLangs.map(l => getLangFlag(l)).join(' ')}</span>
                  )}
                </div>
              </div>

              {/* Join arrow */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `${modeInfo.color}12`, border: `1px solid ${modeInfo.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: modeInfo.color, fontSize: 14, fontWeight: 700,
              }}>
                →
              </div>
            </button>
          );
        })}
      </div>

      {/* CSS */}
      <style>{`
        @keyframes vtShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes vtSpin { to { transform: rotate(360deg); } }
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes vtOrbBreathe { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.05); } }
      `}</style>
    </div>
  );
}

export default memo(MondoView);

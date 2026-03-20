'use client';
// ═══════════════════════════════════════════════
// MondoView — Public room discovery
//
// Browse and join public chat rooms from around the world.
// Pull-to-refresh, auto-refresh every 30s.
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useCallback } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import { IconBack, IconSignal } from './Icons.js';

const MODE_LABELS = {
  conversation: 'Chat',
  classroom: 'Classroom',
  interview: 'Interview',
  conference: 'Conference',
};

function MondoView({ L, S, prefs, setView, onJoinRoom, theme }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (e) {
      setError('Impossibile caricare le stanze');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + auto-refresh every 30s
  useEffect(() => {
    fetchRooms();
    const timer = setInterval(fetchRooms, 30000);
    return () => clearInterval(timer);
  }, [fetchRooms]);

  const getLangFlag = (code) => {
    const lang = LANGS.find(l => l.code === code);
    return lang?.flag || '\uD83C\uDF10';
  };

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'ora';
    if (mins < 60) return `${mins}m fa`;
    return `${Math.floor(mins / 60)}h fa`;
  };

  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px',
        borderBottom: `1px solid ${S.colors.overlayBorder}`,
      }}>
        <button onClick={() => setView('home')}
          style={{ background: 'none', border: 'none', color: S.colors.textPrimary, cursor: 'pointer', padding: 4 }}>
          <IconBack size={20} />
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: S.colors.textPrimary, fontFamily: FONT }}>
            {'\uD83C\uDF0D'} Mondo
          </h2>
          <div style={{ fontSize: 12, color: S.colors.textMuted }}>
            {rooms.length} {rooms.length === 1 ? 'stanza pubblica' : 'stanze pubbliche'}
          </div>
        </div>
        <button onClick={fetchRooms}
          style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 10,
            background: S.colors.accent1Bg || 'rgba(108,99,255,0.15)',
            border: `1px solid ${S.colors.accent1Border || 'rgba(108,99,255,0.3)'}`,
            color: S.colors.accent1 || '#6C63FF', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT,
          }}>
          {'\u21BB'} Refresh
        </button>
      </div>

      {/* Room list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && rooms.length === 0 && (
          <div style={{ textAlign: 'center', color: S.colors.textMuted, padding: 40 }}>
            Caricamento...
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83C\uDF0D'}</div>
            <div style={{ color: S.colors.textMuted, fontSize: 15 }}>
              Nessuna stanza pubblica al momento
            </div>
            <div style={{ color: S.colors.textTertiary, fontSize: 13, marginTop: 8 }}>
              Crea una stanza e rendila pubblica per farla apparire qui
            </div>
          </div>
        )}

        {rooms.map((room) => (
          <button
            key={room.roomId}
            onClick={() => onJoinRoom(room.roomId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: '14px 16px', marginBottom: 10,
              background: S.colors.cardBg || 'rgba(255,255,255,0.03)',
              border: `1px solid ${S.colors.cardBorder || 'rgba(255,255,255,0.06)'}`,
              borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              fontFamily: FONT,
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Language flag */}
            <div style={{
              fontSize: 28, width: 44, height: 44, borderRadius: 12,
              background: 'rgba(108,99,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {getLangFlag(room.lang)}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: S.colors.textPrimary }}>
                  {room.host}
                </span>
                <span style={{
                  padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                }}>
                  {MODE_LABELS[room.mode] || room.mode}
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
              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: S.colors.textMuted }}>
                <span>{'\uD83D\uDC65'} {room.memberCount}</span>
                <span>{'\u23F0'} {timeAgo(room.createdAt)}</span>
              </div>
            </div>

            {/* Join arrow */}
            <div style={{ color: S.colors.textMuted, fontSize: 18 }}>{'\u203A'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(MondoView);

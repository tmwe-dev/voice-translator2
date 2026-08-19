'use client';
import Icon from './Icon.js';
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
import { PALETTE } from '../lib/palette.js';
import { subscribeTick } from '../lib/ticker.js';
import { useApp } from '../contexts/AppContext.js';
import MondoNews from './MondoNews.js';

// ═══ INIZIO b.255 — le etichette delle stanze erano in inglese fisso ═══
// Sono il testo piu ripetuto della vetrina (una per ogni scheda e per
// ogni filtro) e restavano "Chat/Classroom/Free Talk/Live" anche con
// l'interfaccia in coreano o in arabo. Le chiavi esistono gia: sono le
// STESSE che usa la barra dentro la stanza (MODES in constants.js), cosi
// la stessa modalita non si chiama in due modi diversi in due schermate.
// 'interview' e 'conference' restano nella mappa per le stanze vecchie
// che potrebbero averle salvate (tolte da b.126), ma senza chiave: per
// quelle si mostra l'identificativo grezzo invece di una bugia tradotta.
const MODE_LABELS = {
  conversation: { labelKey: 'conversation', icon: '', color: PALETTE.teal },
  classroom:    { labelKey: 'classroom', icon: '', color: '#10B981' },
  interview:    { label: 'Interview', icon: '', color: '#F59E0B' },
  conference:   { label: 'Conference', icon: '', color: '#8B5CF6' },
  freetalk:     { labelKey: 'freeTalk', icon: '', color: '#EC4899' },
  simultaneous: { labelKey: 'simultaneous', icon: '', color: '#EF4444' },
};
// Il nome da mostrare: la chiave tradotta se c'e, altrimenti cio che c'e.
const nomeModalita = (info, L) => (info?.labelKey ? L(info.labelKey) : (info?.label || ''));
// ═══ FINE b.255 ═══

// b.98 — questa mappa era rimasta svuotata dalla ripulitura delle emoji di
// b.94: renderizzava uno spazio, e il tipo di stanza non si vedeva piu.
// Ora sono nomi del sistema di icone, non caratteri.
const ROOM_TYPE_ICONS = {
  public: null,        // pubblica: nessun segno, e la normalita
  protected: 'lock',
  private: 'lock',
  temporary: 'history',
};

// b.138 — le etichette del ruolo erano parole italiane fisse: chi
// leggeva l'app in un'altra lingua vedeva "Invitato" su una scheda
// per il resto tradotta. Ora sono chiavi, tranne quelle che restano
// sigle uguali ovunque.
const ROLE_BADGES = {
  owner: { labelKey: 'roleHost', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  moderator: { labelKey: 'roleMod', color: '#8B5CF6', bg: 'rgba(139,106,255,0.12)' },
  participant: null,
  listener: { label: '', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  invited: { labelKey: 'roleInvited', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
};

const LANG_FILTERS = [
  { code: 'all', flag: '', nameKey: 'filterAllVoices' },
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

function MondoView({ onJoinRoom, onCreateRoom, onParlane }) {
  const { L, setView, theme } = useApp(); // b.232 — rimossi S/prefs inutilizzati
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    // Fondo dal TEMA: prima era fisso e il tema chiaro restava nero.
    bg: col.bg || PALETTE.bgDeep,
    textPrimary: col.textPrimary || PALETTE.grayLight,
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || PALETTE.teal,
    purple: col.accent2 || PALETTE.violet,
    red: col.accent3 || PALETTE.coral,
    divider: col.dividerColor || 'rgba(255,255,255,0.04)',
  };

  // b.147 — Mondo si divide in due anime: le STANZE (quello che c'era)
  // e le NEWS (il seminatore di conversazioni). Un tab, non due pagine:
  // la gerarchia resta Mondo → argomento → persone → conversazione.
  const [tab, setTab] = useState('stanze');
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
      else setError(L('loadRoomsFailed')); // b.232 — prima !res.ok (500/429) era silenzioso
    } catch { setError(L('loadRoomsFailed')); }
    finally { setLoading(false); }
  }, [L]);

  useEffect(() => {
    return subscribeTick(30000, fetchRooms, { immediate: true });
  }, [fetchRooms]);

  const handleRefresh = useCallback(() => {
    setRefreshAnim(true);
    fetchRooms().finally(() => setTimeout(() => setRefreshAnim(false), 600));
  }, [fetchRooms]);

  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '';
  const getLangName = (code) => LANGS.find(l => l.code === code)?.name || '';

  const timeAgo = (ts) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return L('timeNow');
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  };

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    if (langFilter !== 'all') list = list.filter(r => r.lang === langFilter);
    if (modeFilter !== 'all') list = list.filter(r => r.mode === modeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.nome?.toLowerCase().includes(q)
        || r.host?.toLowerCase().includes(q)
        || r.description?.toLowerCase().includes(q));
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
        <button onClick={() => setView('home')} aria-label={L('goBack')} style={{
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
            Community
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {rooms.length} {rooms.length === 1 ? L('roomActiveOne') : L('roomActiveMany')}
          </div>
        </div>
        <button onClick={handleRefresh} aria-label={L('refreshRooms')} style={{
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
        {onCreateRoom && (
          <button onClick={onCreateRoom} aria-label={L('createBarTalk')} style={{
            width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: `0 2px 12px ${C.accent}30`,
          }}>
            +
          </button>
        )}
      </header>

      {/* ═══ TAB: STANZE | NEWS ═══ */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5 }}>
        {[
          { id: 'stanze', labelKey: 'tabRooms' },
          { id: 'news', labelKey: 'tabNews' },
        ].map(t => {
          const attivo = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '9px 0', borderRadius: 12, cursor: 'pointer',
              background: attivo ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : C.card,
              border: attivo ? 'none' : `1px solid ${C.cardBorder}`,
              color: attivo ? '#fff' : C.textSecondary,
              fontSize: 13, fontWeight: 700, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
              boxShadow: attivo ? `0 2px 12px ${C.accent}30` : 'none',
            }}>
              {L(t.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB NEWS ═══ */}
      {tab === 'news' && (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 5 }}>
          <MondoNews C={C} onJoinRoom={onJoinRoom} onParlane={onParlane} />
        </div>
      )}

      {/* ═══ SEARCH BAR ═══ */}
      {tab === 'stanze' && (
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <span style={{ fontSize: 14, opacity: 0.4 }}></span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={L('searchRooms')}
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
      )}

      {/* ═══ LANGUAGE PILLS ═══ */}
      {tab === 'stanze' && (
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
              <span>{lf.nameKey ? L(lf.nameKey) : lf.name}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* ═══ MODE PILLS ═══ */}
      {tab === 'stanze' && availableModes.length > 2 && (
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
                {mode === 'all' ? L('filterAllVoices') : `${info?.icon || ''} ${nomeModalita(info, L) || mode}`}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ ROOM LIST ═══ */}
      {tab === 'stanze' && (
      // b.206 — bottom alzato: le ultime stanze finivano sotto la BottomNav (76px)
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(88px + env(safe-area-inset-bottom))', scrollbarWidth: 'none' }}>

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
              {L('retryWord')}
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
            }}><Icon name="globe" size={34} color={C.accent || 'rgba(255,255,255,0.4)'} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
              {L('noRoomsYet')}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>
              {L('createPublicRoomDesc')}
            </div>
            <button onClick={onCreateRoom || (() => setView('home'))} style={{
              padding: '12px 28px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: FONT,
              boxShadow: `0 4px 20px ${C.accent}35`,
            }}>
              {L('createBarTalk')}
            </button>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}></div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              {L('noRoomsFilters')}
            </div>
            <button onClick={() => { setSearch(''); setLangFilter('all'); setModeFilter('all'); }} style={{
              padding: '7px 18px', borderRadius: 10,
              background: 'none', border: `1px solid ${C.cardBorder}`,
              color: C.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT,
            }}>
              {L('resetFilters')}
            </button>
          </div>
        )}

        {/* Room cards */}
        {filteredRooms.map((room, idx) => {
          const modeInfo = MODE_LABELS[room.mode] || { label: room.mode, icon: '', color: PALETTE.teal };
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
              {/* Bandiera dell'host: da quale lingua e paese si parla */}
              <div style={{
                fontSize: 26, width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                background: `${modeInfo.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${modeInfo.color}20`,
              }}>
                {getLangFlag(room.hostLang || room.lang)}
              </div>

              {/* Info — in cima il NOME della stanza: e cio che si sceglie.
                  L'host viene dopo, con la sua bandiera e la sua lingua. */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{
                    fontWeight: 700, fontSize: 14, color: C.textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                  }}>
                    {room.nome || room.host}
                  </span>
                  {/* Room type icon */}
                  {ROOM_TYPE_ICONS[room.roomType] && (
                    <span style={{ display: 'inline-flex' }} title={room.roomType}>
                      <Icon name={ROOM_TYPE_ICONS[room.roomType]} size={12} color={C.textMuted} />
                    </span>
                  )}
                  {/* Si bussa e l'host apre: dirlo PRIMA che uno tocchi,
                      altrimenti sembra una stanza che non risponde. */}
                  {room.suApprovazione && (
                    <span style={{
                      padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                      background: `${PALETTE.amber || '#F59E0B'}18`, color: PALETTE.amber || '#F59E0B',
                    }}>
                      {L('onApproval')}
                    </span>
                  )}
                  {/* b.111 — litigio libero. Va detto PRIMA di entrare:
                      e la ragione per cui uno sceglie questa stanza, o
                      per cui gira alla larga. Scoprirlo dentro sarebbe
                      un'imboscata. */}
                  {room.hot && (
                    <span style={{
                      padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                      background: 'rgba(255,90,60,0.12)', color: '#FF7A5C',
                    }} title={L('freeFightTip')}>
                      {L('freeFight')}
                    </span>
                  )}
                  {/* Host role badge */}
                  {room.myRole && ROLE_BADGES[room.myRole] && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700,
                      background: ROLE_BADGES[room.myRole].bg,
                      color: ROLE_BADGES[room.myRole].color,
                    }}>
                      {ROLE_BADGES[room.myRole].labelKey ? L(ROLE_BADGES[room.myRole].labelKey) : ROLE_BADGES[room.myRole].label}
                    </span>
                  )}
                  <span style={{
                    padding: '2px 7px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                    background: `${modeInfo.color}18`, color: modeInfo.color,
                  }}>
                    {modeInfo.icon} {nomeModalita(modeInfo, L)}
                  </span>
                </div>

                {/* Chi ospita, e da dove */}
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                  {getLangFlag(room.hostLang || room.lang)} {getLangName(room.hostLang || room.lang)}
                  {' · '}{room.host}
                </div>

                {/* b.99 — la verita sulla riservatezza, scritta prima di
                    entrare e non nascosta nelle condizioni d'uso. Qui i
                    messaggi restano sul server: e il prezzo per far vedere
                    a chi arriva di cosa si sta parlando. Le chat private
                    restano cifrate, e sono un'altra cosa. */}
                <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3, opacity: 0.85 }}>
                  {L('openRoomNotice')}
                </div>

                {room.description && (
                  <div style={{
                    fontSize: 12, color: C.textSecondary, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {room.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: C.textMuted }}>
                  <span>{room.memberCount}{room.maxPartecipanti ? `/${room.maxPartecipanti}` : ''}</span>
                  <span>{timeAgo(room.createdAt)}</span>
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
      )}

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

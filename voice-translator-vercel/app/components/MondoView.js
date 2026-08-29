'use client';
import Icon from './Icon.js';
import { quando, viva, stileEtichetta, PUNTO, paeseDaLingua, linguaDelPaese, bandieraPaese, nomePaese } from '../lib/schedaMondo.js';
import PannelloLaterale, { LinguettaPannello } from './ui/PannelloLaterale.js';
import { COLONNA, riservaADestra } from '../lib/righello.js';
import PreferenzeMondo from './ui/PreferenzeMondo.js';
import PreferitiTemi from './ui/PreferitiTemi.js';
import CardSezione from './ui/CardSezione.js';
import Scelta from './ui/Scelta.js';
import { PAESI } from '../lib/paesi.js';
import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { FONT, LANGS, vibrate, lingueTrovate } from '../lib/constants.js';
import GloboMondo from './GloboMondo.js';
import FinestraSulMondo from './FinestraSulMondo.js';
import getStyles from '../lib/styles.js';
import { PALETTE } from '../lib/palette.js';
import { subscribeTick } from '../lib/ticker.js';
import { useApp } from '../contexts/AppContext.js';
import MondoNews from './MondoNews.js';

// ═══════════════════════════════════════════════════════════════
// MondoView — b.580
//
// Il globo approvato resta intatto: nessun velo scuro sopra Terra,
// stelle o animazioni. Paese e lingua diventano due concetti distinti.
// Il radar Live e' gestito da FinestraSulMondo e usa lo stesso globo.
// ═══════════════════════════════════════════════════════════════

const MODE_LABELS = {
  conversation: { labelKey: 'conversation', icon: '', color: PALETTE.teal },
  classroom:    { labelKey: 'classroom', icon: '', color: '#10B981' },
  interview:    { label: 'Interview', icon: '', color: '#F59E0B' },
  conference:   { label: 'Conference', icon: '', color: '#8B5CF6' },
  freetalk:     { labelKey: 'freeTalk', icon: '', color: '#EC4899' },
  simultaneous: { labelKey: 'simultaneous', icon: '', color: '#EF4444' },
};
const nomeModalita = (info, L) => (info?.labelKey ? L(info.labelKey) : (info?.label || ''));

const ROOM_TYPE_ICONS = {
  public: null,
  protected: 'lock',
  private: 'lock',
  temporary: 'history',
};

const ROLE_BADGES = {
  owner: { labelKey: 'roleHost', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  moderator: { labelKey: 'roleMod', color: '#8B5CF6', bg: 'rgba(139,106,255,0.12)' },
  participant: null,
  listener: { labelKey: 'roleListener', color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
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

function normalizzaStanza(r) {
  if (!r) return r;
  return { ...r,
    roomId: r.roomId || r.id,
    nome: r.nome || r.name || r.roomId || r.id || '',
    membri: (r.memberCount ?? r.members ?? r.partecipanti ?? 0),
  };
}
function normalizzaDiscussione(d) {
  if (!d) return d;
  return { ...d,
    titolo: d.titolo || d.title || '',
    commenti: (d.comment_count ?? d.commentCount ?? d.commenti ?? 0),
  };
}

function MondoView({ onJoinRoom, onCreateRoom, onParlane }) {
  const { L, setView, theme, prefs, savePrefs } = useApp();
  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
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

  const [tab, setTab] = useState('news');
  const [feedCaldo, setFeedCaldo] = useState(null);
  const [feedCaldoGuasto, setFeedCaldoGuasto] = useState(false);
  const [riprovaCaldo, setRiprovaCaldo] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!vivo) return;
        if (d) { setFeedCaldo((d.discussioni || []).map(normalizzaDiscussione)); setFeedCaldoGuasto(false); }
        else { setFeedCaldo([]); setFeedCaldoGuasto(true); }
      })
      .catch(() => { if (vivo) { setFeedCaldo([]); setFeedCaldoGuasto(true); } });
    return () => { vivo = false; };
  }, [riprovaCaldo]);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [apriDiscussione, setApriDiscussione] = useState(null);
  const [strumenti, setStrumenti] = useState(false);
  const [paeseScelto, setPaeseScelto] = useState(null);
  const [paeseFocusNotizia, setPaeseFocusNotizia] = useState(null);
  const [bozzaPaesePanello, setBozzaPaesePanello] = useState(null);
  useEffect(() => { if (strumenti) setBozzaPaesePanello(paeseScelto); }, [strumenti, paeseScelto]);
  const [discesa, setDiscesa] = useState(0);
  const [schedaPaese, setSchedaPaese] = useState(null);
  const [temaDaMondo, setTemaDaMondo] = useState(null);

  useEffect(() => {
    if (!paeseScelto) { setSchedaPaese(null); return; }
    let vivo = true;
    const taglio = new AbortController();
    (async () => {
      try {
        const r = await fetch(`/api/mondo/paese?code=${encodeURIComponent(paeseScelto)}`, { signal: taglio.signal });
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (vivo) setSchedaPaese(d);
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('[b.399] scheda paese non arrivata:', e?.message);
        if (vivo) setSchedaPaese(null);
      }
    })();
    return () => { vivo = false; taglio.abort(); };
  }, [paeseScelto]);

  const seguiScorrimento = useCallback((e) => {
    const y = e?.currentTarget?.scrollTop || 0;
    const q = Math.min(1, y / 240);
    setDiscesa((prima) => (Math.abs(prima - q) > 0.01 ? q : prima));
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo', { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) { setRooms((data.rooms || []).map(normalizzaStanza)); setError(null); }
        else setError(L('loadRoomsFailed'));
      } else setError(L('loadRoomsFailed'));
    } catch (e) {
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo:', e?.message || e);
      setError(L('loadRoomsFailed'));
    } finally { setLoading(false); }
  }, [L]);

  useEffect(() => subscribeTick(30000, fetchRooms, { immediate: true }), [fetchRooms]);
  const handleRefresh = useCallback(() => { fetchRooms(); }, [fetchRooms]);
  const getLangFlag = (code) => LANGS.find(l => l.code === code)?.flag || '';
  const getLangName = (code) => LANGS.find(l => l.code === code)?.name || '';

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    // Paese e lingua non sono piu la stessa scelta. Se una stanza porta
    // il Paese vero si usa quello; le stanze legacy senza Paese restano
    // visibili invece di essere escluse da una lingua indovinata.
    if (paeseScelto) list = list.filter((r) => !r.paese || r.paese === paeseScelto);
    else if (langFilter !== 'all') list = list.filter(r => r.lang === langFilter);
    if (modeFilter !== 'all') list = list.filter(r => r.mode === modeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => r.nome?.toLowerCase().includes(q)
        || r.host?.toLowerCase().includes(q)
        || r.description?.toLowerCase().includes(q));
    }
    return list;
  }, [rooms, langFilter, modeFilter, search, paeseScelto]);

  const cercando = search.trim().length > 0;
  const risultati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const stanzePerLingua = {};
    for (const r of rooms) { if (r.lang) stanzePerLingua[r.lang] = (stanzePerLingua[r.lang] || 0) + 1; }
    const paesi = LANGS
      .filter((l) => lingueTrovate(l, q))
      .sort((a, b) => (stanzePerLingua[b.code] || 0) - (stanzePerLingua[a.code] || 0))
      .slice(0, 6)
      .map((l) => ({ ...l, vive: stanzePerLingua[l.code] || 0 }));
    const stanze = rooms.filter((r) =>
      r.nome?.toLowerCase().includes(q)
      || r.host?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    ).slice(0, 6);
    const discussioni = (feedCaldo || []).filter((d) =>
      (d.titolo || '').toLowerCase().includes(q) || (d.topic || '').toLowerCase().includes(q)
    ).slice(0, 6);
    return { paesi, stanze, discussioni };
  }, [search, rooms, feedCaldo]);

  useEffect(() => {
    const mio = paeseDaLingua(prefs?.lang);
    if (mio) setPaeseScelto(mio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Community traffic resta disponibile come layer separato del globo.
  const trafficoPaesi = useMemo(() => {
    const conto = {};
    for (const r of rooms) {
      const p = r.paese || paeseDaLingua(r.hostLang || r.lang);
      if (p) conto[p] = (conto[p] || 0) + 1 + (Number(r.membri) || 0) * 0.2;
    }
    for (const d of feedCaldo || []) {
      if (d.country) conto[d.country] = (conto[d.country] || 0) + 0.6;
    }
    const massimo = Math.max(1, ...Object.values(conto));
    const scala = {};
    for (const [p, n] of Object.entries(conto)) scala[p] = Math.min(1, n / massimo);
    return scala;
  }, [rooms, feedCaldo]);

  const rotteVere = useMemo(() => {
    const paesi = [...new Set(rooms.map((r) => r.paese || paeseDaLingua(r.hostLang || r.lang)).filter(Boolean))];
    const coppie = [];
    for (let i = 0; i < paesi.length && coppie.length < 10; i++) {
      for (let j = i + 1; j < paesi.length && coppie.length < 10; j++) coppie.push([paesi[i], paesi[j]]);
    }
    return coppie;
  }, [rooms]);

  const perLingua = useMemo(() => {
    const c = {};
    for (const r of rooms) { const l = r.lang; if (l) c[l] = (c[l] || 0) + 1; }
    return c;
  }, [rooms]);

  const availableModes = useMemo(() => {
    const modes = new Set(rooms.map(r => r.mode));
    return ['all', ...modes];
  }, [rooms]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>

      {tab === 'mondo' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <GloboMondo sfondo paese={paeseScelto} focusEsterno={paeseFocusNotizia} rotte={rotteVere} traffico={trafficoPaesi}
            titolo={L('worldNowTitle')} etichettaCielo={L('skyOfPlanet')}
            onPaeseScelto={(code) => {
              // b.580 — scegliere una zona non cambia la lingua. Il Paese
              // dice DOVE guardare; BarTalk traduce cio che trova.
              setPaeseScelto(code);
            }} />

          {/* Nessun filtro/velo sopra il pianeta. Terra, stelle, atmosfera
              e animazioni arrivano direttamente dal renderer approvato. */}

          {paeseScelto && schedaPaese && discesa < 0.6 && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '52%', pointerEvents: 'none',
              display: 'flex', justifyContent: 'center',
              opacity: 1 - (discesa / 0.6), transition: 'opacity 160ms linear',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                borderRadius: 999, background: 'rgba(6,9,18,0.62)',
                border: `1px solid ${C.cardBorder}`, backdropFilter: 'blur(10px)',
                fontFamily: FONT, fontSize: 12.5, fontWeight: 500, color: C.textSecondary,
                maxWidth: '92%', flexWrap: 'wrap', justifyContent: 'center',
              }}>
                {(() => {
                  const pezzi = [];
                  if (Number.isFinite(schedaPaese.persone) && schedaPaese.persone > 0) pezzi.push(`${schedaPaese.persone} ${L('inRoomWord')}`);
                  if (Number.isFinite(schedaPaese.stanze) && schedaPaese.stanze > 0) pezzi.push(`${schedaPaese.stanze} ${L('tabRooms')}`);
                  if (Number.isFinite(schedaPaese.temi) && schedaPaese.temi > 0) pezzi.push(`${schedaPaese.temi} ${L('topicsWord')}`);
                  if (!pezzi.length) return <span style={{ color: C.textMuted }}>{L('quietHereNow')}</span>;
                  return <span>{pezzi.join(` ${PUNTO} `)}</span>;
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <FinestraSulMondo C={C} L={L} lingua={prefs?.lang || 'it'} prefs={prefs}
        attiva={tab === 'mondo' && !cercando} paese={paeseScelto}
        onPuntaGlobo={setPaeseFocusNotizia}
        occupato={strumenti || !!schedaPaese} />

      {!cercando && !strumenti && (
        <LinguettaPannello onApri={() => setStrumenti(true)} C={C}
          etichetta={tab === 'news' ? L('tabNews') : tab === 'mondo' ? L('worldNowTitle') : L('searchRooms')} />
      )}

      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px 4px', flexShrink: 0, position: 'relative', zIndex: 6,
      }}>
        {(() => {
          const SCHEDE = [
            { id: 'news', parola: L('tabNews'), acciaio: '/sezioni/sez-news.webp' },
            { id: 'mondo', parola: L('worldNowTitle'), acciaio: '/sezioni/sez-mondo.webp' },
          ];
          const i = Math.max(0, SCHEDE.findIndex((x) => x.id === tab));
          const gira = (passo) => {
            vibrate(8);
            setTab(SCHEDE[(i + passo + SCHEDE.length) % SCHEDE.length].id);
          };
          const freccia = (verso, nome) => (
            <button onClick={() => gira(verso)} aria-label={nome}
              style={{
                width: 38, height: 38, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
                background: 'transparent', border: 'none', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <Icon name={verso < 0 ? 'chevLeft' : 'chevRight'} size={20} color={C.textSecondary || C.textMuted} />
            </button>
          );
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              {freccia(-1, SCHEDE[(i - 1 + SCHEDE.length) % SCHEDE.length].parola)}
              <button onClick={() => gira(1)} aria-label={SCHEDE[i].parola} title={SCHEDE[i].parola}
                style={{
                  width: 54, height: 54, borderRadius: 16, cursor: 'pointer', flexShrink: 0, padding: 0,
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SCHEDE[i].acciaio} alt="" width={48} height={48}
                  style={{ width: 48, height: 48, objectFit: 'contain', display: 'block' }} />
              </button>
              {freccia(1, SCHEDE[(i + 1) % SCHEDE.length].parola)}
            </div>
          );
        })()}

        <div style={{ marginLeft: 'auto', marginRight: riservaADestra(2), minHeight: 30, display: 'flex', alignItems: 'center' }}>
          {/* Nel radar Live il refresh e il ritmo sono responsabilita del
              motore. Il refresh manuale resta disponibile nelle liste. */}
          {tab !== 'mondo' && (
            <button onClick={() => { vibrate(8); handleRefresh(); }}
              aria-label={L('retryWord')} title={L('retryWord')}
              style={{ width: 44, height: 44, borderRadius: 12, marginRight: 6, flexShrink: 0,
                cursor: 'pointer', background: 'none', border: `1px solid ${C.cardBorder}`,
                color: C.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="refresh" size={16} color={C.textMuted} />
            </button>
          )}
          {paeseScelto ? (
            <button onClick={() => { vibrate(8); setStrumenti(true); }}
              aria-label={nomePaese(paeseScelto)} title={nomePaese(paeseScelto)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, flexShrink: 0,
                borderRadius: 999, cursor: 'pointer', fontFamily: FONT,
                background: C.card, border: `1px solid ${C.cardBorder}`,
              }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{bandieraPaese(paeseScelto)}</span>
            </button>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: C.textMuted, whiteSpace: 'nowrap' }}>
              <Icon name="globe" size={14} color={C.textMuted} />
              {L('wholeWorld')}
            </span>
          )}
        </div>
      </header>

      <PannelloLaterale aperto={strumenti && (tab === 'stanze' || tab === 'mondo')} onChiudi={() => setStrumenti(false)}
        titolo={tab === 'mondo' ? L('worldNowTitle') : L('tabRooms')} C={C}>
        <CardSezione icona="star" titolo={L('favouritesWord')} sotto={L('sbFavCaption')} C={C}>
          <PreferitiTemi nudo temi={schedaPaese?.temiCaldi} prefs={prefs} savePrefs={savePrefs} C={C} L={L}
            onScegli={(topic) => { setTemaDaMondo(topic); setTab('news'); setStrumenti(false); }} />
        </CardSezione>

        <CardSezione icona="globe" titolo={L('sbWhereTitle')} sotto={L('sbWhereCaption')} C={C}>
          <Scelta C={C}
            valore={bozzaPaesePanello || 'tutto'}
            opzioni={[
              { valore: 'tutto', etichetta: L('wholeWorld'), conto: rooms.length },
              ...(bozzaPaesePanello && !PAESI.some((pa) => pa.codice === bozzaPaesePanello)
                ? [{ valore: bozzaPaesePanello, etichetta: `${bandieraPaese(bozzaPaesePanello)} ${nomePaese(bozzaPaesePanello)}` }]
                : []),
              ...PAESI
                .map((pa) => ({
                  valore: pa.codice,
                  etichetta: `${pa.bandiera} ${nomePaese(pa.codice)}`,
                  // Il conteggio e' geografico quando il dato esiste. Le
                  // stanze legacy senza Paese non vengono attribuite per
                  // lingua, per non trasformare una lingua in un luogo.
                  conto: rooms.filter((r) => r.paese === pa.codice).length,
                }))
                .sort((a, b) => a.etichetta.localeCompare(b.etichetta)),
            ]}
            onCambia={(v) => setBozzaPaesePanello(v === 'tutto' ? null : v)} />
        </CardSezione>

        {availableModes.length > 2 && (
          <Scelta C={C}
            etichetta={L('roomTypeWord')}
            valore={modeFilter}
            opzioni={availableModes.map((m) => ({
              valore: m,
              etichetta: m === 'all' ? L('filterAllVoices') : (nomeModalita(MODE_LABELS[m], L) || m),
              conto: m === 'all' ? rooms.length : rooms.filter((r) => r.mode === m).length,
            }))}
            onCambia={setModeFilter} />
        )}

        <div style={{ height: 1, background: C.cardBorder, margin: '6px 0 16px' }} />
        <button onClick={() => {
            vibrate(10);
            if (bozzaPaesePanello !== paeseScelto) setPaeseScelto(bozzaPaesePanello);
            setStrumenti(false);
          }}
          style={{
            width: '100%', minHeight: 46, borderRadius: 12, cursor: 'pointer', margin: '2px 0 14px',
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none',
            color: '#fff', fontSize: 13.5, fontWeight: 500, fontFamily: FONT,
            WebkitTapHighlightColor: 'transparent',
          }}>
          {L('applyWord')}
        </button>

        <CardSezione icona="settings" titolo={L('sbPrefsTitle')} sotto={L('sbPrefsCaption')} C={C}>
          <PreferenzeMondo C={C} />
        </CardSezione>
      </PannelloLaterale>

      {cercando && risultati && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4px 20px', pointerEvents: 'none' }}>
          <div style={{ width: '100%', maxWidth: 420, maxHeight: '68vh', overflowY: 'auto', scrollbarWidth: 'none', pointerEvents: 'auto', background: C.card, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: '14px 20px', boxShadow: '0 24px 60px -14px rgba(0,0,0,0.65)' }}>
            {risultati.paesi.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>{L('searchCountriesLangs')}</div>
              {risultati.paesi.map((l) => (
                <button key={l.code} onClick={() => { setLangFilter(l.code); setPaeseScelto(paeseDaLingua(l.code)); setSearch(''); setTab('stanze'); }}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{l.flag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: C.textPrimary }}>{l.name}</span>
                  {l.vive > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: C.accent }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
                      {l.vive}
                    </span>
                  )}
                  <span style={{ color: C.textMuted }}>›</span>
                </button>
              ))}
            </>)}

            {risultati.stanze.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{L('liveRoomsNow')}</div>
              {risultati.stanze.map((r) => (
                <button key={r.roomId} onClick={() => onJoinRoom?.(r.roomId)}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.membri} {L('inRoomWord')}{r.lang ? ` · ${getLangFlag(r.lang)} ${getLangName(r.lang)}` : ''}</div>
                </button>
              ))}
            </>)}

            {risultati.discussioni.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{L('trendNow')}</div>
              {risultati.discussioni.map((d, i) => (
                <button key={d.id || i} onClick={() => { setSearch(''); setTab('news'); setApriDiscussione(d.id || null); }}
                  style={{ width: '100%', minHeight: 44, textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titolo}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.commenti} {L('commentsWord')}{d.topic ? ` · ${d.topic}` : ''}</div>
                </button>
              ))}
            </>)}

            {feedCaldoGuasto && (
              <button onClick={() => { setFeedCaldoGuasto(false); setRiprovaCaldo((n) => n + 1); }}
                style={{ width: '100%', minHeight: 44, margin: '10px 0', padding: '10px 12px', borderRadius: 12, background: 'none', border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontSize: 12, fontWeight: 500, fontFamily: FONT, cursor: 'pointer' }}>
                {L('newsError')} · {L('retryWord')}
              </button>
            )}

            {risultati.paesi.length === 0 && risultati.stanze.length === 0 && risultati.discussioni.length === 0 && (
              <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', padding: '30px 0', lineHeight: 1.6 }}>
                {L('searchNothing')}<br />{L('searchOpenFirst')}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'news' && !cercando && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5 }}>
          <div style={{ ...COLONNA, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <MondoNews strumenti={strumenti} suChiudiStrumenti={() => setStrumenti(false)} suApriStrumenti={() => setStrumenti(true)} apriDiscussioneId={apriDiscussione} suApertaDiscussione={() => setApriDiscussione(null)} paeseDalGlobo={paeseScelto}
              suPaeseScelto={(codice) => { setPaeseScelto(codice); }}
              suScorrimento={seguiScorrimento}
              temaDaFuori={temaDaMondo}
              suTemaLetto={() => setTemaDaMondo(null)}
              C={C} onJoinRoom={onJoinRoom} onParlane={onParlane} />
          </div>
        </div>
      )}

      {/* b.580 — rimossa anche la seconda sfumatura scura che stava in
          cima alla pagina Mondo. Nessun overlay modifica il renderer. */}

      {tab === 'stanze' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 20px', flexShrink: 0, position: 'relative', zIndex: 6 }}>
          <div style={{
            width: '100%', maxWidth: 420, minHeight: 54,
            display: 'flex', alignItems: 'center', gap: 10,
            background: C.card, border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 14, padding: '0 20px',
          }}>
            <Icon name="globe" size={14} color={C.textMuted} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={L('searchRooms')}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.textPrimary, fontSize: 13, fontFamily: FONT }} />
            {search && (
              <button onClick={() => setSearch('')} aria-label={L('resetWord')} style={{
                background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', width: 44, height: 44, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="x" size={16} color={C.textMuted} />
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'stanze' && !cercando && (
        <div onScroll={seguiScorrimento} style={{ flex: 1, overflowY: 'auto', padding: '4px 20px calc(106px + env(safe-area-inset-bottom))', scrollbarWidth: 'none', pointerEvents: 'none' }}>
          <div style={{ ...COLONNA, pointerEvents: 'auto' }}>
            {error && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</div>
                <button onClick={handleRefresh} style={{ minHeight: 44, padding: '8px 20px', borderRadius: 12, background: `${C.accent}15`, border: `1px solid ${C.accent}25`, color: C.accent, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                  {L('retryWord')}
                </button>
              </div>
            )}

            {!loading && !error && rooms.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, margin: '0 auto 16px', background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`, border: `1px solid ${C.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}><Icon name="globe" size={34} color={C.accent || 'rgba(255,255,255,0.4)'} /></div>
                <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>{L('noRoomsYet')}</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, maxWidth: 260, margin: '0 auto 20px' }}>{L('createPublicRoomDesc')}</div>
                <button onClick={onCreateRoom || (() => setView('home'))} style={{ minHeight: 44, padding: '12px 28px', borderRadius: 14, cursor: 'pointer', background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, fontFamily: FONT, boxShadow: `0 4px 20px ${C.accent}35` }}>
                  {L('createBarTalk')}
                </button>
              </div>
            )}

            {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Icon name="search" size={28} color={C.textMuted} />
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{L('noRoomsFilters')}</div>
                <button onClick={() => { setSearch(''); setLangFilter('all'); setModeFilter('all'); setPaeseScelto(null); }} style={{ minHeight: 44, padding: '7px 18px', borderRadius: 10, background: 'none', border: `1px solid ${C.cardBorder}`, color: C.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: FONT }}>
                  {L('resetFilters')}
                </button>
              </div>
            )}

            {filteredRooms.length > 0 && (
              <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 1.1, textTransform: 'uppercase', color: C.textMuted, margin: '2px 0 6px' }}>{L('openNowWord')}</div>
            )}

            {filteredRooms.map((room, idx) => {
              const modeInfo = MODE_LABELS[room.mode] || { label: room.mode, icon: '', color: PALETTE.teal };
              const eta = quando(room.createdAt, L);
              const dentro = viva(room.membri ?? room.memberCount, 4);
              const eti = stileEtichetta(C);
              return (
                <button key={room.roomId} onClick={() => onJoinRoom(room.roomId)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', minHeight: 44, padding: 12, marginBottom: 8, background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, WebkitTapHighlightColor: 'transparent', animation: `vtSlideUp 0.3s ease-out ${idx * 0.05}s both` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, lineHeight: 1 }}>{getLangFlag(room.hostLang || room.lang)}</span>
                      <span style={eti}>{getLangName(room.hostLang || room.lang)}</span>
                      <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                      <span style={{ ...eti, color: modeInfo.color }}>{nomeModalita(modeInfo, L)}</span>
                      {eta && <><span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span><span style={eti}>{eta}</span></>}
                      {room.suApprovazione && <span style={{ ...eti, color: PALETTE.amber, background: `${PALETTE.amber}18`, borderRadius: 5, padding: '1px 6px' }}>{L('onApproval')}</span>}
                      {room.hot && <span style={{ ...eti, color: C.red, background: `${C.red}1F`, borderRadius: 5, padding: '1px 6px' }} title={L('freeFightTip')}>{L('freeFight')}</span>}
                    </div>
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: C.textPrimary }}>{room.nome || room.host}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={eti}>{room.host}</span>
                      <span style={{ ...eti, opacity: 0.5 }}>{PUNTO}</span>
                      <span style={{ ...eti, color: dentro.accesa ? C.accent : C.textMuted, fontWeight: 500 }}>{dentro.n}{room.maxPartecipanti ? `/${room.maxPartecipanti}` : ''} {L('insideWord')}</span>
                      {room.myRole && ROLE_BADGES[room.myRole] && (
                        <span style={{ ...eti, background: ROLE_BADGES[room.myRole].bg, color: ROLE_BADGES[room.myRole].color, borderRadius: 5, padding: '1px 6px' }}>
                          {ROLE_BADGES[room.myRole].labelKey ? L(ROLE_BADGES[room.myRole].labelKey) : ROLE_BADGES[room.myRole].label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, alignSelf: 'center', background: `${modeInfo.color}12`, border: `1px solid ${modeInfo.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: modeInfo.color, fontSize: 14, fontWeight: 500 }}>→</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

export default memo(MondoView);

'use client';
import Icon from './Icon.js';
import { ombraAcciaio, faroAcciaio } from '../lib/acciaio.js';
// ═══════════════════════════════════════════════
// MondoView — Public room discovery
//
// Redesigned: glassmorphism cards, ambient orb,
// horizontal lang/mode pills, skeleton shimmer,
// search bar, room cards with gradient accents.
// ═══════════════════════════════════════════════

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { FONT, LANGS } from '../lib/constants.js';
import GloboMondo from './GloboMondo.js'; // b.359 — il pianeta dal file di Luca
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

// b.362 — I DATI IN UNA FORMA SOLA. Stanze e discussioni arrivavano in due
// vesti (nome/name, members/partecipanti, title/titolo, commentCount/
// commenti) e ogni punto del file doveva ricordarsi entrambe: una classe
// intera di bug futuri. Qui si normalizza UNA volta, all'ingresso.
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
  // b.335 — HOME MONDO NUOVA: si atterra su "Per te" — cosa e caldo ADESSO
  // (discussioni piu vive, stanze piu piene), a colpo d'occhio.
  const [tab, setTab] = useState('stanze');
  const [feedCaldo, setFeedCaldo] = useState(null);
  // b.363 — un elenco CADUTO non e un elenco VUOTO: prima, se la chiamata
  // non riusciva, la corsia "di cosa si parla" restava muta e sembrava che
  // non ci fosse nulla di cui parlare; con una risposta non valida restava
  // in attesa per sempre, senza un secondo tentativo. Ora il guasto si
  // dichiara e si riprova aprendo la ricerca.
  const [feedCaldoGuasto, setFeedCaldoGuasto] = useState(false);
  const [riprovaCaldo, setRiprovaCaldo] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch('/api/mondo/discussioni', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ })
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
  // b.363 — dai risultati di ricerca la discussione va APERTA, non solo la
  // scheda News: prima l'id veniva buttato e si atterrava sul generico.
  const [apriDiscussione, setApriDiscussione] = useState(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/mondo', { signal: AbortSignal.timeout(10000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ });
      // b.363 — prima la lettura non era protetta: una risposta rotta faceva
      // sparire l'elenco stanze senza mostrare il messaggio d'errore previsto.
      if (res.ok) { const data = await res.json().catch(() => null); if (data) { setRooms((data.rooms || []).map(normalizzaStanza)); setError(null); } else setError(L('loadRoomsFailed')); }
      else setError(L('loadRoomsFailed')); // b.232 — prima !res.ok (500/429) era silenzioso
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/mondo:', e?.message || e);
      setError(L('loadRoomsFailed')); }
    finally { setLoading(false); }
  }, [L]);

  useEffect(() => {
    return subscribeTick(30000, fetchRooms, { immediate: true });
  }, [fetchRooms]);

  const handleRefresh = useCallback(() => { fetchRooms(); }, [fetchRooms]);

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

  // b.355 — LA RICERCA A TRE CORSIE (il disegno approvato): mentre scrivi,
  // tre gruppi di risposte — PAESI/LINGUE (col conteggio delle stanze vive),
  // STANZE vere, DISCUSSIONI calde. Un campo solo, tutto il Mondo dentro.
  const cercando = search.trim().length > 0;
  const risultati = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const stanzePerLingua = {};
    for (const r of rooms) { if (r.lang) stanzePerLingua[r.lang] = (stanzePerLingua[r.lang] || 0) + 1; }
    const paesi = LANGS
      .filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q))
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

  const availableModes = useMemo(() => {
    const modes = new Set(rooms.map(r => r.mode));
    return ['all', ...modes];
  }, [rooms]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
    }}>

      {/* b.361 — IL PIANETA INTEGRATO: e lo SFONDO a tutto schermo della
          pagina Mondo (Luca: «invece di integrarlo»). La testata, le schede e
          la ricerca qui sotto gli fluttuano sopra: una sola chrome, quella di
          BarTalk. Sta nella scheda "Per te"; nelle altre le liste lo coprono. */}
      {/* b.363 — IL PIANETA NON SPARISCE PIU. Prima al primo carattere
          digitato veniva smontato (e ricaricato da zero all'uscita); poi
          veniva solo nascosto — ma sparire e sparire. Ora resta acceso
          mentre si cerca: la ricerca gli galleggia sopra.
          E c'e anche in News: era il pianeta di Mondo, non della sola
          scheda Stanze (Luca: «la pagina news dovrebbe avere anche lei il
          mondo e non ce l'ha»). */}
      {(tab === 'stanze' || tab === 'news') && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <GloboMondo sfondo titolo={L('worldNowTitle')} etichettaCielo={L('skyOfPlanet')} />
        </div>
      )}

      {/* ═══ TESTATA (Luca): solo il testo e l'icona della scheda al centro,
          con la freccia a sinistra e a destra che scorrono le schede. Sopra
          l'area di ricerca. Le icone sono quelle in acciaio. ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        padding: '14px 16px 10px', flexShrink: 0, position: 'relative', zIndex: 5,
      }}>
        {(() => {
          // b.361 — due schede: STANZE (icona porta, Luca: «cambia in porta le
          // stanze») e NEWS. Il logo/icona sta nell'angolo a SINISTRA; al
          // centro il testo con le frecce che scorrono le schede.
          const schede = [
            { id: 'stanze', labelKey: 'tabRooms', img: '/sezioni/menu-profilo.webp' },
            { id: 'news', labelKey: 'tabNews', img: '/sezioni/sez-news.webp' },
          ];
          const idx = Math.max(0, schede.findIndex(s => s.id === tab));
          const cur = schede[idx];
          const vai = (d) => setTab(schede[(idx + d + schede.length) % schede.length].id);
          const freccia = { fontSize: 30, lineHeight: 1, cursor: 'pointer', padding: 4,
            background: 'none', border: 'none', WebkitTapHighlightColor: 'transparent',
            backgroundImage: 'linear-gradient(145deg, #f2f4f8, #b9c0cc 45%, #7d8492 80%, #aeb6c4)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' };
          return (
            <>
              {/* il logo nell'angolo a sinistra, allineato al testo "Stanze",
                  con piu aria attorno (Luca: «aumenta i padding della porta e
                  allina a stanze»). */}
              {/* b.363 — le icone in acciaio dei menu vanno al DOPPIO
                  (ordine di Luca): il riquadro da 52 passa a 104, il
                  respiro interno da 8 a 16 perche resti in proporzione. */}
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                width: 104, height: 104, padding: 16, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: faroAcciaio(1), borderRadius: '50%',
              }}>
                <img src={cur.img} alt="" aria-hidden width={104} height={104}
                  style={{ width: '100%', height: '100%', objectFit: 'contain',
                    filter: ombraAcciaio(1.6) }} />
              </span>
              <button onClick={() => vai(-1)} aria-label={L('previousWord')} style={freccia}>‹</button>
              <span style={{ fontSize: 19, fontWeight: 800, color: C.textPrimary, letterSpacing: -0.5 }}>
                {L(cur.labelKey)}
              </span>
              <button onClick={() => vai(1)} aria-label={L('nextWord')} style={freccia}>›</button>
            </>
          );
        })()}
      </header>

      {/* ═══ b.355 — LA RICERCA, una sola, per tutto il Mondo ═══
          b.361 — CENTRATA e non a tutta larghezza (regola di Luca). */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%', maxWidth: 420,
          display: 'flex', alignItems: 'center', gap: 10,
          background: C.card, border: `1px solid ${C.cardBorder}`,
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <Icon name="globe" size={14} color={C.textMuted} />
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

      {/* ═══ b.361 — I RISULTATI DELLA RICERCA come POPUP centrata sul globo
          (collaudo di Luca: «deve essere una popup in primo piano senza
          eliminare lo sfondo»): un pannello stretto, in mezzo, col pianeta
          che resta dietro. Larghezze rispettate. ═══ */}
      {cercando && risultati && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4px 16px', pointerEvents: 'none' }}>
          <div style={{ width: '100%', maxWidth: 420, maxHeight: '68vh', overflowY: 'auto', scrollbarWidth: 'none', pointerEvents: 'auto', background: C.card, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: `1px solid ${C.cardBorder}`, borderRadius: 18, padding: 14, boxShadow: '0 24px 60px -14px rgba(0,0,0,0.65)' }}>

            {risultati.paesi.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '4px 0 8px' }}>{L('searchCountriesLangs')}</div>
              {risultati.paesi.map((l) => (
                <button key={l.code} onClick={() => { setLangFilter(l.code); setSearch(''); setTab('stanze'); }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{l.flag}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.textPrimary }}>{l.name}</span>
                  {l.vive > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: C.accent }}>
                      <span style={{ width: 7, height: 7, borderRadius: 4, background: C.accent, boxShadow: `0 0 8px ${C.accent}` }} />
                      {l.vive}
                    </span>
                  )}
                  <span style={{ color: C.textMuted }}>›</span>
                </button>
              ))}
            </>)}

            {risultati.stanze.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{(L('liveRoomsNow') !== 'liveRoomsNow' ? L('liveRoomsNow') : 'STANZE VIVE ADESSO')}</div>
              {risultati.stanze.map((r) => (
                <button key={r.roomId} onClick={() => onJoinRoom?.(r.roomId)}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.membri} {(L('inRoomWord') !== 'inRoomWord' ? L('inRoomWord') : 'dentro')}{r.lang ? ` · ${getLangFlag(r.lang)} ${getLangName(r.lang)}` : ''}</div>
                </button>
              ))}
            </>)}

            {risultati.discussioni.length > 0 && (<>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.textMuted, margin: '14px 0 8px' }}>{(L('trendNow') !== 'trendNow' ? L('trendNow') : 'DI COSA SI PARLA')}</div>
              {risultati.discussioni.map((d, i) => (
                <button key={d.id || i} onClick={() => { setSearch(''); setTab('news'); setApriDiscussione(d.id || null); }}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 14, background: C.card, border: `1px solid ${C.cardBorder}`, cursor: 'pointer', fontFamily: FONT, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titolo}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{d.commenti} {(L('commentsWord') !== 'commentsWord' ? L('commentsWord') : 'commenti')}{d.topic ? ` · ${d.topic}` : ''}</div>
                </button>
              ))}
            </>)}

            {/* b.363 — se l'elenco delle discussioni e caduto lo si dice qui,
                invece di far passare il guasto per un mondo silenzioso. */}
            {feedCaldoGuasto && (
              <button onClick={() => { setFeedCaldoGuasto(false); setRiprovaCaldo((n) => n + 1); }}
                style={{ width: '100%', margin: '10px 0', padding: '10px 12px', borderRadius: 12, background: 'none',
                  border: `1px solid ${C.cardBorder}`, color: C.textMuted, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>
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


      {/* ═══ TAB NEWS ═══ */}
      {tab === 'news' && !cercando && (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', position: 'relative', zIndex: 5 }}>
          {/* b.324 — audit Mondo D8: su schermo largo il contenuto andava a
              tutta larghezza; ora sta nella colonna centrata (regola di Luca,
              gia standard in Life). */}
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            <MondoNews apriDiscussioneId={apriDiscussione} suApertaDiscussione={() => setApriDiscussione(null)} C={C} onJoinRoom={onJoinRoom} onParlane={onParlane} />
          </div>
        </div>
      )}

      {/* ═══ LANGUAGE PILLS ═══ */}
      {tab === 'stanze' && !cercando && (
      <div style={{
        display: 'flex', gap: 6, padding: '0 16px 6px', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flexShrink: 0,
        maxWidth: 460, margin: '0 auto', width: '100%', justifyContent: 'flex-start',
      }}>
        {/* b.363 — cercando una lingua fuori dalle 12 pillole (es. il russo)
            il filtro si applicava ma NESSUNA pillola risultava attiva: la
            lista sembrava vuota senza motivo e non si poteva togliere il
            filtro. Qui la lingua scelta compare comunque. */}
        {(LANG_FILTERS.some(l => l.code === langFilter) ? LANG_FILTERS
          : [...LANG_FILTERS, { code: langFilter, flag: getLangFlag(langFilter), name: (getLangName(langFilter) || langFilter).slice(0, 12) }]
        ).map(lf => {
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
      // b.361 — IL GLOBO SI TRASCINA sotto la lista (collaudo di Luca): la
      // colonna non ruba i tocchi (pointerEvents none), solo le card e i
      // pulsanti veri li riprendono.
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px calc(106px + env(safe-area-inset-bottom))', scrollbarWidth: 'none', pointerEvents: 'none' }}>
        {/* b.324 — D8: colonna centrata anche qui. */}
        <div style={{ maxWidth: 440, margin: '0 auto', pointerEvents: 'auto' }}>

        {/* b.363 — ECCO LE CARD FANTASMA CHE LUCA VEDEVA A OGNI APERTURA DI
            MONDO. Erano quattro rettangoli finti alti 80 pixel, con il velo
            bianco luccicante: uno scheletro di caricamento nato quando la
            pagina ERA la lista delle stanze. Da quando la pagina e il PIANETA,
            quei quattro riquadri si disegnano SOPRA il globo — mezzo mondo
            coperto da schede vuote a ogni ricarico, per tutto il tempo del
            caricamento. Non e uno sfondo che traspare: sono loro.
            Sul pianeta non si mette nessuno scheletro: le stanze arrivano
            nella tendina in basso, e finche non ci sono non si mostra niente. */}

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
            {/* b.363 — qui c'era un riquadro alto 36 pixel con dentro NIENTE:
                il posto di un'icona tolta, che spingeva in basso il testo
                senza mostrare nulla. */}
            <Icon name="search" size={28} color={C.textMuted} />
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
      </div>
      )}

      {/* CSS */}
      <style>{`
        /* b.363 — l'animazione del luccichio se n'e andata con lo scheletro
           che copriva il pianeta: qui non la usa piu nessuno. */
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default memo(MondoView);

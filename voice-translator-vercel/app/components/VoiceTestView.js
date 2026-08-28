'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { FONT, getLang } from '../lib/constants.js';
import Icon from './Icon.js';
import { bandieraVoce } from '../lib/bandiereVoci.js';
import { useApp } from '../contexts/AppContext.js';

// ═══════════════════════════════════════════════════════════════
// VoiceTestView — Premium ElevenLabs Voice Studio
// Standard voices auto-managed, ElevenLabs front-and-center
// Glassmorphism dark ambient design
// ═══════════════════════════════════════════════════════════════

const KEYFRAMES_VTV = `
@keyframes vtvOrbFloat { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8px,-10px) scale(1.12); } }
@keyframes vtvPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
@keyframes vtvWave { 0% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } 100% { transform: scaleY(0.4); } }
@keyframes vtvShimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
`;

let vtvInjected = false;
function injectVTVKeyframes() {
  if (vtvInjected || typeof document === 'undefined') return;
  vtvInjected = true;
  const s = document.createElement('style');
  s.textContent = KEYFRAMES_VTV;
  document.head.appendChild(s);
}

// ── Voice category filters ──
// b.136 — le etichette erano DUE per filtro, `label` e `labelEN`, e si
// sceglieva col ternario `isIT ? f.label : f.labelEN`. Due lingue
// cablate nella struttura dati: per aggiungerne una terza bisognava
// cambiare la forma dell'oggetto. Ora c'e una chiave sola e le lingue
// stanno dove stanno tutte le altre, in locales/*.js.
const CATEGORY_FILTERS = [
  { id: 'all', chiave: 'filterAllVoices' },
  { id: 'premade', chiave: 'filterPremade' },
  { id: 'cloned', chiave: 'filterCloned' },
  { id: 'professional', chiave: 'filterPro' },
];

// M e F non si traducono: sono iniziali, e restano le stesse ovunque.
const GENDER_FILTERS = [
  { id: 'all', chiave: 'filterAllVoices', fisso: null },
  { id: 'male', chiave: null, fisso: 'M' },
  { id: 'female', chiave: null, fisso: 'F' },
];

const VoiceTestView = memo(function VoiceTestView({ isTrial, isTopPro,
  useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setElevenLabsVoices, userToken, userTokenRef, creditBalance }) {
  const { L, S, prefs, setView, theme } = useApp();

  if (typeof document !== 'undefined') injectVTVKeyframes();

  const colors = S.colors;

  const [playingVoice, setPlayingVoice] = useState(null);
  // b.501 — tavola 28: Aa come su ogni pagina.
  const [zoomTesto, setZoomTesto] = useState(0);
  const [testResults, setTestResults] = useState({});
  const [loadingEL, setLoadingEL] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredVoice, setHoveredVoice] = useState(null);
  const [ordina, setOrdina] = useState('paese'); // 'paese' | 'nome' — b.309
  const audioRef = useRef(null);

  // i tre colori del foglio vengono dal tema: erano tinte fisse, uguali su tutti e sei i temi
  const gold = colors.goldAccent;
  const goldGlow = `${colors.goldAccent}40`;
  const teal = colors.accent2;
  const purple = colors.accent1;

  const langInfo = getLang(prefs.lang);
  const hasApiAccess = userToken && (useOwnKeys || creditBalance > 0);
  const hasElevenLabs = !!(apiKeyInputs?.elevenlabs?.trim());
  const elAvailable = !isTrial && ((useOwnKeys && hasElevenLabs) || platformHasEL);

  // Sample texts
  const SAMPLES = {
    it: 'Ciao! Questa è una prova della voce.',
    en: 'Hello! This is a voice test.',
    es: 'Hola! Esta es una prueba de voz.',
    fr: 'Bonjour! Ceci est un test vocal.',
    de: 'Hallo! Dies ist ein Sprachtest.',
    pt: 'Olá! Este é um teste de voz.',
    zh: '你好！这是语音测试。',
    ja: 'こんにちは！音声テストです。',
    ko: '안녕하세요! 음성 테스트입니다.',
  };
  const sampleText = SAMPLES[prefs.lang] || SAMPLES.en;

  // Auto-load EL voices on mount
  const loadELVoices = useCallback(async () => {
    setLoadingEL(true);
    try {
      const res = await fetch('/api/tts-elevenlabs?action=voices', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, headers: { 'Authorization': `Bearer ${userTokenRef?.current || ''}` } });
      if (res.ok) {
        // b.363 — prima la lettura non era protetta: l'elenco voci si
        // svuotava senza che nulla, a schermo o nel registro, lo dicesse.
        const data = await res.json().catch(() => null);
        if (data) setElevenLabsVoices(data.voices || []);
        else console.warn('[b.363] tts-elevenlabs voci: risposta illeggibile');
      }
    } catch(e) { console.error(e); }
    setLoadingEL(false);
  }, [userTokenRef, setElevenLabsVoices]);

  useEffect(() => {
    if (elAvailable && elevenLabsVoices.length === 0 && !loadingEL) {
      loadELVoices();
    }
  }, [elAvailable, elevenLabsVoices.length, loadingEL, loadELVoices]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingVoice(null);
  }, []);

  // Play ElevenLabs voice
  const testELVoice = useCallback(async (voice) => {
    stopAudio();
    const key = `el_${voice.id}`;
    if (playingVoice === key) return;

    setPlayingVoice(key);
    setTestResults(prev => ({ ...prev, [key]: 'loading' }));

    try {
      if (voice.preview) {
        const audio = new Audio(voice.preview);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); setTestResults(prev => ({ ...prev, [key]: 'ok' })); };
        audio.onerror = () => { setPlayingVoice(null); setTestResults(prev => ({ ...prev, [key]: 'error' })); };
        await audio.play();
        setTestResults(prev => ({ ...prev, [key]: 'playing' }));
        return;
      }
      const start = Date.now();
      const res = await fetch('/api/tts-elevenlabs', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voiceId: voice.id, langCode: prefs.lang, userToken: userTokenRef?.current })
      });
      if (res.ok) {
        const blob = await res.blob();
        const elapsed = Date.now() - start;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        await audio.play();
        setTestResults(prev => ({ ...prev, [key]: `ok_${elapsed}ms` }));
      } else {
        setTestResults(prev => ({ ...prev, [key]: 'error' }));
        setPlayingVoice(null);
      }
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/tts-elevenlabs:', e?.message || e);
      setTestResults(prev => ({ ...prev, [key]: 'error' }));
      setPlayingVoice(null);
    }
  }, [playingVoice, sampleText, prefs.lang, userTokenRef, stopAudio]);

  // Filter EL voices
  const filtrate = elevenLabsVoices.filter(v => {
    if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
    if (genderFilter !== 'all') {
      const g = v.labels?.gender?.toLowerCase() || '';
      if (genderFilter === 'male' && !g.includes('male')) return false;
      if (genderFilter === 'female' && !g.includes('female')) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (v.name || '').toLowerCase();
      const accent = (v.labels?.accent || '').toLowerCase();
      // b.309 — si cerca anche per PAESE (ricavato dall'accento): "italia",
      // "francia", "usa" filtrano, non solo il nome o l'accento in inglese.
      const paese = (bandieraVoce({ accent: v.labels?.accent, language: v.labels?.language || v.language }).p || '').toLowerCase();
      if (!name.includes(q) && !accent.includes(q) && !paese.includes(q)) return false;
    }
    return true;
  });
  // b.309 — ORDINAMENTO con un tasto: per PAESE (bandiere raggruppate) o per
  // NOME. Le voci qui hanno l'accento in labels.*, quindi si passa lo shim a
  // bandieraVoce (che legge accent/language al primo livello).
  const bandieraDi = (v) => bandieraVoce({ accent: v.labels?.accent, language: v.labels?.language || v.language });
  const filteredVoices = ordina === 'paese'
    ? [...filtrate].sort((a, b) => {
        const ba = bandieraDi(a), bb = bandieraDi(b);
        if (ba.o !== bb.o) return ba.o - bb.o;
        if (ba.p !== bb.p) return String(ba.p).localeCompare(String(bb.p));
        return String(a.name || '').localeCompare(String(b.name || ''));
      })
    : [...filtrate].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  // ── Waveform bars for playing indicator ──
  const WaveBars = ({ color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
      {[0, 0.15, 0.3, 0.15, 0].map((delay, i) => (
        <div key={i} style={{
          width: 3, height: 14, borderRadius: 2,
          background: color,
          animation: `vtvWave 0.8s ease-in-out ${delay}s infinite`,
        }} />
      ))}
    </div>
  );

  // il fondo e quello del tema: il nero scritto a mano restava nero anche sul tema chiaro
  return (
    <div style={S.page}>
      {/* margini laterali a 20: testata, contenuto e riga in basso sullo stesso filo */}
      <div style={{...S.scrollCenter, paddingLeft:20, paddingRight:20}}>
        {/* ── INIZIO b.211 — wrapper non comprimibile ──
            scrollCenter è una COLONNA flex: senza questo wrapper le card
            figlie (flex-shrink di default 1) venivano schiacciate quando il
            contenuto superava lo schermo, e il loro contenuto sbordava —
            la hero "ElevenLabs" finiva SOTTO la card "Voce standard".
            Il wrapper con flexShrink:0 tiene l'altezza naturale; scorre lo
            scrollCenter. Sfondo e colori invariati. ── */}
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>

        {/* ── Top bar ── */}
        <div style={{
          ...S.topBar,
          background: 'transparent',
          borderBottom: 'none',
        }}>
          {/* nessun tasto sotto i 44 punti, e i colori dal tema */}
          <button onClick={() => setView('settings')} style={{
            width: 44, height: 44, borderRadius: 14, cursor: 'pointer',
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: colors.textSecondary, fontSize: 18,
            fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
          }}>
            <Icon name="back" size={20} color={colors.textSecondary} />
          </button>
          {/* b.501 — tavola 28: la testata dice COSA E questa pagina
              («Come ti sentono»), nella lingua dell'utente — non un nome
              in inglese. E Aa, come ovunque. */}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: 17, fontWeight: 500, letterSpacing: -0.3,
              color: colors.textPrimary,
            }}>{L('howTheyHearYou')}</span>
          </div>
          <button onClick={() => setZoomTesto((z) => (z >= 3 ? 0 : z + 1))}
            title={L('textBigger')} aria-label={L('textBigger')}
            style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, cursor: 'pointer',
              background: zoomTesto ? `${colors.accent1}22` : colors.cardBg,
              border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary,
              fontFamily: FONT, fontSize: 15, fontWeight: 500 }}>
            Aa
          </button>
        </div>

        {/* b.501 — tavola 28: la riga in cima spiega IL GESTO. */}
        <div style={{ width: '100%', maxWidth: 400, fontSize: 12.5 * (1 + zoomTesto * 0.15), color: colors.textMuted,
          lineHeight: 1.5, margin: '0 0 12px', textAlign: 'left' }}>
          {L('voicesExplain')}
        </div>

        {/* ── Hero Card: ElevenLabs Status ── */}
        <div style={{
          width: '100%', maxWidth: 400, marginBottom: 16, borderRadius: 24,
          position: 'relative', overflow: 'hidden',
          padding: '28px 22px 24px',
          background: `linear-gradient(165deg, ${gold}10 0%, ${colors.cardBg} 50%, ${purple}08 100%)`,
          border: `1px solid ${gold}20`,
          backdropFilter: 'blur(40px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.2)',
          boxShadow: `0 16px 50px rgba(0,0,0,0.5), 0 0 60px ${gold}08`,
        }}>
          {/* Floating orbs */}
          <div style={{
            position: 'absolute', top: -25, right: -20, width: 100, height: 100, borderRadius: '50%',
            background: `radial-gradient(circle, ${gold}20 0%, transparent 70%)`,
            animation: 'vtvOrbFloat 5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -15, left: -15, width: 70, height: 70, borderRadius: '50%',
            background: `radial-gradient(circle, ${purple}15 0%, transparent 70%)`,
            animation: 'vtvOrbFloat 6s ease-in-out infinite reverse',
            pointerEvents: 'none',
          }} />

          {/* ElevenLabs logo + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: `linear-gradient(145deg, ${gold}25, ${gold}08)`,
              border: `1px solid ${gold}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 25px ${goldGlow}`,
            }}>
              <Icon name="music" size={28} color={gold} />
            </div>
            <div>
              <div style={{
                fontSize: 20, fontWeight: 500, letterSpacing: -0.5,
                background: `linear-gradient(135deg, ${gold} 0%, ${colors.textPrimary} 60%, ${gold} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>ElevenLabs</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, letterSpacing: 0.3 }}>
                {elAvailable
                  ? (elevenLabsVoices.length > 0
                    ? `${elevenLabsVoices.length} ${L('voicesAvailable')}`
                    : (loadingEL ? L('loading') : L('ready')))
                  : L('configureApiKey')}
              </div>
            </div>
            {/* Status indicator */}
            <div style={{
              marginLeft: 'auto',
              width: 10, height: 10, borderRadius: '50%',
              background: elAvailable ? teal : colors.toggleOff,
              boxShadow: elAvailable ? `0 0 12px ${teal}80` : 'none',
              animation: elAvailable ? 'vtvPulse 2s ease-in-out infinite' : 'none',
            }} />
          </div>

          {/* Bottom shine */}
          <div style={{
            position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 1,
            background: `linear-gradient(90deg, transparent, ${gold}35, transparent)`,
          }} />
        </div>

        {/* ── INIZIO b.89 — si possono provare anche le voci GRATUITE ──
            Prima questa pagina si chiamava "Prova le voci" ma senza una
            chiave ElevenLabs non si poteva ascoltare nulla: eppure la voce
            standard (Edge) e quella che usa il 99% delle persone. */}
        <div style={{
          width: '100%', maxWidth: 400, marginBottom: 16, borderRadius: 20,
          padding: '18px 18px 16px', background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
            <Icon name="speaker" size={17} color={teal} />
            <span style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary }}>
              {L('standardVoiceFree')}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
            {L('standardVoiceHint')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {['it', 'en', 'es', 'fr', 'de', 'pt', 'zh', 'ja'].map(codice => {
              const l = getLang(codice);
              const inCorso = playingVoice === 'edge-' + codice;
              return (
                <button key={codice} disabled={inCorso}
                  onClick={async () => {
                    setPlayingVoice('edge-' + codice);
                    try {
                      const frase = {
                        it: 'Buongiorno, questa è la voce standard di BarTalk.',
                        en: 'Hello, this is the standard BarTalk voice.',
                        es: 'Hola, esta es la voz estándar de BarTalk.',
                        fr: 'Bonjour, voici la voix standard de BarTalk.',
                        de: 'Guten Tag, das ist die Standardstimme von BarTalk.',
                        pt: 'Olá, esta é a voz padrão do BarTalk.',
                        zh: '你好，这是 BarTalk 的标准语音。',
                        ja: 'こんにちは。これはBarTalkの標準音声です。',
                      }[codice];
                      const r = await fetch('/api/tts-edge', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */,
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: frase, langCode: l?.speech || codice, gender: 'female' }),
                      });
                      if (!r.ok) { setPlayingVoice(null); return; }
                      const blob = await r.blob();
                      const url = URL.createObjectURL(blob);
                      const audio = new Audio(url);
                      audio.onended = () => { URL.revokeObjectURL(url); setPlayingVoice(null); };
                      audio.onerror = () => setPlayingVoice(null);
                      audio.play().catch(() => setPlayingVoice(null));
                    } catch (e) {
                      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
                      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
                      // scaduta, credito finito, server rotto) restava irrecuperabile.
                      if (e?.name !== 'AbortError') console.warn('[b.363] /api/tts-edge:', e?.message || e);
                      setPlayingVoice(null); }
                  }}
                  style={{
                    padding: '9px 13px', minHeight: 44, borderRadius: 12, cursor: inCorso ? 'default' : 'pointer',
                    background: inCorso ? `${teal}22` : colors.inputBg,
                    border: `1px solid ${inCorso ? `${teal}55` : colors.inputBorder}`,
                    color: inCorso ? teal : colors.textSecondary,
                    fontSize: 12.5, fontWeight: 500, fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  <Icon name={inCorso ? 'refresh' : 'play'} size={11} color={inCorso ? teal : colors.textMuted} />
                  {l?.name || codice}
                </button>
              );
            })}
          </div>
        </div>
        {/* ── FINE b.89 ── */}

        {/* ── Not available state ── */}
        {!elAvailable && (
          <div style={{
            width: '100%', maxWidth: 400, marginBottom: 16, borderRadius: 20,
            padding: '24px 20px', textAlign: 'center',
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
          }}>
            <Icon name="key" size={32} color={colors.textMuted} />
            <div style={{ fontSize: 14, fontWeight: 500, color: colors.textSecondary, marginTop: 12 }}>
              {L('elKeyRequired')}
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 1.5 }}>
              {L('elKeyRequiredHint')}
            </div>
            <button onClick={() => setView('settings')} style={{
              marginTop: 16, padding: '10px 24px', minHeight: 44, borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${gold}20, ${gold}08)`,
              border: `1px solid ${gold}30`,
              color: gold, fontSize: 13, fontWeight: 500, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <Icon name="settings" size={14} color={gold} /> {L('settings')}
            </button>
          </div>
        )}

        {/* ── Search + Filters ── */}
        {elAvailable && elevenLabsVoices.length > 0 && (
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 12 }}>
            {/* Search bar */}
            <div style={{
              position: 'relative', marginBottom: 10,
            }}>
              <div style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}>
                <Icon name="globe" size={16} color={colors.textMuted} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={L('searchVoice')}
                style={{
                  width: '100%', padding: '12px 14px 12px 40px', minHeight: 44, borderRadius: 16,
                  background: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  color: colors.textPrimary, fontSize: 13,
                  fontFamily: FONT, outline: 'none',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Category + Gender filters */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORY_FILTERS.map(f => {
                const active = categoryFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setCategoryFilter(f.id)} style={{
                    padding: '6px 14px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
                    background: active ? `${gold}18` : colors.inputBg,
                    border: `1px solid ${active ? gold + '40' : colors.inputBorder}`,
                    color: active ? gold : colors.textSecondary, // b.211 — contrasto: era 0.5, poco visibile
                    fontSize: 11, fontWeight: 500, fontFamily: FONT,
                    transition: 'all 0.2s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}>{L(f.chiave)}</button>
                );
              })}
              <div style={{ width: 1, height: 28, background: colors.dividerColor, alignSelf: 'center', margin: '0 4px' }} />
              {GENDER_FILTERS.map(f => {
                const active = genderFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setGenderFilter(f.id)} style={{
                    padding: '6px 12px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
                    background: active ? `${purple}18` : colors.inputBg,
                    border: `1px solid ${active ? purple + '40' : colors.inputBorder}`,
                    color: active ? purple : colors.textSecondary, // b.211 — contrasto: era 0.5
                    fontSize: 11, fontWeight: 500, fontFamily: FONT,
                    transition: 'all 0.2s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}>{f.fisso || L(f.chiave)}</button>
                );
              })}
              <div style={{ width: 1, height: 28, background: colors.dividerColor, alignSelf: 'center', margin: '0 4px' }} />
              {/* b.309 — tasto ORDINAMENTO: alterna paese/nome */}
              <button onClick={() => setOrdina(o => o === 'paese' ? 'nome' : 'paese')}
                title={ordina === 'paese' ? 'Ordina per paese' : 'Ordina per nome'} style={{
                padding: '6px 12px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
                background: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.textSecondary,
                fontSize: 11, fontWeight: 500, fontFamily: FONT,
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.2s ease', WebkitTapHighlightColor: 'transparent',
              }}>{/* niente emoji: l'ordinamento si dice col mappamondo o col foglio, e la freccia dice il verso */}
                <Icon name={ordina === 'paese' ? 'globe' : 'doc'} size={13} color={colors.textSecondary} />
                <Icon name="chevDown" size={12} color={colors.textSecondary} />
              </button>
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {elAvailable && loadingEL && elevenLabsVoices.length === 0 && (
          <div style={{
            width: '100%', maxWidth: 400, padding: '40px 20px', textAlign: 'center',
            borderRadius: 20,
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, margin: '0 auto 16px',
              background: `linear-gradient(145deg, ${gold}20, transparent)`,
              border: `1px solid ${gold}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'vtvPulse 1.5s ease-in-out infinite',
            }}>
              <Icon name="refresh" size={24} color={gold} />
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              {L('loadingELVoices')}
            </div>
          </div>
        )}

        {/* ── Voice Grid ── */}
        {elAvailable && filteredVoices.length > 0 && (
          <div style={{
            width: '100%', maxWidth: 400,
            display: 'flex', flexDirection: 'column', gap: 6,
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10, color: colors.textMuted, padding: '0 4px 4px',
              letterSpacing: 0.5,
            }}>
              {filteredVoices.length} {L('voicesWord')}
              {searchQuery && ` — "${searchQuery}"`}
            </div>

            {filteredVoices.map(v => {
              const key = `el_${v.id}`;
              const isPlaying = playingVoice === key;
              const isSelected = selectedELVoice === v.id;
              const isHovered = hoveredVoice === v.id;
              const result = testResults[key];
              const accent = v.labels?.accent || '';
              const gender = v.labels?.gender || '';
              const category = v.category || '';
              // b.309 — bandiera del paese della voce (ricavata dall'accento):
              // qui le righe mostravano solo l'accento a parole, ora c'e anche
              // la bandiera, come nella striscia voci in stanza.
              const bv = bandieraVoce({ accent: v.labels?.accent, language: v.labels?.language || v.language });

              // Determine accent color based on category
              const voiceAccent = category === 'cloned' ? purple
                : category === 'professional' ? teal
                : gold;

              return (
                <button
                  key={v.id}
                  onPointerEnter={() => setHoveredVoice(v.id)}
                  onPointerLeave={() => setHoveredVoice(null)}
                  onClick={() => testELVoice(v)}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 18, cursor: 'pointer',
                    position: 'relative', overflow: 'hidden',
                    background: isSelected
                      ? `linear-gradient(155deg, ${voiceAccent}12 0%, ${colors.cardBg} 60%)`
                      : isHovered
                        ? `linear-gradient(155deg, ${voiceAccent}08 0%, ${colors.cardBg} 60%)`
                        : colors.glassCard,
                    border: `1px solid ${isSelected ? voiceAccent + '35' : isHovered ? voiceAccent + '20' : colors.cardBorder}`,
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    boxShadow: isHovered || isSelected
                      ? `0 8px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`
                      : '0 2px 10px rgba(0,0,0,0.2)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transform: isHovered ? 'scale(1.015) translateY(-1px)' : 'scale(1)',
                    textAlign: 'left',
                  }}
                >
                  {/* Play indicator / icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    background: isPlaying
                      ? `linear-gradient(145deg, ${voiceAccent}30, ${voiceAccent}10)`
                      : `linear-gradient(145deg, ${voiceAccent}15, ${colors.cardBg})`,
                    border: `1px solid ${isPlaying ? voiceAccent + '40' : voiceAccent + '18'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isPlaying ? `0 0 20px ${voiceAccent}30` : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                    {isPlaying && result === 'playing'
                      ? <WaveBars color={voiceAccent} />
                      : result === 'loading'
                        ? <Icon name="refresh" size={18} color={voiceAccent} />
                        : <Icon name={isPlaying ? 'pause' : 'play'} size={18} color={isPlaying ? voiceAccent : colors.textMuted} />
                    }
                  </div>

                  {/* Voice info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
                      color: isSelected ? voiceAccent : (isHovered ? colors.textPrimary : colors.textSecondary),
                      transition: 'color 0.3s',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{bv?.f ? `${bv.f} ` : ''}{v.name}</div>
                    <div style={{
                      fontSize: 10, color: colors.textMuted, marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    }}>
                      {category && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 5,
                          background: `${voiceAccent}12`,
                          color: voiceAccent,
                          fontSize: 9, fontWeight: 500, letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}>{category}</span>
                      )}
                      {gender && <span>{gender}</span>}
                      {accent && <span>{accent}</span>}
                    </div>
                  </div>

                  {/* Status / selected indicator */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {result === 'ok' && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: teal,
                        boxShadow: `0 0 8px ${teal}60`,
                      }} />
                    )}
                    {result === 'error' && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: colors.statusError,
                        boxShadow: `0 0 8px ${colors.statusError}66`,
                      }} />
                    )}
                    {isSelected && (
                      <div style={{
                        padding: '3px 8px', borderRadius: 8,
                        background: `${voiceAccent}18`,
                        border: `1px solid ${voiceAccent}30`,
                        color: voiceAccent,
                        fontSize: 9, fontWeight: 500, letterSpacing: 0.5,
                      }}>{L('voiceActive')}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Empty filter state ── */}
        {elAvailable && elevenLabsVoices.length > 0 && filteredVoices.length === 0 && (
          <div style={{
            width: '100%', maxWidth: 400, padding: '30px 20px', textAlign: 'center',
            borderRadius: 20,
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              {L('noVoicesMatch')}
            </div>
            <button onClick={() => { setCategoryFilter('all'); setGenderFilter('all'); setSearchQuery(''); }} style={{
              marginTop: 10, padding: '8px 18px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
              background: colors.inputBg,
              border: `1px solid ${colors.inputBorder}`,
              color: colors.textSecondary, fontSize: 12, fontWeight: 500, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>{L('resetWord')}</button>
          </div>
        )}

        {/* ── Reload button ── */}
        {elAvailable && !loadingEL && (
          <button onClick={loadELVoices} style={{
            width: '100%', maxWidth: 400, marginBottom: 16,
            padding: '12px 16px', minHeight: 44, borderRadius: 16, cursor: 'pointer',
            background: colors.cardBg,
            border: `1px solid ${colors.cardBorder}`,
            color: colors.textMuted, fontSize: 12, fontWeight: 500,
            fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s ease',
          }}>
            <Icon name="refresh" size={14} color={colors.textMuted} />
            {L('reloadVoices')}
          </button>
        )}

        {/* ── TTS Engine Info (subtle footer) ── */}
        <div style={{
          width: '100%', maxWidth: 400, marginBottom: 24, padding: '14px 16px',
          borderRadius: 16,
          background: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 500, color: colors.textMuted,
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            {L('activeVoiceEngines')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { name: 'ElevenLabs', ok: elAvailable, note: L('enginePremium'), color: gold },
              { name: 'Edge TTS', ok: true, note: L('engineAutoFree'), color: teal },
              { name: 'OpenAI TTS', ok: hasApiAccess, note: L('engineFallback'), color: purple },
              { name: 'Browser', ok: typeof speechSynthesis !== 'undefined', note: L('engineLastFallback'), color: colors.textMuted },
            ].map(e => (
              <div key={e.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: e.ok ? e.color : colors.toggleOff,
                  boxShadow: e.ok ? `0 0 6px ${e.color}40` : 'none',
                }} />
                <span style={{ fontSize: 11, color: e.ok ? colors.textSecondary : colors.textMuted, fontWeight: 500 }}>
                  {e.name}
                </span>
                <span style={{ fontSize: 10, color: colors.textMuted, marginLeft: 'auto' }}>
                  {e.note}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: 9, color: colors.textMuted, marginTop: 10, lineHeight: 1.5,
          }}>
            {L('voiceEnginesNote')}
          </div>
        </div>

        </div>{/* ── FINE b.211 — chiude il wrapper non comprimibile ── */}
      </div>
    </div>
  );
});

export default VoiceTestView;

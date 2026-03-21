'use client';
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { VOICES, FONT, getLang } from '../lib/constants.js';
import Icon from './Icon.js';

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
const CATEGORY_FILTERS = [
  { id: 'all', label: 'Tutte', labelEN: 'All' },
  { id: 'premade', label: 'Premade', labelEN: 'Premade' },
  { id: 'cloned', label: 'Clonate', labelEN: 'Cloned' },
  { id: 'professional', label: 'Pro', labelEN: 'Pro' },
];

const GENDER_FILTERS = [
  { id: 'all', label: 'Tutti', labelEN: 'All' },
  { id: 'male', label: 'M', labelEN: 'M' },
  { id: 'female', label: 'F', labelEN: 'F' },
];

const VoiceTestView = memo(function VoiceTestView({ L, S, prefs, setView, isTrial, isTopPro,
  useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setElevenLabsVoices, userToken, userTokenRef, creditBalance, theme }) {

  if (typeof document !== 'undefined') injectVTVKeyframes();

  const colors = S.colors;
  const isIT = L('createRoom') === 'Crea Stanza';

  const [playingVoice, setPlayingVoice] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [loadingEL, setLoadingEL] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredVoice, setHoveredVoice] = useState(null);
  const audioRef = useRef(null);

  // Palette
  const gold = '#F5A623';
  const goldGlow = 'rgba(245,166,35,0.25)';
  const teal = '#26D9B0';
  const purple = '#8B6AFF';

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
      const res = await fetch(`/api/tts-elevenlabs?action=voices&token=${userTokenRef?.current || ''}`);
      if (res.ok) {
        const data = await res.json();
        setElevenLabsVoices(data.voices || []);
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
      const res = await fetch('/api/tts-elevenlabs', {
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
      setTestResults(prev => ({ ...prev, [key]: 'error' }));
      setPlayingVoice(null);
    }
  }, [playingVoice, sampleText, prefs.lang, userTokenRef, stopAudio]);

  // Filter EL voices
  const filteredVoices = elevenLabsVoices.filter(v => {
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
      if (!name.includes(q) && !accent.includes(q)) return false;
    }
    return true;
  });

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

  return (
    <div style={{
      ...S.page,
      background: 'linear-gradient(180deg, #060810 0%, #0A0D1A 50%, #060810 100%)',
    }}>
      <div style={S.scrollCenter}>

        {/* ── Top bar ── */}
        <div style={{
          ...S.topBar,
          background: 'transparent',
          borderBottom: 'none',
        }}>
          <button onClick={() => setView('settings')} style={{
            width: 40, height: 40, borderRadius: 14, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)', fontSize: 18,
            fontFamily: FONT, WebkitTapHighlightColor: 'transparent',
          }}>
            <Icon name="back" size={20} color="rgba(255,255,255,0.7)" />
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{
              fontSize: 17, fontWeight: 800, letterSpacing: -0.3,
              background: `linear-gradient(135deg, ${gold} 0%, #fff 50%, ${gold} 100%)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Voice Studio</span>
          </div>
          <div style={{ width: 40 }} />
        </div>

        {/* ── Hero Card: ElevenLabs Status ── */}
        <div style={{
          width: '100%', maxWidth: 400, marginBottom: 16, borderRadius: 24,
          position: 'relative', overflow: 'hidden',
          padding: '28px 22px 24px',
          background: `linear-gradient(165deg, ${gold}10 0%, rgba(8,10,22,0.95) 50%, ${purple}08 100%)`,
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
                fontSize: 20, fontWeight: 800, letterSpacing: -0.5,
                background: `linear-gradient(135deg, ${gold} 0%, #fff 60%, ${gold} 100%)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>ElevenLabs</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, letterSpacing: 0.3 }}>
                {elAvailable
                  ? (elevenLabsVoices.length > 0
                    ? `${elevenLabsVoices.length} ${isIT ? 'voci disponibili' : 'voices available'}`
                    : (loadingEL ? (isIT ? 'Caricamento...' : 'Loading...') : (isIT ? 'Pronto' : 'Ready')))
                  : (isIT ? 'Configura API key' : 'Configure API key')}
              </div>
            </div>
            {/* Status indicator */}
            <div style={{
              marginLeft: 'auto',
              width: 10, height: 10, borderRadius: '50%',
              background: elAvailable ? teal : 'rgba(255,255,255,0.2)',
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

        {/* ── Not available state ── */}
        {!elAvailable && (
          <div style={{
            width: '100%', maxWidth: 400, marginBottom: 16, borderRadius: 20,
            padding: '24px 20px', textAlign: 'center',
            background: 'rgba(10,13,26,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Icon name="key" size={32} color="rgba(255,255,255,0.3)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
              {isIT ? 'Chiave API ElevenLabs necessaria' : 'ElevenLabs API key required'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.5 }}>
              {isIT
                ? 'Vai su Impostazioni > API Keys per configurare la tua chiave ElevenLabs'
                : 'Go to Settings > API Keys to configure your ElevenLabs key'}
            </div>
            <button onClick={() => setView('settings')} style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, ${gold}20, ${gold}08)`,
              border: `1px solid ${gold}30`,
              color: gold, fontSize: 13, fontWeight: 700, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <Icon name="settings" size={14} color={gold} /> {isIT ? 'Impostazioni' : 'Settings'}
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
                <Icon name="globe" size={16} color="rgba(255,255,255,0.3)" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isIT ? 'Cerca voce...' : 'Search voice...'}
                style={{
                  width: '100%', padding: '12px 14px 12px 40px', borderRadius: 16,
                  background: 'rgba(10,13,26,0.8)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.9)', fontSize: 13,
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
                    padding: '6px 14px', borderRadius: 12, cursor: 'pointer',
                    background: active ? `${gold}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? gold + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: active ? gold : 'rgba(255,255,255,0.5)',
                    fontSize: 11, fontWeight: 600, fontFamily: FONT,
                    transition: 'all 0.2s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}>{isIT ? f.label : f.labelEN}</button>
                );
              })}
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)', alignSelf: 'center', margin: '0 4px' }} />
              {GENDER_FILTERS.map(f => {
                const active = genderFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setGenderFilter(f.id)} style={{
                    padding: '6px 12px', borderRadius: 12, cursor: 'pointer',
                    background: active ? `${purple}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? purple + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: active ? purple : 'rgba(255,255,255,0.5)',
                    fontSize: 11, fontWeight: 600, fontFamily: FONT,
                    transition: 'all 0.2s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }}>{isIT ? f.label : f.labelEN}</button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {elAvailable && loadingEL && elevenLabsVoices.length === 0 && (
          <div style={{
            width: '100%', maxWidth: 400, padding: '40px 20px', textAlign: 'center',
            borderRadius: 20,
            background: 'rgba(10,13,26,0.6)',
            border: '1px solid rgba(255,255,255,0.05)',
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
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              {isIT ? 'Caricamento voci ElevenLabs...' : 'Loading ElevenLabs voices...'}
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
              fontSize: 10, color: 'rgba(255,255,255,0.35)', padding: '0 4px 4px',
              letterSpacing: 0.5,
            }}>
              {filteredVoices.length} {isIT ? 'voci' : 'voices'}
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
                      ? `linear-gradient(155deg, ${voiceAccent}12 0%, rgba(8,10,22,0.92) 60%)`
                      : isHovered
                        ? `linear-gradient(155deg, ${voiceAccent}08 0%, rgba(10,13,26,0.88) 60%)`
                        : 'linear-gradient(155deg, rgba(12,15,30,0.5) 0%, rgba(8,10,24,0.7) 100%)',
                    border: `1px solid ${isSelected ? voiceAccent + '35' : isHovered ? voiceAccent + '20' : 'rgba(255,255,255,0.05)'}`,
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
                      : `linear-gradient(145deg, ${voiceAccent}15, rgba(255,255,255,0.02))`,
                    border: `1px solid ${isPlaying ? voiceAccent + '40' : voiceAccent + '18'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isPlaying ? `0 0 20px ${voiceAccent}30` : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                    {isPlaying && result === 'playing'
                      ? <WaveBars color={voiceAccent} />
                      : result === 'loading'
                        ? <Icon name="refresh" size={18} color={voiceAccent} />
                        : <Icon name={isPlaying ? 'pause' : 'play'} size={18} color={isPlaying ? voiceAccent : 'rgba(255,255,255,0.5)'} />
                    }
                  </div>

                  {/* Voice info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: isSelected ? 700 : 600, letterSpacing: -0.2,
                      color: isSelected ? voiceAccent : (isHovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)'),
                      transition: 'color 0.3s',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{v.name}</div>
                    <div style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 3,
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    }}>
                      {category && (
                        <span style={{
                          padding: '1px 6px', borderRadius: 5,
                          background: `${voiceAccent}12`,
                          color: voiceAccent,
                          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
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
                        background: '#EF4444',
                        boxShadow: '0 0 8px rgba(239,68,68,0.4)',
                      }} />
                    )}
                    {isSelected && (
                      <div style={{
                        padding: '3px 8px', borderRadius: 8,
                        background: `${voiceAccent}18`,
                        border: `1px solid ${voiceAccent}30`,
                        color: voiceAccent,
                        fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                      }}>{isIT ? 'ATTIVA' : 'ACTIVE'}</div>
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
            background: 'rgba(10,13,26,0.5)',
            border: '1px solid rgba(255,255,255,0.04)',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {isIT ? 'Nessuna voce corrisponde ai filtri' : 'No voices match filters'}
            </div>
            <button onClick={() => { setCategoryFilter('all'); setGenderFilter('all'); setSearchQuery(''); }} style={{
              marginTop: 10, padding: '8px 18px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, fontFamily: FONT,
              WebkitTapHighlightColor: 'transparent',
            }}>Reset</button>
          </div>
        )}

        {/* ── Reload button ── */}
        {elAvailable && !loadingEL && (
          <button onClick={loadELVoices} style={{
            width: '100%', maxWidth: 400, marginBottom: 16,
            padding: '12px 16px', borderRadius: 16, cursor: 'pointer',
            background: 'rgba(10,13,26,0.5)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600,
            fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            WebkitTapHighlightColor: 'transparent',
            transition: 'all 0.2s ease',
          }}>
            <Icon name="refresh" size={14} color="rgba(255,255,255,0.4)" />
            {isIT ? 'Ricarica voci' : 'Reload voices'}
          </button>
        )}

        {/* ── TTS Engine Info (subtle footer) ── */}
        <div style={{
          width: '100%', maxWidth: 400, marginBottom: 24, padding: '14px 16px',
          borderRadius: 16,
          background: 'rgba(10,13,26,0.4)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
          }}>
            {isIT ? 'Motori vocali attivi' : 'Active voice engines'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { name: 'ElevenLabs', ok: elAvailable, note: isIT ? 'Voci premium' : 'Premium voices', color: gold },
              { name: 'Edge TTS', ok: true, note: isIT ? 'Automatico, gratuito' : 'Automatic, free', color: teal },
              { name: 'OpenAI TTS', ok: hasApiAccess, note: isIT ? 'Fallback' : 'Fallback', color: purple },
              { name: 'Browser', ok: typeof speechSynthesis !== 'undefined', note: isIT ? 'Ultimo fallback' : 'Last fallback', color: 'rgba(255,255,255,0.4)' },
            ].map(e => (
              <div key={e.name} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: e.ok ? e.color : 'rgba(255,255,255,0.12)',
                  boxShadow: e.ok ? `0 0 6px ${e.color}40` : 'none',
                }} />
                <span style={{ fontSize: 11, color: e.ok ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
                  {e.name}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>
                  {e.note}
                </span>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: 9, color: 'rgba(255,255,255,0.18)', marginTop: 10, lineHeight: 1.5,
          }}>
            {isIT
              ? 'Le voci standard vengono selezionate automaticamente in base alla lingua. ElevenLabs ha la priorità quando disponibile.'
              : 'Standard voices are selected automatically by language. ElevenLabs takes priority when available.'}
          </div>
        </div>

      </div>
    </div>
  );
});

export default VoiceTestView;

'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { LANGS, FONT } from '../lib/constants.js';
import { TEST_STRINGS, PRIORITY_PAIRS, SCENARIOS } from '../lib/testStrings.js';
import { PROVIDERS, LLM_MODELS, TTS_ENGINES, AVATAR_NAMES } from '../lib/provider-meta.js';

// ═══════════════════════════════════════════════
// Translation Test Center v2
//
// Tabs:
// 1. Free — test free providers (Google, Microsoft, MyMemory)
// 2. LLM — test paid AI models (OpenAI, Anthropic, Gemini)
// 3. Voice TTS — test ElevenLabs, OpenAI TTS, Edge TTS
// 4. Config — system status and configuration
// ═══════════════════════════════════════════════

const TABS = [
  { id: 'free', label: 'Free', icon: '🆓' },
  { id: 'llm', label: 'LLM (AI)', icon: '🤖' },
  { id: 'voice', label: 'Voci TTS', icon: '🎤' },
  { id: 'config', label: 'Config', icon: '⚙️' },
];

const SCENARIO_LABELS = {
  travel: '✈️ Viaggio',
  business: '💼 Business',
  emergency: '🚨 Emergenza',
  casual: '💬 Conversazione',
};

const PROVIDER_COLORS = {
  google: '#4285F4',
  microsoft: '#00A4EF',
  mymemory: '#FF6B35',
};

// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════

export default function TestCenterPage() {
  const [activeTab, setActiveTab] = useState('free');

  // Override body overflow:hidden from layout.js
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <a href="/" style={{ color: '#71717a', textDecoration: 'none', fontSize: 14 }}>← Torna all'app</a>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, flex: 1 }}>
            🧪 Test Center
          </h1>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#18181b', borderRadius: 12, padding: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '10px 16px', border: 'none', borderRadius: 8,
                background: activeTab === tab.id ? '#f97316' : 'transparent',
                color: activeTab === tab.id ? '#000' : '#a1a1aa',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                fontFamily: FONT,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'free' && <FreeTranslationTab />}
        {activeTab === 'llm' && <LLMTranslationTab />}
        {activeTab === 'voice' && <VoiceTTSTab />}
        {activeTab === 'config' && <ConfigTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════

function LanguageControls({ sourceLang, setSourceLang, targetLang, setTargetLang, scenario, setScenario }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
      <div>
        <label style={labelStyle}>Lingua Sorgente</label>
        <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} style={selectStyle}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 24, padding: '0 4px', alignSelf: 'center' }}>→</div>
      <div>
        <label style={labelStyle}>Lingua Target</label>
        <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={selectStyle}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>
      {scenario !== undefined && (
        <div>
          <label style={labelStyle}>Scenario</label>
          <select value={scenario} onChange={e => setScenario(e.target.value)} style={selectStyle}>
            {SCENARIOS.map(s => <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tab 1: Free Translation (existing functionality)
// ═══════════════════════════════════════════════

function FreeTranslationTab() {
  const [sourceLang, setSourceLang] = useState('it');
  const [targetLang, setTargetLang] = useState('th');
  const [scenario, setScenario] = useState('travel');
  const [customText, setCustomText] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const sourceText = customText.trim() || TEST_STRINGS[sourceLang]?.[scenario] || '';

  async function runTest() {
    if (!sourceText || loading) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/translate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, sourceLang, targetLang, userEmail: 'testcenter@voicetranslate.app' }),
      });
      const data = await res.json();
      setResults(data);
      setHistory(prev => [{ timestamp: new Date().toLocaleTimeString(), sourceLang, targetLang, scenario, ...data }, ...prev].slice(0, 20));
    } catch (e) {
      setResults({ error: e.message });
    }
    setLoading(false);
  }

  function exportCSV() {
    if (!history.length) return;
    const rows = [['Time', 'Source', 'Target', 'Scenario', 'Provider', 'Translation', 'Time (ms)', 'Score', 'Valid', 'Consensus']];
    for (const h of history) {
      for (const r of (h.results || [])) {
        rows.push([h.timestamp, h.sourceLang, h.targetLang, h.scenario, r.provider,
          `"${(r.text || '').replace(/"/g, '""')}"`, r.elapsed, r.score, r.valid ? 'YES' : 'NO',
          h.consensus?.agreedProviders?.includes(r.provider) ? 'YES' : 'NO']);
      }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `testcenter-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const sourceLangObj = LANGS.find(l => l.code === sourceLang) || LANGS[0];
  const targetLangObj = LANGS.find(l => l.code === targetLang) || LANGS[0];

  return (
    <>
      {/* Controls */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <LanguageControls {...{ sourceLang, setSourceLang, targetLang, setTargetLang, scenario, setScenario }} />
        <button onClick={runTest} disabled={loading || !sourceText} style={runBtnStyle(loading)}>
          {loading ? '⏳ Testing...' : '🚀 Avvia Test'}
        </button>
        {history.length > 0 && (
          <button onClick={exportCSV} style={{ ...btnSecondary, background: '#22c55e' }}>
            📊 CSV ({history.length})
          </button>
        )}
      </div>

      {/* Quick pairs */}
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#71717a', alignSelf: 'center' }}>Coppie prioritarie:</span>
        {PRIORITY_PAIRS.slice(0, 10).map((p, i) => {
          const sFlag = LANGS.find(l => l.code === p.source)?.flag || '';
          const tFlag = LANGS.find(l => l.code === p.target)?.flag || '';
          return (
            <button key={i} onClick={() => { setSourceLang(p.source); setTargetLang(p.target); }}
              style={{
                background: sourceLang === p.source && targetLang === p.target ? '#f97316' : '#27272a',
                color: sourceLang === p.source && targetLang === p.target ? '#000' : '#a1a1aa',
                border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12,
              }}>
              {sFlag}→{tFlag}
            </button>
          );
        })}
      </div>

      {/* Source text */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 6 }}>
          {sourceLangObj.flag} Testo sorgente ({SCENARIO_LABELS[scenario]}):
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>{sourceText || 'Nessun testo disponibile'}</div>
        <textarea placeholder="Oppure inserisci testo personalizzato..." value={customText}
          onChange={e => setCustomText(e.target.value)} style={textareaStyle} />
      </div>

      {/* Results */}
      {results && !results.error && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
            {targetLangObj.flag} Risultati — {sourceLangObj.name} → {targetLangObj.name}
          </h2>
          {results.consensus && <ConsensusBadge consensus={results.consensus} />}
          <FreeResultsTable results={results.results} consensus={results.consensus} />
        </div>
      )}
      {results?.error && <ErrorBox message={results.error} />}

      {/* History */}
      {history.length > 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
            📋 Cronologia ({history.length})
          </h2>
          {history.slice(1).map((h, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < history.length - 2 ? '1px solid #1a1a1e' : 'none', fontSize: 13, color: '#a1a1aa' }}>
              <span style={{ color: '#71717a' }}>{h.timestamp}</span>{' '}
              {LANGS.find(l => l.code === h.sourceLang)?.flag}→{LANGS.find(l => l.code === h.targetLang)?.flag}{' '}
              ({SCENARIO_LABELS[h.scenario]}){' — '}
              {h.consensus?.guaranteed ? '✅ Consenso' : '⚠️ No consenso'}{' — '}
              {h.results?.filter(r => r.valid).length || 0}/{h.results?.length || 0} validi
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ConsensusBadge({ consensus }) {
  return (
    <div style={{
      background: consensus.guaranteed ? '#052e16' : '#451a03',
      border: `1px solid ${consensus.guaranteed ? '#16a34a' : '#d97706'}`,
      borderRadius: 8, padding: 12, marginBottom: 16,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {consensus.guaranteed ? '✅ Consenso Raggiunto' : '⚠️ Nessun Consenso'}
      </div>
      <div style={{ fontSize: 13, color: '#a1a1aa' }}>
        {consensus.guaranteed
          ? `${consensus.agreedProviders.length} provider concordano (${(consensus.confidence * 100).toFixed(0)}%)`
          : 'Traduzioni diverse. Verificare manualmente.'}
      </div>
      {consensus.text && (
        <div style={{ marginTop: 8, padding: 8, background: '#09090b', borderRadius: 6, fontSize: 14 }}>
          {consensus.text}
        </div>
      )}
    </div>
  );
}

function FreeResultsTable({ results, consensus }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #27272a' }}>
            <th style={thStyle}>Provider</th>
            <th style={thStyle}>Traduzione</th>
            <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Tempo</th>
            <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Voto</th>
            <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>Script</th>
            <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Consenso</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const isAgreed = consensus?.agreedProviders?.includes(r.provider);
            return (
              <tr key={i} style={{ borderBottom: '1px solid #1a1a1e', background: isAgreed ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: PROVIDER_COLORS[r.provider] || '#555', marginRight: 6 }} />
                  <strong>{PROVIDERS[r.provider]?.name || r.provider}</strong>
                </td>
                <td style={{ padding: '10px 8px', maxWidth: 400, wordBreak: 'break-word' }}>
                  {r.text || <span style={{ color: '#ef4444' }}>❌ Fallito ({r.validationReason})</span>}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: getSpeedColor(r.elapsed) }}>
                  {r.elapsed ? `${r.elapsed}ms` : '—'}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: getScoreColor(r.score) }}>{r.score}/10</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{r.valid ? '✅' : '❌'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{isAgreed ? '🤝' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Tab 2: LLM Translation
// ═══════════════════════════════════════════════

function LLMTranslationTab() {
  const [sourceLang, setSourceLang] = useState('it');
  const [targetLang, setTargetLang] = useState('th');
  const [scenario, setScenario] = useState('travel');
  const [customText, setCustomText] = useState('');
  const [selectedModels, setSelectedModels] = useState(Object.keys(LLM_MODELS));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const sourceText = customText.trim() || TEST_STRINGS[sourceLang]?.[scenario] || '';

  function toggleModel(id) {
    setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  }

  async function runTest() {
    if (!sourceText || loading || selectedModels.length === 0) return;
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch('/api/translate-test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, sourceLang, targetLang, models: selectedModels }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setResults({ error: e.message });
    }
    setLoading(false);
  }

  const sourceLangObj = LANGS.find(l => l.code === sourceLang) || LANGS[0];
  const targetLangObj = LANGS.find(l => l.code === targetLang) || LANGS[0];

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <LanguageControls {...{ sourceLang, setSourceLang, targetLang, setTargetLang, scenario, setScenario }} />

        {/* Model selection */}
        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>Modelli da testare</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {Object.entries(LLM_MODELS).map(([id, m]) => (
              <button key={id} onClick={() => toggleModel(id)} style={{
                background: selectedModels.includes(id) ? m.color : '#27272a',
                color: selectedModels.includes(id) ? '#fff' : '#71717a',
                border: `1px solid ${selectedModels.includes(id) ? m.color : '#3f3f46'}`,
                borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                opacity: selectedModels.includes(id) ? 1 : 0.6,
              }}>
                {m.name} <span style={{ fontSize: 11, opacity: 0.7 }}>{m.cost}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source text + run */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>
            {sourceLangObj.flag} {SCENARIO_LABELS[scenario]}: <span style={{ color: '#e4e4e7' }}>{sourceText.substring(0, 100)}{sourceText.length > 100 ? '...' : ''}</span>
          </div>
          <textarea placeholder="Testo personalizzato..." value={customText}
            onChange={e => setCustomText(e.target.value)} style={{ ...textareaStyle, minHeight: 40 }} />
        </div>

        <button onClick={runTest} disabled={loading || !sourceText || selectedModels.length === 0}
          style={{ ...runBtnStyle(loading), marginTop: 12 }}>
          {loading ? '⏳ Testing LLM...' : `🤖 Test ${selectedModels.length} Modelli`}
        </button>
      </div>

      {/* Results */}
      {results && !results.error && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
            {targetLangObj.flag} Risultati LLM — {sourceLangObj.name} → {targetLangObj.name}
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  <th style={thStyle}>Modello</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Traduzione</th>
                  <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>Tempo</th>
                  <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>Token</th>
                  <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>Valido</th>
                </tr>
              </thead>
              <tbody>
                {results.results
                  .sort((a, b) => a.elapsed - b.elapsed)
                  .map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a1a1e' }}>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: LLM_MODELS[r.model]?.color || '#555', marginRight: 6 }} />
                      <strong>{LLM_MODELS[r.model]?.name || r.model}</strong>
                    </td>
                    <td style={{ padding: '10px 8px', color: '#a1a1aa', fontSize: 12 }}>
                      {r.provider}
                    </td>
                    <td style={{ padding: '10px 8px', maxWidth: 400, wordBreak: 'break-word' }}>
                      {r.text || <span style={{ color: '#ef4444' }}>❌ {r.reason}</span>}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: getSpeedColor(r.elapsed), fontWeight: 600 }}>
                      {r.elapsed ? `${r.elapsed}ms` : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
                      {r.tokens || '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {r.valid ? '✅' : '❌'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Speed ranking */}
          <div style={{ marginTop: 16, padding: 12, background: '#09090b', borderRadius: 8, fontSize: 13 }}>
            <strong>Classifica velocità:</strong>{' '}
            {results.results
              .filter(r => r.text)
              .sort((a, b) => a.elapsed - b.elapsed)
              .map((r, i) => `${i + 1}. ${LLM_MODELS[r.model]?.name} (${r.elapsed}ms)`)
              .join(' → ')}
          </div>
        </div>
      )}
      {results?.error && <ErrorBox message={results.error} />}
    </>
  );
}

// ═══════════════════════════════════════════════
// Tab 3: Voice TTS
// ═══════════════════════════════════════════════

function VoiceTTSTab() {
  const [voices, setVoices] = useState([]);
  const [avatarMap, setAvatarMap] = useState({});
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [filterGender, setFilterGender] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const audioRef = useRef(null);

  // TTS Test state
  const [ttsText, setTtsText] = useState('Buongiorno, benvenuto al test delle voci.');
  const [ttsLang, setTtsLang] = useState('it');
  const [ttsEngine, setTtsEngine] = useState('elevenlabs');
  const [ttsVoice, setTtsVoice] = useState('');
  const [ttsModel, setTtsModel] = useState('eleven_flash_v2_5');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsGender, setTtsGender] = useState('female');

  // Load ElevenLabs voices
  useEffect(() => {
    loadVoices();
  }, []);

  async function loadVoices() {
    setLoadingVoices(true);
    setVoiceError(null);
    try {
      const res = await fetch('/api/tts-elevenlabs?action=voices&source=testcenter');
      if (!res.ok) throw new Error(`Errore ${res.status}`);
      const data = await res.json();
      setVoices(data.voices || []);
      setAvatarMap(data.avatarVoiceMap || {});
    } catch (e) {
      setVoiceError(e.message);
    }
    setLoadingVoices(false);
  }

  function playPreview(url, voiceId) {
    if (audioRef.current) { audioRef.current.pause(); }
    if (playingId === voiceId) { setPlayingId(null); return; }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(voiceId);
    audio.play();
    audio.onended = () => setPlayingId(null);
  }

  async function testTTS() {
    if (!ttsText.trim() || ttsLoading) return;
    setTtsLoading(true);
    setTtsError(null);
    try {
      const body = {
        text: ttsText.trim(),
        langCode: ttsLang,
        engine: ttsEngine,
      };
      if (ttsEngine === 'elevenlabs') {
        body.voiceId = ttsVoice || undefined;
        body.model = ttsModel;
      } else if (ttsEngine === 'openai') {
        body.voiceId = ttsVoice || 'nova';
      } else if (ttsEngine === 'edge') {
        body.gender = ttsGender;
      }

      const res = await fetch('/api/tts-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (e) {
      setTtsError(e.message);
    }
    setTtsLoading(false);
  }

  const filteredVoices = voices.filter(v => {
    if (filterGender !== 'all' && v.gender !== filterGender) return false;
    if (filterCategory !== 'all' && v.category !== filterCategory) return false;
    return true;
  });

  const categories = [...new Set(voices.map(v => v.category).filter(Boolean))];

  return (
    <>
      {/* TTS Test Panel */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>🔊 Test Voce</h3>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          {/* Engine */}
          <div>
            <label style={labelStyle}>Engine</label>
            <select value={ttsEngine} onChange={e => { setTtsEngine(e.target.value); setTtsVoice(''); }} style={selectStyle}>
              {Object.entries(TTS_ENGINES).map(([id, e]) => (
                <option key={id} value={id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label style={labelStyle}>Lingua</label>
            <select value={ttsLang} onChange={e => setTtsLang(e.target.value)} style={selectStyle}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          {/* Voice / Model based on engine */}
          {ttsEngine === 'elevenlabs' && (
            <>
              <div>
                <label style={labelStyle}>Modello</label>
                <select value={ttsModel} onChange={e => setTtsModel(e.target.value)} style={selectStyle}>
                  {TTS_ENGINES.elevenlabs.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.latency})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Voce</label>
                <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ ...selectStyle, maxWidth: 200 }}>
                  <option value="">Default (Sarah)</option>
                  {voices.slice(0, 50).map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.gender || '?'})</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {ttsEngine === 'openai' && (
            <div>
              <label style={labelStyle}>Voce</label>
              <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={selectStyle}>
                {TTS_ENGINES.openai.voices.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
          {ttsEngine === 'edge' && (
            <div>
              <label style={labelStyle}>Genere</label>
              <select value={ttsGender} onChange={e => setTtsGender(e.target.value)} style={selectStyle}>
                <option value="female">Femminile</option>
                <option value="male">Maschile</option>
              </select>
            </div>
          )}
        </div>

        <textarea value={ttsText} onChange={e => setTtsText(e.target.value)}
          placeholder="Testo da pronunciare..." style={{ ...textareaStyle, marginTop: 12 }} />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={testTTS} disabled={ttsLoading || !ttsText.trim()} style={runBtnStyle(ttsLoading)}>
            {ttsLoading ? '⏳ Generando...' : '🔊 Play'}
          </button>
        </div>
        {ttsError && <div style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>❌ {ttsError}</div>}
      </div>

      {/* Avatar Voice Mapping */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>🎭 Avatar → Voci ElevenLabs</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {AVATAR_NAMES.map(name => {
            const voiceId = avatarMap[name];
            const voice = voices.find(v => v.id === voiceId);
            return (
              <div key={name} style={{ background: '#09090b', borderRadius: 8, padding: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{name}</div>
                <div style={{ color: '#a1a1aa', fontSize: 12 }}>
                  {voice ? `${voice.name} (${voice.gender || '?'})` : voiceId ? `ID: ${voiceId.substring(0, 12)}...` : '—'}
                </div>
                {voice?.preview && (
                  <button onClick={() => playPreview(voice.preview, voice.id)} style={{
                    background: playingId === voice?.id ? '#ef4444' : '#27272a', color: '#e4e4e7', border: 'none',
                    borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, marginTop: 4,
                  }}>
                    {playingId === voice?.id ? '⏹ Stop' : '▶ Preview'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ElevenLabs Voice Library */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📚 Libreria Voci ElevenLabs</h3>
          {loadingVoices && <span style={{ fontSize: 13, color: '#71717a' }}>⏳ Caricamento...</span>}
          <span style={{ fontSize: 13, color: '#71717a' }}>{voices.length} voci</span>
          <button onClick={loadVoices} style={{ ...btnSecondary, fontSize: 12, padding: '4px 10px' }}>🔄 Ricarica</button>
        </div>

        {voiceError && <ErrorBox message={voiceError} />}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} style={{ ...selectStyle, minWidth: 100 }}>
            <option value="all">Tutti i generi</option>
            <option value="male">Maschile</option>
            <option value="female">Femminile</option>
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...selectStyle, minWidth: 120 }}>
            <option value="all">Tutte le categorie</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Voice grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, maxHeight: 500, overflowY: 'auto' }}>
          {filteredVoices.map(v => (
            <div key={v.id} style={{
              background: '#09090b', borderRadius: 8, padding: 12,
              border: ttsVoice === v.id ? '1px solid #f97316' : '1px solid #1a1a1e',
              cursor: 'pointer',
            }} onClick={() => { setTtsVoice(v.id); setTtsEngine('elevenlabs'); }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>{v.name}</strong>
                {v.preview && (
                  <button onClick={e => { e.stopPropagation(); playPreview(v.preview, v.id); }} style={{
                    background: playingId === v.id ? '#ef4444' : '#27272a', color: '#e4e4e7',
                    border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                  }}>
                    {playingId === v.id ? '⏹' : '▶'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                {[v.gender, v.accent, v.age, v.category].filter(Boolean).join(' · ')}
              </div>
              {v.useCase && <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{v.useCase}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// Tab 4: Configuration
// ═══════════════════════════════════════════════

function ConfigTab() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  async function checkApiStatus() {
    setLoading(true);
    const status = {};

    // Check each provider by attempting a minimal test
    const checks = [
      { key: 'openai', endpoint: '/api/translate-test-llm', body: { text: 'test', sourceLang: 'en', targetLang: 'it', models: ['gpt-4o-mini'] } },
      { key: 'anthropic', endpoint: '/api/translate-test-llm', body: { text: 'test', sourceLang: 'en', targetLang: 'it', models: ['claude-haiku'] } },
      { key: 'gemini', endpoint: '/api/translate-test-llm', body: { text: 'test', sourceLang: 'en', targetLang: 'it', models: ['gemini-flash'] } },
      { key: 'elevenlabs', endpoint: '/api/tts-elevenlabs?action=voices&source=testcenter', method: 'GET' },
    ];

    for (const check of checks) {
      try {
        const res = check.method === 'GET'
          ? await fetch(check.endpoint)
          : await fetch(check.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(check.body) });
        const data = await res.json();
        if (check.key === 'elevenlabs') {
          status[check.key] = { ok: !!data.voices?.length, detail: `${data.voices?.length || 0} voci` };
        } else {
          const result = data.results?.[0];
          status[check.key] = {
            ok: result?.valid === true,
            detail: result?.valid ? `${result.elapsed}ms` : (result?.reason || 'errore'),
          };
        }
      } catch (e) {
        status[check.key] = { ok: false, detail: e.message };
      }
    }

    // Free providers
    try {
      const res = await fetch('/api/translate-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test', sourceLang: 'en', targetLang: 'it', userEmail: 'testcenter@voicetranslate.app' }),
      });
      const data = await res.json();
      for (const r of (data.results || [])) {
        status[r.provider] = { ok: r.valid, detail: r.valid ? `${r.elapsed}ms` : (r.validationReason || 'errore') };
      }
    } catch (e) {
      status.google = status.microsoft = status.mymemory = { ok: false, detail: e.message };
    }

    setApiStatus(status);
    setLoading(false);
  }

  // Provider chain info
  const CHAIN_INFO = {
    'th': ['google', 'microsoft', 'mymemory'],
    'zh': ['google', 'microsoft', 'mymemory'],
    'ja': ['google', 'microsoft', 'mymemory'],
    'ko': ['google', 'microsoft', 'mymemory'],
    'ar': ['microsoft', 'google', 'mymemory'],
    'hi': ['microsoft', 'google', 'mymemory'],
    'ru': ['microsoft', 'google', 'mymemory'],
    'tr': ['microsoft', 'google', 'mymemory'],
    '*': ['google', 'microsoft', 'mymemory'],
  };

  return (
    <>
      {/* API Status */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🔑 Stato API</h3>
          <button onClick={checkApiStatus} disabled={loading} style={runBtnStyle(loading)}>
            {loading ? '⏳ Verificando...' : '🔍 Verifica Connessioni'}
          </button>
        </div>

        {apiStatus && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {[
              { key: 'google', name: 'Google Translate', type: 'free' },
              { key: 'microsoft', name: 'Microsoft', type: 'free' },
              { key: 'mymemory', name: 'MyMemory', type: 'free' },
              { key: 'openai', name: 'OpenAI', type: 'paid' },
              { key: 'anthropic', name: 'Anthropic', type: 'paid' },
              { key: 'gemini', name: 'Gemini', type: 'paid' },
              { key: 'elevenlabs', name: 'ElevenLabs', type: 'paid' },
            ].map(({ key, name, type }) => {
              const s = apiStatus[key];
              return (
                <div key={key} style={{
                  background: '#09090b', borderRadius: 8, padding: 12,
                  border: `1px solid ${s?.ok ? '#16a34a' : s ? '#dc2626' : '#27272a'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13 }}>{name}</strong>
                    <span style={{ fontSize: 20 }}>{s?.ok ? '✅' : s ? '❌' : '⏸️'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                    {type === 'free' ? '🆓 Gratuito' : '💎 A pagamento'}
                  </div>
                  {s && <div style={{ fontSize: 12, color: s.ok ? '#22c55e' : '#ef4444', marginTop: 2 }}>{s.detail}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LLM Models */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>🤖 Modelli LLM Disponibili</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                <th style={thStyle}>Modello</th>
                <th style={thStyle}>Provider</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Qualità</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Velocità</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Costo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(LLM_MODELS).map(([id, m]) => (
                <tr key={id} style={{ borderBottom: '1px solid #1a1a1e' }}>
                  <td style={{ padding: '8px' }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: m.color, marginRight: 6 }} />
                    <strong>{m.name}</strong>
                  </td>
                  <td style={{ padding: '8px', color: '#a1a1aa' }}>{m.provider}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{'⭐'.repeat(m.quality)}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{'⚡'.repeat(m.speed)}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{m.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Chains */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>🔗 Catene Provider (Free)</h3>
        <p style={{ fontSize: 13, color: '#a1a1aa', margin: '0 0 12px' }}>
          Ordine di fallback per la traduzione gratuita. Il primo provider viene provato per primo.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {Object.entries(CHAIN_INFO).map(([lang, chain]) => {
            const langObj = LANGS.find(l => l.code === lang);
            return (
              <div key={lang} style={{ background: '#09090b', borderRadius: 8, padding: 10, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {lang === '*' ? '🌍 Default (tutte le altre)' : `${langObj?.flag || ''} ${langObj?.name || lang}`}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {chain.map((p, i) => (
                    <span key={p}>
                      <span style={{
                        background: PROVIDER_COLORS[p] || '#555', color: '#fff',
                        borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
                      }}>{i + 1}. {p}</span>
                      {i < chain.length - 1 && <span style={{ color: '#3f3f46', margin: '0 2px' }}>→</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TTS Engines */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>🎤 Engine TTS Disponibili</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {Object.entries(TTS_ENGINES).map(([id, engine]) => (
            <div key={id} style={{ background: '#09090b', borderRadius: 8, padding: 16, border: `1px solid ${engine.color}30` }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: engine.color }}>{engine.name}</div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>
                <div style={{ marginBottom: 4 }}>Modelli:</div>
                {engine.models.map(m => (
                  <div key={m.id} style={{ marginLeft: 8, marginBottom: 2 }}>
                    • {m.name} — {m.latency}, qualità {'⭐'.repeat(m.quality)}
                  </div>
                ))}
                {engine.voices && (
                  <div style={{ marginTop: 8 }}>
                    Voci: {engine.voices.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// Shared UI Components & Styles
// ═══════════════════════════════════════════════

function ErrorBox({ message }) {
  return (
    <div style={{ background: '#451a03', border: '1px solid #dc2626', borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 14 }}>
      ❌ Errore: {message}
    </div>
  );
}

const cardStyle = {
  background: '#18181b', borderRadius: 12, padding: 20, marginBottom: 16,
};

const selectStyle = {
  background: '#09090b', color: '#e4e4e7', border: '1px solid #27272a',
  borderRadius: 8, padding: '8px 12px', fontSize: 14, minWidth: 140,
};

const labelStyle = {
  fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4,
};

const thStyle = {
  padding: '8px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: 12,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const textareaStyle = {
  width: '100%', background: '#09090b', border: '1px solid #27272a',
  borderRadius: 8, padding: 10, color: '#e4e4e7', fontSize: 13, resize: 'vertical',
  minHeight: 50, fontFamily: FONT,
};

function runBtnStyle(loading) {
  return {
    background: loading ? '#3f3f46' : '#f97316', color: '#000', border: 'none',
    borderRadius: 8, padding: '10px 24px', cursor: loading ? 'wait' : 'pointer',
    fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap',
  };
}

const btnSecondary = {
  background: '#27272a', color: '#e4e4e7', border: 'none',
  borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
};

function getSpeedColor(ms) {
  if (!ms) return '#71717a';
  if (ms < 500) return '#22c55e';
  if (ms < 1000) return '#eab308';
  if (ms < 2000) return '#f97316';
  return '#ef4444';
}

function getScoreColor(score) {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#eab308';
  if (score >= 4) return '#f97316';
  return '#ef4444';
}

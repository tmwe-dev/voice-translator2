'use client';
import { useState, useRef, useEffect } from 'react';
import { LANGS, FONT } from '../lib/constants.js';
import { TEST_STRINGS, PRIORITY_PAIRS, SCENARIOS } from '../lib/testStrings.js';
import { PROVIDERS } from '../lib/providers.js';

// ═══════════════════════════════════════════════
// Translation Test Center
//
// Test all translation providers in parallel for any language pair.
// Compare quality, speed, and consensus across providers.
// ═══════════════════════════════════════════════

const SCENARIO_LABELS = {
  travel: '✈️ Viaggio',
  business: '💼 Business',
  emergency: '🚨 Emergenza',
  casual: '💬 Conversazione',
};

const PROVIDER_COLORS = {
  google: '#4285F4',
  baidu: '#2932E1',
  microsoft: '#00A4EF',
  mymemory: '#FF6B35',
  libretranslate: '#16A34A',
};

export default function TestCenterPage() {
  const [sourceLang, setSourceLang] = useState('it');
  const [targetLang, setTargetLang] = useState('th');
  const [scenario, setScenario] = useState('travel');
  const [customText, setCustomText] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const abortRef = useRef(null);

  const sourceText = customText.trim() || TEST_STRINGS[sourceLang]?.[scenario] || '';

  async function runTest() {
    if (!sourceText || loading) return;
    setLoading(true);
    setResults(null);

    try {
      abortRef.current = new AbortController();
      const res = await fetch('/api/translate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, sourceLang, targetLang }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      setResults(data);

      // Add to history
      setHistory(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        sourceLang,
        targetLang,
        scenario,
        ...data,
      }, ...prev].slice(0, 20));
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Test error:', e);
        setResults({ error: e.message });
      }
    }
    setLoading(false);
  }

  function exportCSV() {
    if (!history.length) return;
    const rows = [['Time', 'Source', 'Target', 'Scenario', 'Provider', 'Translation', 'Time (ms)', 'Score', 'Valid', 'Consensus']];
    for (const h of history) {
      for (const r of (h.results || [])) {
        rows.push([
          h.timestamp, h.sourceLang, h.targetLang, h.scenario,
          r.provider, `"${(r.text || '').replace(/"/g, '""')}"`,
          r.elapsed, r.score, r.valid ? 'YES' : 'NO',
          h.consensus?.agreedProviders?.includes(r.provider) ? 'YES' : 'NO',
        ]);
      }
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `testcenter-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Override body overflow:hidden from layout.js so this page can scroll
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const sourceLangObj = LANGS.find(l => l.code === sourceLang) || LANGS[0];
  const targetLangObj = LANGS.find(l => l.code === targetLang) || LANGS[0];

  return (
    <div style={{ fontFamily: FONT, background: '#0a0a0a', color: '#e4e4e7', minHeight: '100vh', padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
      {/* Header */}
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <a href="/" style={{ color: '#71717a', textDecoration: 'none', fontSize: 14 }}>← Torna all'app</a>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, flex: 1 }}>
            🧪 Translation Test Center
          </h1>
          {history.length > 0 && (
            <button onClick={exportCSV} style={{
              background: '#22c55e', color: '#000', border: 'none', borderRadius: 8,
              padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            }}>
              📊 Esporta CSV ({history.length})
            </button>
          )}
        </div>

        {/* Controls */}
        <div style={{
          background: '#18181b', borderRadius: 12, padding: 20, marginBottom: 20,
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end',
        }}>
          {/* Source language */}
          <div>
            <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Lingua Sorgente</label>
            <select value={sourceLang} onChange={e => setSourceLang(e.target.value)} style={selectStyle}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 24, padding: '0 4px', alignSelf: 'center' }}>→</div>

          {/* Target language */}
          <div>
            <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Lingua Target</label>
            <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={selectStyle}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          {/* Scenario */}
          <div>
            <label style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>Scenario</label>
            <select value={scenario} onChange={e => setScenario(e.target.value)} style={selectStyle}>
              {SCENARIOS.map(s => <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>)}
            </select>
          </div>

          {/* Run button */}
          <button onClick={runTest} disabled={loading || !sourceText} style={{
            background: loading ? '#3f3f46' : '#f97316', color: '#000', border: 'none',
            borderRadius: 8, padding: '10px 24px', cursor: loading ? 'wait' : 'pointer',
            fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap',
          }}>
            {loading ? '⏳ Testing...' : '🚀 Avvia Test'}
          </button>
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

        {/* Source text display */}
        <div style={{ background: '#18181b', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#71717a', marginBottom: 6 }}>
            {sourceLangObj.flag} Testo sorgente ({SCENARIO_LABELS[scenario]}):
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.5 }}>{sourceText || 'Nessun testo disponibile per questa lingua'}</div>
          <textarea
            placeholder="Oppure inserisci testo personalizzato..."
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            style={{
              width: '100%', marginTop: 10, background: '#09090b', border: '1px solid #27272a',
              borderRadius: 8, padding: 10, color: '#e4e4e7', fontSize: 13, resize: 'vertical',
              minHeight: 50, fontFamily: FONT,
            }}
          />
        </div>

        {/* Results */}
        {results && !results.error && (
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 0, marginBottom: 16 }}>
              {targetLangObj.flag} Risultati — {sourceLangObj.name} → {targetLangObj.name}
            </h2>

            {/* Consensus badge */}
            {results.consensus && (
              <div style={{
                background: results.consensus.guaranteed ? '#052e16' : '#451a03',
                border: `1px solid ${results.consensus.guaranteed ? '#16a34a' : '#d97706'}`,
                borderRadius: 8, padding: 12, marginBottom: 16,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {results.consensus.guaranteed ? '✅ Consenso Raggiunto' : '⚠️ Nessun Consenso'}
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa' }}>
                  {results.consensus.guaranteed
                    ? `${results.consensus.agreedProviders.length} provider concordano (similarità: ${(results.consensus.confidence * 100).toFixed(0)}%)`
                    : 'I provider hanno prodotto traduzioni diverse. Consigliato: verificare manualmente.'}
                </div>
                {results.consensus.text && (
                  <div style={{ marginTop: 8, padding: 8, background: '#09090b', borderRadius: 6, fontSize: 14 }}>
                    {results.consensus.text}
                  </div>
                )}
              </div>
            )}

            {/* Provider results table */}
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
                  {results.results.map((r, i) => {
                    const isAgreed = results.consensus?.agreedProviders?.includes(r.provider);
                    return (
                      <tr key={i} style={{
                        borderBottom: '1px solid #1a1a1e',
                        background: isAgreed ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                      }}>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                            background: PROVIDER_COLORS[r.provider] || '#555', marginRight: 6,
                          }} />
                          <strong>{PROVIDERS[r.provider]?.name || r.provider}</strong>
                        </td>
                        <td style={{ padding: '10px 8px', maxWidth: 400, wordBreak: 'break-word' }}>
                          {r.text || <span style={{ color: '#ef4444' }}>❌ Fallito ({r.validationReason})</span>}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: getSpeedColor(r.elapsed) }}>
                          {r.elapsed ? `${r.elapsed}ms` : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span style={{ color: getScoreColor(r.score) }}>
                            {r.score}/10
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {r.valid ? '✅' : '❌'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {isAgreed ? '🤝' : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results?.error && (
          <div style={{ background: '#451a03', border: '1px solid #dc2626', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            ❌ Errore: {results.error}
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>
              📋 Cronologia Test ({history.length})
            </h2>
            {history.slice(1).map((h, i) => (
              <div key={i} style={{
                padding: '8px 0', borderBottom: i < history.length - 2 ? '1px solid #1a1a1e' : 'none',
                fontSize: 13, color: '#a1a1aa',
              }}>
                <span style={{ color: '#71717a' }}>{h.timestamp}</span>
                {' '}
                {LANGS.find(l => l.code === h.sourceLang)?.flag}→{LANGS.find(l => l.code === h.targetLang)?.flag}
                {' '}
                ({SCENARIO_LABELS[h.scenario]})
                {' — '}
                {h.consensus?.guaranteed ? '✅ Consenso' : '⚠️ No consenso'}
                {' — '}
                {h.results?.filter(r => r.valid).length || 0}/{h.results?.length || 0} validi
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const selectStyle = {
  background: '#09090b', color: '#e4e4e7', border: '1px solid #27272a',
  borderRadius: 8, padding: '8px 12px', fontSize: 14, minWidth: 140,
};

const thStyle = {
  padding: '8px', textAlign: 'left', color: '#71717a', fontWeight: 500, fontSize: 12,
  textTransform: 'uppercase', letterSpacing: '0.05em',
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

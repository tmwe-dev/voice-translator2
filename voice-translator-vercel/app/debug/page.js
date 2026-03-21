'use client';
import { useState, useEffect } from 'react';

const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const CONTEXTS = [
  { id: 'general', label: 'Generale', prompt: '' },
  { id: 'tourism', label: 'Turismo', prompt: 'This is a tourism/travel conversation. Use travel terminology: directions, accommodation, sightseeing, transportation, restaurants, bookings. Keep translations practical and clear for travelers.' },
  { id: 'medical', label: 'Medico', prompt: 'This is a medical conversation. Use precise medical terminology: symptoms, medications, dosages, diagnoses, body parts, medical procedures. Accuracy is critical - never approximate medical terms.' },
  { id: 'business', label: 'Business', prompt: 'This is a business conversation. Use professional/corporate terminology: contracts, negotiations, deadlines, KPIs, deliverables, stakeholders. Maintain formal register.' },
  { id: 'emergency', label: 'Emergenza', prompt: 'This is an EMERGENCY conversation. Translate with maximum clarity and urgency. Use direct, unambiguous language. Include emergency-specific terms: location, danger, injury, police, ambulance, fire. Speed and clarity are paramount.' },
];

export default function DebugPage() {
  const [userInfo, setUserInfo] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [text, setText] = useState('Ciao, come stai oggi? Io sto bene grazie.');
  const [audioSec, setAudioSec] = useState(5);
  const [sourceLang, setSourceLang] = useState('it');
  const [targetLang, setTargetLang] = useState('en');
  const [contextId, setContextId] = useState('general');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  async function loadUserInfo() {
    const token = localStorage.getItem('vtToken');
    if (!token) return;
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user-info', userToken: token }),
      });
      if (res.ok) setUserInfo(await res.json());
    } catch (e) { console.error(e); }
  }

  async function runSimulation() {
    setLoading(true);
    const ctx = CONTEXTS.find(c => c.id === contextId);
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate',
          text,
          sourceLang,
          targetLang,
          sourceLangName: sourceLang === 'it' ? 'Italiano' : 'English',
          targetLangName: targetLang === 'en' ? 'English' : 'Italiano',
          domainContext: ctx?.prompt || '',
          description,
          audioSeconds: audioSec,
          userToken: localStorage.getItem('vtToken'),
        }),
      });
      if (res.ok) setSimulation(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const S = {
    page: { minHeight: '100vh', background: 'linear-gradient(145deg, #0f0c29, #302b63, #24243e)',
      color: '#fff', fontFamily: FONT, padding: '20px', boxSizing: 'border-box' },
    card: { background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 18px',
      border: '1px solid rgba(255,255,255,0.1)', marginBottom: 16,
      backdropFilter: 'blur(16px)' },
    title: { fontSize: 22, fontWeight: 700, marginBottom: 4,
      background: 'linear-gradient(135deg, #f093fb, #f5576c, #4facfe)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    label: { fontSize: 10, fontWeight: 600, letterSpacing: 1, color: 'rgba(255,255,255,0.75)',
      textTransform: 'uppercase', marginBottom: 4 },
    input: { width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, outline: 'none',
      boxSizing: 'border-box', fontFamily: FONT, marginBottom: 10 },
    select: { width: '100%', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, outline: 'none',
      boxSizing: 'border-box', fontFamily: FONT, marginBottom: 10 },
    btn: { width: '100%', padding: '12px', borderRadius: 14, border: 'none',
      background: 'linear-gradient(135deg, #f5576c, #e94560)', color: '#fff', fontSize: 15,
      fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginTop: 8 },
    row: { display: 'flex', justifyContent: 'space-between', padding: '6px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 },
    val: { color: '#4ecdc4', fontFamily: 'monospace', fontWeight: 600 },
    warn: { color: '#ff6b6b', fontWeight: 600 },
    good: { color: '#4ecdc4', fontWeight: 600 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 10, letterSpacing: 0.5 },
    td: { padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)',
      color: 'rgba(255,255,255,0.7)' },
  };

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={S.title}>Debug Costi & Crediti</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 16 }}>
          Pagina nascosta per analisi costi e verifica crediti
        </div>

        {/* User Info Card */}
        {userInfo && (
          <div style={S.card}>
            <div style={S.label}>Account Utente</div>
            <div style={S.row}>
              <span>Email</span><span style={S.val}>{userInfo.email}</span>
            </div>
            <div style={S.row}>
              <span>Crediti</span>
              <span style={S.val}>{userInfo.credits} cent ({'\u20AC'}{userInfo.creditsEur})</span>
            </div>
            <div style={S.row}>
              <span>Speso totale</span><span style={S.val}>{'\u20AC'}{userInfo.totalSpentEur}</span>
            </div>
            <div style={S.row}>
              <span>Messaggi totali</span><span style={S.val}>{userInfo.totalMessages}</span>
            </div>
            <div style={S.row}>
              <span>Costo medio/msg</span>
              <span style={S.val}>{userInfo.avgCostPerMsg} cent</span>
            </div>
            <div style={S.row}>
              <span>API Keys proprie</span>
              <span style={userInfo.useOwnKeys ? S.good : S.warn}>
                {userInfo.useOwnKeys ? 'Attive' : 'No (usa piattaforma)'}
              </span>
            </div>
          </div>
        )}

        {/* Simulation Form */}
        <div style={S.card}>
          <div style={S.label}>Simulazione Costi</div>

          <div style={{ marginTop: 8 }}>
            <div style={S.label}>Testo messaggio</div>
            <textarea
              style={{ ...S.input, minHeight: 60, resize: 'vertical' }}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Lingua origine</div>
              <select style={S.select} value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ar">العربية</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Lingua target</div>
              <select style={S.select} value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                <option value="en">English</option>
                <option value="it">Italiano</option>
                <option value="zh">中文</option>
                <option value="ar">العربية</option>
                <option value="ja">日本語</option>
              </select>
            </div>
          </div>

          <div style={S.label}>Durata audio (secondi) — 0 = solo testo</div>
          <input
            type="number" style={S.input} value={audioSec}
            onChange={e => setAudioSec(parseInt(e.target.value) || 0)}
          />

          <div style={S.label}>Contesto dominio</div>
          <select style={S.select} value={contextId} onChange={e => setContextId(e.target.value)}>
            {CONTEXTS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>

          <div style={S.label}>Descrizione aggiuntiva</div>
          <input style={S.input} value={description} onChange={e => setDescription(e.target.value)}
            placeholder="es. Conversazione al ristorante" />

          <button style={S.btn} onClick={runSimulation} disabled={loading}>
            {loading ? 'Calcolando...' : 'Simula Costi'}
          </button>
        </div>

        {/* Simulation Results */}
        {simulation && (
          <>
            {/* Cost Breakdown */}
            <div style={S.card}>
              <div style={S.label}>Dettaglio Costi Messaggio</div>
              <div style={S.row}>
                <span>Caratteri input</span>
                <span style={S.val}>{simulation.simulation.inputChars}</span>
              </div>
              <div style={S.row}>
                <span>Caratteri output (stima)</span>
                <span style={S.val}>{simulation.simulation.estimatedOutputChars}</span>
              </div>
              <div style={S.row}>
                <span>Audio secondi</span>
                <span style={S.val}>{simulation.simulation.audioSeconds}s</span>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={S.label}>Token</div>
                <div style={S.row}>
                  <span>System prompt</span>
                  <span style={S.val}>{simulation.tokens.systemPromptTokens} tokens ({simulation.tokens.systemPromptChars} chars)</span>
                </div>
                <div style={S.row}>
                  <span>Testo input</span>
                  <span style={S.val}>{simulation.tokens.inputTextTokens} tokens</span>
                </div>
                <div style={S.row}>
                  <span>Totale input</span>
                  <span style={{ ...S.val, fontSize: 14 }}>{simulation.tokens.totalInputTokens} tokens</span>
                </div>
                <div style={S.row}>
                  <span>Output stimato</span>
                  <span style={S.val}>{simulation.tokens.estimatedOutputTokens} tokens</span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={S.label}>Costi USD</div>
                <div style={S.row}>
                  <span>GPT-4o-mini input</span>
                  <span style={S.val}>${simulation.costs_usd.gptInput}</span>
                </div>
                <div style={S.row}>
                  <span>GPT-4o-mini output</span>
                  <span style={S.val}>${simulation.costs_usd.gptOutput}</span>
                </div>
                <div style={S.row}>
                  <span>Whisper STT</span>
                  <span style={S.val}>${simulation.costs_usd.whisper}</span>
                </div>
                <div style={S.row}>
                  <span>TTS-1</span>
                  <span style={S.val}>${simulation.costs_usd.tts}</span>
                </div>
                <div style={{ ...S.row, borderBottom: '2px solid rgba(245,87,108,0.3)' }}>
                  <span style={{ fontWeight: 700 }}>TOTALE USD</span>
                  <span style={{ ...S.val, fontSize: 15 }}>${simulation.costs_usd.total}</span>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={S.label}>Costi EUR (nostri crediti)</div>
                <div style={S.row}>
                  <span>Costo reale</span>
                  <span style={S.val}>{simulation.costs_eur.totalCents} cent</span>
                </div>
                <div style={S.row}>
                  <span>Minimo addebito</span>
                  <span style={S.warn}>{simulation.costs_eur.minCharge} cent</span>
                </div>
                <div style={{ ...S.row, background: 'rgba(245,87,108,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                  <span style={{ fontWeight: 700 }}>ADDEBITO EFFETTIVO</span>
                  <span style={{ color: '#f5576c', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>
                    {simulation.costs_eur.actualCharge} cent
                  </span>
                </div>
              </div>
            </div>

            {/* System Prompt Preview */}
            <div style={S.card}>
              <div style={S.label}>System Prompt Inviato a GPT</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
                background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 10, marginTop: 6,
                fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {simulation.tokens.systemPromptText}
              </div>
            </div>

            {/* Scenarios Table */}
            <div style={S.card}>
              <div style={S.label}>Scenari Tipici di Costo</div>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Scenario</th>
                      <th style={S.th}>Chars</th>
                      <th style={S.th}>Audio</th>
                      <th style={S.th}>Tokens</th>
                      <th style={S.th}>USD</th>
                      <th style={S.th}>Addebito</th>
                      <th style={S.th}>Msg/€2</th>
                      <th style={S.th}>Msg/€5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulation.scenarios.map((s, i) => (
                      <tr key={i}>
                        <td style={{ ...S.td, fontSize: 11, maxWidth: 120 }}>{s.name}</td>
                        <td style={S.td}>{s.chars}</td>
                        <td style={S.td}>{s.audioSec}s</td>
                        <td style={S.td}>{s.tokens.input}+{s.tokens.output}</td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#4ecdc4' }}>
                          ${s.costUsd}
                        </td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#f5576c', fontWeight: 600 }}>
                          {s.actualChargeCents}¢
                        </td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{s.msgsPerPack2}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{s.msgsPerPack5}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Package Estimates */}
            <div style={S.card}>
              <div style={S.label}>Stima Messaggi per Pacchetto (basata su questo messaggio)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {simulation.packages_estimate.map(p => (
                  <div key={p.id} style={{ flex: '1 1 45%', padding: '12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#f5576c' }}>
                      {'\u20AC'}{p.euros}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
                      {p.credits} cent crediti
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#4ecdc4' }}>
                      ~{p.messagesEstimate}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>messaggi</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Reference */}
            <div style={S.card}>
              <div style={S.label}>Prezzi OpenAI di Riferimento</div>
              <div style={S.row}>
                <span>GPT-4o-mini input</span>
                <span style={S.val}>{simulation.pricing_reference.gpt4oMini_input}</span>
              </div>
              <div style={S.row}>
                <span>GPT-4o-mini output</span>
                <span style={S.val}>{simulation.pricing_reference.gpt4oMini_output}</span>
              </div>
              <div style={S.row}>
                <span>Whisper STT</span>
                <span style={S.val}>{simulation.pricing_reference.whisper}</span>
              </div>
              <div style={S.row}>
                <span>TTS-1</span>
                <span style={S.val}>{simulation.pricing_reference.tts1}</span>
              </div>
              <div style={S.row}>
                <span>Cambio USD→EUR</span>
                <span style={S.val}>{simulation.pricing_reference.usdToEur}</span>
              </div>
            </div>

            {/* Issues Found */}
            <div style={{ ...S.card, borderColor: 'rgba(255,107,107,0.3)' }}>
              <div style={{ ...S.label, color: '#ff6b6b' }}>Note Tecniche</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={S.warn}>1.</span> Il costo TTS è <b>stimato</b> negli endpoint translate/process.
                  L{`'`}endpoint /api/tts non traccia costi né deduce crediti separatamente.
                  Il costo TTS è incluso nella stima pre-calcolata.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={S.warn}>2.</span> /api/tts usa <b>sempre</b> la key della piattaforma,
                  anche quando l{`'`}utente ha configurato la propria API key.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={S.warn}>3.</span> Il calcolo Whisper usa <code>buffer.length / 16000</code> come
                  stima della durata — potrebbe non essere accurato per tutti i codec.
                </div>
                <div>
                  <span style={S.good}>4.</span> I minimi di addebito (0.1¢ testo, 0.2¢ audio) proteggono
                  da messaggi molto brevi che costerebbero quasi zero.
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
          /debug — Pagina nascosta di test
        </div>
      </div>
    </div>
  );
}

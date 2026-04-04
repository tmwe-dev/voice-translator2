'use client';
import { memo, useState } from 'react';
import { FONT } from '../lib/constants.js';

/**
 * AIView — P4 Schermata 6: AI & Automazioni
 *
 * Central hub for AI-powered features:
 * - Quick suggestions based on recent conversations
 * - Glossary management (custom terms per language pair)
 * - Automation rules (auto-reply, auto-translate, triggers)
 * - Translation style preferences
 * - Interpreter mode shortcut
 */
const AIView = memo(function AIView({
  L, S, theme, setView,
  prefs = {},
  contacts = [],
  recentConversations = [],
}) {
  const [activeSection, setActiveSection] = useState(null);
  const [glossaryTerms, setGlossaryTerms] = useState([
    { from: 'Buongiorno', to: 'Good morning', note: 'formale' },
    { from: 'Grazie mille', to: 'Thank you very much', note: 'cortesia' },
  ]);
  const [newTermFrom, setNewTermFrom] = useState('');
  const [newTermTo, setNewTermTo] = useState('');
  const [automations, setAutomations] = useState([
    { id: 1, name: 'Auto-saluto', desc: 'Saluta automaticamente quando un partner si connette', enabled: true },
    { id: 2, name: 'Riepilogo automatico', desc: 'Genera un riepilogo AI al termine della conversazione', enabled: true },
    { id: 3, name: 'Correzione ortografica', desc: 'Correggi automaticamente errori prima di tradurre', enabled: false },
    { id: 4, name: 'Tono formale', desc: 'Adatta le traduzioni a un registro formale', enabled: false },
  ]);

  const quickActions = [
    { icon: '🎙️', label: 'Interprete', desc: 'Modalità interpretazione real-time', action: () => setView('home'), color: S.colors.accent1 },
    { icon: '📖', label: 'Glossario', desc: 'Gestisci termini personalizzati', action: () => setActiveSection(activeSection === 'glossary' ? null : 'glossary'), color: S.colors.accent2 },
    { icon: '⚡', label: 'Automazioni', desc: 'Regole AI automatiche', action: () => setActiveSection(activeSection === 'automations' ? null : 'automations'), color: S.colors.statusWarning },
    { icon: '🎨', label: 'Stile', desc: 'Preferenze di traduzione', action: () => setActiveSection(activeSection === 'style' ? null : 'style'), color: S.colors.accent4 },
  ];

  const translationStyles = [
    { id: 'natural', label: 'Naturale', desc: 'Fluente e idiomatico', icon: '🌊' },
    { id: 'literal', label: 'Letterale', desc: 'Fedele al testo originale', icon: '📐' },
    { id: 'formal', label: 'Formale', desc: 'Registro professionale', icon: '👔' },
    { id: 'casual', label: 'Informale', desc: 'Conversazione casual', icon: '😊' },
    { id: 'technical', label: 'Tecnico', desc: 'Terminologia specialistica', icon: '⚙️' },
  ];

  const [selectedStyle, setSelectedStyle] = useState('natural');

  const toggleAutomation = (id) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const addGlossaryTerm = () => {
    if (!newTermFrom.trim() || !newTermTo.trim()) return;
    setGlossaryTerms(prev => [...prev, { from: newTermFrom.trim(), to: newTermTo.trim(), note: '' }]);
    setNewTermFrom('');
    setNewTermTo('');
  };

  return (
    <div style={{
      ...S.page, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16,
      minHeight: '100vh', boxSizing: 'border-box', overflowY: 'auto', paddingBottom: 100,
    }}>
      {/* Header */}
      <div style={{ marginTop: 8 }}>
        <h2 style={{
          color: S.colors.textPrimary, fontSize: 22, fontWeight: 800, margin: 0,
          background: S.colors.accentGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          ✨ AI & Automazioni
        </h2>
        <p style={{ color: S.colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Potenzia le traduzioni con intelligenza artificiale
        </p>
      </div>

      {/* Quick Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {quickActions.map((qa, i) => (
          <button key={i} onClick={qa.action}
            style={{
              display: 'flex', flexDirection: 'column', gap: 8, padding: 16,
              borderRadius: 18, cursor: 'pointer', textAlign: 'left',
              background: activeSection === ['glossary', 'automations', 'style'][i - 1]
                ? `${qa.color}15` : S.colors.cardBg,
              border: `1px solid ${activeSection === ['glossary', 'automations', 'style'][i - 1]
                ? `${qa.color}40` : S.colors.cardBorder}`,
              transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
            }}>
            <span style={{ fontSize: 28 }}>{qa.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.colors.textPrimary }}>{qa.label}</div>
              <div style={{ fontSize: 11, color: S.colors.textMuted, marginTop: 2 }}>{qa.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Glossary Section */}
      {activeSection === 'glossary' && (
        <div style={{
          padding: 16, borderRadius: 18,
          background: S.colors.cardBg, border: `1px solid ${S.colors.accent2Border}`,
          animation: 'vtSlideUp 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>📖</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.colors.textPrimary }}>Glossario Personale</span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, padding: '3px 8px', borderRadius: 8,
              background: S.colors.accent2Bg, color: S.colors.accent2, fontWeight: 600,
            }}>
              {glossaryTerms.length} termini
            </span>
          </div>

          {/* Add new term */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input placeholder="Termine originale" value={newTermFrom}
              onChange={e => setNewTermFrom(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                background: S.colors.inputBg, border: `1px solid ${S.colors.inputBorder}`,
                color: S.colors.textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none',
              }} />
            <input placeholder="Traduzione" value={newTermTo}
              onChange={e => setNewTermTo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addGlossaryTerm(); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                background: S.colors.inputBg, border: `1px solid ${S.colors.inputBorder}`,
                color: S.colors.textPrimary, fontSize: 13, fontFamily: FONT, outline: 'none',
              }} />
            <button onClick={addGlossaryTerm}
              style={{
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: S.colors.btnGradient, color: '#fff', fontSize: 16, fontWeight: 700,
              }}>
              +
            </button>
          </div>

          {/* Terms list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {glossaryTerms.map((term, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 12, background: S.colors.overlayBg,
                border: `1px solid ${S.colors.overlayBorder}`,
              }}>
                <span style={{ fontSize: 13, color: S.colors.textPrimary, fontWeight: 600, flex: 1 }}>{term.from}</span>
                <span style={{ color: S.colors.textMuted, fontSize: 14 }}>→</span>
                <span style={{ fontSize: 13, color: S.colors.accent2, fontWeight: 600, flex: 1 }}>{term.to}</span>
                <button onClick={() => setGlossaryTerms(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: S.colors.textMuted, fontSize: 16, padding: '0 4px',
                  }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automations Section */}
      {activeSection === 'automations' && (
        <div style={{
          padding: 16, borderRadius: 18,
          background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
          animation: 'vtSlideUp 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.colors.textPrimary }}>Automazioni AI</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {automations.map(auto => (
              <div key={auto.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 14, background: S.colors.overlayBg,
                border: `1px solid ${auto.enabled ? S.colors.accent4Border : S.colors.overlayBorder}`,
                transition: 'all 0.2s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.colors.textPrimary }}>{auto.name}</div>
                  <div style={{ fontSize: 11, color: S.colors.textMuted, marginTop: 2 }}>{auto.desc}</div>
                </div>
                <button onClick={() => toggleAutomation(auto.id)}
                  style={{
                    width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: auto.enabled ? S.colors.accent4 : S.colors.toggleOff,
                    position: 'relative', transition: 'background 0.3s',
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: auto.enabled ? 23 : 3,
                    transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Translation Style Section */}
      {activeSection === 'style' && (
        <div style={{
          padding: 16, borderRadius: 18,
          background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
          animation: 'vtSlideUp 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🎨</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.colors.textPrimary }}>Stile di Traduzione</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {translationStyles.map(style => (
              <button key={style.id} onClick={() => setSelectedStyle(style.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                  background: selectedStyle === style.id ? S.colors.accent1Bg : S.colors.overlayBg,
                  border: `1px solid ${selectedStyle === style.id ? S.colors.accent1Border : S.colors.overlayBorder}`,
                  transition: 'all 0.2s',
                }}>
                <span style={{ fontSize: 22 }}>{style.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.colors.textPrimary }}>{style.label}</div>
                  <div style={{ fontSize: 11, color: S.colors.textMuted, marginTop: 1 }}>{style.desc}</div>
                </div>
                {selectedStyle === style.id && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: S.colors.btnGradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>✓</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Tips */}
      <div style={{
        padding: 14, borderRadius: 16,
        background: `linear-gradient(135deg, ${S.colors.accent1}08, ${S.colors.accent2}08)`,
        border: `1px solid ${S.colors.accent1Border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: S.colors.accent1 }}>Suggerimento AI</span>
        </div>
        <p style={{ color: S.colors.textSecondary, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Attiva il glossario personale per migliorare la precisione delle traduzioni nei tuoi contesti d'uso più frequenti.
          L'AI imparerà dalle tue correzioni.
        </p>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes vtSlideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
});

export default AIView;

'use client';
import { memo, useState, useMemo } from 'react';
import { getLang, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';

/**
 * DetailView — P4 Schermata 5: Conversation Command Center
 *
 * Shows a detailed view of a past conversation with:
 * - Conversation metadata (participants, duration, mode)
 * - Full message history with translations
 * - AI-generated summary
 * - Export, share, and delete actions
 * - Quick-resume: rejoin the same room
 */
const DetailView = memo(function DetailView({
  L, S, theme,
  conversation = {},
  messages = [],
  onBack,
  onResume, onExport, onDelete, onShare,
  onPlayMessage,
  playingMsgId,
  prefs = {},
}) {
  const [activeTab, setActiveTab] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');

  const partner = conversation.members?.find(m => m.name !== prefs.name);
  const partnerLang = getLang(partner?.lang || conversation.otherLang || 'en');
  const myLangInfo = getLang(conversation.myLang || prefs.lang || 'it');
  const duration = conversation.duration
    ? `${Math.floor(conversation.duration / 60)}m ${conversation.duration % 60}s`
    : conversation.messageCount
      ? `${conversation.messageCount} messaggi`
      : '--';

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m =>
      (m.original || '').toLowerCase().includes(q) ||
      (m.translated || '').toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const tabs = [
    { id: 'messages', label: 'Messaggi', icon: '💬' },
    { id: 'summary', label: 'Riepilogo', icon: '📝' },
    { id: 'stats', label: 'Statistiche', icon: '📊' },
  ];

  return (
    <div style={{
      ...S.page, display: 'flex', flexDirection: 'column',
      minHeight: '100vh', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${S.colors.overlayBorder}`,
        background: S.colors.headerBg, backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onBack}
          style={{
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
            color: S.colors.textPrimary, fontSize: 16,
          }}>
          ←
        </button>
        <AvatarImg src={partner?.avatar} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ color: S.colors.textPrimary, fontSize: 16, fontWeight: 700 }}>
            {partner?.name || conversation.partnerName || 'Conversazione'}
          </div>
          <div style={{ color: S.colors.textMuted, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{myLangInfo.flag} ⇄ {partnerLang.flag}</span>
            <span>•</span>
            <span>{duration}</span>
          </div>
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          {onResume && (
            <button onClick={onResume}
              style={{
                padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: S.colors.btnGradient, color: '#fff', fontSize: 12, fontWeight: 700,
                boxShadow: S.colors.btnGlow,
              }}>
              ▶ Riprendi
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10, overflowX: 'auto' }}>
        {[
          { label: 'Modalità', value: conversation.mode || 'Conversazione', icon: '🎯' },
          { label: 'Contesto', value: conversation.context || 'Generale', icon: '🌍' },
          { label: 'Messaggi', value: String(messages.length || conversation.messageCount || 0), icon: '💬' },
          { label: 'Costo', value: conversation.totalCost ? `€${conversation.totalCost.toFixed(4)}` : 'Free', icon: '💰' },
        ].map((card, i) => (
          <div key={i} style={{
            flexShrink: 0, padding: '10px 14px', borderRadius: 14,
            background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
            minWidth: 90, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{card.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.colors.textPrimary }}>{card.value}</div>
            <div style={{ fontSize: 10, color: S.colors.textMuted, marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 16px',
        borderBottom: `1px solid ${S.colors.overlayBorder}`,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? S.colors.accent1 : S.colors.textMuted,
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              borderBottom: activeTab === tab.id ? `2px solid ${S.colors.accent1}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {activeTab === 'messages' && (
          <>
            {/* Search */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 12, padding: '8px 12px',
              borderRadius: 12, background: S.colors.inputBg, border: `1px solid ${S.colors.inputBorder}`,
            }}>
              <span style={{ color: S.colors.textMuted }}>🔍</span>
              <input
                placeholder="Cerca nei messaggi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: S.colors.textPrimary, fontSize: 13, fontFamily: FONT,
                }}
              />
            </div>
            {/* Messages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredMessages.map((m, i) => {
                const isMine = m.sender === (prefs.name || conversation.myName);
                return (
                  <div key={m.id || i} style={{
                    display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                  }}>
                    <AvatarImg src={isMine ? prefs.avatar : partner?.avatar} size={28} />
                    <div style={{
                      maxWidth: '75%', padding: '10px 14px', borderRadius: 16,
                      background: isMine ? S.colors.accent1Bg : S.colors.cardBg,
                      border: `1px solid ${isMine ? S.colors.accent1Border : S.colors.cardBorder}`,
                    }}>
                      <div style={{ fontSize: 14, color: S.colors.textPrimary, lineHeight: 1.5 }}>
                        {m.original}
                      </div>
                      {m.translated && (
                        <div style={{
                          fontSize: 12, color: S.colors.textSecondary, marginTop: 6,
                          paddingTop: 6, borderTop: `1px solid ${S.colors.dividerColor}`,
                          lineHeight: 1.4,
                        }}>
                          {m.translated}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, color: S.colors.textMuted }}>
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {onPlayMessage && m.translated && (
                          <button onClick={() => onPlayMessage(m)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                              color: playingMsgId === m.id ? S.colors.accent1 : S.colors.textMuted, fontSize: 14,
                            }}>
                            {playingMsgId === m.id ? '🔊' : '▶'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: S.colors.textMuted, fontSize: 13 }}>
                  {searchQuery ? 'Nessun messaggio trovato' : 'Nessun messaggio in questa conversazione'}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'summary' && (
          <div style={{
            padding: 16, borderRadius: 16,
            background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>✨</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: S.colors.textPrimary }}>
                Riepilogo AI
              </span>
            </div>
            <p style={{
              color: S.colors.textSecondary, fontSize: 14, lineHeight: 1.7, margin: 0,
            }}>
              {conversation.summary || `Conversazione con ${partner?.name || 'partner'} in modalità ${conversation.mode || 'conversazione'}. Scambiati ${messages.length} messaggi tra ${myLangInfo.name} e ${partnerLang.name}.`}
            </p>
          </div>
        )}

        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Messaggi inviati', value: messages.filter(m => m.sender === prefs.name).length, icon: '📤' },
              { label: 'Messaggi ricevuti', value: messages.filter(m => m.sender !== prefs.name).length, icon: '📥' },
              { label: 'Lingue', value: `${myLangInfo.name} ⇄ ${partnerLang.name}`, icon: '🌐' },
              { label: 'Durata', value: duration, icon: '⏱️' },
              { label: 'Costo traduzione', value: conversation.totalCost ? `€${conversation.totalCost.toFixed(4)}` : 'Gratuito', icon: '💰' },
              { label: 'Contesto', value: conversation.context || 'Generale', icon: '🎯' },
            ].map((stat, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 14, background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
              }}>
                <span style={{ fontSize: 20 }}>{stat.icon}</span>
                <span style={{ flex: 1, color: S.colors.textSecondary, fontSize: 13 }}>{stat.label}</span>
                <span style={{ color: S.colors.textPrimary, fontSize: 14, fontWeight: 700 }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{
        padding: '12px 16px', display: 'flex', gap: 10,
        borderTop: `1px solid ${S.colors.overlayBorder}`,
        background: S.colors.headerBg, backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onExport}
          style={{
            flex: 1, padding: '12px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            color: S.colors.textPrimary, fontSize: 13, fontWeight: 600,
          }}>
          📋 Esporta
        </button>
        <button onClick={onShare}
          style={{
            flex: 1, padding: '12px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.accent2Bg, border: `1px solid ${S.colors.accent2Border}`,
            color: S.colors.accent2, fontSize: 13, fontWeight: 600,
          }}>
          🔗 Condividi
        </button>
        <button onClick={onDelete}
          style={{
            padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            background: S.colors.accent3Bg, border: `1px solid ${S.colors.accent3Border}`,
            color: S.colors.statusError, fontSize: 13, fontWeight: 600,
          }}>
          🗑️
        </button>
      </div>
    </div>
  );
});

export default DetailView;

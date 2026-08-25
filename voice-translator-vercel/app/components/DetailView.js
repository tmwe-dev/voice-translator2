'use client';
import { memo, useState, useMemo } from 'react';
import { getLang, FONT } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import { IconPlay, IconVolume, IconBack, IconExport } from './Icons.js';  // b.404 — l'icona vera, non la lettera
import { useApp } from '../contexts/AppContext.js';

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
  conversation = {},
  messages = [],
  onBack,
  onResume, onExport, onDelete, onShare,
  onPlayMessage,
  playingMsgId,
}) {
  const { L, S, theme, prefs, uiLang } = useApp();
  const [activeTab, setActiveTab] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');

  const partner = conversation.members?.find(m => m.name !== prefs.name);
  const partnerLang = getLang(partner?.lang || conversation.otherLang || 'en');
  const myLangInfo = getLang(conversation.myLang || prefs.lang || 'it');
  const duration = conversation.duration
    ? `${Math.floor(conversation.duration / 60)}m ${conversation.duration % 60}s`
    : conversation.messageCount
      ? `${conversation.messageCount} ${L('messages')}`
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
    // b.138 — schede, etichette e riepilogo erano in italiano fisso.
    { id: 'messages', label: L('tabMessages') },
    { id: 'summary', label: L('tabSummary') },
    { id: 'stats', label: L('tabStats') },
  ];

  return (
    <div style={{
      ...S.page, display: 'flex', flexDirection: 'column',
      minHeight: '100vh', boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${S.colors.overlayBorder}`,
        background: S.colors.headerBg, backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onBack}
          style={{
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            borderRadius: 12, minWidth: 44, minHeight: 44, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: S.colors.textPrimary,
          }}>
          <IconBack size={18} />
        </button>
        <AvatarImg src={partner?.avatar} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ color: S.colors.textPrimary, fontSize: 16, fontWeight: 600 }}>
            {partner?.name || conversation.partnerName || L('conversation')}
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
                ...S.btn, width: 'auto', minHeight: 44, padding: '0 14px',
                borderRadius: 12, fontSize: 12, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <IconPlay size={12} />
              {L('lifeResumeWord')}
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, overflowX: 'auto' }}>
        {[
          { label: L('mode'), value: conversation.mode || L('conversation') },
          { label: L('context'), value: conversation.context || L('ctxGeneral') },
          { label: L('tabMessages'), value: String(messages.length || conversation.messageCount || 0) },
          { label: L('costWord'), value: conversation.totalCost ? `€${conversation.totalCost.toFixed(4)}` : L('freeWord') },
        ].map((card, i) => (
          <div key={i} style={{
            flexShrink: 0, padding: '10px 14px', borderRadius: 14,
            background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
            minWidth: 90, textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: S.colors.textPrimary }}>{card.value}</div>
            <div style={{ fontSize: 10, color: S.colors.textMuted, marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 20px',
        borderBottom: `1px solid ${S.colors.overlayBorder}`,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, minHeight: 44, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? S.colors.accent1 : S.colors.textMuted,
              fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 500,
              borderBottom: activeTab === tab.id ? `2px solid ${S.colors.accent1}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        {activeTab === 'messages' && (
          <>
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              padding: '8px 12px', minHeight: 44,
              borderRadius: 12, background: S.colors.inputBg, border: `1px solid ${S.colors.inputBorder}`,
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                style={{ color: S.colors.textMuted, flexShrink: 0 }}>
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                placeholder={L('searchInMessages')}
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
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString(uiLang, { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {onPlayMessage && m.translated && (
                          <button onClick={() => onPlayMessage(m)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                              color: playingMsgId === m.id ? S.colors.accent1 : S.colors.textMuted, fontSize: 14,
                            }}>
                            {/* b.404 — l'icona del sistema, non una lettera */}
                            {playingMsgId === m.id ? <IconVolume size={16}/> : <IconPlay size={16}/>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: S.colors.textMuted, fontSize: 13 }}>
                  {searchQuery ? L('noMessageFound') : L('noMessagesInConv')}
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
              <span style={{ fontSize: 14, fontWeight: 600, color: S.colors.textPrimary }}>
                {L('aiSummary')}
              </span>
            </div>
            <p style={{
              color: S.colors.textSecondary, fontSize: 14, lineHeight: 1.7, margin: 0,
            }}>
              {conversation.summary || L('detailSummaryFallback')
                .replace('{partner}', partner?.name || 'partner')
                .replace('{mode}', conversation.mode || L('conversation'))
                .replace('{n}', String(messages.length))
                .replace('{a}', myLangInfo.name)
                .replace('{b}', partnerLang.name)}
            </p>
          </div>
        )}

        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: L('statsSent'), value: messages.filter(m => m.sender === prefs.name).length },
              { label: L('statsReceived'), value: messages.filter(m => m.sender !== prefs.name).length },
              { label: L('languagesWord'), value: `${myLangInfo.name} ⇄ ${partnerLang.name}` },
              { label: L('durationWord'), value: duration },
              { label: L('translationCost'), value: conversation.totalCost ? `€${conversation.totalCost.toFixed(4)}` : L('freeWord') },
              { label: L('context'), value: conversation.context || L('ctxGeneral') },
            ].map((stat, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderRadius: 14, background: S.colors.cardBg, border: `1px solid ${S.colors.cardBorder}`,
              }}>
                <span style={{ flex: 1, color: S.colors.textSecondary, fontSize: 13, fontWeight: 500 }}>{stat.label}</span>
                <span style={{ color: S.colors.textPrimary, fontSize: 14, fontWeight: 600 }}>{stat.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{
        padding: '12px 20px', display: 'flex', gap: 10,
        borderTop: `1px solid ${S.colors.overlayBorder}`,
        background: S.colors.headerBg, backdropFilter: 'blur(20px)',
      }}>
        <button onClick={onExport}
          style={{
            flex: 1, minHeight: 44, padding: '12px', borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: S.colors.overlayBg, border: `1px solid ${S.colors.overlayBorder}`,
            color: S.colors.textPrimary, fontSize: 13, fontWeight: 600,
          }}>
          <IconExport size={15} />
          {L('exportConversation')}
        </button>
        <button onClick={onShare}
          style={{
            flex: 1, minHeight: 44, padding: '12px', borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: S.colors.accent2Bg, border: `1px solid ${S.colors.accent2Border}`,
            color: S.colors.accent2, fontSize: 13, fontWeight: 600,
          }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4" /><path d="M15.4 6.5l-6.8 4" />
          </svg>
          {L('shareWord')}
        </button>
        <button onClick={onDelete}
          style={{
            minWidth: 44, minHeight: 44, padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: S.colors.accent3Bg, border: `1px solid ${S.colors.accent3Border}`,
            color: S.colors.statusError, fontSize: 13, fontWeight: 600,
          }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4h8v2" />
            <path d="M6 6l1 14h10l1-14" /><path d="M10 11v6" /><path d="M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default DetailView;

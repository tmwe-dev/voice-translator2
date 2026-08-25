'use client';
import { useApp } from '../contexts/AppContext.js';
import { IconLoader } from './Icons.js';
import { membriDi } from '../lib/membri.js';

export default function SummaryView({ currentConv, summaryLoading, shareSummary,
  setCurrentConv, verifiedName }) {
  const { L, S, prefs, setView, status, theme, setTheme, uiLang } = useApp();
  if (!currentConv) return null;
  const s = currentConv.summary;
  const isHost = currentConv.host === (verifiedName || prefs.name);
  const colors = S.colors;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={{...S.backBtn, width:44, height:44}} onClick={() => { setCurrentConv(null); setView('history'); }}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('reportWord')}</span>
        </div>

        {summaryLoading ? (
          <div style={{textAlign:'center', marginTop:40}}>
            <div style={{marginBottom:8, color:colors.textMuted}}><IconLoader size={24} /></div>
            <div style={{color:colors.textMuted, fontSize:13}}>{L('aiReportLoading')}</div>
          </div>
        ) : s ? (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:18, fontWeight:600, marginBottom:8, color:colors.textPrimary,
              lineHeight:1.3}}>{s.title || L('reportWord')}</div>

            {s.topics?.length > 0 && (
              <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                {s.topics.map((topic,i) => (
                  <span key={i} style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:colors.accent3Bg, color:colors.accent3, textTransform:'uppercase',
                    letterSpacing:0.5}}>{topic}</span>
                ))}
                {s.sentiment && (
                  <span style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:colors.accent2Bg, color:colors.accent2, letterSpacing:0.5}}>
                    {s.sentiment}
                  </span>
                )}
              </div>
            )}

            <div style={{fontSize:13, color:colors.textSecondary, lineHeight:1.6, marginBottom:16}}>
              {s.summary}
            </div>

            {s.keyPoints?.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{...S.label, marginBottom:8}}>{L('keyPointsLabel')}</div>
                {s.keyPoints.map((p,i) => (
                  <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13,
                    color:colors.textSecondary, lineHeight:1.5}}>
                    <span style={{color:colors.accent3, flexShrink:0}}>{'•'}</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0',
              borderTop:`1px solid ${colors.dividerColor}`, fontSize:11, color:colors.textMuted}}>
              <span>{s.participants || membriDi(currentConv).map(m => m.name).join(' & ')}</span>
              <span>{s.duration || ''} | {s.messageCount || currentConv.msgCount} msg</span>
            </div>

            {isHost && (
              <button style={{...S.btn, marginTop:12, minHeight:44}} onClick={shareSummary}>
                {L('shareReport')}
              </button>
            )}
          </div>
        ) : (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12, color:colors.textSecondary}}>
              {L('savedConversation')}
            </div>
            <div style={{fontSize:13, color:colors.textTertiary, marginBottom:8}}>
              {membriDi(currentConv).map(m => m.name).join(' & ')} - {currentConv.msgCount} {L('messages')}
            </div>
            <div style={{fontSize:11, color:colors.textMuted}}>
              {currentConv.created ? new Date(currentConv.created).toLocaleString(uiLang) : ''}
            </div>
          </div>
        )}

        {/* Message transcript */}
        {currentConv.messages?.length > 0 && (
          <div style={{width:'100%', maxWidth:380, marginTop:12}}>
            <div style={{...S.label, marginBottom:8}}>{L('transcript')}</div>
            <div style={{background:colors.overlayBg, borderRadius:16, padding:'12px 14px',
              border:`1px solid ${colors.overlayBorder}`, maxHeight:300, overflowY:'auto'}}>
              {currentConv.messages.map((m,i) => (
                <div key={i} style={{marginBottom:10, paddingBottom:10,
                  borderBottom:i < currentConv.messages.length-1 ? `1px solid ${colors.dividerColor}` : 'none'}}>
                  <div style={{fontSize:10, color:colors.textMuted, marginBottom:2}}>
                    {m.sender}
                  </div>
                  <div style={{fontSize:13, color:colors.textSecondary, lineHeight:1.5}}>
                    {m.original}
                  </div>
                  <div style={{fontSize:12, color:colors.textTertiary, marginTop:2, lineHeight:1.4}}>
                    {m.translated}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentConv.messages?.length > 0 && (
          <button style={{...S.btn, marginTop:12, width:'100%', maxWidth:380, minHeight:44}} onClick={() => setView('detail')}>
            {L('viewMessages')}
          </button>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}

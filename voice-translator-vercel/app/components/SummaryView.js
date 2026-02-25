'use client';

export default function SummaryView({ L, S, prefs, currentConv, summaryLoading, shareSummary,
  setCurrentConv, setView, status, theme, setTheme }) {
  if (!currentConv) return null;
  const s = currentConv.summary;
  const isHost = currentConv.host === prefs.name;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => { setCurrentConv(null); setView('home'); }}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>Report</span>
        </div>

        {summaryLoading ? (
          <div style={{textAlign:'center', marginTop:40}}>
            <div style={{fontSize:24, marginBottom:8}}>...</div>
            <div style={{color:'rgba(255,255,255,0.4)', fontSize:13}}>AI Report...</div>
          </div>
        ) : s ? (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:18, fontWeight:700, marginBottom:8, color:'rgba(255,255,255,0.95)',
              lineHeight:1.3}}>{s.title || 'Report'}</div>

            {s.topics?.length > 0 && (
              <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:12}}>
                {s.topics.map((topic,i) => (
                  <span key={i} style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:'rgba(245,87,108,0.12)', color:'#f5576c', textTransform:'uppercase',
                    letterSpacing:0.5}}>{topic}</span>
                ))}
                {s.sentiment && (
                  <span style={{padding:'3px 10px', borderRadius:12, fontSize:10, fontWeight:600,
                    background:'rgba(78,205,196,0.12)', color:'#4ecdc4', letterSpacing:0.5}}>
                    {s.sentiment}
                  </span>
                )}
              </div>
            )}

            <div style={{fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:16}}>
              {s.summary}
            </div>

            {s.keyPoints?.length > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{...S.label, marginBottom:8}}>Key Points</div>
                {s.keyPoints.map((p,i) => (
                  <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13,
                    color:'rgba(255,255,255,0.65)', lineHeight:1.5}}>
                    <span style={{color:'#f5576c', flexShrink:0}}>{'•'}</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-between', padding:'10px 0',
              borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:11, color:'rgba(255,255,255,0.35)'}}>
              <span>{s.participants || currentConv.members?.map(m => m.name).join(' & ')}</span>
              <span>{s.duration || ''} | {s.messageCount || currentConv.msgCount} msg</span>
            </div>

            {isHost && (
              <button style={{...S.btn, marginTop:12}} onClick={shareSummary}>
                {L('shareReport')}
              </button>
            )}
          </div>
        ) : (
          <div style={{...S.card, width:'100%', maxWidth:380}}>
            <div style={{fontSize:15, fontWeight:600, marginBottom:12, color:'rgba(255,255,255,0.8)'}}>
              {L('savedConversation')}
            </div>
            <div style={{fontSize:13, color:'rgba(255,255,255,0.5)', marginBottom:8}}>
              {currentConv.members?.map(m => m.name).join(' & ')} - {currentConv.msgCount} {L('messages')}
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.35)'}}>
              {currentConv.created ? new Date(currentConv.created).toLocaleString('it-IT') : ''}
            </div>
          </div>
        )}

        {/* Message transcript */}
        {currentConv.messages?.length > 0 && (
          <div style={{width:'100%', maxWidth:380, marginTop:12}}>
            <div style={{...S.label, marginBottom:8}}>{L('transcript')}</div>
            <div style={{background:'rgba(255,255,255,0.03)', borderRadius:16, padding:'12px 14px',
              border:'1px solid rgba(255,255,255,0.06)', maxHeight:300, overflowY:'auto'}}>
              {currentConv.messages.map((m,i) => (
                <div key={i} style={{marginBottom:10, paddingBottom:10,
                  borderBottom:i < currentConv.messages.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none'}}>
                  <div style={{fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:2}}>
                    {m.sender}
                  </div>
                  <div style={{fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.5}}>
                    {m.original}
                  </div>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:2, lineHeight:1.4}}>
                    {m.translated}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}

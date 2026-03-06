'use client';
import { FONT } from '../lib/constants.js';

export default function HistoryView({ L, S, prefs, convHistory, viewConversation, setView, status, theme, setTheme, verifiedName }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('history')}</span>
        </div>
        {convHistory.length === 0 ? (
          <div style={{color:S.colors.textTertiary, fontSize:14, textAlign:'center', marginTop:40}}>
            {L('noHistory')}
          </div>
        ) : (
          <div style={{width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:8}}>
            {convHistory.map((c, i) => (
              <button key={c.id + i} onClick={() => viewConversation(c.id)}
                style={{width:'100%', padding:'14px 16px', borderRadius:16,
                  background:S.colors.overlayBg, border:`1px solid ${S.colors.overlayBorder}`,
                  color:S.colors.textPrimary, textAlign:'left', cursor:'pointer', fontFamily:FONT,
                  backdropFilter:'blur(8px)', WebkitTapHighlightColor:'transparent'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                  <span style={{fontWeight:600, fontSize:14}}>{c.members?.join(' & ') || 'Conversazione'}</span>
                  <span style={{fontSize:10, color:S.colors.textTertiary}}>
                    {c.msgCount || 0} msg
                  </span>
                </div>
                <div style={{fontSize:11, color:S.colors.textMuted}}>
                  {c.created ? new Date(c.created).toLocaleDateString('it-IT', {
                    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
                  }) : ''}
                  {c.host === (verifiedName || prefs.name) && <span style={{color:S.colors.accent3, marginLeft:6}}>Host</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}

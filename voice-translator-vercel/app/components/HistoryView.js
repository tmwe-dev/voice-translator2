'use client';
import { FONT } from '../lib/constants.js';

export default function HistoryView({ L, S, prefs, convHistory, viewConversation, setView, status, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('history')}</span>
        </div>
        {convHistory.length === 0 ? (
          <div style={{color:'rgba(255,255,255,0.3)', fontSize:14, textAlign:'center', marginTop:40}}>
            {L('noHistory')}
          </div>
        ) : (
          <div style={{width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:8}}>
            {convHistory.map((c, i) => (
              <button key={c.id + i} onClick={() => viewConversation(c.id)}
                style={{width:'100%', padding:'14px 16px', borderRadius:16,
                  background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                  color:'#fff', textAlign:'left', cursor:'pointer', fontFamily:FONT,
                  backdropFilter:'blur(8px)', WebkitTapHighlightColor:'transparent'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                  <span style={{fontWeight:600, fontSize:14}}>{c.members?.join(' & ') || 'Conversazione'}</span>
                  <span style={{fontSize:10, color:'rgba(255,255,255,0.3)'}}>
                    {c.msgCount || 0} msg
                  </span>
                </div>
                <div style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>
                  {c.created ? new Date(c.created).toLocaleDateString('it-IT', {
                    day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
                  }) : ''}
                  {c.host === prefs.name && <span style={{color:'#f5576c', marginLeft:6}}>Host</span>}
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

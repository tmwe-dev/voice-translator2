'use client';
import { CREDIT_PACKAGES, FONT, formatCredits } from '../lib/constants.js';

export default function CreditsView({ L, S, creditBalance, buyCredits, authLoading, userAccount, setView, status, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView(userAccount ? 'home' : 'account')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('rechargeCredits')}</span>
        </div>

        {creditBalance > 0 && (
          <div style={{width:'100%', maxWidth:380, marginBottom:16, padding:'14px 18px', borderRadius:18,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)',
            textAlign:'center'}}>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4}}>{L('currentBalance')}</div>
            <div style={{fontSize:28, fontWeight:700, color:'#4facfe'}}>{formatCredits(creditBalance)}</div>
          </div>
        )}

        <div style={{width:'100%', maxWidth:380}}>
          {CREDIT_PACKAGES.map(pkg => (
            <button key={pkg.id} onClick={() => buyCredits(pkg.id)}
              style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                padding: pkg.starter ? '18px 18px' : '16px 18px', marginBottom:10, borderRadius:18,
                background: pkg.starter ? 'linear-gradient(135deg, rgba(79,172,254,0.15), rgba(78,205,196,0.15))' : 'rgba(255,255,255,0.06)',
                border: pkg.starter ? '2px solid rgba(79,172,254,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color:'#fff', cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                transition:'all 0.15s', position:'relative'}}>
              {pkg.starter && (
                <div style={{position:'absolute', top:-10, left:16, padding:'2px 10px', borderRadius:8,
                  background:'linear-gradient(135deg, #4facfe, #4ecdc4)', color:'#fff',
                  fontSize:10, fontWeight:700, letterSpacing:0.5, textTransform:'uppercase'}}>
                  {L('starterPack')}
                </div>
              )}
              <div style={{textAlign:'left'}}>
                <div style={{fontSize:22, fontWeight:700}}>{pkg.label}</div>
                <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:2}}>
                  {pkg.starter ? L('starterPackDesc') : pkg.messages}
                </div>
              </div>
              {pkg.bonus && (
                <div style={{padding:'4px 10px', borderRadius:10, background:'rgba(79,172,254,0.15)',
                  color:'#4facfe', fontSize:12, fontWeight:600}}>
                  {pkg.bonus}
                </div>
              )}
              {pkg.starter && (
                <div style={{padding:'6px 14px', borderRadius:10,
                  background:'linear-gradient(135deg, #4facfe, #4ecdc4)',
                  color:'#fff', fontSize:12, fontWeight:700}}>
                  {L('tryNow')}
                </div>
              )}
            </button>
          ))}
        </div>

        <div style={{width:'100%', maxWidth:380, marginTop:12, padding:'12px 16px', borderRadius:14,
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', lineHeight:1.6}}>
            {'💳'} {L('securePayment')}
          </div>
        </div>

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}
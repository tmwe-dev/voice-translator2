'use client';
import { FONT } from '../lib/constants.js';

export default function AccountView({ L, S, authStep, authEmail, setAuthEmail, authCode, setAuthCode,
  authLoading, authTestCode, sendAuthCode, verifyAuthCodeFn, setAuthStep, setView, status, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={{fontSize:42, marginBottom:8}}>{authStep === 'choose' ? '\u2705' : '\u{1F512}'}</div>
        <div style={S.title}>{L('account')}</div>
        <div style={S.sub}>{authStep === 'choose' ? L('accessDone') : L('accessToCreate')}</div>

        {authStep === 'email' && (
          <div style={S.card}>
            <div style={S.cardTitle}>{L('loginToAccount')}</div>
            <div style={S.field}>
              <div style={S.label}>{L('email')}</div>
              <input style={S.input} type="email" placeholder="your@email.com" value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAuthCode()} />
            </div>
            <button style={{...S.btn, marginTop:8, opacity:authLoading?0.5:1}}
              disabled={authLoading} onClick={sendAuthCode}>
              {authLoading ? L('sending') : L('sendAccessCode')}
            </button>
            <div style={{display:'flex', alignItems:'center', gap:12, margin:'16px 0'}}>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
              <div style={{fontSize:11, color:'rgba(255,255,255,0.25)'}}>{L('or')}</div>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.08)'}} />
            </div>
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent', marginBottom:8}}
              onClick={() => {}}>
              <span style={{fontSize:18}}>G</span>
              <span>{L('loginGoogle')}</span>
            </button>
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.1)',
              background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => {}}>
              <span style={{fontSize:18}}>{'\uF8FF'}</span>
              <span>{L('loginApple')}</span>
            </button>
            <div style={{fontSize:10, color:'rgba(255,255,255,0.2)', textAlign:'center', marginTop:12}}>
              {L('noPasswordRequired')}
            </div>
          </div>
        )}

        {authStep === 'code' && (
          <div style={S.card}>
            <div style={S.cardTitle}>{L('enterCode')}</div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.4)', textAlign:'center', marginBottom:12}}>
              {L('sentTo')} {authEmail}
            </div>
            {authTestCode && (
              <div style={{fontSize:13, color:'#f5576c', textAlign:'center', marginBottom:12,
                padding:'8px 12px', background:'rgba(245,87,108,0.1)', borderRadius:12}}>
                {L('testCode')}: <strong>{authTestCode}</strong>
              </div>
            )}
            <div style={S.field}>
              <input style={{...S.input, fontSize:24, textAlign:'center', letterSpacing:8}}
                placeholder="000000" value={authCode} maxLength={6}
                onChange={e => setAuthCode(e.target.value.replace(/\D/g,''))}
                onKeyDown={e => e.key === 'Enter' && verifyAuthCodeFn()} />
            </div>
            <button style={{...S.btn, marginTop:8, opacity:authLoading?0.5:1}}
              disabled={authLoading} onClick={verifyAuthCodeFn}>
              {authLoading ? L('verifying') : L('verify')}
            </button>
            <button style={{marginTop:10, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8, width:'100%', textAlign:'center'}}
              onClick={() => { setAuthStep('email'); setAuthCode(''); }}>
              {L('changeEmail')}
            </button>
          </div>
        )}

        {authStep === 'choose' && (
          <div style={{width:'100%', maxWidth:380}}>
            <div style={S.card}>
              <div style={S.cardTitle}>{L('howToTranslate')}</div>
              <button style={{...S.bigBtn, marginBottom:10, background:'linear-gradient(135deg, #4facfe, #4ecdc4)'}}
                onClick={() => setView('credits')}>
                <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.2)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>{'\u{1F680}'}</div>
                <div>
                  <div style={{fontWeight:600, fontSize:15}}>{L('starterPack')} - {'\u20AC'}0.90</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.8)', marginTop:1}}>
                    {L('starterPackDesc')}
                  </div>
                </div>
              </button>
              <button style={{...S.bigBtn, marginBottom:10, background:'linear-gradient(135deg, #f5576c, #e94560)'}}
                onClick={() => setView('credits')}>
                <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>{'\u{1F4B3}'}</div>
                <div>
                  <div style={{fontWeight:600, fontSize:15}}>{L('buyCredits')}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:1}}>
                    {L('payAsYouGo')} - {L('from')} {'\u20AC'}2
                  </div>
                </div>
              </button>
              <button style={{...S.bigBtn, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)'}}
                onClick={() => setView('apikeys')}>
                <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{'\u{1F511}'}</div>
                <div>
                  <div style={{fontWeight:600, fontSize:15}}>{L('useYourKeys')}</div>
                  <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1}}>
                    {L('openaiAnthropicGemini')}
                  </div>
                </div>
              </button>
            </div>
            <button style={{marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.35)',
              fontSize:13, cursor:'pointer', fontFamily:FONT, padding:10, width:'100%', textAlign:'center'}}
              onClick={() => setView('home')}>
              {L('chooseLater')}
            </button>
          </div>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );
}

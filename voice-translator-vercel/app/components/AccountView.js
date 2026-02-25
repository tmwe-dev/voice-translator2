'use client';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

export default function AccountView({ L, S, authStep, authEmail, setAuthEmail, authCode, setAuthCode,
  authLoading, authTestCode, sendAuthCode, verifyAuthCodeFn, setAuthStep, setView, status, theme, setTheme }) {

  // Language detection
  const isIT = L('createRoom') === 'Crea Stanza';

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
          <div style={{width:'100%', maxWidth:400}}>

            {/* ══════ FREE — Hero card, first and biggest ══════ */}
            <button style={{
              width:'100%', padding:'24px 20px', borderRadius:22, cursor:'pointer',
              background:'linear-gradient(135deg, rgba(0,255,148,0.10), rgba(0,210,255,0.06))',
              border:'2px solid rgba(0,255,148,0.30)', marginBottom:16,
              display:'flex', alignItems:'center', gap:18, fontFamily:FONT,
              WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
              color:'#E8EAFF', position:'relative'
            }}
              onClick={() => setView('home')}>

              <div style={{position:'absolute', top:-11, left:18, padding:'3px 14px', borderRadius:8,
                background:'linear-gradient(135deg, #00FF94, #00D2FF)',
                color:'#0a0e27', fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
                {isIT ? 'Consigliato' : 'Recommended'}
              </div>

              <div style={{width:64, height:64, borderRadius:18,
                background:'linear-gradient(135deg, rgba(0,255,148,0.20), rgba(0,210,255,0.12))',
                border:'2px solid rgba(0,255,148,0.25)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <Icon name="zap" size={32} color="#00FF94" />
              </div>
              <div style={{flex:1, textAlign:'left'}}>
                <div style={{fontWeight:800, fontSize:20, color:'#00FF94', letterSpacing:-0.3}}>
                  {L('startFreeMode')}
                </div>
                <div style={{fontSize:12, color:'rgba(232,234,255,0.55)', marginTop:4, lineHeight:1.5}}>
                  {L('startFreeDesc')}
                </div>
                <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
                  {[
                    isIT ? 'Voce browser' : 'Browser voice',
                    isIT ? 'Tutti i contesti' : 'All contexts',
                    isIT ? 'Nessun costo' : 'No cost',
                  ].map((tag, i) => (
                    <span key={i} style={{fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6,
                      background:'rgba(0,255,148,0.10)', border:'1px solid rgba(0,255,148,0.18)',
                      color:'#00FF94'}}>
                      {'\u2713'} {tag}
                    </span>
                  ))}
                </div>
              </div>
            </button>

            {/* ══════ Divider ══════ */}
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
              <div style={{flex:1, height:1, background:'rgba(232,234,255,0.06)'}} />
              <div style={{fontSize:10, color:'rgba(232,234,255,0.25)', fontWeight:700, textTransform:'uppercase', letterSpacing:1.5}}>
                {isIT ? 'Oppure passa a Pro' : 'Or go Pro'}
              </div>
              <div style={{flex:1, height:1, background:'rgba(232,234,255,0.06)'}} />
            </div>

            {/* ══════ PRO Options ══════ */}
            <div style={{display:'flex', flexDirection:'column', gap:10}}>

              {/* Starter Pack */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'linear-gradient(135deg, rgba(108,99,255,0.10), rgba(0,210,255,0.05))',
                border:'1.5px solid rgba(108,99,255,0.22)',
                display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
                WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#E8EAFF'
              }}
                onClick={() => setView('credits')}>
                <div style={{width:48, height:48, borderRadius:14,
                  background:'linear-gradient(135deg, rgba(108,99,255,0.18), rgba(0,210,255,0.10))',
                  border:'1.5px solid rgba(108,99,255,0.25)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <span style={{fontSize:24}}>{'\u{1F680}'}</span>
                </div>
                <div style={{flex:1, textAlign:'left'}}>
                  <div style={{fontWeight:800, fontSize:15, color:'#6C63FF'}}>{L('starterPack')} — {'\u20AC'}0.90</div>
                  <div style={{fontSize:11, color:'rgba(232,234,255,0.45)', marginTop:2}}>
                    {isIT ? 'Voci AI OpenAI, ~180 messaggi' : 'OpenAI AI voices, ~180 messages'}
                  </div>
                </div>
                <Icon name="chevDown" size={18} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
              </button>

              {/* Buy Credits */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'rgba(232,234,255,0.03)',
                border:'1px solid rgba(232,234,255,0.08)',
                display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
                WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#E8EAFF'
              }}
                onClick={() => setView('credits')}>
                <div style={{width:48, height:48, borderRadius:14,
                  background:'rgba(232,234,255,0.05)', border:'1px solid rgba(232,234,255,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <span style={{fontSize:24}}>{'\u{1F4B3}'}</span>
                </div>
                <div style={{flex:1, textAlign:'left'}}>
                  <div style={{fontWeight:700, fontSize:15}}>{L('buyCredits')}</div>
                  <div style={{fontSize:11, color:'rgba(232,234,255,0.40)', marginTop:2}}>
                    {L('payAsYouGo')} — {L('from')} {'\u20AC'}2
                  </div>
                </div>
                <Icon name="chevDown" size={18} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
              </button>

              {/* API Keys */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'rgba(232,234,255,0.02)',
                border:'1px solid rgba(232,234,255,0.06)',
                display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
                WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#E8EAFF'
              }}
                onClick={() => setView('apikeys')}>
                <div style={{width:48, height:48, borderRadius:14,
                  background:'rgba(0,210,255,0.06)', border:'1px solid rgba(0,210,255,0.12)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <Icon name="key" size={22} color="#00D2FF" />
                </div>
                <div style={{flex:1, textAlign:'left'}}>
                  <div style={{fontWeight:700, fontSize:15}}>{L('useYourKeys')}</div>
                  <div style={{fontSize:11, color:'rgba(232,234,255,0.40)', marginTop:2}}>
                    {L('openaiAnthropicGemini')}
                  </div>
                </div>
                <Icon name="chevDown" size={18} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
              </button>
            </div>

            <button style={{marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.25)',
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:10, width:'100%', textAlign:'center'}}
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

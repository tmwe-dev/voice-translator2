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
              width:'100%', padding:'22px 18px', borderRadius:22, cursor:'pointer',
              background:'linear-gradient(135deg, rgba(0,255,148,0.10), rgba(0,210,255,0.06))',
              border:'2px solid rgba(0,255,148,0.30)', marginBottom:16,
              fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
              color:'#FFFFFF', position:'relative', textAlign:'left', display:'block'
            }}
              onClick={() => setView('home')}>

              <div style={{position:'absolute', top:-11, left:18, padding:'3px 14px', borderRadius:8,
                background:'linear-gradient(135deg, #00FF94, #00D2FF)',
                color:'#0a0e27', fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
                {isIT ? 'Consigliato' : 'Recommended'}
              </div>

              {/* Header row */}
              <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:12}}>
                <div style={{width:56, height:56, borderRadius:16,
                  background:'linear-gradient(135deg, rgba(0,255,148,0.20), rgba(0,210,255,0.12))',
                  border:'2px solid rgba(0,255,148,0.25)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <Icon name="zap" size={28} color="#00FF94" />
                </div>
                <div>
                  <div style={{fontWeight:800, fontSize:20, color:'#00FF94', letterSpacing:-0.3}}>
                    {L('startFreeMode')}
                  </div>
                  <div style={{fontSize:12, color:'rgba(232,234,255,0.50)', marginTop:2}}>
                    {isIT ? 'Inizia subito, zero costi' : 'Start now, zero cost'}
                  </div>
                </div>
              </div>

              {/* Feature grid */}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 12px', marginBottom:12, paddingLeft:4}}>
                {[
                  { icon:'\u{1F4AC}', text: isIT ? '~1000 msg testo/giorno' : '~1000 text msgs/day' },
                  { icon:'\u{1F399}\uFE0F', text: isIT ? 'Input vocale illimitato' : 'Unlimited voice input' },
                  { icon:'\u{1F50A}', text: isIT ? 'Voce browser gratuita' : 'Free browser voice' },
                  { icon:'\u{1F310}', text: isIT ? '25 lingue disponibili' : '25 languages available' },
                  { icon:'\u{1F3AF}', text: isIT ? '12 contesti tematici' : '12 topic contexts' },
                  { icon:'\u{267E}\uFE0F', text: isIT ? 'Si rinnova ogni giorno' : 'Renews every day' },
                ].map((f, i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
                    <span style={{fontSize:13, width:18, textAlign:'center', flexShrink:0}}>{f.icon}</span>
                    <span style={{fontSize:11, color:'rgba(232,234,255,0.60)', fontWeight:600}}>{f.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{textAlign:'center', padding:'10px 0 4px', borderTop:'1px solid rgba(0,255,148,0.12)'}}>
                <span style={{fontSize:13, fontWeight:800, color:'#00FF94', letterSpacing:0.3}}>
                  {isIT ? 'Inizia Gratis \u2192' : 'Start Free \u2192'}
                </span>
              </div>
            </button>

            {/* ══════ Divider ══════ */}
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.07)'}} />
              <div style={{fontSize:10, color:'rgba(255,255,255,0.50)', fontWeight:700, textTransform:'uppercase', letterSpacing:1.5}}>
                {isIT ? 'Oppure passa a Pro' : 'Or go Pro'}
              </div>
              <div style={{flex:1, height:1, background:'rgba(255,255,255,0.07)'}} />
            </div>

            {/* ══════ PRO Options ══════ */}
            <div style={{display:'flex', flexDirection:'column', gap:10}}>

              {/* Starter Pack — expanded */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'linear-gradient(135deg, rgba(108,99,255,0.10), rgba(0,210,255,0.05))',
                border:'1.5px solid rgba(108,99,255,0.22)',
                fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#FFFFFF', textAlign:'left', display:'block'
              }}
                onClick={() => setView('credits')}>
                <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:14,
                    background:'linear-gradient(135deg, rgba(108,99,255,0.18), rgba(0,210,255,0.10))',
                    border:'1.5px solid rgba(108,99,255,0.25)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <span style={{fontSize:24}}>{'\u{1F680}'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800, fontSize:16, color:'#6C63FF'}}>{L('starterPack')} — {'\u20AC'}0.90</div>
                    <div style={{fontSize:11, color:'rgba(255,255,255,0.68)', marginTop:2}}>
                      {isIT ? '900 testo o 180 voce AI' : '900 text or 180 AI voice msgs'}
                    </div>
                  </div>
                  <Icon name="chevDown" size={18} color="rgba(255,255,255,0.55)" style={{transform:'rotate(-90deg)'}} />
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', paddingLeft:2}}>
                  {[
                    { val: '~900', label: isIT ? 'msg testo' : 'text msgs', color:'#00D2FF' },
                    { val: '~180', label: isIT ? 'msg voce AI' : 'AI voice msgs', color:'#6C63FF' },
                    { val: '6', label: isIT ? 'voci AI OpenAI' : 'OpenAI AI voices', color:'#00FF94' },
                  ].map((s, i) => (
                    <div key={i} style={{display:'flex', alignItems:'baseline', gap:4,
                      padding:'4px 10px', borderRadius:8, background:'rgba(108,99,255,0.06)',
                      border:'1px solid rgba(108,99,255,0.10)'}}>
                      <span style={{fontSize:15, fontWeight:800, color:s.color}}>{s.val}</span>
                      <span style={{fontSize:9, color:'rgba(232,234,255,0.40)', fontWeight:600}}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* Buy Credits — expanded */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)',
                fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#FFFFFF', textAlign:'left', display:'block'
              }}
                onClick={() => setView('credits')}>
                <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:14,
                    background:'rgba(232,234,255,0.05)', border:'1px solid rgba(255,255,255,0.09)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <span style={{fontSize:24}}>{'\u{1F4B3}'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700, fontSize:16}}>{L('buyCredits')}</div>
                    <div style={{fontSize:11, color:'rgba(232,234,255,0.40)', marginTop:2}}>
                      {L('payAsYouGo')} — {L('from')} {'\u20AC'}2 {isIT ? 'a' : 'to'} {'\u20AC'}20
                    </div>
                  </div>
                  <Icon name="chevDown" size={18} color="rgba(255,255,255,0.55)" style={{transform:'rotate(-90deg)'}} />
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', paddingLeft:2}}>
                  {[
                    { val: isIT ? 'fino a 26000' : 'up to 26000', label: isIT ? 'msg testo' : 'text msgs', color:'#00D2FF' },
                    { val: isIT ? 'fino a 5200' : 'up to 5200', label: isIT ? 'msg voce AI' : 'AI voice msgs', color:'#6C63FF' },
                    { val: isIT ? 'fino a +30%' : 'up to +30%', label: 'bonus', color:'#FFD700' },
                  ].map((s, i) => (
                    <div key={i} style={{display:'flex', alignItems:'baseline', gap:4,
                      padding:'4px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)',
                      border:'1px solid rgba(255,255,255,0.07)'}}>
                      <span style={{fontSize:12, fontWeight:800, color:s.color}}>{s.val}</span>
                      <span style={{fontSize:9, color:'rgba(255,255,255,0.58)', fontWeight:600}}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* API Keys */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
                display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
                WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:'#FFFFFF'
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
                    {isIT ? 'Messaggi illimitati con le tue API' : 'Unlimited messages with your APIs'}
                  </div>
                </div>
                <Icon name="chevDown" size={18} color="rgba(255,255,255,0.55)" style={{transform:'rotate(-90deg)'}} />
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

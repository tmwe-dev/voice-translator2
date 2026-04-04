'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import Icon from './Icon.js';

export default function AccountView({ L, S, authStep, authEmail, setAuthEmail, authCode, setAuthCode,
  authLoading, authTestCode, sendAuthCode, verifyAuthCodeFn, loginWithGoogle, loginWithApple,
  pendingReferralCode, setAuthStep, setView, status, theme, setTheme }) {

  // Auto-redirect to home after successful auth (skip tier choose page)
  useEffect(() => {
    if (authStep === 'choose') {
      setView('home');
    }
  }, [authStep, setView]);

  // Language detection
  const isIT = L('createRoom') === 'Crea Stanza';
  const googleInitRef = useRef(false);
  const [authError, setAuthError] = useState('');

  // Initialize Google Identity Services when SDK is available
  const initGoogleSignIn = useCallback(() => {
    if (googleInitRef.current) return;
    const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
    if (!clientId || !window.google?.accounts?.id) return;
    googleInitRef.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (response.credential) {
          await loginWithGoogle(response.credential, pendingReferralCode);
        }
      }
    });
  }, [loginWithGoogle, pendingReferralCode]);

  // Fallback: open Google OAuth in popup when One Tap SDK fails
  const googleOAuthPopup = useCallback(() => {
    const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
    if (!clientId) return false;
    const redirectUri = `${window.location.origin}/api/auth/google-callback`;
    const scope = 'email profile openid';
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=select_account`;
    const w = 500, h = 600;
    const left = (screen.width - w) / 2, top = (screen.height - h) / 2;
    window.open(url, 'googleOAuth', `width=${w},height=${h},left=${left},top=${top}`);
    return true;
  }, []);

  useEffect(() => {
    if (authStep !== 'email') return;
    initGoogleSignIn();
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogleSignIn();
        clearInterval(checkInterval);
      }
    }, 500);
    return () => clearInterval(checkInterval);
  }, [authStep, initGoogleSignIn]);

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
              <div style={{flex:1, height:1, background:S.colors.dividerColor}} />
              <div style={{fontSize:11, color:S.colors.textMuted}}>{L('or')}</div>
              <div style={{flex:1, height:1, background:S.colors.dividerColor}} />
            </div>
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:`1px solid ${S.colors.inputBorder}`,
              background:S.colors.inputBg, color:S.colors.textPrimary, fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent', marginBottom:8,
              opacity: authLoading ? 0.5 : 1}}
              disabled={authLoading}
              onClick={() => {
                setAuthError('');
                const clientId = typeof window !== 'undefined' ? window.__VT_GOOGLE_CLIENT_ID : '';
                if (!clientId) {
                  setAuthError(isIT ? 'Google Sign-In non ancora configurato. Usa il login con email.' : 'Google Sign-In not yet configured. Use email login.');
                  return;
                }
                initGoogleSignIn();
                if (window.google?.accounts?.id) {
                  window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                      console.log('[Auth] One Tap unavailable, using OAuth popup');
                      googleOAuthPopup();
                    }
                  });
                } else {
                  console.log('[Auth] Google SDK not loaded, using OAuth popup');
                  if (!googleOAuthPopup()) {
                    setAuthError(isIT ? 'Google Sign-In non disponibile. Usa il login con email.' : 'Google Sign-In unavailable. Use email login.');
                  }
                }
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{L('loginGoogle')}</span>
            </button>
            {authError && (
              <div style={{color:S.colors.statusError || '#FF6B6B', fontSize:12, textAlign:'center',
                padding:'6px 12px', marginBottom:8, borderRadius:8,
                background:S.colors.accent3Bg || 'rgba(255,107,107,0.1)',
                border:`1px solid ${S.colors.accent3Border || 'rgba(255,107,107,0.2)'}`}}>
                {authError}
              </div>
            )}
            {/* Apple Sign-In — hidden until app is published on App Store */}
            {typeof window !== 'undefined' && window.__VT_APPLE_CLIENT_ID ? (
            <button style={{width:'100%', padding:'12px 16px', borderRadius:14, border:`1px solid ${S.colors.inputBorder}`,
              background:S.colors.inputBg, color:S.colors.textPrimary, fontSize:14, cursor:'pointer',
              fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              WebkitTapHighlightColor:'transparent',
              opacity: authLoading ? 0.5 : 1}}
              disabled={authLoading}
              onClick={async () => {
                // Apple Sign-In via Apple JS SDK
                if (typeof window !== 'undefined' && window.AppleID?.auth) {
                  try {
                    const response = await window.AppleID.auth.signIn();
                    if (response) {
                      await loginWithApple(response, pendingReferralCode);
                    }
                  } catch (e) {
                    if (e.error !== 'popup_closed_by_user') {
                      console.error('Apple Sign-In error:', e);
                    }
                  }
                } else {
                  // Load Apple JS SDK dynamically
                  const script = document.createElement('script');
                  script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
                  script.async = true;
                  script.onload = async () => {
                    const clientId = window.__VT_APPLE_CLIENT_ID;
                    if (!clientId) {
                      alert(isIT ? 'Apple Sign-In non ancora configurato. Contatta l\'amministratore.' : 'Apple Sign-In not yet configured. Contact administrator.');
                      return;
                    }
                    window.AppleID.auth.init({
                      clientId,
                      scope: 'name email',
                      redirectURI: window.location.origin,
                      usePopup: true
                    });
                    try {
                      const response = await window.AppleID.auth.signIn();
                      if (response) {
                        await loginWithApple(response, pendingReferralCode);
                      }
                    } catch (e) {
                      if (e.error !== 'popup_closed_by_user') {
                        console.error('Apple Sign-In error:', e);
                      }
                    }
                  };
                  document.head.appendChild(script);
                }
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              <span>{L('loginApple')}</span>
            </button>
            ) : null}
            <div style={{fontSize:10, color:S.colors.textMuted, textAlign:'center', marginTop:12}}>
              {L('noPasswordRequired')}
            </div>
          </div>
        )}

        {authStep === 'code' && (
          <div style={S.card}>
            <div style={S.cardTitle}>{L('enterCode')}</div>
            <div style={{fontSize:12, color:S.colors.textTertiary, textAlign:'center', marginBottom:12}}>
              {L('sentTo')} {authEmail}
            </div>
            {authTestCode && (
              <div style={{fontSize:13, color:S.colors.accent3, textAlign:'center', marginBottom:12,
                padding:'8px 12px', background:S.colors.accent3Bg, borderRadius:12}}>
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
            <button style={{marginTop:10, background:'none', border:'none', color:S.colors.textMuted,
              fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8, width:'100%', textAlign:'center'}}
              onClick={() => { setAuthStep('email'); setAuthCode(''); setAuthError(''); }}>
              {L('changeEmail')}
            </button>
          </div>
        )}

        {authStep === 'choose' && (
          <div style={{width:'100%', maxWidth:400}}>

            {/* ══════ FREE — Hero card, first and biggest ══════ */}
            <button style={{
              width:'100%', padding:'22px 18px', borderRadius:22, cursor:'pointer',
              background:`linear-gradient(135deg, ${S.colors.accent4Bg}, ${S.colors.accent2Bg})`,
              border:`2px solid ${S.colors.accent4Border}`, marginBottom:16,
              fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
              color:S.colors.textPrimary, position:'relative', textAlign:'left', display:'block'
            }}
              onClick={() => setView('home')}>

              <div style={{position:'absolute', top:-11, left:18, padding:'3px 14px', borderRadius:8,
                background:`linear-gradient(135deg, ${S.colors.accent4}, ${S.colors.accent2})`,
                color:'#0a0e27', fontSize:10, fontWeight:800, letterSpacing:0.5, textTransform:'uppercase'}}>
                {isIT ? 'Consigliato' : 'Recommended'}
              </div>

              {/* Header row */}
              <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:12}}>
                <div style={{width:56, height:56, borderRadius:16,
                  background:`linear-gradient(135deg, ${S.colors.accent4Bg}, ${S.colors.accent2Bg})`,
                  border:`2px solid ${S.colors.accent4Border}`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <Icon name="zap" size={28} color={S.colors.accent4} />
                </div>
                <div>
                  <div style={{fontWeight:800, fontSize:20, color:S.colors.accent4, letterSpacing:-0.3}}>
                    {L('startFreeMode')}
                  </div>
                  <div style={{fontSize:12, color:S.colors.textTertiary, marginTop:2}}>
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
                    <span style={{fontSize:11, color:S.colors.textSecondary, fontWeight:600}}>{f.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{textAlign:'center', padding:'10px 0 4px', borderTop:`1px solid ${S.colors.accent4Border}`}}>
                <span style={{fontSize:13, fontWeight:800, color:S.colors.accent4, letterSpacing:0.3}}>
                  {isIT ? 'Inizia Gratis \u2192' : 'Start Free \u2192'}
                </span>
              </div>
            </button>

            {/* ══════ Divider ══════ */}
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16}}>
              <div style={{flex:1, height:1, background:S.colors.dividerColor}} />
              <div style={{fontSize:10, color:S.colors.textSecondary, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5}}>
                {isIT ? 'Oppure passa a Pro' : 'Or go Pro'}
              </div>
              <div style={{flex:1, height:1, background:S.colors.dividerColor}} />
            </div>

            {/* ══════ PRO Options ══════ */}
            <div style={{display:'flex', flexDirection:'column', gap:10}}>

              {/* Starter Pack — expanded */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:`linear-gradient(135deg, ${S.colors.accent1Bg}, ${S.colors.accent2Bg})`,
                border:`1.5px solid ${S.colors.accent1Border}`,
                fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:S.colors.textPrimary, textAlign:'left', display:'block'
              }}
                onClick={() => setView('credits')}>
                <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:14,
                    background:`linear-gradient(135deg, ${S.colors.accent1Bg}, ${S.colors.accent2Bg})`,
                    border:`1.5px solid ${S.colors.accent1Border}`,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <span style={{fontSize:24}}>{'\u{1F680}'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:800, fontSize:16, color:S.colors.accent1}}>{L('starterPack')} — {'\u20AC'}0.90</div>
                    <div style={{fontSize:11, color:S.colors.textSecondary, marginTop:2}}>
                      {isIT ? '900 testo o 180 voce AI' : '900 text or 180 AI voice msgs'}
                    </div>
                  </div>
                  <Icon name="chevDown" size={18} color={S.colors.textSecondary} style={{transform:'rotate(-90deg)'}} />
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', paddingLeft:2}}>
                  {[
                    { val: '~900', label: isIT ? 'msg testo' : 'text msgs', color:S.colors.accent2 },
                    { val: '~180', label: isIT ? 'msg voce AI' : 'AI voice msgs', color:S.colors.accent1 },
                    { val: '6', label: isIT ? 'voci AI OpenAI' : 'OpenAI AI voices', color:S.colors.accent4 },
                  ].map((s, i) => (
                    <div key={i} style={{display:'flex', alignItems:'baseline', gap:4,
                      padding:'4px 10px', borderRadius:8, background:S.colors.accent1Bg,
                      border:`1px solid ${S.colors.accent1Border}`}}>
                      <span style={{fontSize:15, fontWeight:800, color:s.color}}>{s.val}</span>
                      <span style={{fontSize:9, color:S.colors.textMuted, fontWeight:600}}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* Buy Credits — expanded */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:S.colors.inputBg, border:`1px solid ${S.colors.inputBorder}`,
                fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:S.colors.textPrimary, textAlign:'left', display:'block'
              }}
                onClick={() => setView('credits')}>
                <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
                  <div style={{width:48, height:48, borderRadius:14,
                    background:S.colors.inputBg, border:`1px solid ${S.colors.inputBorder}`,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                    <span style={{fontSize:24}}>{'\u{1F4B3}'}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700, fontSize:16}}>{L('buyCredits')}</div>
                    <div style={{fontSize:11, color:S.colors.textMuted, marginTop:2}}>
                      {L('payAsYouGo')} — {L('from')} {'\u20AC'}2 {isIT ? 'a' : 'to'} {'\u20AC'}20
                    </div>
                  </div>
                  <Icon name="chevDown" size={18} color={S.colors.textSecondary} style={{transform:'rotate(-90deg)'}} />
                </div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap', paddingLeft:2}}>
                  {[
                    { val: isIT ? 'fino a 26000' : 'up to 26000', label: isIT ? 'msg testo' : 'text msgs', color:S.colors.accent2 },
                    { val: isIT ? 'fino a 5200' : 'up to 5200', label: isIT ? 'msg voce AI' : 'AI voice msgs', color:S.colors.accent1 },
                    { val: isIT ? 'fino a +30%' : 'up to +30%', label: 'bonus', color:S.colors.goldAccent },
                  ].map((s, i) => (
                    <div key={i} style={{display:'flex', alignItems:'baseline', gap:4,
                      padding:'4px 10px', borderRadius:8, background:S.colors.inputBg,
                      border:`1px solid ${S.colors.inputBorder}`}}>
                      <span style={{fontSize:12, fontWeight:800, color:s.color}}>{s.val}</span>
                      <span style={{fontSize:9, color:S.colors.textSecondary, fontWeight:600}}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* API Keys */}
              <button style={{
                width:'100%', padding:'16px 18px', borderRadius:18, cursor:'pointer',
                background:S.colors.inputBg, border:`1px solid ${S.colors.inputBorder}`,
                display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
                WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                color:S.colors.textPrimary
              }}
                onClick={() => setView('apikeys')}>
                <div style={{width:48, height:48, borderRadius:14,
                  background:S.colors.accent2Bg, border:`1px solid ${S.colors.accent2Border}`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <Icon name="key" size={22} color={S.colors.accent2} />
                </div>
                <div style={{flex:1, textAlign:'left'}}>
                  <div style={{fontWeight:700, fontSize:15}}>{L('useYourKeys')}</div>
                  <div style={{fontSize:11, color:S.colors.textMuted, marginTop:2}}>
                    {isIT ? 'Messaggi illimitati con le tue API' : 'Unlimited messages with your APIs'}
                  </div>
                </div>
                <Icon name="chevDown" size={18} color={S.colors.textSecondary} style={{transform:'rotate(-90deg)'}} />
              </button>
            </div>

            <button style={{marginTop:16, background:'none', border:'none', color:S.colors.textMuted,
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

'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { LANGS, MODES, CONTEXTS, VOICES, FONT, APP_URL, getLang, vibrate, formatCredits } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import TutorialOverlay from './TutorialOverlay.js';
import Icon from './Icon.js';

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, selectedMode, setSelectedMode, selectedContext,
  setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView, userToken,
  userAccount, useOwnKeys, creditBalance, refreshBalance, setAuthStep, loadHistory,
  showShareApp, setShowShareApp, shareAppLang, setShareAppLang, shareApp,
  showTutorial, setShowTutorial, tutorialStep, setTutorialStep, status,
  isTrial, platformHasEL, referralCode, theme, setTheme }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const audioRef = useRef(null);

  const isGuest = !userToken;

  // Quick voice preview (browser speech only — free, no API cost)
  const quickPreview = useCallback((voiceName) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    if (playingVoice === voiceName) { setPlayingVoice(null); return; }
    setPlayingVoice(voiceName);
    const samples = { it:'Ciao!', en:'Hello!', es:'Hola!', fr:'Bonjour!', de:'Hallo!', pt:'Olá!',
      zh:'你好！', ja:'こんにちは！', ko:'안녕하세요!', th:'สวัสดี!', ar:'مرحبا!', hi:'नमस्ते!',
      ru:'Привет!', tr:'Merhaba!', vi:'Xin chào!' };
    if (typeof speechSynthesis !== 'undefined') {
      const u = new SpeechSynthesisUtterance(samples[prefs.lang] || samples.en);
      u.lang = langInfo.speech;
      u.rate = 0.9;
      u.onend = () => setPlayingVoice(null);
      u.onerror = () => setPlayingVoice(null);
      speechSynthesis.speak(u);
    } else { setPlayingVoice(null); }
  }, [playingVoice, prefs.lang, langInfo.speech]);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ── Profile header — avatar big + name + settings ── */}
        <div style={{display:'flex', alignItems:'center', gap:16, width:'100%', maxWidth:400, marginBottom:16,
          padding:'14px 18px', borderRadius:22, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)', backdropFilter:'blur(20px)'}}>
          <AvatarImg src={prefs.avatar} size={56} style={{borderRadius:18}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:18, fontWeight:800, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:13, color:'rgba(232,234,255,0.5)', display:'flex', alignItems:'center', gap:5, marginTop:2}}>
              <span style={{fontSize:20}}>{langInfo.flag}</span> <span>{langInfo.name}</span>
              <span style={{marginLeft:4, fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:7,
                background: isGuest ? 'rgba(0,255,148,0.12)' : (isTrial ? 'rgba(0,255,148,0.12)' : 'rgba(108,99,255,0.15)'),
                color: isGuest ? '#00FF94' : (isTrial ? '#00FF94' : '#6C63FF')}}>
                {isGuest ? 'FREE' : (isTrial ? 'FREE' : 'PRO')}
              </span>
            </div>
          </div>
          <button style={{...S.backBtn, width:44, height:44, borderRadius:14}}
            onClick={() => setView('settings')}>
            <Icon name="settings" size={24} color="rgba(232,234,255,0.6)" />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            QUICK PREFERENCES — language + voice + autoplay
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400, marginBottom:16, padding:'14px 16px', borderRadius:18,
          background:'rgba(232,234,255,0.02)', border:'1px solid rgba(232,234,255,0.06)'}}>

          {/* Language quick selector */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.35)', textTransform:'uppercase',
              letterSpacing:1.2, marginBottom:8}}>{L('yourLang')}</div>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              {LANGS.slice(0, showLangPicker ? LANGS.length : 7).map(l => (
                <button key={l.code} onClick={() => { const np = {...prefs, lang:l.code}; setPrefs(np); savePrefs(np); }}
                  style={{padding:'6px 10px', borderRadius:10, fontSize:13, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:5, fontFamily:FONT,
                    WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                    background: prefs.lang === l.code ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)',
                    border: prefs.lang === l.code ? '1.5px solid rgba(108,99,255,0.35)' : '1.5px solid rgba(232,234,255,0.06)',
                    color: prefs.lang === l.code ? '#6C63FF' : 'rgba(232,234,255,0.5)'}}>
                  <span style={{fontSize:18}}>{l.flag}</span>
                  {prefs.lang === l.code && <span style={{fontSize:11, fontWeight:700}}>{l.name}</span>}
                </button>
              ))}
              <button onClick={() => setShowLangPicker(!showLangPicker)}
                style={{padding:'6px 10px', borderRadius:10, fontSize:11, cursor:'pointer',
                  background:'rgba(232,234,255,0.03)', border:'1.5px solid rgba(232,234,255,0.06)',
                  color:'rgba(232,234,255,0.4)', fontFamily:FONT, fontWeight:600}}>
                {showLangPicker ? '\u2715' : `+${LANGS.length - 7}`}
              </button>
            </div>
          </div>

          {/* Voice + Autoplay row */}
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.35)', textTransform:'uppercase',
                letterSpacing:1.2, marginBottom:6}}>{L('voiceTranslation')}</div>
              <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                {VOICES.map(v => {
                  const isSel = prefs.voice === v;
                  const isPlaying = playingVoice === v;
                  return (
                    <button key={v} onClick={() => { const np = {...prefs, voice:v}; setPrefs(np); savePrefs(np); }}
                      style={{padding:'4px 9px', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer',
                        fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                        display:'flex', alignItems:'center', gap:4,
                        background: isSel ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: isSel ? '1.5px solid rgba(108,99,255,0.3)' : '1.5px solid rgba(232,234,255,0.05)',
                        color: isSel ? '#6C63FF' : 'rgba(232,234,255,0.4)'}}>
                      {v}
                      {isSel && (
                        <span onClick={(e) => { e.stopPropagation(); quickPreview(v); }}
                          style={{display:'inline-flex', alignItems:'center', marginLeft:2, cursor:'pointer'}}>
                          <Icon name={isPlaying ? 'stop' : 'play'} size={10}
                            color={isPlaying ? '#FF6B9D' : '#6C63FF'} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
              <div style={{fontSize:9, fontWeight:700, color:'rgba(232,234,255,0.3)', textTransform:'uppercase',
                letterSpacing:1}}>Auto</div>
              <button onClick={() => { const np = {...prefs, autoPlay:!prefs.autoPlay}; setPrefs(np); savePrefs(np); }}
                style={{width:44, height:26, borderRadius:13, cursor:'pointer', border:'none',
                  background: prefs.autoPlay ? '#6C63FF' : 'rgba(232,234,255,0.1)',
                  position:'relative', transition:'all 0.2s', WebkitTapHighlightColor:'transparent'}}>
                <div style={{width:20, height:20, borderRadius:10, background:'#fff', position:'absolute',
                  top:3, left: prefs.autoPlay ? 21 : 3, transition:'all 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}} />
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            MAIN ACTIONS — BIG icons, unmistakable
           ══════════════════════════════════════════════════ */}

        {/* ── Create Room ── HUGE card */}
        <button style={{
          width:'100%', maxWidth:400, padding:'22px 20px', borderRadius:22, cursor:'pointer',
          background:'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,210,255,0.06))',
          border:'1.5px solid rgba(108,99,255,0.22)', marginBottom:12,
          display:'flex', alignItems:'center', gap:18, fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
          color:'#E8EAFF'
        }}
          onClick={() => { vibrate(); setShowCreatePanel(!showCreatePanel); }}>
          <div style={{width:80, height:80, borderRadius:22,
            background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            boxShadow:'0 6px 28px rgba(108,99,255,0.35)'}}>
            <Icon name="plus" size={42} color="#fff" />
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:800, fontSize:19, letterSpacing:-0.3}}>{L('createRoom')}</div>
            <div style={{fontSize:12, color:'rgba(232,234,255,0.45)', marginTop:3}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
            </div>
          </div>
          <Icon name={showCreatePanel ? 'chevUp' : 'chevDown'} size={24} color="rgba(232,234,255,0.35)" />
        </button>

        {/* Create Room — expandable config panel */}
        {showCreatePanel && (
          <div style={{width:'100%', maxWidth:400, padding:'16px', borderRadius:18,
            background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
            marginBottom:12, backdropFilter:'blur(20px)'}}>
            <div style={{marginBottom:12}}>
              <div style={{...S.label, marginBottom:8}}>{L('context')}</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                {CONTEXTS.map(c => (
                  <button key={c.id} onClick={() => setSelectedContext(c.id)}
                    style={{padding:'7px 11px', borderRadius:10, fontSize:12, fontWeight:600,
                      fontFamily:FONT, cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                      WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                      background: selectedContext === c.id ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)',
                      border: selectedContext === c.id ? '1px solid rgba(108,99,255,0.3)' : '1px solid rgba(232,234,255,0.06)',
                      color: selectedContext === c.id ? '#6C63FF' : 'rgba(232,234,255,0.45)'}}>
                    <span style={{fontSize:15}}>{c.icon}</span> {L(c.nameKey)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{...S.label, marginBottom:5}}>{L('descriptionOptional')}</div>
              <input style={{...S.input, fontSize:13, padding:'10px 12px'}} value={roomDescription}
                onChange={e => setRoomDescription(e.target.value)} placeholder="..." maxLength={150} />
            </div>
            <button style={{...S.btn, width:'100%', padding:'14px 0', fontSize:16, fontWeight:800,
              background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
              boxShadow:'0 4px 24px rgba(108,99,255,0.35)', borderRadius:14}}
              onClick={() => { vibrate(); handleCreateRoom(); }}>
              {L('createRoom')}
            </button>
          </div>
        )}

        {/* ── Join Room ── HUGE card */}
        <button style={{
          width:'100%', maxWidth:400, padding:'22px 20px', borderRadius:22, cursor:'pointer',
          background:'rgba(0,210,255,0.05)', border:'1.5px solid rgba(0,210,255,0.18)',
          marginBottom:18, display:'flex', alignItems:'center', gap:18, fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
          color:'#E8EAFF'
        }}
          onClick={() => setView('join')}>
          <div style={{width:80, height:80, borderRadius:22,
            background:'rgba(0,210,255,0.1)', border:'1.5px solid rgba(0,210,255,0.22)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="link" size={42} color="#00D2FF" />
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:800, fontSize:19, letterSpacing:-0.3}}>{L('joinRoom')}</div>
            <div style={{fontSize:12, color:'rgba(232,234,255,0.45)', marginTop:3}}>{L('codeOrQR')}</div>
          </div>
          <Icon name="chevDown" size={24} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
        </button>

        {/* ══════════════════════════════════════════════════
            ACCOUNT AREA
           ══════════════════════════════════════════════════ */}

        {/* Guest → big invite to sign in */}
        {isGuest && (
          <button style={{
            width:'100%', maxWidth:400, padding:'18px 20px', borderRadius:20, cursor:'pointer',
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,107,157,0.05))',
            border:'1.5px solid rgba(108,99,255,0.18)', marginBottom:16,
            display:'flex', alignItems:'center', gap:16, fontFamily:FONT,
            WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <div style={{width:64, height:64, borderRadius:18,
              background:'rgba(108,99,255,0.12)', border:'1.5px solid rgba(108,99,255,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="user" size={34} color="#6C63FF" />
            </div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:16, color:'#6C63FF'}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:11, color:'rgba(232,234,255,0.4)', marginTop:3}}>{L('signInProDesc')}</div>
            </div>
            <span style={{fontSize:10, fontWeight:800, padding:'4px 10px', borderRadius:8,
              background:'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,210,255,0.12))',
              color:'#6C63FF'}}>PRO</span>
          </button>
        )}

        {/* Logged in → balance bar */}
        {!isGuest && userAccount && (
          <div style={{width:'100%', maxWidth:400, padding:'14px 18px', borderRadius:18,
            background:'rgba(108,99,255,0.05)', border:'1px solid rgba(108,99,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              <Icon name="credit" size={22} color={useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'} />
              <div>
                <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
                  {useOwnKeys ? L('personalApiKeys') : L('credit')}
                </div>
                <div style={{fontSize:18, fontWeight:700, color: useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'}}>
                  {useOwnKeys ? '\u2713 ' + L('active') : formatCredits(creditBalance)}
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:6}}>
              <button style={{padding:'8px 14px', borderRadius:12, background:'rgba(108,99,255,0.12)',
                border:'1px solid rgba(108,99,255,0.2)', color:'#6C63FF', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:5}}
                onClick={() => { refreshBalance(); setView('credits'); }}>
                <Icon name="zap" size={16} color="#6C63FF" />
                {L('recharge')}
              </button>
              <button style={{padding:'8px 12px', borderRadius:12, background:'rgba(0,210,255,0.08)',
                border:'1px solid rgba(0,210,255,0.15)', color:'#00D2FF', fontSize:12, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:5}}
                onClick={() => setView('apikeys')}>
                <Icon name="key" size={16} color="#00D2FF" />
                API
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            QUICK ACTIONS — big icon grid
           ══════════════════════════════════════════════════ */}
        <div style={{display:'flex', gap:12, justifyContent:'center', width:'100%', maxWidth:400}}>

          {/* Share */}
          <button style={{
            flex:1, padding:'20px 0', borderRadius:20, cursor:'pointer',
            background:'rgba(0,210,255,0.05)', border:'1.5px solid rgba(0,210,255,0.12)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => setShowShareApp(!showShareApp)}>
            <Icon name="share" size={44} color={showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.5)'} />
            <span style={{fontSize:12, fontWeight:700, color: showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.45)'}}>
              {L('shareAppBtn')}
            </span>
          </button>

          {/* History */}
          <button style={{
            flex:1, padding:'20px 0', borderRadius:20, cursor:'pointer',
            background:'rgba(108,99,255,0.04)', border:'1.5px solid rgba(108,99,255,0.1)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { loadHistory(); setView('history'); }}>
            <Icon name="history" size={44} color="rgba(232,234,255,0.5)" />
            <span style={{fontSize:12, fontWeight:700, color:'rgba(232,234,255,0.45)'}}>
              {L('history')}
            </span>
          </button>

          {/* Tutorial */}
          <button style={{
            flex:1, padding:'20px 0', borderRadius:20, cursor:'pointer',
            background:'rgba(255,107,157,0.04)', border:'1.5px solid rgba(255,107,157,0.1)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
            <Icon name="graduation" size={44} color="rgba(232,234,255,0.5)" />
            <span style={{fontSize:12, fontWeight:700, color:'rgba(232,234,255,0.45)'}}>
              {L('tutorial')}
            </span>
          </button>
        </div>

        {/* ── Share App panel ── */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:400, marginTop:12, padding:'16px', borderRadius:18,
            background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.1)',
            backdropFilter:'blur(20px)'}}>
            <div style={{marginBottom:10}}>
              <div style={S.label}>{L('inviteLangLabel')}</div>
              <select style={{...S.select, fontSize:13}} value={shareAppLang} onChange={e => setShareAppLang(e.target.value)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <div style={{textAlign:'center', marginBottom:10}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${APP_URL}?lang=${shareAppLang}`)}`}
                alt="QR" style={{width:140, height:140, borderRadius:16, background:'#fff', padding:8}} />
            </div>
            <button style={{...S.btn, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              background:'rgba(0,210,255,0.12)', border:'1px solid rgba(0,210,255,0.25)', color:'#00D2FF'}}
              onClick={() => shareApp()}>
              <Icon name="share" size={18} color="#00D2FF" />
              {L('shareLink')}
            </button>

            {/* Referral inline */}
            {!isGuest && referralCode && (
              <div style={{marginTop:10, padding:'12px 14px', borderRadius:14,
                background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.1)',
                display:'flex', alignItems:'center', gap:10}}>
                <Icon name="gift" size={22} color="#FF6B9D" />
                <div style={{flex:1, fontFamily:"'Courier New', monospace", fontSize:15, fontWeight:700, color:'#FF6B9D'}}>
                  {referralCode}
                </div>
                <button style={{padding:'7px 12px', borderRadius:10, background:'rgba(255,107,157,0.1)',
                  border:'1px solid rgba(255,107,157,0.2)', color:'#FF6B9D', fontSize:11, fontWeight:700,
                  cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:4}}
                  onClick={() => {
                    const url = `${APP_URL}?ref=${referralCode}&lang=${shareAppLang}`;
                    const text = `${L('referralInviteText') || 'Join me on VoiceTranslate!'} ${referralCode} - ${url}`;
                    if (navigator.share) { navigator.share({ title:'VoiceTranslate', text, url }); }
                    else { navigator.clipboard.writeText(text); }
                  }}>
                  <Icon name="copy" size={14} color="#FF6B9D" />
                  Invite
                </button>
              </div>
            )}
          </div>
        )}

        {status && <div style={S.statusMsg}>{status}</div>}

        {showTutorial && (
          <TutorialOverlay L={L} tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep} setShowTutorial={setShowTutorial} />
        )}
      </div>
    </div>
  );
});

export default HomeView;

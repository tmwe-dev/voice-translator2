'use client';
import { memo, useState } from 'react';
import { LANGS, MODES, CONTEXTS, FONT, APP_URL, getLang, vibrate, formatCredits } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import TutorialOverlay from './TutorialOverlay.js';
import Icon from './Icon.js';

const HomeView = memo(function HomeView({ L, S, prefs, myLang, selectedMode, setSelectedMode, selectedContext,
  setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView, userToken,
  userAccount, useOwnKeys, creditBalance, refreshBalance, setAuthStep, loadHistory,
  showShareApp, setShowShareApp, shareAppLang, setShareAppLang, shareApp,
  showTutorial, setShowTutorial, tutorialStep, setTutorialStep, status,
  isTrial, platformHasEL, referralCode, theme, setTheme }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  // NOT logged in → show big invite to sign in + free access
  const isGuest = !userToken;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ── Profile header ── */}
        <div style={{display:'flex', alignItems:'center', gap:14, width:'100%', maxWidth:380, marginBottom:20,
          padding:'12px 16px', borderRadius:18, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)', backdropFilter:'blur(20px)'}}>
          <AvatarImg src={prefs.avatar} size={48} style={{borderRadius:16}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:16, fontWeight:700, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:12, color:'rgba(232,234,255,0.5)', display:'flex', alignItems:'center', gap:4}}>
              <span style={{fontSize:16}}>{langInfo.flag}</span> <span>{langInfo.name}</span>
              <span style={{marginLeft:4, fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6,
                background: isGuest ? 'rgba(0,255,148,0.12)' : (isTrial ? 'rgba(0,255,148,0.12)' : 'rgba(108,99,255,0.15)'),
                color: isGuest ? '#00FF94' : (isTrial ? '#00FF94' : '#6C63FF')}}>
                {isGuest ? 'FREE' : (isTrial ? 'FREE' : 'PRO')}
              </span>
            </div>
          </div>
          <button style={{...S.backBtn, width:38, height:38, borderRadius:12}}
            onClick={() => setView('settings')}>
            <Icon name="settings" size={18} color="rgba(232,234,255,0.6)" />
          </button>
        </div>

        {/* ══════════════════════════════════════════
            MAIN ACTIONS — big, clear, unmistakable
           ══════════════════════════════════════════ */}

        {/* ── Create Room ── big card */}
        <button style={{
          width:'100%', maxWidth:380, padding:'20px 18px', borderRadius:20, cursor:'pointer',
          background:'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,210,255,0.06))',
          border:'1px solid rgba(108,99,255,0.2)', marginBottom:10,
          display:'flex', alignItems:'center', gap:16, fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
          color:'#E8EAFF'
        }}
          onClick={() => { vibrate(); setShowCreatePanel(!showCreatePanel); }}>
          <div style={{width:52, height:52, borderRadius:16,
            background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            boxShadow:'0 4px 20px rgba(108,99,255,0.3)'}}>
            <Icon name="plus" size={26} color="#fff" />
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:800, fontSize:17, letterSpacing:-0.3}}>{L('createRoom')}</div>
            <div style={{fontSize:11, color:'rgba(232,234,255,0.45)', marginTop:2}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
            </div>
          </div>
          <Icon name={showCreatePanel ? 'chevUp' : 'chevDown'} size={20} color="rgba(232,234,255,0.35)" />
        </button>

        {/* Create Room — expandable config panel */}
        {showCreatePanel && (
          <div style={{width:'100%', maxWidth:380, padding:'16px', borderRadius:16,
            background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
            marginBottom:10, backdropFilter:'blur(20px)'}}>
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
            <button style={{...S.btn, width:'100%', padding:'13px 0', fontSize:15, fontWeight:800,
              background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
              boxShadow:'0 4px 24px rgba(108,99,255,0.35)', borderRadius:14}}
              onClick={() => { vibrate(); handleCreateRoom(); }}>
              {L('createRoom')}
            </button>
          </div>
        )}

        {/* ── Join Room ── big card */}
        <button style={{
          width:'100%', maxWidth:380, padding:'20px 18px', borderRadius:20, cursor:'pointer',
          background:'rgba(0,210,255,0.05)', border:'1px solid rgba(0,210,255,0.15)',
          marginBottom:16, display:'flex', alignItems:'center', gap:16, fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
          color:'#E8EAFF'
        }}
          onClick={() => setView('join')}>
          <div style={{width:52, height:52, borderRadius:16,
            background:'rgba(0,210,255,0.1)', border:'1px solid rgba(0,210,255,0.2)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="link" size={24} color="#00D2FF" />
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:800, fontSize:17, letterSpacing:-0.3}}>{L('joinRoom')}</div>
            <div style={{fontSize:11, color:'rgba(232,234,255,0.45)', marginTop:2}}>{L('codeOrQR')}</div>
          </div>
          <Icon name="chevDown" size={20} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
        </button>

        {/* ══════════════════════════════════════════
            ACCOUNT AREA
           ══════════════════════════════════════════ */}

        {/* Guest → big invite to sign in */}
        {isGuest && (
          <button style={{
            width:'100%', maxWidth:380, padding:'16px 18px', borderRadius:18, cursor:'pointer',
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,107,157,0.05))',
            border:'1px solid rgba(108,99,255,0.15)', marginBottom:16,
            display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
            WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <div style={{width:46, height:46, borderRadius:14,
              background:'rgba(108,99,255,0.12)', border:'1px solid rgba(108,99,255,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="user" size={22} color="#6C63FF" />
            </div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:14, color:'#6C63FF'}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.4)', marginTop:2}}>{L('signInProDesc')}</div>
            </div>
            <span style={{fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:8,
              background:'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,210,255,0.12))',
              color:'#6C63FF'}}>PRO</span>
          </button>
        )}

        {/* Logged in → balance bar */}
        {!isGuest && userAccount && (
          <div style={{width:'100%', maxWidth:380, padding:'12px 16px', borderRadius:16,
            background:'rgba(108,99,255,0.05)', border:'1px solid rgba(108,99,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Icon name="credit" size={18} color={useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'} />
              <div>
                <div style={{fontSize:9, color:'rgba(232,234,255,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
                  {useOwnKeys ? L('personalApiKeys') : L('credit')}
                </div>
                <div style={{fontSize:16, fontWeight:700, color: useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'}}>
                  {useOwnKeys ? '\u2713 ' + L('active') : formatCredits(creditBalance)}
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:6}}>
              <button style={{padding:'7px 12px', borderRadius:10, background:'rgba(108,99,255,0.12)',
                border:'1px solid rgba(108,99,255,0.2)', color:'#6C63FF', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:4}}
                onClick={() => { refreshBalance(); setView('credits'); }}>
                <Icon name="zap" size={13} color="#6C63FF" />
                {L('recharge')}
              </button>
              <button style={{padding:'7px 10px', borderRadius:10, background:'rgba(0,210,255,0.08)',
                border:'1px solid rgba(0,210,255,0.15)', color:'#00D2FF', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:4}}
                onClick={() => setView('apikeys')}>
                <Icon name="key" size={13} color="#00D2FF" />
                API
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            BOTTOM — 3 big icon buttons
           ══════════════════════════════════════════ */}
        <div style={{display:'flex', gap:12, justifyContent:'center', width:'100%', maxWidth:380}}>

          {/* Share */}
          <button style={{
            flex:1, padding:'16px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(0,210,255,0.05)', border:'1px solid rgba(0,210,255,0.1)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => setShowShareApp(!showShareApp)}>
            <Icon name="share" size={28} color={showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.5)'} />
            <span style={{fontSize:11, fontWeight:600, color: showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.45)'}}>
              {L('shareAppBtn')}
            </span>
          </button>

          {/* History */}
          <button style={{
            flex:1, padding:'16px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.08)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { loadHistory(); setView('history'); }}>
            <Icon name="history" size={28} color="rgba(232,234,255,0.5)" />
            <span style={{fontSize:11, fontWeight:600, color:'rgba(232,234,255,0.45)'}}>
              {L('history')}
            </span>
          </button>

          {/* Tutorial */}
          <button style={{
            flex:1, padding:'16px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.08)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
            <Icon name="graduation" size={28} color="rgba(232,234,255,0.5)" />
            <span style={{fontSize:11, fontWeight:600, color:'rgba(232,234,255,0.45)'}}>
              {L('tutorial')}
            </span>
          </button>
        </div>

        {/* ── Share App panel ── */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:380, marginTop:12, padding:'16px', borderRadius:16,
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
                alt="QR" style={{width:130, height:130, borderRadius:14, background:'#fff', padding:8}} />
            </div>
            <button style={{...S.btn, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              background:'rgba(0,210,255,0.12)', border:'1px solid rgba(0,210,255,0.25)', color:'#00D2FF'}}
              onClick={() => shareApp()}>
              <Icon name="share" size={16} color="#00D2FF" />
              {L('shareLink')}
            </button>

            {/* Referral inline */}
            {!isGuest && referralCode && (
              <div style={{marginTop:10, padding:'10px 12px', borderRadius:12,
                background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.1)',
                display:'flex', alignItems:'center', gap:10}}>
                <Icon name="gift" size={18} color="#FF6B9D" />
                <div style={{flex:1, fontFamily:"'Courier New', monospace", fontSize:14, fontWeight:700, color:'#FF6B9D'}}>
                  {referralCode}
                </div>
                <button style={{padding:'6px 10px', borderRadius:8, background:'rgba(255,107,157,0.1)',
                  border:'1px solid rgba(255,107,157,0.2)', color:'#FF6B9D', fontSize:10, fontWeight:700,
                  cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:3}}
                  onClick={() => {
                    const text = `Join me on VoiceTranslate! Use code ${referralCode} for 50 bonus credits. ${APP_URL}?ref=${referralCode}`;
                    if (navigator.share) { navigator.share({ title:'VoiceTranslate', text }); }
                    else { navigator.clipboard.writeText(text); }
                  }}>
                  <Icon name="copy" size={12} color="#FF6B9D" />
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

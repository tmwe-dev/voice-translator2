'use client';
import { memo, useState } from 'react';
import { LANGS, CONTEXTS, FONT, APP_URL, getLang, vibrate, formatCredits } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import TutorialOverlay from './TutorialOverlay.js';
import Icon from './Icon.js';

const HomeView = memo(function HomeView({ L, S, prefs, setPrefs, savePrefs, myLang, selectedMode, setSelectedMode, selectedContext,
  setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView, userToken,
  userAccount, useOwnKeys, creditBalance, refreshBalance, setAuthStep, loadHistory,
  showShareApp, setShowShareApp, shareAppLang, setShareAppLang, shareApp,
  showTutorial, setShowTutorial, tutorialStep, setTutorialStep, status,
  isTrial, platformHasEL, referralCode, theme, setTheme, logout }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);

  const isGuest = !userToken;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ── Profile header — compact ── */}
        <div style={{display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:400, marginBottom:14,
          padding:'12px 16px', borderRadius:18, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)', backdropFilter:'blur(20px)'}}>
          <AvatarImg src={prefs.avatar} size={44} style={{borderRadius:14}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:16, fontWeight:800, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:12, color:'rgba(232,234,255,0.5)', display:'flex', alignItems:'center', gap:4, marginTop:1}}>
              <span style={{fontSize:17}}>{langInfo.flag}</span> <span>{langInfo.name}</span>
              <span style={{marginLeft:4, fontSize:9, fontWeight:800, padding:'1px 7px', borderRadius:6,
                background: isGuest ? 'rgba(0,255,148,0.12)' : (isTrial ? 'rgba(0,255,148,0.12)' : 'rgba(108,99,255,0.15)'),
                color: isGuest ? '#00FF94' : (isTrial ? '#00FF94' : '#6C63FF')}}>
                {isGuest ? 'FREE' : (isTrial ? 'FREE' : 'PRO')}
              </span>
            </div>
          </div>
          <button style={{...S.backBtn, width:40, height:40, borderRadius:12}}
            onClick={() => setView('settings')}>
            <Icon name="settings" size={20} color="rgba(232,234,255,0.6)" />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            MAIN ACTIONS — Create + Join side by side
           ══════════════════════════════════════════════════ */}
        <div style={{display:'flex', gap:10, width:'100%', maxWidth:400, marginBottom:12}}>

          {/* ── Create Room ── */}
          <button style={{
            flex:1, padding:'18px 10px', borderRadius:20, cursor:'pointer',
            background:'linear-gradient(135deg, rgba(108,99,255,0.10), rgba(0,210,255,0.05))',
            border:'1.5px solid rgba(108,99,255,0.20)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
            color:'#E8EAFF'
          }}
            onClick={() => { vibrate(); if (isGuest) { setAuthStep('email'); setView('account'); return; } setShowCreatePanel(!showCreatePanel); }}>
            <div style={{width:56, height:56, borderRadius:16,
              background:'linear-gradient(135deg, rgba(108,99,255,0.18), rgba(0,210,255,0.10))',
              border:'1.5px solid rgba(108,99,255,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center'}}>
              <Icon name="doorCreate" size={28} color="#6C63FF" />
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontWeight:800, fontSize:14, letterSpacing:-0.2}}>{L('createRoom')}</div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', marginTop:2}}>
                {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
                {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
              </div>
            </div>
          </button>

          {/* ── Join Room ── */}
          <button style={{
            flex:1, padding:'18px 10px', borderRadius:20, cursor:'pointer',
            background:'rgba(0,210,255,0.05)',
            border:'1.5px solid rgba(0,210,255,0.18)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
            color:'#E8EAFF'
          }}
            onClick={() => { vibrate(); if (isGuest) { setAuthStep('email'); setView('account'); return; } setView('join'); }}>
            <div style={{width:56, height:56, borderRadius:16,
              background:'rgba(0,210,255,0.10)', border:'1.5px solid rgba(0,210,255,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center'}}>
              <Icon name="doorOpen" size={28} color="#00D2FF" />
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontWeight:800, fontSize:14, letterSpacing:-0.2}}>{L('joinRoom')}</div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', marginTop:2}}>{L('codeOrQR')}</div>
            </div>
          </button>
        </div>

        {/* Create Room — expandable config panel */}
        {showCreatePanel && (
          <div style={{width:'100%', maxWidth:400, padding:'14px', borderRadius:16,
            background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
            marginBottom:12, backdropFilter:'blur(20px)'}}>
            <div style={{marginBottom:10, position:'relative'}}>
              <div style={{...S.label, marginBottom:5, fontSize:10}}>{L('context')}</div>
              <button onClick={() => setShowContextDropdown(!showContextDropdown)}
                style={{width:'100%', padding:'10px 12px', borderRadius:12, cursor:'pointer',
                  background:'rgba(108,99,255,0.08)', border:'1.5px solid rgba(108,99,255,0.2)',
                  display:'flex', alignItems:'center', gap:8, fontFamily:FONT,
                  WebkitTapHighlightColor:'transparent', color:'#E8EAFF'}}>
                <span style={{fontSize:20}}>{CONTEXTS.find(c => c.id === selectedContext)?.icon}</span>
                <span style={{flex:1, textAlign:'left', fontSize:13, fontWeight:600, color:'#6C63FF'}}>
                  {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
                </span>
                <Icon name={showContextDropdown ? 'chevUp' : 'chevDown'} size={16} color="rgba(232,234,255,0.4)" />
              </button>
              {showContextDropdown && (
                <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                  marginTop:4, borderRadius:14, overflow:'hidden',
                  background:'rgba(15,18,53,0.95)', border:'1.5px solid rgba(108,99,255,0.2)',
                  backdropFilter:'blur(20px)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)',
                  maxHeight:260, overflowY:'auto'}}>
                  {CONTEXTS.map(c => {
                    const isSel = selectedContext === c.id;
                    return (
                      <button key={c.id} onClick={() => { setSelectedContext(c.id); setShowContextDropdown(false); }}
                        style={{width:'100%', padding:'10px 12px', cursor:'pointer',
                          display:'flex', alignItems:'center', gap:8, fontFamily:FONT,
                          WebkitTapHighlightColor:'transparent', transition:'all 0.1s',
                          background: isSel ? 'rgba(108,99,255,0.12)' : 'transparent',
                          border:'none', borderBottom:'1px solid rgba(232,234,255,0.04)',
                          color:'#E8EAFF'}}>
                        <span style={{fontSize:18, width:26, textAlign:'center'}}>{c.icon}</span>
                        <span style={{flex:1, textAlign:'left', fontSize:12, fontWeight: isSel ? 700 : 500,
                          color: isSel ? '#6C63FF' : 'rgba(232,234,255,0.6)'}}>
                          {L(c.nameKey)}
                        </span>
                        {isSel && <span style={{fontSize:11, color:'#6C63FF'}}>{'\u2713'}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{...S.label, marginBottom:4, fontSize:10}}>{L('descriptionOptional')}</div>
              <input style={{...S.input, fontSize:12, padding:'9px 11px'}} value={roomDescription}
                onChange={e => setRoomDescription(e.target.value)} placeholder="..." maxLength={150} />
            </div>
            <button style={{...S.btn, width:'100%', padding:'12px 0', fontSize:15, fontWeight:800,
              background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
              boxShadow:'0 4px 24px rgba(108,99,255,0.35)', borderRadius:12}}
              onClick={() => { vibrate(); handleCreateRoom(); }}>
              {L('createRoom')}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            ACCOUNT AREA
           ══════════════════════════════════════════════════ */}

        {/* Guest → sign in */}
        {isGuest && (
          <button style={{
            width:'100%', maxWidth:400, padding:'14px 16px', borderRadius:18, cursor:'pointer',
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,107,157,0.05))',
            border:'1.5px solid rgba(108,99,255,0.18)', marginBottom:14,
            display:'flex', alignItems:'center', gap:14, fontFamily:FONT,
            WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <div style={{width:48, height:48, borderRadius:14,
              background:'rgba(108,99,255,0.12)', border:'1.5px solid rgba(108,99,255,0.22)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <Icon name="user" size={26} color="#6C63FF" />
            </div>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:14, color:'#6C63FF'}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.4)', marginTop:2}}>{L('signInProDesc')}</div>
            </div>
            <span style={{fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:7,
              background:'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,210,255,0.12))',
              color:'#6C63FF'}}>PRO</span>
          </button>
        )}

        {/* Logged in → balance bar */}
        {!isGuest && userAccount && (
          <div style={{width:'100%', maxWidth:400, padding:'12px 16px', borderRadius:16,
            background:'rgba(108,99,255,0.05)', border:'1px solid rgba(108,99,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <Icon name="credit" size={20} color={useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'} />
              <div>
                <div style={{fontSize:9, color:'rgba(232,234,255,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
                  {useOwnKeys ? L('personalApiKeys') : L('credit')}
                </div>
                <div style={{fontSize:16, fontWeight:700, color: useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'}}>
                  {useOwnKeys ? '\u2713 ' + L('active') : formatCredits(creditBalance)}
                </div>
              </div>
            </div>
            <div style={{display:'flex', gap:5}}>
              <button style={{padding:'7px 12px', borderRadius:10, background:'rgba(108,99,255,0.12)',
                border:'1px solid rgba(108,99,255,0.2)', color:'#6C63FF', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:4}}
                onClick={() => { refreshBalance(); setView('credits'); }}>
                <Icon name="zap" size={14} color="#6C63FF" />
                {L('recharge')}
              </button>
              <button style={{padding:'7px 10px', borderRadius:10, background:'rgba(0,210,255,0.08)',
                border:'1px solid rgba(0,210,255,0.15)', color:'#00D2FF', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:4}}
                onClick={() => setView('apikeys')}>
                <Icon name="key" size={14} color="#00D2FF" />
                API
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            QUICK ACTIONS — compact row
           ══════════════════════════════════════════════════ */}
        <div style={{display:'flex', gap:8, justifyContent:'center', width:'100%', maxWidth:400, flexWrap:'wrap'}}>
          <button style={{
            flex:'1 1 22%', minWidth:72, padding:'14px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.10)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => setShowShareApp(!showShareApp)}>
            <Icon name="share" size={26} color={showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.45)'} />
            <span style={{fontSize:10, fontWeight:700, color: showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.40)'}}>
              {L('shareAppBtn')}
            </span>
          </button>

          <button style={{
            flex:'1 1 22%', minWidth:72, padding:'14px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(108,99,255,0.03)', border:'1px solid rgba(108,99,255,0.08)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { loadHistory(); setView('history'); }}>
            <Icon name="history" size={26} color="rgba(232,234,255,0.45)" />
            <span style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.40)'}}>
              {L('history')}
            </span>
          </button>

          <button style={{
            flex:'1 1 22%', minWidth:72, padding:'14px 0', borderRadius:16, cursor:'pointer',
            background:'rgba(255,107,157,0.03)', border:'1px solid rgba(255,107,157,0.08)',
            display:'flex', flexDirection:'column', alignItems:'center', gap:6,
            fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
          }}
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
            <Icon name="graduation" size={26} color="rgba(232,234,255,0.45)" />
            <span style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.40)'}}>
              {L('tutorial')}
            </span>
          </button>

          {!isGuest && (
            <button style={{
              flex:'1 1 22%', minWidth:72, padding:'14px 0', borderRadius:16, cursor:'pointer',
              background:'rgba(255,107,157,0.03)', border:'1px solid rgba(255,107,157,0.08)',
              display:'flex', flexDirection:'column', alignItems:'center', gap:6,
              fontFamily:FONT, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'
            }}
              onClick={() => { logout({ clearPrefs: true }); setPrefs({ name:'', lang:'it', avatar:'/avatars/1.png', voice:'nova', autoPlay:true }); setView('welcome'); }}>
              <Icon name="logout" size={26} color="#FF6B9D" />
              <span style={{fontSize:10, fontWeight:700, color:'#FF6B9D'}}>
                {L('logoutAccount') || 'Logout'}
              </span>
            </button>
          )}
        </div>

        {/* ── Share App panel ── */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:400, marginTop:10, padding:'14px', borderRadius:16,
            background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.1)',
            backdropFilter:'blur(20px)'}}>
            <div style={{marginBottom:8}}>
              <div style={{...S.label, fontSize:10}}>{L('inviteLangLabel')}</div>
              <select style={{...S.select, fontSize:12}} value={shareAppLang} onChange={e => setShareAppLang(e.target.value)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <div style={{textAlign:'center', marginBottom:8}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${APP_URL}?lang=${shareAppLang}`)}`}
                alt="QR" style={{width:120, height:120, borderRadius:14, background:'#fff', padding:6}} />
            </div>
            <button style={{...S.btn, width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background:'rgba(0,210,255,0.12)', border:'1px solid rgba(0,210,255,0.25)', color:'#00D2FF', fontSize:13}}
              onClick={() => shareApp()}>
              <Icon name="share" size={16} color="#00D2FF" />
              {L('shareLink')}
            </button>

            {!isGuest && referralCode && (
              <div style={{marginTop:8, padding:'10px 12px', borderRadius:12,
                background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.1)',
                display:'flex', alignItems:'center', gap:8}}>
                <Icon name="gift" size={18} color="#FF6B9D" />
                <div style={{flex:1, fontFamily:"'Courier New', monospace", fontSize:13, fontWeight:700, color:'#FF6B9D'}}>
                  {referralCode}
                </div>
                <button style={{padding:'6px 10px', borderRadius:8, background:'rgba(255,107,157,0.1)',
                  border:'1px solid rgba(255,107,157,0.2)', color:'#FF6B9D', fontSize:10, fontWeight:700,
                  cursor:'pointer', fontFamily:FONT, display:'flex', alignItems:'center', gap:3}}
                  onClick={() => {
                    const url = `${APP_URL}?ref=${referralCode}&lang=${shareAppLang}`;
                    const text = `${L('referralInviteText') || 'Join me on VoiceTranslate!'} ${referralCode} - ${url}`;
                    if (navigator.share) { navigator.share({ title:'VoiceTranslate', text, url }); }
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

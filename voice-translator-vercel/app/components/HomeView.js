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
  const lowCredits = !isGuest && !useOwnKeys && !isTrial && creditBalance < 30;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            TOP BAR — avatar + name + logout + settings
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:400, marginBottom:14,
          padding:'10px 14px', borderRadius:18, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)'}}>
          <AvatarImg src={prefs.avatar} size={40} style={{borderRadius:12}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15, fontWeight:800, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:11, color:'rgba(232,234,255,0.5)', display:'flex', alignItems:'center', gap:4}}>
              <span style={{fontSize:15}}>{langInfo.flag}</span>
              <span style={{fontSize:9, fontWeight:800, padding:'1px 7px', borderRadius:6,
                background: isTrial || isGuest ? 'rgba(0,255,148,0.12)' : 'rgba(108,99,255,0.15)',
                color: isTrial || isGuest ? '#00FF94' : '#6C63FF'}}>
                {isGuest || isTrial ? 'FREE' : 'PRO'}
              </span>
              {useOwnKeys && (
                <span style={{fontSize:9, padding:'1px 5px', borderRadius:4,
                  background:'rgba(0,210,255,0.1)', color:'#00D2FF'}}>
                  <Icon name="key" size={8} color="#00D2FF" /> API
                </span>
              )}
            </div>
          </div>
          {/* Right icons */}
          <div style={{display:'flex', gap:6}}>
            {!isGuest && (
              <button style={{width:36, height:36, borderRadius:10, cursor:'pointer',
                background:'rgba(255,107,157,0.06)', border:'1px solid rgba(255,107,157,0.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => { logout({ clearPrefs: true }); setPrefs({ name:'', lang:'it', avatar:'/avatars/1.png', voice:'nova', autoPlay:true }); setView('welcome'); }}
                title={L('logoutAccount')}>
                <Icon name="logout" size={16} color="#FF6B9D" />
              </button>
            )}
            <button style={{width:36, height:36, borderRadius:10, cursor:'pointer',
              background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => setView('settings')}>
              <Icon name="settings" size={18} color="rgba(232,234,255,0.6)" />
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            LOW CREDITS WARNING (only when needed)
           ═══════════════════════════════════════ */}
        {lowCredits && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'10px 14px', borderRadius:14,
            background:'rgba(255,107,157,0.06)', border:'1px solid rgba(255,107,157,0.15)',
            display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontFamily:FONT,
            WebkitTapHighlightColor:'transparent'}}
            onClick={() => { refreshBalance(); setView('credits'); }}>
            <span style={{fontSize:18}}>{'\u26A0\uFE0F'}</span>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontSize:12, fontWeight:700, color:'#FF6B9D'}}>
                {L('lowCreditsWarning') || 'Crediti in esaurimento'}
              </div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.4)', marginTop:1}}>
                {formatCredits(creditBalance)} {L('remaining') || 'rimanenti'} — {L('tapToRecharge') || 'tocca per ricaricare'}
              </div>
            </div>
            <Icon name="zap" size={18} color="#FF6B9D" />
          </button>
        )}

        {/* Guest sign in prompt */}
        {isGuest && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'12px 14px', borderRadius:14,
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,210,255,0.04))',
            border:'1.5px solid rgba(108,99,255,0.18)', cursor:'pointer', fontFamily:FONT,
            display:'flex', alignItems:'center', gap:10, WebkitTapHighlightColor:'transparent', color:'#E8EAFF'}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <Icon name="user" size={22} color="#6C63FF" />
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:13, color:'#6C63FF'}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.4)'}}>
                {L('signInProDesc')}
              </div>
            </div>
            <span style={{fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6,
              background:'rgba(108,99,255,0.15)', color:'#6C63FF'}}>PRO</span>
          </button>
        )}

        {/* ═══════════════════════════════════════
            CREA STANZA — main CTA
           ═══════════════════════════════════════ */}
        <button style={{
          width:'100%', maxWidth:400, padding:'22px 16px', borderRadius:22, cursor:'pointer',
          background:'linear-gradient(135deg, rgba(108,99,255,0.12), rgba(0,210,255,0.06))',
          border:'2px solid rgba(108,99,255,0.25)',
          display:'flex', alignItems:'center', gap:14,
          fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
          color:'#E8EAFF', marginBottom:12,
          boxShadow:'0 4px 30px rgba(108,99,255,0.08)'
        }}
          onClick={() => {
            vibrate();
            if (isGuest) { setAuthStep('email'); setView('account'); return; }
            setShowCreatePanel(!showCreatePanel);
          }}>
          <div style={{width:60, height:60, borderRadius:18,
            background:'linear-gradient(135deg, rgba(108,99,255,0.2), rgba(0,210,255,0.12))',
            border:'1.5px solid rgba(108,99,255,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="doorCreate" size={32} color="#6C63FF" />
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:800, fontSize:17, letterSpacing:-0.3}}>{L('createRoom')}</div>
            <div style={{fontSize:11, color:'rgba(232,234,255,0.40)', marginTop:3}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
            </div>
          </div>
          <Icon name={showCreatePanel ? 'chevUp' : 'chevDown'} size={20} color="rgba(232,234,255,0.3)" />
        </button>

        {/* Create Room — expandable config */}
        {showCreatePanel && (
          <div style={{width:'100%', maxWidth:400, padding:'14px', borderRadius:16,
            background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
            marginBottom:12}}>
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
            <button style={{...S.btn, width:'100%', padding:'13px 0', fontSize:15, fontWeight:800,
              background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
              boxShadow:'0 4px 24px rgba(108,99,255,0.35)', borderRadius:12}}
              onClick={() => { vibrate(); handleCreateRoom(); }}>
              {L('createRoom')}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            INVITE CARD — full width with avatar
           ═══════════════════════════════════════ */}
        <button style={{width:'100%', maxWidth:400, marginBottom:8, padding:'12px 14px', borderRadius:16,
          background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.1)',
          display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', color:'#E8EAFF'}}
          onClick={() => setShowShareApp(!showShareApp)}>
          <img src="/avatars/2.png" alt="" style={{width:42, height:42, objectFit:'contain', borderRadius:12}} />
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:700, fontSize:13}}>
              {L('inviteFriend') || 'Invita un amico'}
            </div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', marginTop:1}}>
              {L('inviteFriendDesc') || 'Condividi VoiceTranslate con QR o link'}
            </div>
          </div>
          <Icon name="share" size={20} color="#00D2FF" />
        </button>

        {/* Share panel (expandable) */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:400, marginBottom:8, padding:'14px', borderRadius:16,
            background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.1)'}}>
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

        {/* ═══════════════════════════════════════
            MINI ACTIONS ROW — history + tutorial
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', gap:8, width:'100%', maxWidth:400}}>
          <button style={{flex:1, padding:'10px 12px', borderRadius:14, cursor:'pointer',
            background:'rgba(108,99,255,0.03)', border:'1px solid rgba(108,99,255,0.08)',
            display:'flex', alignItems:'center', gap:8, fontFamily:FONT,
            WebkitTapHighlightColor:'transparent', color:'#E8EAFF'}}
            onClick={() => { loadHistory(); setView('history'); }}>
            <Icon name="history" size={18} color="rgba(232,234,255,0.4)" />
            <span style={{fontSize:12, fontWeight:600, color:'rgba(232,234,255,0.4)'}}>
              {L('history')}
            </span>
          </button>
          <button style={{flex:1, padding:'10px 12px', borderRadius:14, cursor:'pointer',
            background:'rgba(255,107,157,0.03)', border:'1px solid rgba(255,107,157,0.08)',
            display:'flex', alignItems:'center', gap:8, fontFamily:FONT,
            WebkitTapHighlightColor:'transparent', color:'#E8EAFF'}}
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
            <Icon name="graduation" size={18} color="rgba(232,234,255,0.4)" />
            <span style={{fontSize:12, fontWeight:600, color:'rgba(232,234,255,0.4)'}}>
              {L('tutorial')}
            </span>
          </button>
        </div>

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

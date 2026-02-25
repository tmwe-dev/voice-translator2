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
  isTrial, platformHasEL, referralCode, theme, setTheme, logout,
  showInstallBanner, handleInstallApp, dismissInstallBanner,
  notifPermission, requestNotifPermission, deferredInstallPrompt }) {

  const langInfo = getLang(prefs.lang);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [showContextDropdown, setShowContextDropdown] = useState(false);

  const isGuest = !userToken;
  const lowCredits = !isGuest && !useOwnKeys && !isTrial && creditBalance < 30;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>

        {/* ═══════════════════════════════════════
            TOP BAR — avatar + name + history + tutorial + logout + settings
           ═══════════════════════════════════════ */}
        <div style={{display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:400, marginBottom:14,
          padding:'10px 14px', borderRadius:18, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)'}}>
          <AvatarImg src={prefs.avatar} size={40} style={{borderRadius:12}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15, fontWeight:800, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.72)', display:'flex', alignItems:'center', gap:4}}>
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
          {/* Right icons: history, tutorial, logout, settings */}
          <div style={{display:'flex', gap:4}}>
            {!isGuest && (
              <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
                background:'rgba(0,210,255,0.06)', border:'1px solid rgba(0,210,255,0.15)',
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => setView('contacts')}
                title={L('createRoom') === 'Crea Stanza' ? 'Contatti' : 'Contacts'}>
                <span style={{fontSize:14}}>{'👥'}</span>
              </button>
            )}
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => { loadHistory(); setView('history'); }}
              title={L('history')}>
              <Icon name="history" size={15} color="rgba(255,255,255,0.65)" />
            </button>
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
              title={L('tutorial')}>
              <Icon name="graduation" size={15} color="rgba(255,255,255,0.65)" />
            </button>
            {!isGuest && (
              <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
                background:'rgba(255,107,157,0.06)', border:'1px solid rgba(255,107,157,0.12)',
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent'}}
                onClick={() => { logout({ clearPrefs: true }); setPrefs({ name:'', lang:'it', avatar:'/avatars/1.png', voice:'nova', autoPlay:true }); setView('welcome'); }}
                title={L('logoutAccount')}>
                <Icon name="logout" size={14} color="#FF6B9D" />
              </button>
            )}
            <button style={{width:32, height:32, borderRadius:9, cursor:'pointer',
              background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.12)',
              display:'flex', alignItems:'center', justifyContent:'center',
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => setView('settings')}>
              <Icon name="settings" size={16} color="rgba(255,255,255,0.80)" />
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
              <div style={{fontSize:10, color:'rgba(255,255,255,0.65)', marginTop:1}}>
                {formatCredits(creditBalance)} {L('remaining') || 'rimanenti'} — {L('tapToRecharge') || 'tocca per ricaricare'}
              </div>
            </div>
            <Icon name="zap" size={18} color="#FF6B9D" />
          </button>
        )}

        {/* PWA Install Banner */}
        {showInstallBanner && deferredInstallPrompt && (
          <div style={{width:'100%', maxWidth:400, marginBottom:10, padding:'12px 14px', borderRadius:14,
            background:'linear-gradient(135deg, rgba(78,205,196,0.08), rgba(108,99,255,0.06))',
            border:'1.5px solid rgba(78,205,196,0.2)', fontFamily:FONT,
            display:'flex', alignItems:'center', gap:10, animation:'vtFadeIn 0.3s ease'}}>
            <div style={{width:40, height:40, borderRadius:10,
              background:'linear-gradient(135deg, #4ecdc4, #6C63FF)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <span style={{fontSize:20}}>{'📲'}</span>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:12, color:'#4ecdc4'}}>
                {L('installApp') || 'Installa VoiceTranslate'}
              </div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.60)', marginTop:1}}>
                {L('installAppDesc') || 'Aggiungi al desktop per accesso rapido e notifiche'}
              </div>
            </div>
            <div style={{display:'flex', gap:4, flexShrink:0}}>
              <button onClick={handleInstallApp}
                style={{padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg, #4ecdc4, #6C63FF)', color:'#fff',
                  fontSize:10, fontWeight:700, fontFamily:FONT}}>
                {L('install') || 'Installa'}
              </button>
              <button onClick={dismissInstallBanner}
                style={{padding:'6px 8px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)',
                  background:'transparent', color:'rgba(255,255,255,0.4)', cursor:'pointer',
                  fontSize:12, fontFamily:FONT}}>
                {'\u2716'}
              </button>
            </div>
          </div>
        )}

        {/* Notification permission prompt (only if app installed but notifications not granted) */}
        {!showInstallBanner && notifPermission === 'default' && !isGuest && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'10px 14px', borderRadius:14,
            background:'rgba(255,170,0,0.06)', border:'1px solid rgba(255,170,0,0.15)',
            display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontFamily:FONT,
            WebkitTapHighlightColor:'transparent'}}
            onClick={requestNotifPermission}>
            <span style={{fontSize:18}}>{'🔔'}</span>
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontSize:12, fontWeight:700, color:'#ffaa00'}}>
                {L('enableNotifications') || 'Attiva le notifiche'}
              </div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.55)', marginTop:1}}>
                {L('enableNotifDesc') || 'Ricevi avvisi quando arrivano messaggi nella stanza'}
              </div>
            </div>
            <Icon name="bell" size={18} color="#ffaa00" />
          </button>
        )}

        {/* Guest sign in prompt */}
        {isGuest && (
          <button style={{width:'100%', maxWidth:400, marginBottom:10, padding:'12px 14px', borderRadius:14,
            background:'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,210,255,0.04))',
            border:'1.5px solid rgba(108,99,255,0.18)', cursor:'pointer', fontFamily:FONT,
            display:'flex', alignItems:'center', gap:10, WebkitTapHighlightColor:'transparent', color:'#FFFFFF'}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <Icon name="user" size={22} color="#6C63FF" />
            <div style={{flex:1, textAlign:'left'}}>
              <div style={{fontWeight:700, fontSize:13, color:'#6C63FF'}}>{L('loginToCreateRooms')}</div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.65)'}}>
                {L('signInProDesc')}
              </div>
            </div>
            <span style={{fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6,
              background:'rgba(108,99,255,0.15)', color:'#6C63FF'}}>PRO</span>
          </button>
        )}

        {/* ═══════════════════════════════════════
            CREA STANZA — standalone icon + text (no card)
           ═══════════════════════════════════════ */}
        <button style={{
          width:'100%', maxWidth:400, padding:0, cursor:'pointer',
          background:'transparent', border:'none',
          display:'flex', alignItems:'center', gap:16,
          fontFamily:FONT, WebkitTapHighlightColor:'transparent',
          color:'#FFFFFF', marginBottom:16, marginTop:8,
        }}
          onClick={() => {
            vibrate();
            if (isGuest) { setAuthStep('email'); setView('account'); return; }
            setShowCreatePopup(true);
          }}>
          {/* 3D Door Icon */}
          <div style={{
            width:72, height:72, borderRadius:22, flexShrink:0,
            background:'linear-gradient(145deg, #7B73FF 0%, #5A4FFF 40%, #3D35CC 100%)',
            boxShadow:'0 8px 32px rgba(108,99,255,0.35), 0 2px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
            display:'flex', alignItems:'center', justifyContent:'center',
            position:'relative', overflow:'hidden',
          }}>
            {/* Shine effect */}
            <div style={{position:'absolute', top:-10, right:-10, width:40, height:40,
              background:'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)',
              borderRadius:'50%'}} />
            {/* Door shape */}
            <div style={{
              width:32, height:42, borderRadius:'6px 6px 0 0',
              background:'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(230,230,255,0.85) 100%)',
              boxShadow:'0 2px 8px rgba(0,0,0,0.2)',
              position:'relative',
            }}>
              {/* Door handle */}
              <div style={{width:4, height:4, borderRadius:'50%',
                background:'#FFD700', boxShadow:'0 0 6px rgba(255,215,0,0.6)',
                position:'absolute', right:5, top:'50%', transform:'translateY(-50%)'}} />
              {/* Door panel top line */}
              <div style={{width:18, height:2, borderRadius:1,
                background:'rgba(108,99,255,0.15)', position:'absolute', top:8, left:'50%', transform:'translateX(-50%)'}} />
              {/* Door panel rectangle */}
              <div style={{width:18, height:14, borderRadius:3,
                border:'1.5px solid rgba(108,99,255,0.12)',
                position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)'}} />
            </div>
          </div>
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:900, fontSize:20, letterSpacing:-0.5,
              background:'linear-gradient(135deg, #7B73FF, #00D2FF)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              backgroundClip:'text'}}>
              {L('createRoom')}
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.58)', marginTop:3, display:'flex', alignItems:'center', gap:4}}>
              <span style={{fontSize:14}}>{CONTEXTS.find(c => c.id === selectedContext)?.icon}</span>
              <span>{L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}</span>
            </div>
          </div>
        </button>

        {/* ═══════════════════════════════════════
            CREATE ROOM POPUP — modal overlay
           ═══════════════════════════════════════ */}
        {showCreatePopup && (
          <>
            {/* Backdrop */}
            <div onClick={() => { setShowCreatePopup(false); setShowContextDropdown(false); }}
              style={{position:'fixed', inset:0, zIndex:200,
                background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)',
                animation:'vtFadeIn 0.2s ease-out'}} />
            {/* Popup */}
            <div style={{position:'fixed', left:'50%', top:'50%', transform:'translate(-50%, -50%)',
              zIndex:201, width:'calc(100% - 40px)', maxWidth:380,
              padding:'22px 18px', borderRadius:24,
              background:'linear-gradient(160deg, rgba(20,22,50,0.98) 0%, rgba(15,17,40,0.98) 100%)',
              border:'1.5px solid rgba(108,99,255,0.2)',
              boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(108,99,255,0.08)',
              animation:'vtSlideUp 0.25s ease-out'}}>
              {/* Header */}
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18}}>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{fontSize:22}}>{'\u{1F6AA}'}</span>
                  <div style={{fontWeight:800, fontSize:17, letterSpacing:-0.3, color:'#FFFFFF'}}>
                    {L('createRoom')}
                  </div>
                </div>
                <button onClick={() => { setShowCreatePopup(false); setShowContextDropdown(false); }}
                  style={{width:32, height:32, borderRadius:10, cursor:'pointer',
                    background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    WebkitTapHighlightColor:'transparent', color:'rgba(255,255,255,0.55)',
                    fontSize:16, fontWeight:400}}>
                  {'\u2715'}
                </button>
              </div>

              {/* Context selector */}
              <div style={{marginBottom:14, position:'relative'}}>
                <div style={{fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.55)',
                  textTransform:'uppercase', letterSpacing:1, marginBottom:6}}>
                  {L('context')}
                </div>
                <button onClick={() => setShowContextDropdown(!showContextDropdown)}
                  style={{width:'100%', padding:'12px 14px', borderRadius:14, cursor:'pointer',
                    background:'rgba(108,99,255,0.08)', border:'1.5px solid rgba(108,99,255,0.2)',
                    display:'flex', alignItems:'center', gap:10, fontFamily:FONT,
                    WebkitTapHighlightColor:'transparent', color:'#FFFFFF', transition:'all 0.15s'}}>
                  <span style={{fontSize:22}}>{CONTEXTS.find(c => c.id === selectedContext)?.icon}</span>
                  <div style={{flex:1, textAlign:'left'}}>
                    <span style={{fontSize:14, fontWeight:700, color:'#6C63FF'}}>
                      {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
                    </span>
                    <div style={{fontSize:10, color:'rgba(255,255,255,0.50)', marginTop:2}}>
                      {L(CONTEXTS.find(c => c.id === selectedContext)?.descKey) || ''}
                    </div>
                  </div>
                  <Icon name={showContextDropdown ? 'chevUp' : 'chevDown'} size={16} color="rgba(255,255,255,0.55)" />
                </button>
                {showContextDropdown && (
                  <div style={{position:'absolute', top:'100%', left:0, right:0, zIndex:50,
                    marginTop:4, borderRadius:16, overflow:'hidden',
                    background:'rgba(12,14,42,0.98)', border:'1.5px solid rgba(108,99,255,0.2)',
                    backdropFilter:'blur(20px)', boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
                    maxHeight:240, overflowY:'auto'}}>
                    {CONTEXTS.map(c => {
                      const isSel = selectedContext === c.id;
                      return (
                        <button key={c.id} onClick={() => { setSelectedContext(c.id); setShowContextDropdown(false); }}
                          style={{width:'100%', padding:'10px 14px', cursor:'pointer',
                            display:'flex', alignItems:'center', gap:10, fontFamily:FONT,
                            WebkitTapHighlightColor:'transparent', transition:'all 0.1s',
                            background: isSel ? 'rgba(108,99,255,0.12)' : 'transparent',
                            border:'none', borderBottom:'1px solid rgba(255,255,255,0.04)',
                            color:'#FFFFFF'}}>
                          <span style={{fontSize:18, width:28, textAlign:'center'}}>{c.icon}</span>
                          <span style={{flex:1, textAlign:'left', fontSize:13, fontWeight: isSel ? 700 : 500,
                            color: isSel ? '#6C63FF' : 'rgba(255,255,255,0.80)'}}>
                            {L(c.nameKey)}
                          </span>
                          {isSel && <span style={{fontSize:12, color:'#6C63FF'}}>{'\u2713'}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Description */}
              <div style={{marginBottom:18}}>
                <div style={{fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.55)',
                  textTransform:'uppercase', letterSpacing:1, marginBottom:6}}>
                  {L('descriptionOptional')}
                </div>
                <input style={{...S.input, fontSize:13, padding:'11px 14px', borderRadius:14}} value={roomDescription}
                  onChange={e => setRoomDescription(e.target.value)}
                  placeholder={L('descriptionPlaceholder') || 'Es. lezione di italiano...'}
                  maxLength={150} />
              </div>

              {/* Create button */}
              <button style={{
                width:'100%', padding:'16px 0', borderRadius:16, cursor:'pointer', border:'none',
                background:'linear-gradient(135deg, #6C63FF 0%, #00D2FF 100%)',
                boxShadow:'0 6px 24px rgba(108,99,255,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                color:'#FFFFFF', fontFamily:FONT, fontSize:16, fontWeight:900,
                letterSpacing:-0.3, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s'
              }}
                onClick={() => { vibrate(); setShowCreatePopup(false); handleCreateRoom(); }}>
                <span style={{fontSize:20}}>{'\u{1F680}'}</span>
                {L('createRoom')}
              </button>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════
            INVITE CARD — full width with avatar
           ═══════════════════════════════════════ */}
        <button style={{width:'100%', maxWidth:400, marginBottom:8, padding:'12px 14px', borderRadius:16,
          background:'rgba(0,210,255,0.04)', border:'1px solid rgba(0,210,255,0.1)',
          display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:FONT,
          WebkitTapHighlightColor:'transparent', color:'#FFFFFF'}}
          onClick={() => setShowShareApp(!showShareApp)}>
          <img src="/avatars/2.png" alt="" style={{width:42, height:42, objectFit:'contain', borderRadius:12}} />
          <div style={{flex:1, textAlign:'left'}}>
            <div style={{fontWeight:700, fontSize:13}}>
              {L('inviteFriend') || 'Invita un amico'}
            </div>
            <div style={{fontSize:10, color:'rgba(255,255,255,0.58)', marginTop:1}}>
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

        {status && <div style={S.statusMsg}>{status}</div>}

        {showTutorial && (
          <TutorialOverlay L={L} tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep} setShowTutorial={setShowTutorial} />
        )}
      </div>

      {/* Popup animations */}
      <style>{`
        @keyframes vtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vtSlideUp {
          from { opacity: 0; transform: translate(-50%, -45%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </div>
  );
});

export default HomeView;

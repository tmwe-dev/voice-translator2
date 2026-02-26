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
            CREA STANZA — elegant 3D door, no background
           ═══════════════════════════════════════ */}
        <div style={{
          width:'100%', maxWidth:400, display:'flex', flexDirection:'column',
          alignItems:'center', marginTop:12, marginBottom:20,
        }}>
          {/* 3D Door — pure icon, no box */}
          <button style={{
            background:'transparent', border:'none', cursor:'pointer',
            padding:0, WebkitTapHighlightColor:'transparent',
            display:'flex', flexDirection:'column', alignItems:'center',
            transition:'transform 0.2s ease',
          }}
            onClick={() => {
              vibrate();
              if (isGuest) { setAuthStep('email'); setView('account'); return; }
              setShowCreatePopup(true);
            }}>
            {/* Door SVG 3D */}
            <div style={{
              width:140, height:180, position:'relative',
              animation:'vtDoorGlow 3s ease-in-out infinite',
            }}>
              <svg viewBox="0 0 140 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%', height:'100%'}}>
                {/* Glow underneath */}
                <defs>
                  <linearGradient id="doorBody" x1="30" y1="8" x2="110" y2="172">
                    <stop offset="0%" stopColor="#9B93FF"/>
                    <stop offset="35%" stopColor="#7B73FF"/>
                    <stop offset="100%" stopColor="#4A40E0"/>
                  </linearGradient>
                  <linearGradient id="doorFace" x1="38" y1="14" x2="102" y2="168">
                    <stop offset="0%" stopColor="#B8B3FF"/>
                    <stop offset="40%" stopColor="#8B83FF"/>
                    <stop offset="100%" stopColor="#5A50F0"/>
                  </linearGradient>
                  <linearGradient id="panelGrad" x1="48" y1="28" x2="92" y2="90">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.18)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,0.04)"/>
                  </linearGradient>
                  <linearGradient id="panelGrad2" x1="48" y1="100" x2="92" y2="155">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.12)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,0.02)"/>
                  </linearGradient>
                  <linearGradient id="handleGrad" x1="95" y1="88" x2="102" y2="100">
                    <stop offset="0%" stopColor="#FFE066"/>
                    <stop offset="100%" stopColor="#FFB800"/>
                  </linearGradient>
                  <radialGradient id="handleGlow" cx="98" cy="94" r="12" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(255,215,0,0.35)"/>
                    <stop offset="100%" stopColor="rgba(255,215,0,0)"/>
                  </radialGradient>
                  <linearGradient id="archGrad" x1="34" y1="6" x2="106" y2="6">
                    <stop offset="0%" stopColor="#C4BFFF"/>
                    <stop offset="50%" stopColor="#D4D0FF"/>
                    <stop offset="100%" stopColor="#A8A0FF"/>
                  </linearGradient>
                  <linearGradient id="shineGrad" x1="42" y1="14" x2="60" y2="60">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.30)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
                  </linearGradient>
                  <linearGradient id="floorGlow" x1="30" y1="172" x2="110" y2="180">
                    <stop offset="0%" stopColor="rgba(108,99,255,0)"/>
                    <stop offset="50%" stopColor="rgba(108,99,255,0.15)"/>
                    <stop offset="100%" stopColor="rgba(108,99,255,0)"/>
                  </linearGradient>
                </defs>

                {/* Floor glow */}
                <ellipse cx="70" cy="175" rx="50" ry="5" fill="url(#floorGlow)"/>

                {/* Door frame / body - 3D perspective */}
                <rect x="30" y="8" width="80" height="164" rx="8" fill="url(#doorBody)"/>

                {/* Door face (slightly inset for 3D depth) */}
                <rect x="34" y="12" width="72" height="156" rx="6" fill="url(#doorFace)"/>

                {/* Arch detail at top */}
                <path d="M38 18 Q70 4 102 18" stroke="url(#archGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

                {/* Top panel (recessed) */}
                <rect x="48" y="28" width="44" height="58" rx="5" fill="url(#panelGrad)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>

                {/* Bottom panel (recessed) */}
                <rect x="48" y="100" width="44" height="54" rx="5" fill="url(#panelGrad2)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

                {/* Handle glow */}
                <circle cx="98" cy="94" r="12" fill="url(#handleGlow)"/>

                {/* Door handle - elegant round */}
                <circle cx="98" cy="94" r="5" fill="url(#handleGrad)" stroke="rgba(255,200,0,0.3)" strokeWidth="0.5"/>

                {/* Handle highlight */}
                <circle cx="96.5" cy="92.5" r="2" fill="rgba(255,255,255,0.45)"/>

                {/* Keyhole */}
                <ellipse cx="98" cy="102" rx="1.5" ry="2" fill="rgba(0,0,0,0.25)"/>

                {/* Light shine on door (top-left) */}
                <path d="M38 14 L58 14 Q42 50 38 70 Z" fill="url(#shineGrad)" opacity="0.7"/>

                {/* Side shadow for depth */}
                <rect x="30" y="8" width="6" height="164" rx="4" fill="rgba(0,0,0,0.12)"/>
              </svg>
            </div>

            {/* Text under door */}
            <div style={{marginTop:16, textAlign:'center'}}>
              <div style={{
                fontWeight:900, fontSize:24, letterSpacing:-0.8,
                background:'linear-gradient(135deg, #B8B3FF 0%, #7B73FF 40%, #00D2FF 100%)',
                WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                backgroundClip:'text', fontFamily:FONT,
              }}>
                {L('createRoom')}
              </div>
              <div style={{fontSize:12, color:'rgba(255,255,255,0.40)', marginTop:4, fontFamily:FONT, letterSpacing:0.5}}>
                {L('tapToStart') || 'Tocca per iniziare'}
              </div>
            </div>
          </button>
        </div>

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
        @keyframes vtDoorGlow {
          0%, 100% { filter: drop-shadow(0 16px 40px rgba(108,99,255,0.30)) drop-shadow(0 4px 12px rgba(0,0,0,0.25)); }
          50% { filter: drop-shadow(0 16px 48px rgba(108,99,255,0.45)) drop-shadow(0 6px 16px rgba(0,0,0,0.30)); }
        }
      `}</style>
    </div>
  );
});

export default HomeView;

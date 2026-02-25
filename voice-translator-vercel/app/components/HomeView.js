'use client';
import { memo } from 'react';
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

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        {/* Profile header - compact */}
        <div style={{display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:380, marginBottom:14,
          padding:'10px 14px', borderRadius:16, background:'rgba(108,99,255,0.06)',
          border:'1px solid rgba(108,99,255,0.1)', backdropFilter:'blur(20px)'}}>
          <AvatarImg src={prefs.avatar} size={44} style={{borderRadius:14}} />
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:15, fontWeight:700, letterSpacing:-0.3}}>{prefs.name}</div>
            <div style={{fontSize:12, color:'rgba(232,234,255,0.5)', display:'flex', alignItems:'center', gap:4}}>
              <span>{langInfo.flag}</span> <span>{langInfo.name}</span>
            </div>
          </div>
          <div style={{display:'flex', gap:6}}>
            <button style={{...S.backBtn, width:34, height:34, borderRadius:10}}
              onClick={() => setView('settings')}>
              <Icon name="settings" size={16} color="rgba(232,234,255,0.6)" />
            </button>
            <button style={{...S.backBtn, width:34, height:34, borderRadius:10}}
              onClick={() => { loadHistory(); setView('history'); }}>
              <Icon name="history" size={16} color="rgba(232,234,255,0.6)" />
            </button>
            {userToken && (
              <button style={{...S.backBtn, width:34, height:34, borderRadius:10}}
                onClick={() => setView('apikeys')}>
                <Icon name="key" size={16} color="rgba(232,234,255,0.6)" />
              </button>
            )}
          </div>
        </div>

        {/* Mode selector - compact */}
        <div style={{width:'100%', maxWidth:380, marginBottom:10}}>
          <div style={{...S.label, marginBottom:6}}>{L('mode')}</div>
          <div style={{display:'flex', gap:6}}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setSelectedMode(m.id)}
                style={{...S.modeBtn, ...(selectedMode===m.id ? S.modeBtnSel : {})}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <span style={{fontSize:10, fontWeight:700}}>{L(m.nameKey)}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', marginTop:4, textAlign:'center'}}>
            {L(MODES.find(m => m.id === selectedMode)?.descKey)}
          </div>
        </div>

        {/* Context + Description - combined row */}
        <div style={{width:'100%', maxWidth:380, marginBottom:10, display:'flex', gap:8}}>
          <div style={{flex:'0 0 48%'}}>
            <div style={{...S.label, marginBottom:5}}>{L('context')}</div>
            <div style={{position:'relative'}}>
              <select value={selectedContext} onChange={e => setSelectedContext(e.target.value)}
                style={{...S.select, fontSize:13, padding:'10px 30px 10px 12px',
                  appearance:'none', WebkitAppearance:'none'}}>
                {CONTEXTS.map(c => (
                  <option key={c.id} value={c.id} style={{background:'#111638', color:'#E8EAFF'}}>
                    {c.icon} {L(c.nameKey)}
                  </option>
                ))}
              </select>
              <Icon name="chevDown" size={14} color="rgba(232,234,255,0.4)"
                style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none'}} />
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{...S.label, marginBottom:5}}>{L('descriptionOptional')}</div>
            <input style={{...S.input, fontSize:13, padding:'10px 12px'}} value={roomDescription}
              onChange={e => setRoomDescription(e.target.value)}
              placeholder="..."
              maxLength={150} />
          </div>
        </div>

        {/* Create Room - main CTA */}
        <button style={{...S.bigBtn, background:'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(0,210,255,0.08))',
          border:'1px solid rgba(108,99,255,0.25)', marginBottom:8}}
          onClick={() => { vibrate(); handleCreateRoom(); }}>
          <div style={{width:40, height:40, borderRadius:12,
            background:'linear-gradient(135deg, #6C63FF, #00D2FF)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="plus" size={20} color="#fff" />
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700, fontSize:14}}>{L('createRoom')}</div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.5)', marginTop:1}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
              {' \u2022 '}{L(MODES.find(m => m.id === selectedMode)?.nameKey)}
            </div>
          </div>
          <Icon name="zap" size={18} color="#6C63FF" />
        </button>

        {/* Join Room */}
        <button style={{...S.bigBtn, marginBottom:8}} onClick={() => setView('join')}>
          <div style={{width:40, height:40, borderRadius:12,
            background:'rgba(0,210,255,0.1)', border:'1px solid rgba(0,210,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <Icon name="link" size={18} color="#00D2FF" />
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700, fontSize:14}}>{L('joinRoom')}</div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.5)', marginTop:1}}>{L('codeOrQR')}</div>
          </div>
          <Icon name="chevDown" size={16} color="rgba(232,234,255,0.3)" style={{transform:'rotate(-90deg)'}} />
        </button>

        {/* Balance / Account */}
        {userToken && userAccount ? (
          <div style={{width:'100%', maxWidth:380, marginTop:4, padding:'10px 14px', borderRadius:14,
            background:'rgba(108,99,255,0.05)', border:'1px solid rgba(108,99,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <Icon name="credit" size={16} color={useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'} />
              <div>
                <div style={{fontSize:9, color:'rgba(232,234,255,0.35)', fontWeight:600, textTransform:'uppercase', letterSpacing:1}}>
                  {useOwnKeys ? L('personalApiKeys') : L('credit')}
                </div>
                <div style={{fontSize:15, fontWeight:700, color: useOwnKeys ? '#00D2FF' : creditBalance > 50 ? '#00FF94' : '#FF6B9D'}}>
                  {useOwnKeys ? '\u2713 ' + L('active') : formatCredits(creditBalance)}
                </div>
              </div>
            </div>
            <button style={{padding:'6px 12px', borderRadius:10, background:'rgba(108,99,255,0.12)',
              border:'1px solid rgba(108,99,255,0.25)', color:'#6C63FF', fontSize:11, fontWeight:700,
              cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
              display:'flex', alignItems:'center', gap:4}}
              onClick={() => { refreshBalance(); setView('credits'); }}>
              <Icon name="zap" size={12} color="#6C63FF" />
              {L('recharge')}
            </button>
          </div>
        ) : (
          <button style={{width:'100%', maxWidth:380, marginTop:4, padding:'10px 14px', borderRadius:14,
            background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.12)',
            color:'#6C63FF', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:FONT,
            textAlign:'center', WebkitTapHighlightColor:'transparent', display:'flex', alignItems:'center',
            justifyContent:'center', gap:6}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            <Icon name="lock" size={14} color="#6C63FF" />
            {L('loginToCreateRooms')}
          </button>
        )}

        {/* Bottom actions row */}
        <div style={{display:'flex', gap:6, marginTop:10, flexWrap:'wrap', justifyContent:'center'}}>
          <button style={S.settingsBtn}
            onClick={() => setShowShareApp(!showShareApp)}>
            <Icon name="globe" size={14} color={showShareApp ? '#00D2FF' : 'rgba(232,234,255,0.5)'} />
            <span>{L('shareAppBtn')}</span>
          </button>
          {userToken && userAccount && referralCode && (
            <button style={S.settingsBtn}
              onClick={() => {
                const text = `Join me on VoiceTranslate! Use my referral code ${referralCode} to get 50 bonus credits. ${APP_URL}?ref=${referralCode}`;
                if (navigator.share) { navigator.share({ title:'VoiceTranslate', text }); }
                else { navigator.clipboard.writeText(text); }
              }}>
              <Icon name="gift" size={14} color="#FF6B9D" />
              <span>Invite</span>
            </button>
          )}
          <button style={S.settingsBtn}
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
            <Icon name="graduation" size={14} color="rgba(232,234,255,0.5)" />
            <span>{L('tutorial')}</span>
          </button>
        </div>

        {/* Share App panel */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:380, marginTop:8, padding:'14px', borderRadius:14,
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
                alt="QR" style={{width:120, height:120, borderRadius:12, background:'#fff', padding:6}} />
            </div>
            <button style={{...S.shareBtn, width:'100%', textAlign:'center', justifyContent:'center',
              display:'flex', alignItems:'center', gap:6}} onClick={() => shareApp()}>
              <Icon name="share" size={14} />
              {L('shareLink')}
            </button>
          </div>
        )}

        {/* Referral panel */}
        {userToken && userAccount && referralCode && showShareApp && (
          <div style={{width:'100%', maxWidth:380, marginTop:6, padding:'12px 14px', borderRadius:14,
            background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.1)'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <Icon name="gift" size={16} color="#FF6B9D" />
              <span style={{fontSize:12, fontWeight:700, color:'#FF6B9D'}}>Referral Code</span>
            </div>
            <div style={{display:'flex', gap:8}}>
              <div style={{flex:1, padding:'10px', borderRadius:10, background:'rgba(255,107,157,0.06)',
                border:'1px solid rgba(255,107,157,0.15)', fontFamily:"'Courier New', monospace",
                fontSize:14, fontWeight:700, color:'#FF6B9D', textAlign:'center'}}>
                {referralCode}
              </div>
              <button style={{padding:'10px 12px', borderRadius:10, background:'rgba(255,107,157,0.1)',
                border:'1px solid rgba(255,107,157,0.2)', color:'#FF6B9D', fontSize:11, fontWeight:700,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                display:'flex', alignItems:'center', gap:4}}
                onClick={() => navigator.clipboard.writeText(referralCode)}>
                <Icon name="copy" size={13} color="#FF6B9D" />
                Copy
              </button>
            </div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.4)', marginTop:6, textAlign:'center'}}>
              You get 100 credits, they get 50
            </div>
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

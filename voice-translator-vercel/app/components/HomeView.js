'use client';
import { LANGS, MODES, CONTEXTS, FONT, APP_URL, getLang, vibrate, formatCredits } from '../lib/constants.js';
import AvatarImg from './AvatarImg.js';
import TutorialOverlay from './TutorialOverlay.js';

export default function HomeView({ L, S, prefs, myLang, selectedMode, setSelectedMode, selectedContext,
  setSelectedContext, roomDescription, setRoomDescription, handleCreateRoom, setView, userToken,
  userAccount, useOwnKeys, creditBalance, refreshBalance, setAuthStep, loadHistory,
  showShareApp, setShowShareApp, shareAppLang, setShareAppLang, shareApp,
  showTutorial, setShowTutorial, tutorialStep, setTutorialStep, status,
  isTrial, platformHasEL, referralCode, theme, setTheme }) {
  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <AvatarImg src={prefs.avatar} size={56} style={{marginBottom:4}} />
        <div style={{fontSize:18, fontWeight:600, marginBottom:2, letterSpacing:-0.3}}>{prefs.name}</div>
        <div style={{color:'rgba(255,255,255,0.5)', fontSize:13, marginBottom:20}}>
          {getLang(prefs.lang).flag} {getLang(prefs.lang).name}
        </div>

        {/* Mode selector */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:8}}>{L('mode')}</div>
          <div style={{display:'flex', gap:8}}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setSelectedMode(m.id)}
                style={{...S.modeBtn, ...(selectedMode===m.id ? S.modeBtnSel : {})}}>
                <span style={{fontSize:22}}>{m.icon}</span>
                <span style={{fontSize:11, fontWeight:600, marginTop:2}}>{L(m.nameKey)}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:6, textAlign:'center'}}>
            {L(MODES.find(m => m.id === selectedMode)?.descKey)}
          </div>
        </div>

        {/* Context dropdown */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:8}}>{L('context')}</div>
          <div style={{position:'relative'}}>
            <select value={selectedContext} onChange={e => setSelectedContext(e.target.value)}
              style={{width:'100%', padding:'12px 40px 12px 16px', borderRadius:14,
                background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                color:'#fff', fontSize:14, fontFamily:FONT, cursor:'pointer',
                appearance:'none', WebkitAppearance:'none', outline:'none'}}>
              {CONTEXTS.map(c => (
                <option key={c.id} value={c.id} style={{background:'#1a1a2e', color:'#fff'}}>
                  {c.icon} {L(c.nameKey)}
                </option>
              ))}
            </select>
            <div style={{position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
              pointerEvents:'none', color:'rgba(255,255,255,0.4)', fontSize:12}}>{'\u25BC'}</div>
          </div>
          <div style={{fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:6, textAlign:'center'}}>
            {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
            {L(CONTEXTS.find(c => c.id === selectedContext)?.descKey)}
          </div>
        </div>

        {/* Description field */}
        <div style={{width:'100%', maxWidth:380, marginBottom:16}}>
          <div style={{...S.label, marginBottom:6}}>{L('descriptionOptional')}</div>
          <input style={{...S.input, fontSize:13}} value={roomDescription}
            onChange={e => setRoomDescription(e.target.value)}
            placeholder={L('descriptionPlaceholder')}
            maxLength={150} />
          <div style={{fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:4, textAlign:'right'}}>
            {roomDescription.length}/150
          </div>
        </div>

        <button style={S.bigBtn} onClick={() => { vibrate(); handleCreateRoom(); }}>
          <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.15)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0}}>+</div>
          <div>
            <div style={{fontWeight:600, fontSize:15}}>{L('createRoom')}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:1}}>
              {CONTEXTS.find(c => c.id === selectedContext)?.icon}{' '}
              {L(CONTEXTS.find(c => c.id === selectedContext)?.nameKey)}
              {' \u2022 '}{L(MODES.find(m => m.id === selectedMode)?.nameKey)}
            </div>
          </div>
        </button>
        <button style={{...S.bigBtn, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)'}}
          onClick={() => setView('join')}>
          <div style={{width:44, height:44, borderRadius:14, background:'rgba(255,255,255,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{'\u{1F517}'}</div>
          <div>
            <div style={{fontWeight:600, fontSize:15}}>{L('joinRoom')}</div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.5)', marginTop:1}}>{L('codeOrQR')}</div>
          </div>
        </button>

        {/* Balance / Account indicator */}
        {userToken && userAccount ? (
          <div style={{width:'100%', maxWidth:380, marginTop:10, padding:'10px 16px', borderRadius:14,
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)',
            display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginBottom:2}}>
                {useOwnKeys ? L('personalApiKeys') : L('credit')}
              </div>
              <div style={{fontSize:16, fontWeight:600, color: useOwnKeys ? '#4facfe' : creditBalance > 50 ? '#4facfe' : '#f5576c'}}>
                {useOwnKeys ? '\u2713 ' + L('active') : formatCredits(creditBalance)}
              </div>
            </div>
            <button style={{padding:'7px 14px', borderRadius:10, background:'rgba(245,87,108,0.1)',
              border:'1px solid rgba(245,87,108,0.2)', color:'#f5576c', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent'}}
              onClick={() => { refreshBalance(); setView('credits'); }}>
              {L('recharge')}
            </button>
          </div>
        ) : (
          <button style={{width:'100%', maxWidth:380, marginTop:10, padding:'12px 16px', borderRadius:14,
            background:'rgba(79,172,254,0.08)', border:'1px solid rgba(79,172,254,0.15)',
            color:'#4facfe', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:FONT,
            textAlign:'center', WebkitTapHighlightColor:'transparent'}}
            onClick={() => { setAuthStep('email'); setView('account'); }}>
            {'\u{1F512}'} {L('loginToCreateRooms')}
          </button>
        )}

        <div style={{display:'flex', gap:10, marginTop:16}}>
          <button style={S.settingsBtn} onClick={() => setView('settings')}>{L('settings')}</button>
          <button style={S.settingsBtn} onClick={() => { loadHistory(); setView('history'); }}>{L('history')}</button>
          {userToken && <button style={S.settingsBtn} onClick={() => setView('apikeys')}>{L('apiKey')}</button>}
        </div>

        {/* Share App button */}
        <button style={{width:'100%', maxWidth:380, marginTop:14, padding:'12px 16px', borderRadius:14,
          background: showShareApp ? 'rgba(78,205,196,0.12)' : 'rgba(78,205,196,0.06)',
          border:'1px solid rgba(78,205,196,0.15)', color:'#4ecdc4', fontSize:13, fontWeight:500,
          cursor:'pointer', fontFamily:FONT, textAlign:'center', WebkitTapHighlightColor:'transparent',
          display:'flex', alignItems:'center', justifyContent:'center', gap:8}}
          onClick={() => setShowShareApp(!showShareApp)}>
          <span style={{fontSize:16}}>{'\u{1F30D}'}</span>
          <span>{L('shareAppBtn')}</span>
          <span style={{fontSize:10, opacity:0.5}}>{showShareApp ? '\u25B2' : '\u25BC'}</span>
        </button>

        {/* Share App panel */}
        {showShareApp && (
          <div style={{width:'100%', maxWidth:380, marginTop:8, padding:'16px', borderRadius:14,
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)'}}>
            <div style={{marginBottom:12}}>
              <div style={S.label}>{L('inviteLangLabel')}</div>
              <select style={{...S.select, fontSize:14}} value={shareAppLang} onChange={e => setShareAppLang(e.target.value)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <div style={{textAlign:'center', marginBottom:12}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${APP_URL}?lang=${shareAppLang}`)}`}
                alt="QR" style={{width:140, height:140, borderRadius:14, background:'#fff', padding:8}} />
            </div>
            <button style={{...S.shareBtn, width:'100%'}} onClick={() => shareApp()}>
              {L('shareLink')}
            </button>
          </div>
        )}

        {/* Referral Code Section */}
        {userToken && userAccount && referralCode && (
          <div style={{width:'100%', maxWidth:380, marginTop:8, padding:'16px', borderRadius:14,
            background:'rgba(79,172,254,0.06)', border:'1px solid rgba(79,172,254,0.15)'}}>
            <div style={{fontSize:13, fontWeight:600, color:'#4facfe', marginBottom:12}}>
              {'\u{1F393}'} Invite Friends & Earn Bonus Credits
            </div>
            <div style={{fontSize:12, color:'rgba(255,255,255,0.6)', marginBottom:10}}>
              You get 100 credits, they get 50 credits
            </div>
            <div style={{display:'flex', gap:8, marginBottom:12}}>
              <div style={{flex:1, padding:'12px', borderRadius:10, background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(79,172,254,0.2)', fontFamily:"'Courier New', monospace",
                fontSize:14, fontWeight:600, color:'#4facfe', textAlign:'center', wordBreak:'break-all'}}>
                {referralCode}
              </div>
              <button style={{padding:'12px 14px', borderRadius:10, background:'rgba(79,172,254,0.15)',
                border:'1px solid rgba(79,172,254,0.3)', color:'#4facfe', fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent', whiteSpace:'nowrap'}}
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  setTimeout(() => {}, 1500);
                }}>
                {'\u{1F4CB}'} Copy
              </button>
            </div>
            <button style={{width:'100%', padding:'10px 12px', borderRadius:10,
              background:'rgba(79,172,254,0.2)', border:'1px solid rgba(79,172,254,0.3)',
              color:'#4facfe', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:FONT,
              WebkitTapHighlightColor:'transparent'}}
              onClick={() => {
                const text = `Join me on VoiceTranslate! Use my referral code ${referralCode} to get 50 bonus credits. ${APP_URL}?ref=${referralCode}`;
                if (navigator.share) {
                  navigator.share({ title:'VoiceTranslate Referral', text });
                } else {
                  navigator.clipboard.writeText(text);
                }
              }}>
              {'\u{1F4A1}'} Share Invite Link
            </button>
          </div>
        )}

        {/* Tutorial button */}
        <button style={{width:'100%', maxWidth:380, marginTop:8, padding:'12px 16px', borderRadius:14,
          background:'rgba(79,172,254,0.06)', border:'1px solid rgba(79,172,254,0.12)',
          color:'#4facfe', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:FONT,
          textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          WebkitTapHighlightColor:'transparent'}}
          onClick={() => { setTutorialStep(0); setShowTutorial(true); }}>
          <span style={{fontSize:16}}>{'\u{1F393}'}</span>
          <span>{L('tutorial')}</span>
        </button>

        {status && <div style={S.statusMsg}>{status}</div>}

        {/* Tutorial Overlay */}
        {showTutorial && (
          <TutorialOverlay L={L} tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep} setShowTutorial={setShowTutorial} />
        )}
      </div>
    </div>
  );
}

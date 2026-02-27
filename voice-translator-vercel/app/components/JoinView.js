'use client';
import { useState, useEffect, useRef } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import AvatarImg from './AvatarImg.js';

// ═══════════════════════════════════════════════
// JOIN VIEW — Enhanced invited guest experience
//
// For guests with invite link (?room=XXX&lang=YY):
//   Step 0: Welcome + Name (prominent) + Gender
//   Step 1: Language + Avatar
//   Step 2: Audio preferences + Voice + Join
//
// For manual join (no invite link):
//   Single-page: Name + Room Code + Language + Join
// ═══════════════════════════════════════════════

export default function JoinView({ L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, joinCode,
  setJoinCode, inviteMsgLang, setInviteMsgLang, handleJoinRoom, setView, userToken, setAuthStep,
  status, theme, setTheme }) {
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [guestStep, setGuestStep] = useState(0);
  const [gender, setGender] = useState(prefs.gender || '');
  const [audioAutoPlay, setAudioAutoPlay] = useState(prefs.autoPlay !== false);
  const [selectedVoicePref, setSelectedVoicePref] = useState(prefs.voice || 'nova');
  const nameInputRef = useRef(null);

  const iL = inviteMsgLang || prefs.lang || 'en';
  const tI = (key) => t(iL, key);
  const isInvited = !!inviteMsgLang;

  // Auto-focus name input
  useEffect(() => {
    if (guestStep === 0 && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 300);
    }
  }, [guestStep]);

  // Color palette
  const C = S.colors;
  const accent = '#7B73FF';
  const accentSoft = 'rgba(123,115,255,0.15)';

  const cardStyle = {
    background: C.glassCard,
    borderRadius: 20,
    padding: '24px 20px',
    boxShadow: C.cardShadow,
    width: '100%',
    maxWidth: 400,
  };

  const stepDotStyle = (active) => ({
    width: active ? 24 : 8,
    height: 8,
    borderRadius: 4,
    background: active ? accent : C.overlayBorder,
    transition: 'all 0.3s ease',
  });

  const btnPrimary = (enabled) => ({
    ...S.btn,
    marginTop: 16,
    opacity: enabled ? 1 : 0.4,
    pointerEvents: enabled ? 'auto' : 'none',
    fontSize: 15,
    fontWeight: 600,
    padding: '14px 20px',
  });

  const genderBtn = (g, selected) => ({
    flex: 1,
    padding: '14px 8px',
    borderRadius: 14,
    border: `2px solid ${selected ? accent : C.overlayBorder}`,
    background: selected ? accentSoft : 'transparent',
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 14,
    color: selected ? accent : C.textPrimary,
    fontWeight: selected ? 700 : 400,
    textAlign: 'center',
    transition: 'all 0.2s ease',
  });

  // i18n helper for common labels
  const tx = (key) => {
    const map = {
      continue: { it:'Continua', es:'Continuar', fr:'Continuer', de:'Weiter', en:'Continue' },
      gender: { it:'Genere', es:'Género', fr:'Genre', de:'Geschlecht', en:'Gender' },
      male: { it:'Maschio', es:'Hombre', fr:'Homme', de:'Mann', en:'Male' },
      female: { it:'Femmina', es:'Mujer', fr:'Femme', de:'Frau', en:'Female' },
      other: { it:'Altro', es:'Otro', fr:'Autre', de:'Andere', en:'Other' },
      yourLang: { it:'La tua lingua', es:'Tu idioma', fr:'Ta langue', de:'Deine Sprache', en:'Your Language' },
      yourLangDesc: { it:'Scegli la lingua in cui parli', es:'Elige el idioma que hablas', fr:'Choisis la langue que tu parles', de:'Wähle die Sprache, die du sprichst', en:'Choose the language you speak' },
      audioPrefs: { it:'Preferenze audio', es:'Preferencias de audio', fr:'Préférences audio', de:'Audio-Einstellungen', en:'Audio Preferences' },
      autoPlay: { it:'Riproduzione automatica', es:'Reproducción automática', fr:'Lecture automatique', de:'Automatische Wiedergabe', en:'Auto-play audio' },
      autoPlayDesc: { it:'Ascolta automaticamente le traduzioni', es:'Escuchar traducciones automáticamente', fr:'Écouter automatiquement les traductions', de:'Übersetzungen automatisch hören', en:'Automatically hear translations' },
      transVoice: { it:'Voce di traduzione', es:'Voz de traducción', fr:'Voix de traduction', de:'Übersetzungsstimme', en:'Translation voice' },
      changeVoiceLater: { it:'Puoi cambiare la voce anche durante la chat', es:'Puedes cambiar la voz durante el chat', fr:'Tu peux changer la voix pendant le chat', de:'Du kannst die Stimme während des Chats ändern', en:'You can change the voice during chat too' },
      freeVoice: { it:'Voce libera (Edge TTS)', es:'Voz libre (Edge TTS)', fr:'Voix gratuite (Edge TTS)', de:'Freie Stimme (Edge TTS)', en:'Free voice (Edge TTS)' },
      joinChat: { it:'Entra nella Chat', es:'Unirse al Chat', fr:'Rejoindre le Chat', de:'Chat beitreten', en:'Join Chat' },
    };
    const lang = iL.split('-')[0];
    return map[key]?.[lang] || map[key]?.en || key;
  };

  // ─── MANUAL JOIN (no invite link) ───
  if (!isInvited) {
    return (
      <div style={S.page}>
        <div style={S.center}>
          <div style={S.topBar}>
            <button style={S.backBtn} onClick={() => { window.history.replaceState({}, '', window.location.pathname); setView('home'); setJoinCode(''); setInviteMsgLang(null); }}>{'\u2190'}</button>
            <span style={{fontWeight:600, fontSize:17}}>{L('joinRoom')}</span>
          </div>
          <div style={S.card}>
            <div style={S.field}>
              <div style={S.label}>{L('name')}</div>
              <input style={S.input} placeholder={L('namePlaceholder')} value={prefs.name}
                onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
            </div>
            <div style={S.field}>
              <div style={S.label}>{L('roomCode')}</div>
              <input style={{...S.input, textAlign:'center', fontSize:22, letterSpacing:6, textTransform:'uppercase'}}
                placeholder="ABC123" value={joinCode} maxLength={6}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
            </div>
            <div style={S.field}>
              <div style={S.label}>{L('yourLang')}</div>
              <select style={S.select} value={myLang} onChange={e => { setMyLang(e.target.value); setPrefs(p => ({...p, lang: e.target.value})); }}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
            <button style={{...S.btn, marginTop:12, opacity:(joinCode.length>=4 && prefs.name.trim())?1:0.4}}
              disabled={joinCode.length<4 || !prefs.name.trim()} onClick={() => { savePrefs(prefs); handleJoinRoom(); }}>
              {L('enterRoom')}
            </button>
            {status && <div style={S.statusMsg}>{status}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ─── INVITED GUEST FLOW (3 steps) ───

  function handleNext() {
    if (guestStep === 0 && prefs.name.trim()) {
      setPrefs(p => ({ ...p, gender }));
      setGuestStep(1);
    } else if (guestStep === 1) {
      setGuestStep(2);
    }
  }

  function handleJoin() {
    const finalPrefs = {
      ...prefs,
      gender,
      autoPlay: audioAutoPlay,
      voice: selectedVoicePref,
    };
    setPrefs(finalPrefs);
    savePrefs(finalPrefs);
    handleJoinRoom();
  }

  const canProceedStep0 = prefs.name.trim().length >= 1;
  const canJoin = joinCode.length >= 4 && prefs.name.trim();

  return (
    <div style={{...S.page, overflow:'auto'}}>
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:'100vh', padding:'20px 16px', gap:16}}>

        {/* Step indicator */}
        <div style={{display:'flex', gap:6, marginBottom:4}}>
          {[0,1,2].map(i => <div key={i} style={stepDotStyle(guestStep === i)} />)}
        </div>

        {/* ═══ STEP 0: Welcome + Name + Gender ═══ */}
        {guestStep === 0 && (
          <div style={cardStyle}>
            {/* Welcome header */}
            <div style={{textAlign:'center', marginBottom:20}}>
              <div style={{fontSize:44, marginBottom:8}}>{'\u{1F30D}\u{1F399}\uFE0F'}</div>
              <div style={{fontSize:20, fontWeight:700, color:C.textPrimary, marginBottom:6}}>
                {tI('inviteWelcome')}
              </div>
              <div style={{fontSize:14, color:C.textSecondary, lineHeight:1.5}}>
                {tI('inviteInstructions')}
              </div>
            </div>

            {/* Name — big and prominent */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:13, fontWeight:600, color:C.textPrimary, marginBottom:8}}>
                {tI('name')} *
              </div>
              <input
                ref={nameInputRef}
                style={{
                  ...S.input,
                  fontSize: 20,
                  fontWeight: 600,
                  padding: '16px 18px',
                  textAlign: 'center',
                  borderRadius: 16,
                  border: `2px solid ${prefs.name.trim() ? accent : C.overlayBorder}`,
                  background: C.inputBg || 'rgba(0,0,0,0.3)',
                  transition: 'border-color 0.2s',
                }}
                placeholder={tI('namePlaceholder')}
                value={prefs.name}
                onChange={e => setPrefs({...prefs, name:e.target.value})}
                maxLength={20}
              />
            </div>

            {/* Gender selection */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:13, fontWeight:600, color:C.textPrimary, marginBottom:8}}>
                {tx('gender')}
              </div>
              <div style={{display:'flex', gap:10}}>
                <button style={genderBtn('male', gender === 'male')} onClick={() => setGender('male')}>
                  <div style={{fontSize:24, marginBottom:4}}>{'\u2642\uFE0F'}</div>
                  <div>{tx('male')}</div>
                </button>
                <button style={genderBtn('female', gender === 'female')} onClick={() => setGender('female')}>
                  <div style={{fontSize:24, marginBottom:4}}>{'\u2640\uFE0F'}</div>
                  <div>{tx('female')}</div>
                </button>
                <button style={genderBtn('other', gender === 'other')} onClick={() => setGender('other')}>
                  <div style={{fontSize:24, marginBottom:4}}>{'\u26A7\uFE0F'}</div>
                  <div>{tx('other')}</div>
                </button>
              </div>
            </div>

            <button style={btnPrimary(canProceedStep0)} onClick={handleNext}>
              {tx('continue')} {'\u2192'}
            </button>
          </div>
        )}

        {/* ═══ STEP 1: Language + Avatar ═══ */}
        {guestStep === 1 && (
          <div style={cardStyle}>
            <div style={{textAlign:'center', marginBottom:16}}>
              <div style={{fontSize:17, fontWeight:700, color:C.textPrimary}}>
                {tx('yourLang')}
              </div>
              <div style={{fontSize:13, color:C.textSecondary, marginTop:4}}>
                {tx('yourLangDesc')}
              </div>
            </div>

            {/* Language grid */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:20, maxHeight:280, overflowY:'auto', padding:2}}>
              {LANGS.map(l => (
                <button key={l.code} onClick={() => { setMyLang(l.code); setPrefs(p => ({...p, lang: l.code})); }}
                  style={{
                    padding:'12px 6px', borderRadius:12, textAlign:'center', cursor:'pointer', fontFamily:FONT,
                    border: `2px solid ${myLang === l.code ? accent : 'transparent'}`,
                    background: myLang === l.code ? accentSoft : C.overlayBg || 'rgba(255,255,255,0.05)',
                    color: C.textPrimary, fontSize:12, fontWeight: myLang === l.code ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}>
                  <div style={{fontSize:22, marginBottom:2}}>{l.flag}</div>
                  <div style={{lineHeight:1.2}}>{l.name}</div>
                </button>
              ))}
            </div>

            {/* Avatar selection */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:13, fontWeight:600, color:C.textPrimary, marginBottom:10}}>
                Avatar
              </div>
              <div style={{display:'flex', gap:8, overflowX:'auto', paddingBottom:4}}>
                {AVATARS.map((av, i) => (
                  <div key={i} onClick={() => setPrefs(p => ({...p, avatar: av}))}
                    style={{
                      cursor:'pointer', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                      opacity: prefs.avatar === av ? 1 : 0.5,
                      transform: prefs.avatar === av ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{
                      width:46, height:46, borderRadius:23,
                      border: `2px solid ${prefs.avatar === av ? accent : 'transparent'}`,
                      overflow:'hidden',
                    }}>
                      <AvatarImg src={av} size={46} />
                    </div>
                    <div style={{fontSize:8, color: prefs.avatar === av ? accent : C.textMuted, fontWeight:500}}>{AVATAR_NAMES[i]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:'flex', gap:10, marginTop:16}}>
              <button onClick={() => setGuestStep(0)}
                style={{flex:'0 0 auto', padding:'12px 18px', borderRadius:14, border:`1px solid ${C.overlayBorder}`,
                  background:'transparent', color:C.textPrimary, fontSize:14, cursor:'pointer', fontFamily:FONT}}>
                {'\u2190'}
              </button>
              <button style={{...btnPrimary(true), flex:1, marginTop:0}} onClick={handleNext}>
                {tx('continue')} {'\u2192'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Audio Preferences + Voice + Join ═══ */}
        {guestStep === 2 && (
          <div style={cardStyle}>
            <div style={{textAlign:'center', marginBottom:16}}>
              <div style={{fontSize:17, fontWeight:700, color:C.textPrimary}}>
                {tx('audioPrefs')}
              </div>
            </div>

            {/* Auto-play toggle */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px',
              background: C.overlayBg || 'rgba(255,255,255,0.05)', borderRadius:14, marginBottom:12}}>
              <div>
                <div style={{fontSize:14, fontWeight:600, color:C.textPrimary}}>
                  {tx('autoPlay')}
                </div>
                <div style={{fontSize:11, color:C.textSecondary, marginTop:2}}>
                  {tx('autoPlayDesc')}
                </div>
              </div>
              <button onClick={() => setAudioAutoPlay(!audioAutoPlay)}
                style={{width:50, height:28, borderRadius:14, border:'none', cursor:'pointer',
                  background: audioAutoPlay ? accent : C.overlayBorder,
                  position:'relative', transition:'background 0.2s'}}>
                <div style={{width:22, height:22, borderRadius:11, background:'white', position:'absolute', top:3,
                  left: audioAutoPlay ? 25 : 3, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}} />
              </button>
            </div>

            {/* Voice selection for OpenAI TTS */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13, fontWeight:600, color:C.textPrimary, marginBottom:10}}>
                {tx('transVoice')}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8}}>
                {VOICES.map(v => (
                  <button key={v} onClick={() => setSelectedVoicePref(v)}
                    style={{
                      padding:'12px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', fontFamily:FONT,
                      border: `2px solid ${selectedVoicePref === v ? accent : 'transparent'}`,
                      background: selectedVoicePref === v ? accentSoft : C.overlayBg || 'rgba(255,255,255,0.05)',
                      color: selectedVoicePref === v ? accent : C.textPrimary,
                      fontSize:13, fontWeight: selectedVoicePref === v ? 700 : 400,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{fontSize:18, marginBottom:2}}>
                      {v === 'nova' || v === 'shimmer' || v === 'fable' ? '\u2640\uFE0F' : '\u2642\uFE0F'}
                    </div>
                    <div style={{textTransform:'capitalize'}}>{v}</div>
                  </button>
                ))}
              </div>
              <div style={{fontSize:10, color:C.textMuted, textAlign:'center', marginTop:6}}>
                {tx('changeVoiceLater')}
              </div>
            </div>

            {/* Edge TTS gender preference */}
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px',
              background: C.overlayBg || 'rgba(255,255,255,0.05)', borderRadius:14, marginBottom:16}}>
              <div style={{fontSize:13, fontWeight:500, color:C.textPrimary}}>
                {tx('freeVoice')}
              </div>
              <div style={{display:'flex', gap:6}}>
                {['female', 'male'].map(g => (
                  <button key={g} onClick={() => setPrefs(p => ({...p, edgeTtsVoiceGender: g}))}
                    style={{
                      padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                      background: (prefs.edgeTtsVoiceGender || 'female') === g ? accent : 'transparent',
                      color: (prefs.edgeTtsVoiceGender || 'female') === g ? '#fff' : C.textSecondary,
                      fontWeight: (prefs.edgeTtsVoiceGender || 'female') === g ? 600 : 400,
                    }}>
                    {g === 'female' ? '\u2640\uFE0F' : '\u2642\uFE0F'} {g === 'female' ? tx('female') : tx('male')}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary card */}
            <div style={{background: accentSoft, borderRadius:14, padding:'14px 16px', marginBottom:8}}>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:40, height:40, borderRadius:20, overflow:'hidden', flexShrink:0}}>
                  <AvatarImg src={prefs.avatar} size={40} />
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15, fontWeight:700, color:C.textPrimary}}>{prefs.name || '...'}</div>
                  <div style={{fontSize:12, color:C.textSecondary}}>
                    {LANGS.find(l => l.code === myLang)?.flag} {LANGS.find(l => l.code === myLang)?.name}
                    {gender && ` \u2022 ${gender === 'male' ? '\u2642\uFE0F' : gender === 'female' ? '\u2640\uFE0F' : '\u26A7\uFE0F'}`}
                  </div>
                </div>
                <div style={{fontSize:11, color:accent, fontWeight:600}}>
                  {AVATAR_NAMES[AVATARS.indexOf(prefs.avatar)] || ''}
                </div>
              </div>
            </div>

            <div style={{display:'flex', gap:10}}>
              <button onClick={() => setGuestStep(1)}
                style={{flex:'0 0 auto', padding:'14px 18px', borderRadius:14, border:`1px solid ${C.overlayBorder}`,
                  background:'transparent', color:C.textPrimary, fontSize:14, cursor:'pointer', fontFamily:FONT}}>
                {'\u2190'}
              </button>
              <button style={{...btnPrimary(canJoin), flex:1, marginTop:0, fontSize:16}} onClick={handleJoin}>
                {tI('inviteJoinBtn') || tx('joinChat')} {'\u{1F399}\uFE0F'}
              </button>
            </div>

            {!userToken && (
              <button style={{marginTop:12, background:'none', border:'none', color:C.textMuted,
                fontSize:12, cursor:'pointer', fontFamily:FONT, padding:8, textDecoration:'underline', width:'100%', textAlign:'center'}}
                onClick={() => setShowInvitePopup(true)}>
                {tI('inviteInfoLink')}
              </button>
            )}

            {status && <div style={{...S.statusMsg, marginTop:10}}>{status}</div>}
          </div>
        )}
      </div>

      {/* Info popup */}
      {showInvitePopup && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20}}
          onClick={() => setShowInvitePopup(false)}>
          <div style={{background:C.glassCard, borderRadius:18, padding:'28px 22px', maxWidth:360, width:'100%', boxShadow:C.cardShadow}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:32, textAlign:'center', marginBottom:12}}>{'\u{1F30D}\u{1F399}\uFE0F'}</div>
            <div style={{fontSize:18, fontWeight:700, color:C.textPrimary, textAlign:'center', marginBottom:12}}>{tI('invitePopupTitle')}</div>
            <div style={{fontSize:14, color:C.textSecondary, lineHeight:1.6, marginBottom:16}}>{tI('invitePopupDesc')}</div>
            <div style={{fontSize:13, color:C.textTertiary, lineHeight:1.5, marginBottom:16, padding:'10px 12px', background:C.accent2Bg, borderRadius:10}}>
              {tI('invitePopupFeatures')}
            </div>
            <div style={{display:'flex', gap:8}}>
              <button style={{...S.btn, flex:1, fontSize:13}} onClick={() => { setShowInvitePopup(false); setView('account'); setAuthStep('email'); }}>
                {tI('invitePopupCreateAccount')}
              </button>
              <button style={{flex:1, padding:'10px 14px', borderRadius:12, border:`1px solid ${C.overlayBorder}`,
                background:'transparent', color:C.textPrimary, fontSize:13, cursor:'pointer', fontFamily:FONT}}
                onClick={() => setShowInvitePopup(false)}>
                {tI('invitePopupJoinNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

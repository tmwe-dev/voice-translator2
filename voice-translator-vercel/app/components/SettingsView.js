'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES, FONT, FREE_DAILY_LIMIT, formatCredits, getLang } from '../lib/constants.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';

const SettingsView = memo(function SettingsView({ L, S, prefs, setPrefs, savePrefs, setView, isTrial, isTopPro,
  setIsTopPro, useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setSelectedELVoice, setElevenLabsVoices, userToken, userTokenRef, userAccount, logout, status,
  theme, setTheme, creditBalance, refreshBalance, freeCharsUsed }) {

  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const audioRef = useRef(null);

  const selectedAvatarIdx = AVATARS.indexOf(prefs.avatar);
  const selectedLangIdx = LANGS.findIndex(l => l.code === prefs.lang);

  const isGuest = !userToken;

  // Voice preview sample texts per language
  const VOICE_SAMPLES = {
    it:'Ciao! Sono la tua voce per la traduzione.',
    en:'Hello! I am your translation voice.',
    es:'Hola! Soy tu voz de traducción.',
    fr:'Bonjour! Je suis votre voix de traduction.',
    de:'Hallo! Ich bin Ihre Übersetzungsstimme.',
    pt:'Olá! Eu sou sua voz de tradução.',
    zh:'你好！我是你的翻译语音。',
    ja:'こんにちは！翻訳音声です。',
    ko:'안녕하세요! 번역 음성입니다.',
    th:'สวัสดี! ฉันเป็นเสียงแปลของคุณ',
    ar:'مرحبا! أنا صوت الترجمة الخاص بك.',
    hi:'नमस्ते! मैं आपकी अनुवाद आवाज हूं।',
    ru:'Привет! Я ваш голос для перевода.',
    tr:'Merhaba! Ben çeviri sesinizim.',
    vi:'Xin chào! Tôi là giọng dịch của bạn.',
  };

  // Stop any current audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setPlayingVoice(null);
  }, []);

  // Preview OpenAI voice via real TTS API
  const previewVoice = useCallback(async (voiceName) => {
    stopAudio();
    if (playingVoice === voiceName) return; // was playing, now stopped

    setPlayingVoice(voiceName);
    const sampleText = VOICE_SAMPLES[prefs.lang] || VOICE_SAMPLES.en;

    // Must have token + (own keys OR credits) to use OpenAI TTS
    if (userToken && (useOwnKeys || creditBalance > 0)) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sampleText, voice: voiceName, userToken: userTokenRef?.current })
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
          audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
          await audio.play();
          return;
        }
      } catch {}
    }
    // No API available → show message
    setPlayingVoice(null);
  }, [playingVoice, prefs.lang, userToken, useOwnKeys, creditBalance, userTokenRef, stopAudio]);

  // Preview ElevenLabs voice via preview_url or TTS API
  const previewELVoice = useCallback(async (voice) => {
    stopAudio();
    if (playingVoice === `el_${voice.id}`) return;

    setPlayingVoice(`el_${voice.id}`);
    try {
      // First try the preview_url from ElevenLabs API (free, no cost)
      if (voice.preview) {
        const audio = new Audio(voice.preview);
        audioRef.current = audio;
        audio.onended = () => setPlayingVoice(null);
        audio.onerror = () => setPlayingVoice(null);
        await audio.play();
        return;
      }
      // Fallback: use our TTS API
      const sampleText = VOICE_SAMPLES[prefs.lang] || VOICE_SAMPLES.en;
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voiceId: voice.id, langCode: prefs.lang, userToken: userTokenRef?.current })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch {}
    setPlayingVoice(null);
  }, [playingVoice, prefs.lang, userTokenRef, stopAudio]);

  // API key status helpers
  const hasOpenAI = !!(apiKeyInputs?.openai?.trim());
  const hasAnthropic = !!(apiKeyInputs?.anthropic?.trim());
  const hasGemini = !!(apiKeyInputs?.gemini?.trim());
  const hasElevenLabs = !!(apiKeyInputs?.elevenlabs?.trim());
  const keyCount = [hasOpenAI, hasAnthropic, hasGemini, hasElevenLabs].filter(Boolean).length;

  // Free usage
  const freePercent = Math.min(100, Math.round((freeCharsUsed || 0) / FREE_DAILY_LIMIT * 100));
  const freeCharsLeft = Math.max(0, FREE_DAILY_LIMIT - (freeCharsUsed || 0));

  async function handleRefresh() {
    setRefreshing(true);
    try { await refreshBalance?.(); } catch {}
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('settings')}</span>
        </div>

        {/* ══════════════════════════════════════════════════
            ACCOUNT & API STATUS DASHBOARD
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400, marginBottom:16, borderRadius:20,
          background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
          overflow:'hidden'}}>

          {/* Status header */}
          <div style={{padding:'16px 18px 12px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{width:36, height:36, borderRadius:12,
                background: isGuest ? 'rgba(0,255,148,0.1)' : (useOwnKeys ? 'rgba(0,210,255,0.1)' : 'rgba(108,99,255,0.1)'),
                display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Icon name={isGuest ? 'zap' : (useOwnKeys ? 'key' : 'credit')} size={18}
                  color={isGuest ? '#00FF94' : (useOwnKeys ? '#00D2FF' : '#6C63FF')} />
              </div>
              <div>
                <div style={{fontSize:14, fontWeight:700, color:'#E8EAFF'}}>
                  {isGuest ? 'FREE Mode' : (useOwnKeys ? L('personalApiKeys') : 'PRO Mode')}
                </div>
                <div style={{fontSize:11, color:'rgba(232,234,255,0.45)', marginTop:1}}>
                  {isGuest ? L('startFreeDesc') : (userAccount?.email || '')}
                </div>
              </div>
            </div>
            {/* Refresh button */}
            <button onClick={handleRefresh}
              style={{width:36, height:36, borderRadius:12, cursor:'pointer',
                background:'rgba(232,234,255,0.04)', border:'1px solid rgba(232,234,255,0.08)',
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                animation: refreshing ? 'spin 0.8s linear infinite' : 'none'}}>
              <Icon name="refresh" size={16} color="rgba(232,234,255,0.5)" />
            </button>
          </div>

          {/* ── Usage info ── */}
          {isGuest ? (
            /* FREE tier usage bar */
            <div style={{padding:'0 18px 16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <span style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.35)', textTransform:'uppercase', letterSpacing:1}}>
                  {L('dailyUsage') || 'Utilizzo giornaliero'}
                </span>
                <span style={{fontSize:11, fontWeight:600, color: freePercent >= 90 ? '#FF6B9D' : '#00FF94'}}>
                  {freePercent}%
                </span>
              </div>
              <div style={{width:'100%', height:6, borderRadius:3, background:'rgba(232,234,255,0.06)', overflow:'hidden'}}>
                <div style={{width:`${freePercent}%`, height:'100%', borderRadius:3, transition:'width 0.3s',
                  background: freePercent >= 90 ? 'linear-gradient(90deg, #FF6B9D, #ff4757)' :
                    freePercent >= 60 ? 'linear-gradient(90deg, #ffd700, #FF6B9D)' :
                      'linear-gradient(90deg, #00FF94, #00D2FF)'}} />
              </div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.35)', marginTop:5}}>
                {((freeCharsUsed || 0) / 1000).toFixed(1)}k / {(FREE_DAILY_LIMIT / 1000).toFixed(0)}k {L('characters') || 'caratteri'}
                <span style={{marginLeft:8, color: freePercent >= 90 ? '#FF6B9D' : 'rgba(232,234,255,0.25)'}}>
                  ({(freeCharsLeft / 1000).toFixed(1)}k {L('remaining') || 'rimanenti'})
                </span>
              </div>
            </div>
          ) : (
            /* PRO: credits or own-keys status */
            <div style={{padding:'0 18px 16px'}}>
              {useOwnKeys ? (
                /* Own API Keys status */
                <div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:8}}>
                    {[
                      { name:'OpenAI', ok:hasOpenAI, required:true },
                      { name:'Anthropic', ok:hasAnthropic },
                      { name:'Gemini', ok:hasGemini },
                      { name:'ElevenLabs', ok:hasElevenLabs },
                    ].map(k => (
                      <div key={k.name} style={{display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                        borderRadius:8, fontSize:11, fontWeight:600,
                        background: k.ok ? 'rgba(0,255,148,0.08)' : 'rgba(232,234,255,0.03)',
                        border: k.ok ? '1px solid rgba(0,255,148,0.15)' : '1px solid rgba(232,234,255,0.06)',
                        color: k.ok ? '#00FF94' : 'rgba(232,234,255,0.3)'}}>
                        <span style={{fontSize:12}}>{k.ok ? '\u2713' : '\u2715'}</span>
                        {k.name}
                        {k.required && !k.ok && <span style={{fontSize:9, color:'#FF6B9D'}}>*</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:11, color:'rgba(232,234,255,0.4)', lineHeight:1.5}}>
                    {keyCount > 0
                      ? `${keyCount} API key${keyCount > 1 ? 's' : ''} ${L('configured') || 'configurate'} \u2014 ${L('allOk') || 'tutto OK!'}`
                      : L('noKeysConfigured') || 'Nessuna chiave configurata'}
                  </div>
                  <button style={{marginTop:8, padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                    background:'rgba(0,210,255,0.08)', border:'1px solid rgba(0,210,255,0.15)',
                    color:'#00D2FF', display:'flex', alignItems:'center', gap:6}}
                    onClick={() => setView('apikeys')}>
                    <Icon name="key" size={14} color="#00D2FF" />
                    {L('manageKeys') || 'Gestisci chiavi API'}
                  </button>
                </div>
              ) : (
                /* Platform credits */
                <div>
                  <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:4}}>
                    <span style={{fontSize:24, fontWeight:800,
                      color: creditBalance > 50 ? '#00FF94' : creditBalance > 0 ? '#ffd700' : '#FF6B9D'}}>
                      {formatCredits(creditBalance)}
                    </span>
                    <span style={{fontSize:11, color:'rgba(232,234,255,0.35)'}}>
                      {L('credit')}
                    </span>
                  </div>
                  <div style={{fontSize:11, color:'rgba(232,234,255,0.4)', marginBottom:8}}>
                    ~{Math.floor(creditBalance / 0.5)} {L('messagesRemaining') || 'messaggi rimanenti'}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button style={{padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                      background:'rgba(108,99,255,0.12)', border:'1px solid rgba(108,99,255,0.2)',
                      color:'#6C63FF', display:'flex', alignItems:'center', gap:5}}
                      onClick={() => setView('credits')}>
                      <Icon name="zap" size={14} color="#6C63FF" />
                      {L('recharge')}
                    </button>
                    <button style={{padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                      background:'rgba(0,210,255,0.08)', border:'1px solid rgba(0,210,255,0.15)',
                      color:'#00D2FF', display:'flex', alignItems:'center', gap:5}}
                      onClick={() => setView('apikeys')}>
                      <Icon name="key" size={14} color="#00D2FF" />
                      {L('useOwnKeysBtn') || 'Usa API personali'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            MAIN SETTINGS CARD
           ══════════════════════════════════════════════════ */}
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>{L('name')}</div>
            <input style={S.input} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>

          {/* Avatar carousel */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={S.label}>{L('avatar')}</div>
              <button onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                style={{background:'none', border:'none', color:'rgba(232,234,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showAvatarDropdown ? '\u2715' : '\u25BC lista'}
              </button>
            </div>
            {showAvatarDropdown ? (
              <div style={{display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
                {AVATARS.map((a, i) => (
                  <button key={a} onClick={() => { setPrefs({...prefs, avatar:a}); setShowAvatarDropdown(false); }}
                    style={{...S.avatarBtn, width:60, height:74, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2, flexDirection:'column'}}>
                    <img src={a} alt={AVATAR_NAMES[i]} style={{width:46, height:46, objectFit:'contain', borderRadius:12}} />
                    <span style={{fontSize:9, marginTop:2, color:'rgba(232,234,255,0.6)'}}>{AVATAR_NAMES[i]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Carousel
                items={AVATARS}
                selectedIndex={selectedAvatarIdx >= 0 ? selectedAvatarIdx : 0}
                onSelect={(i) => setPrefs({...prefs, avatar: AVATARS[i]})}
                itemWidth={80}
                gap={8}
                renderItem={(avatar, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:70, height:70, borderRadius:18, overflow:'hidden',
                      border: isSelected ? '3px solid #6C63FF' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(108,99,255,0.2), 0 0 16px rgba(108,99,255,0.1)' : 'none',
                      background: isSelected ? 'rgba(108,99,255,0.08)' : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s'
                    }}>
                      <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:60, height:60, objectFit:'contain'}} />
                    </div>
                    <span style={{
                      fontSize:10, marginTop:4, textAlign:'center',
                      color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.5)',
                      fontWeight: isSelected ? 600 : 400, fontFamily: FONT
                    }}>{AVATAR_NAMES[i]}</span>
                  </div>
                )}
              />
            )}
          </div>

          {/* Language carousel */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={S.label}>{L('yourLang')}</div>
              <button onClick={() => setShowLangDropdown(!showLangDropdown)}
                style={{background:'none', border:'none', color:'rgba(232,234,255,0.5)', fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showLangDropdown ? '\u2715' : '\u25BC lista'}
              </button>
            </div>
            {showLangDropdown ? (
              <select style={S.select} value={prefs.lang}
                onChange={e => { setPrefs({...prefs, lang:e.target.value}); setShowLangDropdown(false); }}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            ) : (
              <Carousel
                items={LANGS}
                selectedIndex={selectedLangIdx >= 0 ? selectedLangIdx : 0}
                onSelect={(i) => setPrefs({...prefs, lang: LANGS[i].code})}
                itemWidth={80}
                gap={8}
                renderItem={(lang, i, isSelected) => (
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                    <div style={{
                      width:56, height:56, borderRadius:28, overflow:'hidden',
                      border: isSelected ? '3px solid #6C63FF' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px rgba(108,99,255,0.2), 0 0 16px rgba(108,99,255,0.1)' : 'none',
                      background: isSelected ? 'rgba(108,99,255,0.08)' : 'rgba(232,234,255,0.04)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s', fontSize: 28
                    }}>
                      {lang.flag}
                    </div>
                    <span style={{
                      fontSize:9, marginTop:4, textAlign:'center', maxWidth:76, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap',
                      color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.5)',
                      fontWeight: isSelected ? 600 : 400, fontFamily: FONT
                    }}>{lang.name}</span>
                  </div>
                )}
              />
            )}
          </div>

          <div style={S.field}>
            <div style={S.label}>{L('voiceTranslation')} (OpenAI)</div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginBottom:8}}>
              {L('tapToSelect') || 'Tocca per selezionare'} \u2022 {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {VOICES.map(v => {
                const isSelected = prefs.voice === v;
                const isPlaying = playingVoice === v;
                return (
                  <div key={v} style={{display:'flex', alignItems:'center', gap:8,
                    padding:'10px 14px', borderRadius:14, transition:'all 0.15s',
                    background: isSelected ? 'rgba(108,99,255,0.12)' : 'rgba(232,234,255,0.02)',
                    border: isSelected ? '1.5px solid rgba(108,99,255,0.3)' : '1.5px solid rgba(232,234,255,0.06)'}}>
                    {/* Play/Stop button */}
                    <button onClick={(e) => { e.stopPropagation(); previewVoice(v); }}
                      style={{width:36, height:36, borderRadius:10, cursor:'pointer', flexShrink:0,
                        background: isPlaying ? 'rgba(255,107,157,0.15)' : 'rgba(232,234,255,0.04)',
                        border: isPlaying ? '1.5px solid rgba(255,107,157,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                      <Icon name={isPlaying ? 'stop' : 'play'} size={16}
                        color={isPlaying ? '#FF6B9D' : 'rgba(232,234,255,0.5)'} />
                    </button>
                    {/* Voice name — click to select */}
                    <button onClick={() => setPrefs({...prefs, voice:v})}
                      style={{flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer',
                        fontFamily:FONT, WebkitTapHighlightColor:'transparent', padding:0}}>
                      <div style={{fontSize:14, fontWeight:isSelected ? 700 : 500,
                        color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.6)',
                        letterSpacing:-0.2}}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </div>
                      <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:1}}>
                        {v === 'alloy' ? (L('voiceAlloyDesc') || 'Neutra, versatile') :
                         v === 'echo' ? (L('voiceEchoDesc') || 'Maschile, calda') :
                         v === 'fable' ? (L('voiceFableDesc') || 'Espressiva, narrativa') :
                         v === 'onyx' ? (L('voiceOnyxDesc') || 'Profonda, autorevole') :
                         v === 'nova' ? (L('voiceNovaDesc') || 'Femminile, naturale') :
                         v === 'shimmer' ? (L('voiceShimmerDesc') || 'Luminosa, chiara') : ''}
                      </div>
                    </button>
                    {/* Selected indicator */}
                    {isSelected && (
                      <div style={{width:24, height:24, borderRadius:12,
                        background:'rgba(108,99,255,0.15)', border:'1.5px solid rgba(108,99,255,0.3)',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <span style={{fontSize:12, color:'#6C63FF'}}>{'\u2713'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:10, color:'rgba(232,234,255,0.25)', marginTop:8, lineHeight:1.4}}>
              {(userToken && (useOwnKeys || creditBalance > 0))
                ? (L('previewUsesRealVoice') || '\u2713 Anteprima con la vera voce OpenAI TTS')
                : (L('previewRequiresAccount') || 'Accedi con account PRO o configura le chiavi API per ascoltare l\'anteprima delle voci')}
            </div>
            {/* Voice Test Page button */}
            <button onClick={() => setView('voicetest')}
              style={{width:'100%', marginTop:10, padding:'10px 14px', borderRadius:12, cursor:'pointer',
                background:'rgba(108,99,255,0.06)', border:'1px solid rgba(108,99,255,0.15)',
                color:'#6C63FF', fontSize:12, fontWeight:700, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent'}}>
              <Icon name="play" size={16} color="#6C63FF" />
              {L('voiceTestPage') || 'Test completo voci'}
            </button>
          </div>

          {/* ══════════════════════════════════════════════════
              ELEVENLABS — TOP PRO
             ══════════════════════════════════════════════════ */}
          {!isTrial && ((useOwnKeys && apiKeyInputs?.elevenlabs) || platformHasEL) && (
            <div style={{...S.field, padding:'14px', borderRadius:16,
              background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.12)'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                <span style={{fontSize:14, fontWeight:700, color:'#ffd700', display:'flex', alignItems:'center', gap:6}}>
                  {'\u2B50'} TOP PRO \u2014 ElevenLabs
                </span>
                <button onClick={() => setIsTopPro(!isTopPro)}
                  style={{...S.toggle, background:isTopPro ? '#ffd700' : '#333'}}>
                  <div style={{...S.toggleDot, transform:isTopPro ? 'translateX(20px)' : 'translateX(0)'}} />
                </button>
              </div>
              {!useOwnKeys && platformHasEL && (
                <div style={{fontSize:11, color:'rgba(232,234,255,0.4)', marginBottom:8}}>
                  ElevenLabs via piattaforma (costo ~20x TTS standard)
                </div>
              )}

              {/* Load voices button */}
              {isTopPro && elevenLabsVoices.length === 0 && (
                <button style={{width:'100%', padding:'10px 14px', borderRadius:10, cursor:'pointer',
                  background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.2)',
                  color:'#ffd700', fontSize:13, fontWeight:700, fontFamily:FONT,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  WebkitTapHighlightColor:'transparent'}}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/tts-elevenlabs?action=voices&token=${userTokenRef.current || ''}`);
                      if (res.ok) {
                        const data = await res.json();
                        setElevenLabsVoices(data.voices || []);
                      }
                    } catch(e) { console.error('Failed to load voices:', e); }
                  }}>
                  <Icon name="refresh" size={16} color="#ffd700" />
                  {L('loadVoices') || 'Carica voci ElevenLabs'}
                </button>
              )}

              {/* ElevenLabs voice list with preview */}
              {isTopPro && elevenLabsVoices.length > 0 && (
                <div>
                  <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginBottom:8}}>
                    {elevenLabsVoices.length} {L('voicesAvailable') || 'voci disponibili'} \u2022 {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'}
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:4, maxHeight:300, overflowY:'auto'}}>
                    {elevenLabsVoices.map(v => {
                      const isSel = selectedELVoice === v.id;
                      const isPlaying = playingVoice === `el_${v.id}`;
                      return (
                        <div key={v.id} style={{display:'flex', alignItems:'center', gap:8,
                          padding:'8px 12px', borderRadius:12, transition:'all 0.15s',
                          background: isSel ? 'rgba(255,215,0,0.1)' : 'rgba(232,234,255,0.02)',
                          border: isSel ? '1.5px solid rgba(255,215,0,0.25)' : '1.5px solid rgba(232,234,255,0.04)'}}>
                          {/* Play button */}
                          <button onClick={(e) => { e.stopPropagation(); previewELVoice(v); }}
                            style={{width:32, height:32, borderRadius:8, cursor:'pointer', flexShrink:0,
                              background: isPlaying ? 'rgba(255,107,157,0.15)' : 'rgba(232,234,255,0.04)',
                              border: isPlaying ? '1.5px solid rgba(255,107,157,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              WebkitTapHighlightColor:'transparent'}}>
                            <Icon name={isPlaying ? 'stop' : 'play'} size={14}
                              color={isPlaying ? '#FF6B9D' : 'rgba(232,234,255,0.5)'} />
                          </button>
                          {/* Voice info — click to select */}
                          <button onClick={() => setSelectedELVoice(v.id)}
                            style={{flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer',
                              fontFamily:FONT, WebkitTapHighlightColor:'transparent', padding:0}}>
                            <div style={{fontSize:13, fontWeight: isSel ? 700 : 500,
                              color: isSel ? '#ffd700' : 'rgba(232,234,255,0.6)'}}>
                              {v.name}
                            </div>
                            <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:1}}>
                              {v.category}{v.labels?.accent ? ` \u2022 ${v.labels.accent}` : ''}{v.labels?.gender ? ` \u2022 ${v.labels.gender}` : ''}
                            </div>
                          </button>
                          {isSel && <span style={{fontSize:12, color:'#ffd700'}}>{'\u2713'}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>{L('autoplayTranslation')}</span>
              <button onClick={() => setPrefs({...prefs, autoPlay:!prefs.autoPlay})}
                style={{...S.toggle, background:prefs.autoPlay ? '#6C63FF' : '#333'}}>
                <div style={{...S.toggleDot, transform:prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>

          {/* Theme toggle */}
          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>{L('theme') || 'Theme'}</span>
              <button onClick={() => setTheme(theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK)}
                style={{...S.toggle, background:theme === THEMES.DARK ? '#333' : '#ffd700'}}>
                <div style={{...S.toggleDot, transform:theme === THEMES.DARK ? 'translateX(0)' : 'translateX(20px)'}} />
              </button>
              <span style={{fontSize:14, marginLeft:8}}>{theme === THEMES.DARK ? '\uD83C\uDF19' : '\u2600\uFE0F'}</span>
            </div>
            <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginTop:4}}>
              {theme === THEMES.DARK ? 'Dark Mode' : 'Light Mode'}
            </div>
          </div>

          <button style={{...S.btn, marginTop:12}} onClick={() => { savePrefs(prefs); setView('home'); }}>
            OK
          </button>
          {userToken && (
            <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:8}}>
                Account: {userAccount?.email || ''}
              </div>
              <button style={{...S.settingsBtn, color:'#FF6B9D', borderColor:'rgba(255,107,157,0.2)'}}
                onClick={() => { logout({ clearPrefs: true }); setPrefs({ name:'', lang:'it', avatar:'/avatars/1.png', voice:'nova', autoPlay:true }); setView('welcome'); }}>
                {L('logoutAccount')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CSS animation for refresh spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
});

export default SettingsView;

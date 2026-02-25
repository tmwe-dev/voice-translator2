'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES, FONT, FREE_DAILY_LIMIT, formatCredits, getLang, AI_MODELS } from '../lib/constants.js';
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
  const [elLangFilter, setElLangFilter] = useState('all');
  const [elGenderFilter, setElGenderFilter] = useState('all');
  const [avatarVoiceMap, setAvatarVoiceMap] = useState({});
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
                  <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6}}>
                    <span style={{fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6,
                      background: hasOpenAI ? 'rgba(0,255,148,0.1)' : 'rgba(255,107,157,0.1)',
                      border: hasOpenAI ? '1px solid rgba(0,255,148,0.2)' : '1px solid rgba(255,107,157,0.2)',
                      color: hasOpenAI ? '#00FF94' : '#FF6B9D'}}>
                      {hasOpenAI ? (L('ready') || 'Ready') : (L('incomplete') || 'Incomplete')}
                    </span>
                    <span style={{fontSize:11, color:'rgba(232,234,255,0.4)'}}>
                      {keyCount > 0
                        ? `${keyCount} key${keyCount > 1 ? 's' : ''} ${L('configured') || 'configurate'}`
                        : L('noKeysConfigured') || 'Nessuna chiave configurata'}
                    </span>
                  </div>
                  {!hasOpenAI && (
                    <div style={{fontSize:10, color:'#FF6B9D', marginTop:4}}>
                      {L('openaiRequired') || 'OpenAI key richiesta per traduzione e voci AI'}
                    </div>
                  )}
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
              AI TRANSLATION MODEL SELECTOR
             ══════════════════════════════════════════════════ */}
          {!isGuest && (() => {
            // Filter models: own-key users see all models for which they have keys
            // Platform users only see gpt-4o-mini (default)
            const availableModels = AI_MODELS.filter(m => {
              if (!m.ownKeyOnly) return true;
              if (!useOwnKeys) return false;
              if (m.provider === 'openai') return hasOpenAI;
              if (m.provider === 'anthropic') return hasAnthropic;
              if (m.provider === 'gemini') return hasGemini;
              return false;
            });

            const PROVIDER_ICONS = { openai:'\u26A1', anthropic:'\u{1F9E0}', gemini:'\u2728' };

            return (
              <div style={S.field}>
                <div style={S.label}>{L('aiTranslationModel') || 'Modello AI traduzione'}</div>
                <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginBottom:8}}>
                  {useOwnKeys
                    ? (L('aiModelHintOwnKeys') || 'Scegli il motore AI \u2022 Usa le tue API keys')
                    : (L('aiModelHint') || 'Scegli il motore di traduzione AI')}
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  {availableModels.map(m => {
                    const isSelected = (prefs.aiModel || 'gpt-4o-mini') === m.id;
                    return (
                      <button key={m.id} onClick={() => setPrefs({...prefs, aiModel: m.id})}
                        style={{display:'flex', alignItems:'center', gap:10,
                          padding:'10px 14px', borderRadius:14, cursor:'pointer',
                          background: isSelected ? 'rgba(108,99,255,0.12)' : 'rgba(232,234,255,0.02)',
                          border: isSelected ? '1.5px solid rgba(108,99,255,0.3)' : '1.5px solid rgba(232,234,255,0.06)',
                          fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                        <div style={{width:32, height:32, borderRadius:10, flexShrink:0,
                          background: isSelected ? 'rgba(108,99,255,0.15)' : 'rgba(232,234,255,0.04)',
                          border: isSelected ? '1.5px solid rgba(108,99,255,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                          display:'flex', alignItems:'center', justifyContent:'center'}}>
                          <span style={{fontSize:14}}>{PROVIDER_ICONS[m.provider] || '\u26A1'}</span>
                        </div>
                        <div style={{flex:1, textAlign:'left'}}>
                          <div style={{fontSize:14, fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? '#6C63FF' : 'rgba(232,234,255,0.6)', letterSpacing:-0.2}}>
                            {m.name}
                          </div>
                          <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:1}}>
                            {m.desc} \u2022 {m.cost}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{width:24, height:24, borderRadius:12,
                            background:'rgba(108,99,255,0.15)', border:'1.5px solid rgba(108,99,255,0.3)',
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                            <span style={{fontSize:12, color:'#6C63FF'}}>{'\u2713'}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {useOwnKeys && !hasAnthropic && !hasGemini && (
                  <div style={{fontSize:10, color:'rgba(232,234,255,0.25)', marginTop:8, lineHeight:1.4}}>
                    {L('addMoreKeysHint') || 'Aggiungi chiavi Anthropic o Gemini per sbloccare altri modelli AI'}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              ELEVENLABS — TOP PRO
             ══════════════════════════════════════════════════ */}
          {!isTrial && ((useOwnKeys && apiKeyInputs?.elevenlabs) || platformHasEL) && (() => {
            // Accent/language → flag mapping
            const ACCENT_FLAGS = {
              american:'\u{1F1FA}\u{1F1F8}', british:'\u{1F1EC}\u{1F1E7}', english:'\u{1F1EC}\u{1F1E7}',
              italian:'\u{1F1EE}\u{1F1F9}', spanish:'\u{1F1EA}\u{1F1F8}', french:'\u{1F1EB}\u{1F1F7}',
              german:'\u{1F1E9}\u{1F1EA}', portuguese:'\u{1F1E7}\u{1F1F7}', brazilian:'\u{1F1E7}\u{1F1F7}',
              chinese:'\u{1F1E8}\u{1F1F3}', japanese:'\u{1F1EF}\u{1F1F5}', korean:'\u{1F1F0}\u{1F1F7}',
              arabic:'\u{1F1F8}\u{1F1E6}', hindi:'\u{1F1EE}\u{1F1F3}', indian:'\u{1F1EE}\u{1F1F3}',
              russian:'\u{1F1F7}\u{1F1FA}', turkish:'\u{1F1F9}\u{1F1F7}', dutch:'\u{1F1F3}\u{1F1F1}',
              polish:'\u{1F1F5}\u{1F1F1}', swedish:'\u{1F1F8}\u{1F1EA}', thai:'\u{1F1F9}\u{1F1ED}',
              vietnamese:'\u{1F1FB}\u{1F1F3}', indonesian:'\u{1F1EE}\u{1F1E9}', malay:'\u{1F1F2}\u{1F1FE}',
              greek:'\u{1F1EC}\u{1F1F7}', czech:'\u{1F1E8}\u{1F1FF}', romanian:'\u{1F1F7}\u{1F1F4}',
              hungarian:'\u{1F1ED}\u{1F1FA}', finnish:'\u{1F1EB}\u{1F1EE}', irish:'\u{1F1EE}\u{1F1EA}',
              australian:'\u{1F1E6}\u{1F1FA}', african:'\u{1F30D}', middle_eastern:'\u{1F30D}',
            };
            const getVoiceFlag = (v) => {
              const accent = (v.accent || v.labels?.accent || '').toLowerCase();
              for (const [key, flag] of Object.entries(ACCENT_FLAGS)) {
                if (accent.includes(key)) return flag;
              }
              return '\u{1F30D}';
            };

            // Get unique accents for filter
            const allAccents = elevenLabsVoices.length > 0
              ? [...new Set(elevenLabsVoices.map(v => (v.accent || v.labels?.accent || '').toLowerCase()).filter(Boolean))].sort()
              : [];

            // Filter voices
            const filteredVoices = elevenLabsVoices.filter(v => {
              if (elLangFilter !== 'all') {
                const accent = (v.accent || v.labels?.accent || '').toLowerCase();
                if (!accent.includes(elLangFilter)) return false;
              }
              if (elGenderFilter !== 'all') {
                const gender = (v.gender || v.labels?.gender || '').toLowerCase();
                if (gender !== elGenderFilter) return false;
              }
              return true;
            });

            // Check if a voice is assigned to any avatar
            const voiceToAvatars = {};
            if (avatarVoiceMap) {
              Object.entries(avatarVoiceMap).forEach(([name, vid]) => {
                if (!voiceToAvatars[vid]) voiceToAvatars[vid] = [];
                voiceToAvatars[vid].push(name);
              });
            }

            return (
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
                          if (data.avatarVoiceMap) setAvatarVoiceMap(data.avatarVoiceMap);
                        }
                      } catch(e) { console.error('Failed to load voices:', e); }
                    }}>
                    <Icon name="refresh" size={16} color="#ffd700" />
                    {L('loadVoices') || 'Carica voci ElevenLabs'}
                  </button>
                )}

                {/* ElevenLabs voice browser with filters */}
                {isTopPro && elevenLabsVoices.length > 0 && (
                  <div>
                    {/* ── Filter bar ── */}
                    <div style={{display:'flex', gap:8, marginBottom:10, flexWrap:'wrap'}}>
                      {/* Language/accent filter */}
                      <select value={elLangFilter} onChange={e => setElLangFilter(e.target.value)}
                        style={{flex:1, minWidth:120, padding:'6px 10px', borderRadius:8, fontSize:11, fontWeight:600,
                          background:'rgba(232,234,255,0.04)', border:'1px solid rgba(255,215,0,0.15)',
                          color:'#E8EAFF', fontFamily:FONT, cursor:'pointer',
                          WebkitAppearance:'none', MozAppearance:'none'}}>
                        <option value="all">{'\u{1F30D}'} {L('allLanguages') || 'Tutte le lingue'}</option>
                        {allAccents.map(a => (
                          <option key={a} value={a}>{ACCENT_FLAGS[a] || '\u{1F30D}'} {a.charAt(0).toUpperCase() + a.slice(1)}</option>
                        ))}
                      </select>
                      {/* Gender filter */}
                      <div style={{display:'flex', gap:0, borderRadius:8, overflow:'hidden',
                        border:'1px solid rgba(255,215,0,0.15)'}}>
                        {['all','male','female'].map(g => (
                          <button key={g} onClick={() => setElGenderFilter(g)}
                            style={{padding:'6px 10px', fontSize:11, fontWeight:600, cursor:'pointer',
                              fontFamily:FONT, border:'none', WebkitTapHighlightColor:'transparent',
                              background: elGenderFilter === g ? 'rgba(255,215,0,0.15)' : 'rgba(232,234,255,0.04)',
                              color: elGenderFilter === g ? '#ffd700' : 'rgba(232,234,255,0.4)'}}>
                            {g === 'all' ? (L('allGenders') || 'Tutti') : g === 'male' ? '\u2642\uFE0F' : '\u2640\uFE0F'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginBottom:8}}>
                      {filteredVoices.length}/{elevenLabsVoices.length} {L('voicesAvailable') || 'voci'} \u2022 {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'}
                    </div>

                    {/* Voice list */}
                    <div style={{display:'flex', flexDirection:'column', gap:4, maxHeight:320, overflowY:'auto',
                      WebkitOverflowScrolling:'touch'}}>
                      {filteredVoices.map(v => {
                        const isSel = selectedELVoice === v.id;
                        const isPlaying = playingVoice === `el_${v.id}`;
                        const flag = getVoiceFlag(v);
                        const assignedAvatars = voiceToAvatars[v.id] || [];
                        return (
                          <div key={v.id} style={{display:'flex', alignItems:'center', gap:8,
                            padding:'8px 12px', borderRadius:12, transition:'all 0.15s',
                            background: isSel ? 'rgba(255,215,0,0.1)' : 'rgba(232,234,255,0.02)',
                            border: isSel ? '1.5px solid rgba(255,215,0,0.25)' : '1.5px solid rgba(232,234,255,0.04)'}}>
                            {/* Flag */}
                            <span style={{fontSize:18, flexShrink:0}}>{flag}</span>
                            {/* Play button */}
                            <button onClick={(e) => { e.stopPropagation(); previewELVoice(v); }}
                              style={{width:30, height:30, borderRadius:8, cursor:'pointer', flexShrink:0,
                                background: isPlaying ? 'rgba(255,107,157,0.15)' : 'rgba(232,234,255,0.04)',
                                border: isPlaying ? '1.5px solid rgba(255,107,157,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                WebkitTapHighlightColor:'transparent'}}>
                              <Icon name={isPlaying ? 'stop' : 'play'} size={12}
                                color={isPlaying ? '#FF6B9D' : 'rgba(232,234,255,0.5)'} />
                            </button>
                            {/* Voice info */}
                            <button onClick={() => setSelectedELVoice(v.id)}
                              style={{flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer',
                                fontFamily:FONT, WebkitTapHighlightColor:'transparent', padding:0}}>
                              <div style={{display:'flex', alignItems:'center', gap:5}}>
                                <span style={{fontSize:13, fontWeight: isSel ? 700 : 500,
                                  color: isSel ? '#ffd700' : 'rgba(232,234,255,0.6)'}}>
                                  {v.name}
                                </span>
                                {/* Gender badge */}
                                {(v.gender || v.labels?.gender) && (
                                  <span style={{fontSize:9, padding:'1px 5px', borderRadius:4,
                                    background: (v.gender || v.labels?.gender) === 'male' ? 'rgba(0,150,255,0.1)' : 'rgba(255,100,180,0.1)',
                                    color: (v.gender || v.labels?.gender) === 'male' ? '#4da6ff' : '#ff6bb4',
                                    border: (v.gender || v.labels?.gender) === 'male' ? '1px solid rgba(0,150,255,0.15)' : '1px solid rgba(255,100,180,0.15)'}}>
                                    {(v.gender || v.labels?.gender) === 'male' ? '\u2642' : '\u2640'}
                                  </span>
                                )}
                              </div>
                              <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:1}}>
                                {v.accent || v.labels?.accent || v.category || ''}
                                {v.age || v.labels?.age ? ` \u2022 ${v.age || v.labels?.age}` : ''}
                                {v.useCase ? ` \u2022 ${v.useCase}` : ''}
                              </div>
                              {/* Avatar assignment badges */}
                              {assignedAvatars.length > 0 && (
                                <div style={{display:'flex', gap:3, marginTop:3}}>
                                  {assignedAvatars.map(name => (
                                    <span key={name} style={{fontSize:8, padding:'1px 5px', borderRadius:4,
                                      background:'rgba(108,99,255,0.1)', border:'1px solid rgba(108,99,255,0.2)',
                                      color:'#6C63FF', fontWeight:700}}>
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                            {isSel && <span style={{fontSize:12, color:'#ffd700'}}>{'\u2713'}</span>}
                          </div>
                        );
                      })}
                      {filteredVoices.length === 0 && (
                        <div style={{textAlign:'center', padding:16, fontSize:12, color:'rgba(232,234,255,0.3)'}}>
                          {L('noVoicesMatch') || 'Nessuna voce corrisponde ai filtri'}
                        </div>
                      )}
                    </div>

                    {/* Avatar voice defaults info */}
                    {Object.keys(avatarVoiceMap).length > 0 && (
                      <div style={{marginTop:10, padding:'8px 10px', borderRadius:8,
                        background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)'}}>
                        <div style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.4)', marginBottom:4}}>
                          {L('avatarDefaults') || 'Voci predefinite avatar'}
                        </div>
                        <div style={{fontSize:9, color:'rgba(232,234,255,0.3)', lineHeight:1.6}}>
                          {L('avatarDefaultsHint') || 'Ogni avatar usa una voce dedicata se non ne selezioni una manualmente. Seleziona una voce qui per sovrascrivere il default.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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

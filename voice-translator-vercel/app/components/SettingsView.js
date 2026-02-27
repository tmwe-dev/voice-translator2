'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES, THEME_LIST, FONT, FREE_DAILY_LIMIT, formatCredits, getLang, AI_MODELS } from '../lib/constants.js';
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

  // Lending state
  const [showLending, setShowLending] = useState(false);
  const [lendingTokens, setLendingTokens] = useState([]);
  const [lendingLoading, setLendingLoading] = useState(false);
  const [lendingType, setLendingType] = useState('time');
  const [lendingDuration, setLendingDuration] = useState(24);
  const [lendingBudget, setLendingBudget] = useState(5000);
  const [lendingResult, setLendingResult] = useState(null);

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
          background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
          overflow:'hidden'}}>

          {/* Status header */}
          <div style={{padding:'16px 18px 12px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{width:36, height:36, borderRadius:12,
                background: isGuest ? S.colors.accent4Bg : (useOwnKeys ? S.colors.accent2Bg : S.colors.accent1Bg),
                display:'flex', alignItems:'center', justifyContent:'center'}}>
                <Icon name={isGuest ? 'zap' : (useOwnKeys ? 'key' : 'credit')} size={18}
                  color={isGuest ? S.colors.accent4 : (useOwnKeys ? S.colors.accent2 : S.colors.accent1)} />
              </div>
              <div>
                <div style={{fontSize:14, fontWeight:700, color:S.colors.textPrimary}}>
                  {isGuest ? 'FREE Mode' : (useOwnKeys ? L('personalApiKeys') : 'PRO Mode')}
                </div>
                <div style={{fontSize:11, color:S.colors.textSecondary, marginTop:1}}>
                  {isGuest ? L('startFreeDesc') : (userAccount?.email || '')}
                </div>
              </div>
            </div>
            {/* Refresh button */}
            <button onClick={handleRefresh}
              style={{width:36, height:36, borderRadius:12, cursor:'pointer',
                background:S.colors.overlayBg, border:'1px solid ' + S.colors.overlayBorder,
                display:'flex', alignItems:'center', justifyContent:'center',
                WebkitTapHighlightColor:'transparent', transition:'all 0.2s',
                animation: refreshing ? 'spin 0.8s linear infinite' : 'none'}}>
              <Icon name="refresh" size={16} color={S.colors.textSecondary} />
            </button>
          </div>

          {/* ── Usage info ── */}
          {isGuest ? (
            /* FREE tier usage bar */
            <div style={{padding:'0 18px 16px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                <span style={{fontSize:10, fontWeight:700, color:S.colors.textTertiary, textTransform:'uppercase', letterSpacing:1}}>
                  {L('dailyUsage') || 'Utilizzo giornaliero'}
                </span>
                <span style={{fontSize:11, fontWeight:600, color: freePercent >= 90 ? S.colors.accent3 : S.colors.accent4}}>
                  {freePercent}%
                </span>
              </div>
              <div style={{width:'100%', height:6, borderRadius:3, background:S.colors.overlayBorder, overflow:'hidden'}}>
                <div style={{width:`${freePercent}%`, height:'100%', borderRadius:3, transition:'width 0.3s',
                  background: freePercent >= 90 ? `linear-gradient(90deg, ${S.colors.accent3}, ${S.colors.accent3}cc)` :
                    freePercent >= 60 ? `linear-gradient(90deg, ${S.colors.goldAccent}, ${S.colors.accent3})` :
                      `linear-gradient(90deg, ${S.colors.accent4}, ${S.colors.accent2})`}} />
              </div>
              <div style={{fontSize:10, color:S.colors.textTertiary, marginTop:5}}>
                {((freeCharsUsed || 0) / 1000).toFixed(1)}k / {(FREE_DAILY_LIMIT / 1000).toFixed(0)}k {L('characters') || 'caratteri'}
                <span style={{marginLeft:8, color: freePercent >= 90 ? S.colors.accent3 : S.colors.textTertiary}}>
                  ({(freeCharsLeft / 1000).toFixed(1)}k {L('remaining') || 'rimanenti'})
                </span>
              </div>
              <div style={{fontSize:9, color:S.colors.textMuted, marginTop:6, lineHeight:1.4}}>
                {L('freePrivacyNote') || 'Il piano gratuito utilizza MyMemory by Translated. La tua email viene condivisa con il servizio per gestire la quota personale.'}
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
                        background: k.ok ? S.colors.accent4Bg : S.colors.overlayBg,
                        border: k.ok ? '1px solid ' + S.colors.accent4Border : '1px solid ' + S.colors.overlayBorder,
                        color: k.ok ? S.colors.accent4 : S.colors.textTertiary}}>
                        <span style={{fontSize:12}}>{k.ok ? '\u2713' : '\u2715'}</span>
                        {k.name}
                        {k.required && !k.ok && <span style={{fontSize:9, color:S.colors.accent3}}>*</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6}}>
                    <span style={{fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:6,
                      background: hasOpenAI ? S.colors.accent4Bg : S.colors.accent3Bg,
                      border: hasOpenAI ? '1px solid ' + S.colors.accent4Border : '1px solid ' + S.colors.accent3Border,
                      color: hasOpenAI ? S.colors.accent4 : S.colors.accent3}}>
                      {hasOpenAI ? (L('ready') || 'Ready') : (L('incomplete') || 'Incomplete')}
                    </span>
                    <span style={{fontSize:11, color:S.colors.textSecondary}}>
                      {keyCount > 0
                        ? `${keyCount} key${keyCount > 1 ? 's' : ''} ${L('configured') || 'configurate'}`
                        : L('noKeysConfigured') || 'Nessuna chiave configurata'}
                    </span>
                  </div>
                  {!hasOpenAI && (
                    <div style={{fontSize:10, color:S.colors.accent3, marginTop:4}}>
                      {L('openaiRequired') || 'OpenAI key richiesta per traduzione e voci AI'}
                    </div>
                  )}
                  <button style={{marginTop:8, padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                    cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                    background:S.colors.accent2Bg, border:'1px solid ' + S.colors.accent2Border,
                    color:S.colors.accent2, display:'flex', alignItems:'center', gap:6}}
                    onClick={() => setView('apikeys')}>
                    <Icon name="key" size={14} color={S.colors.accent2} />
                    {L('manageKeys') || 'Gestisci chiavi API'}
                  </button>
                </div>
              ) : (
                /* Platform credits */
                <div>
                  <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:4}}>
                    <span style={{fontSize:24, fontWeight:800,
                      color: creditBalance > 50 ? S.colors.accent4 : creditBalance > 0 ? S.colors.goldAccent : S.colors.accent3}}>
                      {formatCredits(creditBalance)}
                    </span>
                    <span style={{fontSize:11, color:S.colors.textTertiary}}>
                      {L('credit')}
                    </span>
                  </div>
                  <div style={{fontSize:11, color:S.colors.textSecondary, marginBottom:8}}>
                    ~{Math.floor(creditBalance / 0.5)} {L('messagesRemaining') || 'messaggi rimanenti'}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button style={{padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                      background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
                      color:S.colors.accent1, display:'flex', alignItems:'center', gap:5}}
                      onClick={() => setView('credits')}>
                      <Icon name="zap" size={14} color={S.colors.accent1} />
                      {L('recharge')}
                    </button>
                    <button style={{padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700,
                      cursor:'pointer', fontFamily:FONT, WebkitTapHighlightColor:'transparent',
                      background:S.colors.accent2Bg, border:'1px solid ' + S.colors.accent2Border,
                      color:S.colors.accent2, display:'flex', alignItems:'center', gap:5}}
                      onClick={() => setView('apikeys')}>
                      <Icon name="key" size={14} color={S.colors.accent2} />
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
                style={{background:'none', border:'none', color:S.colors.textSecondary, fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
                {showAvatarDropdown ? '\u2715' : '\u25BC lista'}
              </button>
            </div>
            {showAvatarDropdown ? (
              <div style={{display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center'}}>
                {AVATARS.map((a, i) => (
                  <button key={a} onClick={() => { setPrefs({...prefs, avatar:a}); setShowAvatarDropdown(false); }}
                    style={{...S.avatarBtn, width:60, height:74, ...(prefs.avatar===a ? S.avatarSel : {}), padding:2, flexDirection:'column'}}>
                    <img src={a} alt={AVATAR_NAMES[i]} style={{width:46, height:46, objectFit:'contain', borderRadius:12}} />
                    <span style={{fontSize:9, marginTop:2, color:S.colors.textSecondary}}>{AVATAR_NAMES[i]}</span>
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
                      border: isSelected ? '3px solid ' + S.colors.accent1 : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px ' + S.colors.accent1Border + ', 0 0 16px ' + S.colors.accent1Bg : 'none',
                      background: isSelected ? S.colors.accent1Bg : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s'
                    }}>
                      <img src={avatar} alt={AVATAR_NAMES[i]} style={{width:60, height:60, objectFit:'contain'}} />
                    </div>
                    <span style={{
                      fontSize:10, marginTop:4, textAlign:'center',
                      color: isSelected ? S.colors.accent1 : S.colors.textSecondary,
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
                style={{background:'none', border:'none', color:S.colors.textSecondary, fontSize:11, cursor:'pointer', fontFamily:FONT, padding:'2px 6px'}}>
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
                      border: isSelected ? '3px solid ' + S.colors.accent1 : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 0 3px ' + S.colors.accent1Border + ', 0 0 16px ' + S.colors.accent1Bg : 'none',
                      background: isSelected ? S.colors.accent1Bg : S.colors.overlayBg,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition: 'all 0.2s', fontSize: 28
                    }}>
                      {lang.flag}
                    </div>
                    <span style={{
                      fontSize:9, marginTop:4, textAlign:'center', maxWidth:76, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap',
                      color: isSelected ? S.colors.accent1 : S.colors.textSecondary,
                      fontWeight: isSelected ? 600 : 400, fontFamily: FONT
                    }}>{lang.name}</span>
                  </div>
                )}
              />
            )}
          </div>

          <div style={S.field}>
            <div style={S.label}>{L('voiceTranslation')} (OpenAI)</div>
            <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:8}}>
              {L('tapToSelect') || 'Tocca per selezionare'} \u2022 {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {VOICES.map(v => {
                const isSelected = prefs.voice === v;
                const isPlaying = playingVoice === v;
                return (
                  <div key={v} style={{display:'flex', alignItems:'center', gap:8,
                    padding:'10px 14px', borderRadius:14, transition:'all 0.15s',
                    background: isSelected ? S.colors.accent1Bg : S.colors.overlayBg,
                    border: isSelected ? '1.5px solid ' + S.colors.accent1Border : '1.5px solid ' + S.colors.overlayBorder}}>
                    {/* Play/Stop button */}
                    <button onClick={(e) => { e.stopPropagation(); previewVoice(v); }}
                      style={{width:36, height:36, borderRadius:10, cursor:'pointer', flexShrink:0,
                        background: isPlaying ? S.colors.accent3Bg : S.colors.overlayBg,
                        border: isPlaying ? '1.5px solid ' + S.colors.accent3Border : '1.5px solid ' + S.colors.overlayBorder,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                      <Icon name={isPlaying ? 'stop' : 'play'} size={16}
                        color={isPlaying ? S.colors.accent3 : S.colors.textSecondary} />
                    </button>
                    {/* Voice name — click to select */}
                    <button onClick={() => setPrefs({...prefs, voice:v})}
                      style={{flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer',
                        fontFamily:FONT, WebkitTapHighlightColor:'transparent', padding:0}}>
                      <div style={{fontSize:14, fontWeight:isSelected ? 700 : 500,
                        color: isSelected ? S.colors.accent1 : S.colors.textSecondary,
                        letterSpacing:-0.2}}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </div>
                      <div style={{fontSize:10, color:S.colors.textTertiary, marginTop:1}}>
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
                        background:S.colors.accent1Bg, border:'1.5px solid ' + S.colors.accent1Border,
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                        <span style={{fontSize:12, color:S.colors.accent1}}>{'\u2713'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:10, color:S.colors.textTertiary, marginTop:8, lineHeight:1.4}}>
              {(userToken && (useOwnKeys || creditBalance > 0))
                ? (L('previewUsesRealVoice') || '\u2713 Anteprima con la vera voce OpenAI TTS')
                : (L('previewRequiresAccount') || 'Accedi con account PRO o configura le chiavi API per ascoltare l\'anteprima delle voci')}
            </div>
            {/* Voice Test Page button */}
            <button onClick={() => setView('voicetest')}
              style={{width:'100%', marginTop:10, padding:'10px 14px', borderRadius:12, cursor:'pointer',
                background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
                color:S.colors.accent1, fontSize:12, fontWeight:700, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent'}}>
              <Icon name="play" size={16} color={S.colors.accent1} />
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
                <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:8}}>
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
                          background: isSelected ? S.colors.accent1Bg : S.colors.overlayBg,
                          border: isSelected ? '1.5px solid ' + S.colors.accent1Border : '1.5px solid ' + S.colors.overlayBorder,
                          fontFamily:FONT, WebkitTapHighlightColor:'transparent', transition:'all 0.15s'}}>
                        <div style={{width:32, height:32, borderRadius:10, flexShrink:0,
                          background: isSelected ? S.colors.accent1Bg : S.colors.overlayBg,
                          border: isSelected ? '1.5px solid ' + S.colors.accent1Border : '1.5px solid ' + S.colors.overlayBorder,
                          display:'flex', alignItems:'center', justifyContent:'center'}}>
                          <span style={{fontSize:14}}>{PROVIDER_ICONS[m.provider] || '\u26A1'}</span>
                        </div>
                        <div style={{flex:1, textAlign:'left'}}>
                          <div style={{fontSize:14, fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? S.colors.accent1 : S.colors.textSecondary, letterSpacing:-0.2}}>
                            {m.name}
                          </div>
                          <div style={{fontSize:10, color:S.colors.textTertiary, marginTop:1}}>
                            {m.desc} \u2022 {m.cost}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{width:24, height:24, borderRadius:12,
                            background:S.colors.accent1Bg, border:'1.5px solid ' + S.colors.accent1Border,
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                            <span style={{fontSize:12, color:S.colors.accent1}}>{'\u2713'}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {useOwnKeys && !hasAnthropic && !hasGemini && (
                  <div style={{fontSize:10, color:S.colors.textTertiary, marginTop:8, lineHeight:1.4}}>
                    {L('addMoreKeysHint') || 'Aggiungi chiavi Anthropic o Gemini per sbloccare altri modelli AI'}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              FREE TRANSLATION SERVICES
             ══════════════════════════════════════════════════ */}
          {(() => {
            const PROVIDER_INFO = {
              google:    { name: 'Google Translate', icon: '🔵', quality: 4, latency: '~400ms' },
              baidu:     { name: 'Baidu Translate',  icon: '🔴', quality: 5, latency: '~600ms' },
              microsoft: { name: 'Microsoft',        icon: '🟢', quality: 4, latency: '~500ms' },
              mymemory:  { name: 'MyMemory',         icon: '🟠', quality: 3, latency: '~700ms' },
              libretranslate: { name: 'LibreTranslate', icon: '🟣', quality: 2, latency: '~1s' },
            };
            const CHAIN_DEFAULTS = {
              zh: ['baidu','google','microsoft'], ja: ['baidu','google','microsoft'],
              ko: ['baidu','google','microsoft'], th: ['baidu','google','microsoft'],
              ar: ['microsoft','google','baidu'], hi: ['microsoft','google','mymemory'],
              ru: ['microsoft','google','mymemory'], tr: ['microsoft','google','mymemory'],
            };
            const DEFAULT_CHAIN = ['google','microsoft','mymemory'];
            const lang2 = prefs.lang;
            const chain = CHAIN_DEFAULTS[lang2] || DEFAULT_CHAIN;
            const tp = prefs.translationProviders || { primary: 'auto', secondary: 'auto', tertiary: 'auto' };
            const tm = prefs.translationMode || 'standard';
            const allProviders = Object.keys(PROVIDER_INFO);
            const stars = (n) => '★'.repeat(n) + '☆'.repeat(5-n);

            const updateTP = (key, val) => {
              const newTP = { ...tp, [key]: val };
              setPrefs({ ...prefs, translationProviders: newTP });
              savePrefs({ ...prefs, translationProviders: newTP });
            };
            const updateMode = (mode) => {
              setPrefs({ ...prefs, translationMode: mode });
              savePrefs({ ...prefs, translationMode: mode });
            };
            const updateGender = (g) => {
              setPrefs({ ...prefs, edgeTtsVoiceGender: g });
              savePrefs({ ...prefs, edgeTtsVoiceGender: g });
            };

            return (
              <div style={S.field}>
                <div style={S.label}>{'🌐'} {L('translationServices') || 'Servizi di Traduzione (Free)'}</div>
                <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:10}}>
                  {L('translationServicesHint') || `Default ottimizzato per ${getLang(lang2).name}. Personalizza l'ordine dei provider.`}
                </div>

                {/* Provider chain for current language */}
                <div style={{fontSize:11, color:S.colors.textSecondary, marginBottom:8, fontWeight:600}}>
                  Provider per {getLang(lang2).flag} {getLang(lang2).name}:
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:4, marginBottom:12}}>
                  {chain.map((pid, i) => {
                    const p = PROVIDER_INFO[pid];
                    return (
                      <div key={pid} style={{
                        display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
                        background: i === 0 ? S.colors.accent1Bg : 'transparent',
                        borderRadius:8, fontSize:12,
                      }}>
                        <span style={{width:18, textAlign:'center'}}>{i+1}.</span>
                        <span>{p.icon}</span>
                        <span style={{flex:1, fontWeight: i===0 ? 600 : 400}}>{p.name}</span>
                        <span style={{color:'#eab308', fontSize:10}}>{stars(p.quality)}</span>
                        <span style={{color:S.colors.textTertiary, fontSize:10}}>{p.latency}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Override dropdowns */}
                {['primary','secondary','tertiary'].map((slot, i) => (
                  <div key={slot} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                    <span style={{fontSize:11, color:S.colors.textTertiary, width:70}}>
                      {i===0 ? 'Primario:' : i===1 ? 'Secondario:' : 'Terziario:'}
                    </span>
                    <select value={tp[slot] || 'auto'} onChange={e => updateTP(slot, e.target.value)}
                      style={{flex:1, background:S.colors.cardBg, color:S.colors.text, border:'1px solid ' + S.colors.border,
                        borderRadius:8, padding:'6px 8px', fontSize:12}}>
                      <option value="auto">🤖 Auto (consigliato)</option>
                      {allProviders.map(pid => (
                        <option key={pid} value={pid}>{PROVIDER_INFO[pid].icon} {PROVIDER_INFO[pid].name}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {/* Translation mode toggle */}
                <div style={{marginTop:12, marginBottom:8}}>
                  <div style={{fontSize:11, color:S.colors.textSecondary, fontWeight:600, marginBottom:6}}>
                    Modalità traduzione:
                  </div>
                  <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                    {[
                      { id: 'standard', label: '⚡ Standard', desc: '1 provider, veloce' },
                      { id: 'guaranteed', label: '✅ Garantita', desc: '3 provider, consenso' },
                      { id: 'superfast', label: '🏎️ Superfast', desc: '1 velocissimo' },
                    ].map(m => (
                      <button key={m.id} onClick={() => updateMode(m.id)}
                        style={{
                          flex:1, minWidth:90, padding:'8px 6px', borderRadius:10,
                          border: tm === m.id ? '2px solid ' + S.colors.accent1 : '1px solid ' + S.colors.border,
                          background: tm === m.id ? S.colors.accent1Bg : 'transparent',
                          color: S.colors.text, cursor:'pointer', textAlign:'center',
                        }}>
                        <div style={{fontSize:13, fontWeight:600}}>{m.label}</div>
                        <div style={{fontSize:9, color:S.colors.textTertiary, marginTop:2}}>{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Edge TTS voice gender */}
                <div style={{marginTop:10, display:'flex', alignItems:'center', gap:8}}>
                  <span style={{fontSize:11, color:S.colors.textTertiary}}>Voce Edge TTS (Free):</span>
                  <button onClick={() => updateGender('female')}
                    style={{padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                      border:'none', fontWeight:600,
                      background: (prefs.edgeTtsVoiceGender || 'female') === 'female' ? S.colors.accent1 : S.colors.cardBg,
                      color: (prefs.edgeTtsVoiceGender || 'female') === 'female' ? '#000' : S.colors.text}}>
                    Femminile
                  </button>
                  <button onClick={() => updateGender('male')}
                    style={{padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer',
                      border:'none', fontWeight:600,
                      background: prefs.edgeTtsVoiceGender === 'male' ? S.colors.accent1 : S.colors.cardBg,
                      color: prefs.edgeTtsVoiceGender === 'male' ? '#000' : S.colors.text}}>
                    Maschile
                  </button>
                </div>

                {/* Test Center link */}
                <a href="/testcenter" target="_blank" rel="noopener"
                  style={{display:'block', marginTop:12, padding:'8px 12px', borderRadius:8,
                    background:S.colors.accent2Bg || '#1e3a5f', textDecoration:'none',
                    color:S.colors.accent2 || '#60a5fa', fontSize:12, fontWeight:600, textAlign:'center'}}>
                  🧪 Apri Test Center
                </a>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              API KEY LENDING — TOP PRO
             ══════════════════════════════════════════════════ */}
          {useOwnKeys && apiKeyInputs?.elevenlabs && (() => {
            const isIT = L('createRoom') === 'Crea Stanza';

            async function fetchLendingTokens() {
              const token = userTokenRef?.current;
              if (!token) return;
              setLendingLoading(true);
              try {
                const res = await fetch('/api/lending', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'list', token })
                });
                const data = await res.json();
                if (data.tokens) setLendingTokens(data.tokens);
              } catch {}
              setLendingLoading(false);
            }

            async function handleCreateLending() {
              const token = userTokenRef?.current;
              if (!token) return;
              try {
                const res = await fetch('/api/lending', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'create',
                    token,
                    type: lendingType,
                    duration: lendingDuration * 3600000,
                    tokenBudget: lendingType !== 'time' ? lendingBudget : undefined
                  })
                });
                const data = await res.json();
                if (data.lendingCode) {
                  setLendingResult(data.lendingCode);
                  fetchLendingTokens();
                }
              } catch {}
            }

            async function handleRevoke(code) {
              const token = userTokenRef?.current;
              if (!token) return;
              try {
                await fetch('/api/lending', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'revoke', token, code })
                });
                fetchLendingTokens();
              } catch {}
            }

            return (
              <div style={{...S.card, marginTop:16}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer'}}
                  onClick={() => { setShowLending(!showLending); if (!showLending) fetchLendingTokens(); }}>
                  <div style={S.label}>{'🔑'} {isIT ? 'Presta Accesso TOP PRO' : 'Lend TOP PRO Access'}</div>
                  <Icon name="chevDown" size={16} color={S.colors.textMuted}
                    style={{transform: showLending ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}} />
                </div>

                {showLending && (
                  <div style={{marginTop:12}}>
                    <div style={{fontSize:11, color:S.colors.textMuted, marginBottom:12}}>
                      {isIT
                        ? 'Crea un token temporaneo che permette ad altri di usare il tuo accesso TOP PRO (le tue chiavi API).'
                        : 'Create a temporary token that lets others use your TOP PRO access (your API keys).'}
                    </div>

                    {/* Create form */}
                    <div style={{display:'flex', gap:8, marginBottom:8, flexWrap:'wrap'}}>
                      {['time', 'tokens', 'combined'].map(t => (
                        <button key={t} onClick={() => setLendingType(t)}
                          style={{padding:'6px 12px', borderRadius:8, fontSize:11, fontFamily:FONT, cursor:'pointer',
                            background: lendingType === t ? S.colors.accent2Bg : S.colors.overlayBg,
                            border: `1px solid ${lendingType === t ? S.colors.accent2Border : S.colors.overlayBorder}`,
                            color: lendingType === t ? S.colors.accent2 : S.colors.textMuted}}>
                          {t === 'time' ? (isIT ? 'Tempo' : 'Time')
                            : t === 'tokens' ? 'Token'
                            : (isIT ? 'Combinato' : 'Combined')}
                        </button>
                      ))}
                    </div>

                    {(lendingType === 'time' || lendingType === 'combined') && (
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                        <span style={{fontSize:11, color:S.colors.textMuted}}>{isIT ? 'Durata:' : 'Duration:'}</span>
                        <select value={lendingDuration} onChange={e => setLendingDuration(parseInt(e.target.value))}
                          style={{...S.input, padding:'4px 8px', fontSize:12, width:'auto'}}>
                          <option value={1}>1h</option>
                          <option value={6}>6h</option>
                          <option value={24}>24h</option>
                          <option value={72}>3 {isIT ? 'giorni' : 'days'}</option>
                          <option value={168}>7 {isIT ? 'giorni' : 'days'}</option>
                          <option value={720}>30 {isIT ? 'giorni' : 'days'}</option>
                        </select>
                      </div>
                    )}

                    {(lendingType === 'tokens' || lendingType === 'combined') && (
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                        <span style={{fontSize:11, color:S.colors.textMuted}}>Token budget:</span>
                        <input type="number" value={lendingBudget} onChange={e => setLendingBudget(parseInt(e.target.value) || 0)}
                          style={{...S.input, padding:'4px 8px', fontSize:12, width:80}} min={100} step={1000} />
                      </div>
                    )}

                    <button onClick={handleCreateLending}
                      style={{...S.btn, width:'100%', marginBottom:8, fontSize:12}}>
                      {'🔑'} {isIT ? 'Crea Token' : 'Create Token'}
                    </button>

                    {lendingResult && (
                      <div style={{padding:'8px 12px', borderRadius:8, background:S.colors.accent4Bg,
                        border:`1px solid ${S.colors.accent4Border}`, marginBottom:12}}>
                        <div style={{fontSize:11, color:S.colors.textMuted, marginBottom:4}}>
                          {isIT ? 'Token creato! Condividilo:' : 'Token created! Share it:'}
                        </div>
                        <div style={{fontSize:13, fontWeight:700, fontFamily:'monospace', color:S.colors.textPrimary,
                          cursor:'pointer', userSelect:'all'}}
                          onClick={() => { navigator.clipboard?.writeText(lendingResult); }}>
                          {lendingResult}
                        </div>
                      </div>
                    )}

                    {/* Active tokens list */}
                    {lendingTokens.length > 0 && (
                      <div style={{marginTop:8}}>
                        <div style={{fontSize:11, fontWeight:700, color:S.colors.textSecondary, marginBottom:6}}>
                          {isIT ? 'Token attivi' : 'Active tokens'}
                        </div>
                        {lendingTokens.map(t => (
                          <div key={t.code} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                            padding:'6px 10px', borderRadius:8, background:S.colors.overlayBg,
                            border:`1px solid ${S.colors.overlayBorder}`, marginBottom:4, fontSize:11}}>
                            <div>
                              <span style={{fontFamily:'monospace', color:S.colors.textPrimary}}>{t.code}</span>
                              <span style={{color:S.colors.textMuted, marginLeft:6}}>
                                {t.tokensUsed > 0 ? `${t.tokensUsed} tok` : ''} · {t.status}
                              </span>
                            </div>
                            {t.status === 'active' && (
                              <button onClick={() => handleRevoke(t.code)}
                                style={{background:'none', border:'none', color:S.colors.accent3,
                                  cursor:'pointer', fontSize:10, fontFamily:FONT}}>
                                {isIT ? 'Revoca' : 'Revoke'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {lendingLoading && (
                      <div style={{fontSize:11, color:S.colors.textMuted, textAlign:'center', padding:8}}>
                        {isIT ? 'Caricamento...' : 'Loading...'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              ELEVENLABS — TOP PRO
             ══════════════════════════════════════════════════ */}
          {!isTrial && ((useOwnKeys && apiKeyInputs?.elevenlabs) || platformHasEL) && (() => {
            // Comprehensive accent/language → flag mapping
            const ACCENT_FLAGS = {
              // English variants
              american:'\u{1F1FA}\u{1F1F8}', british:'\u{1F1EC}\u{1F1E7}', english:'\u{1F1EC}\u{1F1E7}',
              australian:'\u{1F1E6}\u{1F1FA}', canadian:'\u{1F1E8}\u{1F1E6}', scottish:'\u{1F1EC}\u{1F1E7}',
              irish:'\u{1F1EE}\u{1F1EA}', 'new zealand':'\u{1F1F3}\u{1F1FF}', south_african:'\u{1F1FF}\u{1F1E6}',
              // European
              italian:'\u{1F1EE}\u{1F1F9}', spanish:'\u{1F1EA}\u{1F1F8}', french:'\u{1F1EB}\u{1F1F7}',
              german:'\u{1F1E9}\u{1F1EA}', dutch:'\u{1F1F3}\u{1F1F1}', belgian:'\u{1F1E7}\u{1F1EA}',
              swiss:'\u{1F1E8}\u{1F1ED}', austrian:'\u{1F1E6}\u{1F1F9}',
              portuguese:'\u{1F1F5}\u{1F1F9}', brazilian:'\u{1F1E7}\u{1F1F7}',
              polish:'\u{1F1F5}\u{1F1F1}', swedish:'\u{1F1F8}\u{1F1EA}', norwegian:'\u{1F1F3}\u{1F1F4}',
              danish:'\u{1F1E9}\u{1F1F0}', finnish:'\u{1F1EB}\u{1F1EE}',
              greek:'\u{1F1EC}\u{1F1F7}', czech:'\u{1F1E8}\u{1F1FF}', slovak:'\u{1F1F8}\u{1F1F0}',
              romanian:'\u{1F1F7}\u{1F1F4}', hungarian:'\u{1F1ED}\u{1F1FA}', bulgarian:'\u{1F1E7}\u{1F1EC}',
              croatian:'\u{1F1ED}\u{1F1F7}', serbian:'\u{1F1F7}\u{1F1F8}', ukrainian:'\u{1F1FA}\u{1F1E6}',
              russian:'\u{1F1F7}\u{1F1FA}', estonian:'\u{1F1EA}\u{1F1EA}', latvian:'\u{1F1F1}\u{1F1FB}',
              lithuanian:'\u{1F1F1}\u{1F1F9}', slovenian:'\u{1F1F8}\u{1F1EE}',
              // Latin American
              mexican:'\u{1F1F2}\u{1F1FD}', colombian:'\u{1F1E8}\u{1F1F4}', argentinian:'\u{1F1E6}\u{1F1F7}',
              chilean:'\u{1F1E8}\u{1F1F1}', peruvian:'\u{1F1F5}\u{1F1EA}', cuban:'\u{1F1E8}\u{1F1FA}',
              // Asian
              chinese:'\u{1F1E8}\u{1F1F3}', japanese:'\u{1F1EF}\u{1F1F5}', korean:'\u{1F1F0}\u{1F1F7}',
              thai:'\u{1F1F9}\u{1F1ED}', vietnamese:'\u{1F1FB}\u{1F1F3}',
              indonesian:'\u{1F1EE}\u{1F1E9}', malay:'\u{1F1F2}\u{1F1FE}', filipino:'\u{1F1F5}\u{1F1ED}',
              hindi:'\u{1F1EE}\u{1F1F3}', indian:'\u{1F1EE}\u{1F1F3}', bengali:'\u{1F1E7}\u{1F1E9}',
              tamil:'\u{1F1EE}\u{1F1F3}', nepali:'\u{1F1F3}\u{1F1F5}',
              // Middle East & Africa
              arabic:'\u{1F1F8}\u{1F1E6}', turkish:'\u{1F1F9}\u{1F1F7}', persian:'\u{1F1EE}\u{1F1F7}',
              hebrew:'\u{1F1EE}\u{1F1F1}', african:'\u{1F1FF}\u{1F1E6}', middle_eastern:'\u{1F1F8}\u{1F1E6}',
              nigerian:'\u{1F1F3}\u{1F1EC}', kenyan:'\u{1F1F0}\u{1F1EA}', egyptian:'\u{1F1EA}\u{1F1EC}',
              // Catch-all for language labels
              english_us:'\u{1F1FA}\u{1F1F8}', english_uk:'\u{1F1EC}\u{1F1E7}',
              spanish_mx:'\u{1F1F2}\u{1F1FD}', spanish_es:'\u{1F1EA}\u{1F1F8}',
              portuguese_br:'\u{1F1E7}\u{1F1F7}', portuguese_pt:'\u{1F1F5}\u{1F1F9}',
              french_fr:'\u{1F1EB}\u{1F1F7}', french_ca:'\u{1F1E8}\u{1F1E6}',
            };

            const getVoiceFlag = (v) => {
              const accent = (v.accent || v.labels?.accent || '').toLowerCase();
              const lang = (v.language || v.labels?.language || '').toLowerCase();
              // Try accent first, then language
              for (const [key, flag] of Object.entries(ACCENT_FLAGS)) {
                if (accent.includes(key) || lang.includes(key)) return flag;
              }
              // Fallback heuristics for common patterns
              if (accent.includes('latin') || accent.includes('south america')) return '\u{1F1F2}\u{1F1FD}';
              if (accent.includes('east') && accent.includes('asia')) return '\u{1F1E8}\u{1F1F3}';
              if (accent.includes('europe')) return '\u{1F1EA}\u{1F1FA}';
              return '\u{1F3F3}\u{FE0F}';  // White flag for unknown — NOT globe
            };

            // Separate personal voices (cloned/professional) from library voices
            const personalVoices = elevenLabsVoices.filter(v =>
              v.category === 'cloned' || v.category === 'professional' || v.category === 'generated'
            );
            const libraryVoices = elevenLabsVoices.filter(v =>
              v.category !== 'cloned' && v.category !== 'professional' && v.category !== 'generated'
            );

            // Get unique accents for filter (from library voices)
            const allAccents = libraryVoices.length > 0
              ? [...new Set(libraryVoices.map(v => (v.accent || v.labels?.accent || '').toLowerCase()).filter(Boolean))].sort()
              : [];

            // Filter voices
            const filteredVoices = libraryVoices.filter(v => {
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

            // Check if a voice is assigned to any avatar (= default)
            const voiceToAvatars = {};
            if (avatarVoiceMap) {
              Object.entries(avatarVoiceMap).forEach(([name, vid]) => {
                if (!voiceToAvatars[vid]) voiceToAvatars[vid] = [];
                voiceToAvatars[vid].push(name);
              });
            }
            const defaultVoiceIds = new Set(Object.values(avatarVoiceMap || {}));

            // Render a single voice row
            const VoiceRow = (v, opts = {}) => {
              const isSel = selectedELVoice === v.id;
              const isPlaying = playingVoice === `el_${v.id}`;
              const flag = getVoiceFlag(v);
              const gender = (v.gender || v.labels?.gender || '').toLowerCase();
              const isDefault = defaultVoiceIds.has(v.id);
              const assignedAvatars = voiceToAvatars[v.id] || [];
              const isPersonal = opts.personal;

              return (
                <div key={v.id} style={{display:'flex', alignItems:'center', gap:7,
                  padding:'7px 10px', borderRadius:11, transition:'all 0.15s',
                  background: isSel ? 'rgba(255,215,0,0.10)' : isPersonal ? S.colors.accent1Bg : S.colors.overlayBg,
                  border: isSel ? '1.5px solid rgba(255,215,0,0.25)' : '1.5px solid rgba(255,255,255,0.04)'}}>
                  {/* Flag */}
                  <span style={{fontSize:16, flexShrink:0, lineHeight:1}}>{isPersonal ? '\u{1F3A4}' : flag}</span>
                  {/* Play */}
                  <button onClick={(e) => { e.stopPropagation(); previewELVoice(v); }}
                    style={{width:28, height:28, borderRadius:7, cursor:'pointer', flexShrink:0,
                      background: isPlaying ? S.colors.accent3Bg : S.colors.overlayBg,
                      border: isPlaying ? '1.5px solid ' + S.colors.accent3Border : '1.5px solid ' + S.colors.overlayBorder,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      WebkitTapHighlightColor:'transparent'}}>
                    <Icon name={isPlaying ? 'stop' : 'play'} size={11}
                      color={isPlaying ? S.colors.accent3 : S.colors.textSecondary} />
                  </button>
                  {/* Info */}
                  <button onClick={() => setSelectedELVoice(v.id)}
                    style={{flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer',
                      fontFamily:FONT, WebkitTapHighlightColor:'transparent', padding:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:4, flexWrap:'wrap'}}>
                      <span style={{fontSize:12, fontWeight: isSel ? 700 : 500,
                        color: isSel ? S.colors.goldAccent : S.colors.textSecondary}}>
                        {v.name}
                      </span>
                      {/* Gender badge */}
                      {gender && (
                        <span style={{fontSize:8, padding:'1px 4px', borderRadius:3,
                          background: gender === 'male' ? S.colors.accent2Bg : S.colors.accent3Bg,
                          color: gender === 'male' ? S.colors.accent2 : S.colors.accent3,
                          border: gender === 'male' ? '1px solid ' + S.colors.accent2Bg : '1px solid ' + S.colors.accent3Bg,
                          fontWeight:700}}>
                          {gender === 'male' ? '\u2642' : '\u2640'}
                        </span>
                      )}
                      {/* Default badge */}
                      {isDefault && (
                        <span style={{fontSize:7, padding:'1px 4px', borderRadius:3, fontWeight:800,
                          background:S.colors.accent2Bg, border:'1px solid ' + S.colors.accent2Border,
                          color:S.colors.accent2, letterSpacing:0.3}}>
                          DEFAULT
                        </span>
                      )}
                      {/* Personal badge */}
                      {isPersonal && (
                        <span style={{fontSize:7, padding:'1px 4px', borderRadius:3, fontWeight:800,
                          background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
                          color:S.colors.accent1, letterSpacing:0.3}}>
                          {v.category === 'cloned' ? 'CLONED' : v.category === 'professional' ? 'PRO' : 'GENERATED'}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:9, color:S.colors.textTertiary, marginTop:1}}>
                      {v.accent || v.labels?.accent || v.language || v.labels?.language || ''}
                      {(v.age || v.labels?.age) ? ` \u2022 ${v.age || v.labels?.age}` : ''}
                      {v.useCase ? ` \u2022 ${v.useCase}` : ''}
                    </div>
                    {assignedAvatars.length > 0 && (
                      <div style={{display:'flex', gap:2, marginTop:2}}>
                        {assignedAvatars.map(name => (
                          <span key={name} style={{fontSize:7, padding:'1px 4px', borderRadius:3,
                            background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
                            color:S.colors.accent1, fontWeight:700}}>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  {isSel && <span style={{fontSize:11, color:S.colors.goldAccent, flexShrink:0}}>{'\u2713'}</span>}
                </div>
              );
            };

            return (
              <div style={{...S.field, padding:'14px', borderRadius:16,
                background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.12)'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                  <span style={{fontSize:14, fontWeight:700, color:S.colors.goldAccent, display:'flex', alignItems:'center', gap:6}}>
                    {'\u2B50'} TOP PRO \u2014 ElevenLabs
                  </span>
                  <button onClick={() => setIsTopPro(!isTopPro)}
                    style={{...S.toggle, background:isTopPro ? S.colors.goldAccent : S.colors.toggleOff}}>
                    <div style={{...S.toggleDot, transform:isTopPro ? 'translateX(20px)' : 'translateX(0)'}} />
                  </button>
                </div>
                {!useOwnKeys && platformHasEL && (
                  <div style={{fontSize:10, color:'rgba(255,215,0,0.65)', marginBottom:8, lineHeight:1.5,
                    padding:'6px 10px', borderRadius:8, background:'rgba(255,215,0,0.04)',
                    border:'1px solid rgba(255,215,0,0.08)'}}>
                    {'\u26A1'} {L('elCostNote') || 'Voci premium ElevenLabs: ogni messaggio consuma ~5 crediti (vs ~0.5 standard). Usa le tue chiavi API per costo zero.'}
                  </div>
                )}

                {/* Load voices button */}
                {isTopPro && elevenLabsVoices.length === 0 && (
                  <button style={{width:'100%', padding:'10px 14px', borderRadius:10, cursor:'pointer',
                    background:'rgba(255,215,0,0.08)', border:'1px solid rgba(255,215,0,0.2)',
                    color:S.colors.goldAccent, fontSize:13, fontWeight:700, fontFamily:FONT,
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
                    <Icon name="refresh" size={16} color={S.colors.goldAccent} />
                    {L('loadVoices') || 'Carica voci ElevenLabs'}
                  </button>
                )}

                {/* ElevenLabs voice browser */}
                {isTopPro && elevenLabsVoices.length > 0 && (
                  <div>
                    {/* ── Personal voices section ── */}
                    {personalVoices.length > 0 && (
                      <div style={{marginBottom:12}}>
                        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                          <span style={{fontSize:11, fontWeight:700, color:S.colors.accent1}}>{'\u{1F3A4}'} {L('myVoices') || 'Le mie voci'}</span>
                          <span style={{fontSize:9, padding:'1px 6px', borderRadius:4,
                            background:S.colors.accent1Bg, color:S.colors.accent1, fontWeight:600}}>
                            {personalVoices.length}
                          </span>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', gap:3}}>
                          {personalVoices.map(v => VoiceRow(v, { personal: true }))}
                        </div>
                      </div>
                    )}

                    {/* ── Library voices header + filters ── */}
                    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
                      <span style={{fontSize:11, fontWeight:700, color:S.colors.goldAccent}}>{'\u{1F4DA}'} {L('voiceLibrary') || 'Libreria voci'}</span>
                      <span style={{fontSize:9, padding:'1px 6px', borderRadius:4,
                        background:'rgba(255,215,0,0.10)', color:S.colors.goldAccent, fontWeight:600}}>
                        {filteredVoices.length}/{libraryVoices.length}
                      </span>
                    </div>

                    {/* ── Filter bar ── */}
                    <div style={{display:'flex', gap:6, marginBottom:8, flexWrap:'wrap'}}>
                      {/* Language/accent filter with flags */}
                      <select value={elLangFilter} onChange={e => setElLangFilter(e.target.value)}
                        style={{flex:1, minWidth:110, padding:'5px 8px', borderRadius:7, fontSize:10, fontWeight:600,
                          background:S.colors.overlayBg, border:'1px solid rgba(255,215,0,0.12)',
                          color:S.colors.textPrimary, fontFamily:FONT, cursor:'pointer',
                          WebkitAppearance:'none', MozAppearance:'none'}}>
                        <option value="all">{L('allLanguages') || 'Tutte le lingue'}</option>
                        {allAccents.map(a => {
                          const fl = ACCENT_FLAGS[a];
                          const label = a.charAt(0).toUpperCase() + a.slice(1);
                          return <option key={a} value={a}>{fl ? `${fl} ` : ''}{label}</option>;
                        })}
                      </select>
                      {/* Gender filter */}
                      <div style={{display:'flex', gap:0, borderRadius:7, overflow:'hidden',
                        border:'1px solid rgba(255,215,0,0.12)'}}>
                        {['all','male','female'].map(g => (
                          <button key={g} onClick={() => setElGenderFilter(g)}
                            style={{padding:'5px 9px', fontSize:10, fontWeight:600, cursor:'pointer',
                              fontFamily:FONT, border:'none', WebkitTapHighlightColor:'transparent',
                              background: elGenderFilter === g ? 'rgba(255,215,0,0.15)' : S.colors.overlayBg,
                              color: elGenderFilter === g ? S.colors.goldAccent : S.colors.textTertiary}}>
                            {g === 'all' ? (L('all') || 'Tutti') : g === 'male' ? '\u2642\uFE0F M' : '\u2640\uFE0F F'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{fontSize:9, color:S.colors.textMuted, marginBottom:6}}>
                      {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'} \u2022 {L('tapToSelect') || 'Tocca per selezionare'}
                    </div>

                    {/* Voice list */}
                    <div style={{display:'flex', flexDirection:'column', gap:3, maxHeight:300, overflowY:'auto',
                      WebkitOverflowScrolling:'touch'}}>
                      {filteredVoices.map(v => VoiceRow(v))}
                      {filteredVoices.length === 0 && (
                        <div style={{textAlign:'center', padding:16, fontSize:12, color:S.colors.textTertiary}}>
                          {L('noVoicesMatch') || 'Nessuna voce corrisponde ai filtri'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{...S.label, marginBottom:0}}>{L('autoplayTranslation')}</span>
              <button onClick={() => setPrefs({...prefs, autoPlay:!prefs.autoPlay})}
                style={{...S.toggle, background:prefs.autoPlay ? S.colors.accent1 : S.colors.toggleOff}}>
                <div style={{...S.toggleDot, transform:prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>

          {/* Theme selector */}
          <div style={S.field}>
            <div style={S.label}>{L('theme') || 'Tema'}</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {THEME_LIST.map(t => {
                const isSelected = theme === t.id;
                const themeColors = {
                  dark: { bg:'#0B0D1A', accent:S.colors.accent1 },
                  light: { bg:'#F0F2FF', accent:'#5A52E0' }, // Light theme preview - hardcoded to show theme appearance
                  brown: { bg:'#1A120B', accent:'#D4A06A' }, // Brown theme preview - hardcoded to show theme appearance
                  orange: { bg:'#1A0E05', accent:'#FF8C00' }, // Orange theme preview - hardcoded to show theme appearance
                };
                const tc = themeColors[t.id] || themeColors.dark;
                return (
                  <button key={t.id} onClick={() => setTheme(t.id)}
                    style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                      borderRadius:12, cursor:'pointer', fontFamily:FONT,
                      WebkitTapHighlightColor:'transparent', transition:'all 0.15s',
                      background: isSelected ? `${tc.accent}1F` : S.colors.overlayBg,
                      border: isSelected ? `2px solid ${tc.accent}` : '2px solid ' + S.colors.overlayBorder}}>
                    {/* Color preview dot */}
                    <div style={{width:28, height:28, borderRadius:8, flexShrink:0,
                      background:tc.bg, border:`2px solid ${tc.accent}`,
                      display:'flex', alignItems:'center', justifyContent:'center'}}>
                      <span style={{fontSize:14}}>{t.icon}</span>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:12, fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? tc.accent : S.colors.textTertiary}}>
                        {t.name}
                      </div>
                      <div style={{fontSize:9, color:S.colors.textMuted, marginTop:1}}>
                        {t.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button style={{...S.btn, marginTop:12}} onClick={() => { savePrefs(prefs); setView('home'); }}>
            OK
          </button>
          {userToken && (
            <div style={{marginTop:20, paddingTop:16, borderTop:'1px solid ' + S.colors.cardBg}}>
              <div style={{fontSize:11, color:S.colors.textTertiary, marginBottom:8}}>
                Account: {userAccount?.email || ''}
              </div>
              <button style={{...S.settingsBtn, color:S.colors.accent3, borderColor:S.colors.accent3Border}}
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

'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, THEMES, THEME_LIST, FONT, FREE_DAILY_LIMIT, formatCredits, getLang, AI_MODELS } from '../lib/constants.js';
import Carousel from './Carousel.js';
import Icon from './Icon.js';
import { IconMic, IconSettings, IconGlobe, IconKey, IconStar, IconMusic, IconZap, IconUser, IconCheckCircle } from './Icons.js';

const SettingsView = memo(function SettingsView({ L, S, prefs, setPrefs, savePrefs, setView, isTrial, isTopPro,
  setIsTopPro, useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setSelectedELVoice, setElevenLabsVoices, userToken, userTokenRef, userAccount, logout, status,
  theme, setTheme, creditBalance, refreshBalance, freeCharsUsed,
  clonedVoiceId, clonedVoiceName, setClonedVoiceId, setClonedVoiceName }) {

  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [elLangFilter, setElLangFilter] = useState('all');
  const [elGenderFilter, setElGenderFilter] = useState('all');
  const [avatarVoiceMap, setAvatarVoiceMap] = useState({});
  const audioRef = useRef(null);

  // Voice clone state
  const [deletingVoice, setDeletingVoice] = useState(false);
  const [previewingClone, setPreviewingClone] = useState(false);

  // Auto-load ref for ElevenLabs voices
  const loadVoicesTriggered = useRef(false);

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

  // Removed: API key status helpers, free usage counters (no longer needed in free-for-all mode)

  async function handleRefresh() {
    setRefreshing(true);
    try { await refreshBalance?.(); } catch {}
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <div style={S.page}>
      <div style={{...S.scrollCenter, gap: 12}}>
        {/* Header migliorato */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 400,
          padding: '16px 0 8px',
        }}>
          <button onClick={() => setView('home')}
            style={{ background: 'none', border: 'none', color: S.colors.textPrimary, cursor: 'pointer', padding: 4, fontSize: 20 }}>
            {'←'}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: S.colors.textPrimary, fontFamily: FONT }}>
              <IconSettings size={20} style={{display:'inline-block', marginRight:8, verticalAlign:'middle'}} /> {L('settings')}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            ACCOUNT STATUS — compact
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400, marginBottom:4, borderRadius:16,
          background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
          padding:'14px 18px', display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:36, height:36, borderRadius:12,
            background: 'linear-gradient(135deg, rgba(0,255,148,0.15), rgba(38,217,176,0.15))',
            display:'flex', alignItems:'center', justifyContent:'center'}}>
            <IconCheckCircle size={18} color={S.colors.accent1} />
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14, fontWeight:700, color:S.colors.textPrimary}}>
              {userAccount?.email ? userAccount.email : (L('freeForAll') || 'Accesso Gratuito')}
            </div>
            <div style={{fontSize:11, color:S.colors.textSecondary, marginTop:1}}>
              {L('allFeaturesUnlocked') || 'Traduzioni, voci AI premium, ElevenLabs'}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            PROFILO
           ══════════════════════════════════════════════════ */}
        <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
          letterSpacing:1.2, width:'100%', maxWidth:400, padding:'4px 4px 6px', display:'flex', alignItems:'center', gap:6}}>
          <IconUser size={14} style={{color:S.colors.textMuted}} /> Profilo
        </div>
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

          {/* Voce AI — voci gestite automaticamente */}
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', display:'flex', alignItems:'center', gap:6}}>
            <IconMic size={14} style={{color:S.colors.textMuted}} /> Voce AI
          </div>
          <div style={S.field}>
            <div style={{fontSize:10, color:S.colors.textTertiary, marginBottom:8, lineHeight:1.4}}>
              Le voci vengono gestite automaticamente dal sistema in base al sesso e alla lingua. Usa ElevenLabs (sotto) per voci premium.
            </div>
            <button onClick={() => setView('voicetest')}
              style={{width:'100%', padding:'10px 14px', borderRadius:12, cursor:'pointer',
                background:S.colors.accent1Bg, border:'1px solid ' + S.colors.accent1Border,
                color:S.colors.accent1, fontSize:12, fontWeight:700, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent'}}>
              <Icon name="play" size={16} color={S.colors.accent1} />
              Test completo voci
            </button>
          </div>

          {/* AI Model and Translation Services removed — system manages automatically */}

          {/* ══════════════════════════════════════════════════
              LA TUA VOCE — Voice Clone
             ══════════════════════════════════════════════════ */}
          {(() => {
            const isIT = L('createRoom') === 'Crea Stanza';

            async function handleDeleteClone() {
              if (!confirm(isIT ? 'Eliminare la voce clonata?' : 'Delete cloned voice?')) return;
              setDeletingVoice(true);
              try {
                const fd = new FormData();
                fd.append('userToken', userTokenRef?.current || '');
                fd.append('action', 'delete');
                const res = await fetch('/api/voice-clone', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.ok) {
                  if (setClonedVoiceId) setClonedVoiceId(null);
                  if (setClonedVoiceName) setClonedVoiceName('');
                }
              } catch {} finally { setDeletingVoice(false); }
            }

            async function handlePreviewClone() {
              stopAudio();
              if (previewingClone) return;
              setPreviewingClone(true);
              try {
                const sampleText = VOICE_SAMPLES[prefs.lang] || VOICE_SAMPLES.en;
                const res = await fetch('/api/tts-elevenlabs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: sampleText, voiceId: clonedVoiceId, userToken: userTokenRef?.current })
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const audio = new Audio(url);
                  audioRef.current = audio;
                  audio.onended = () => { setPreviewingClone(false); URL.revokeObjectURL(url); };
                  audio.onerror = () => { setPreviewingClone(false); URL.revokeObjectURL(url); };
                  await audio.play();
                  return;
                }
              } catch {} finally { if (!audioRef.current) setPreviewingClone(false); }
            }

            return (
              <div style={{background:S.colors.glassCard, borderRadius:16,
                border:`1px solid ${S.colors.cardBorder}`, padding:16, marginBottom:12}}>
                <div style={{fontSize:13, fontWeight:700, color:S.colors.textPrimary, marginBottom:10, display:'flex', alignItems:'center', gap:6}}>
                  <IconMic size={16} /> {isIT ? 'La tua Voce' : 'Your Voice'}
                </div>

                {clonedVoiceId ? (
                  <>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                      <div style={{width:36, height:36, borderRadius:'50%', background:S.colors.accent4Bg,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>
                        <IconMic size={18} />
                      </div>
                      <div>
                        <div style={{fontSize:13, fontWeight:600, color:S.colors.textPrimary}}>{clonedVoiceName || 'My Voice'}</div>
                        <div style={{fontSize:10, color:S.colors.statusOk}}>{'\u2713'} {isIT ? 'Voce clonata attiva' : 'Cloned voice active'}</div>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:8}}>
                      <button onClick={handlePreviewClone} disabled={previewingClone}
                        style={{flex:1, padding:'8px 0', borderRadius:10,
                          background:S.colors.accent4Bg, border:`1px solid ${S.colors.accent4Border}`,
                          color:S.colors.textPrimary, fontFamily:'inherit', fontSize:11, fontWeight:600,
                          cursor: previewingClone ? 'default' : 'pointer', opacity: previewingClone ? 0.6 : 1}}>
                        {previewingClone ? (isIT ? 'Riproduzione...' : 'Playing...') : (isIT ? 'Anteprima' : 'Preview')}
                      </button>
                      <button onClick={() => setView('voice-clone')}
                        style={{flex:1, padding:'8px 0', borderRadius:10,
                          background:'transparent', border:`1px solid ${S.colors.overlayBorder}`,
                          color:S.colors.textPrimary, fontFamily:'inherit', fontSize:11, fontWeight:600, cursor:'pointer'}}>
                        {isIT ? 'Ricampiona' : 'Re-record'}
                      </button>
                      <button onClick={handleDeleteClone} disabled={deletingVoice}
                        style={{padding:'8px 12px', borderRadius:10,
                          background:'transparent', border:`1px solid ${S.colors.statusError}33`,
                          color:S.colors.statusError, fontFamily:'inherit', fontSize:11, fontWeight:600,
                          cursor: deletingVoice ? 'default' : 'pointer', opacity: deletingVoice ? 0.6 : 1}}>
                        {deletingVoice ? '...' : (isIT ? 'Elimina' : 'Delete')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:11, color:S.colors.textMuted, marginBottom:10, lineHeight:1.4}}>
                      {isIT
                        ? 'Registra la tua voce per creare un clone vocale. Potrai usarla nelle chat per farti sentire con la tua voce in qualsiasi lingua.'
                        : 'Record your voice to create a voice clone. You can use it in chats to be heard in your own voice in any language.'}
                    </div>
                    <button onClick={() => setView('voice-clone')}
                      style={{width:'100%', padding:'10px 0', borderRadius:12,
                        background:`linear-gradient(135deg, ${S.colors.accent4Bg}, ${S.colors.accent2Bg || S.colors.accent4Bg})`,
                        border:`1px solid ${S.colors.accent4Border}`,
                        color:S.colors.textPrimary, fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6}}>
                      <IconMic size={14} /> {isIT ? 'Campiona la tua voce' : 'Record your voice'}
                    </button>
                    {/* Voice clone is free for all */}
                  </>
                )}
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════
              ELEVENLABS VOICES — Free for all
             ══════════════════════════════════════════════════ */}
          {(() => {
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

            // Auto-load voices on first render
            if (!loadVoicesTriggered.current && elevenLabsVoices.length === 0) {
              loadVoicesTriggered.current = true;
              fetch(`/api/tts-elevenlabs?action=voices&token=${userTokenRef?.current || ''}&source=testcenter`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                  if (data?.voices) {
                    setElevenLabsVoices(data.voices);
                    if (data.avatarVoiceMap) setAvatarVoiceMap(data.avatarVoiceMap);
                  }
                })
                .catch(() => {});
            }

            return (
              <div style={{...S.field, padding:'14px', borderRadius:16,
                background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.12)'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
                  <span style={{fontSize:14, fontWeight:700, color:S.colors.goldAccent, display:'flex', alignItems:'center', gap:6}}>
                    <IconMusic size={16} /> ElevenLabs Voices
                  </span>
                  <span style={{fontSize:9, padding:'2px 8px', borderRadius:6, fontWeight:700,
                    background:S.colors.accent4Bg, border:'1px solid ' + S.colors.accent4Border,
                    color:S.colors.accent4}}>FREE</span>
                </div>

                {/* Loading state */}
                {elevenLabsVoices.length === 0 && (
                  <div style={{textAlign:'center', padding:16, fontSize:12, color:S.colors.textTertiary}}>
                    {L('loadingVoices') || 'Caricamento voci...'}
                  </div>
                )}

                {/* ElevenLabs voice browser */}
                {elevenLabsVoices.length > 0 && (
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
                      {L('tapPlayToPreview') || 'Premi \u25B6 per ascoltare'} {'\u2022'} {L('tapToSelect') || 'Tocca per selezionare'}
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

          {/* Sezione Aspetto */}
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', display:'flex', alignItems:'center', gap:6}}>
            <IconSettings size={14} style={{color:S.colors.textMuted}} /> {L('appearance') || 'Aspetto'}
          </div>
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

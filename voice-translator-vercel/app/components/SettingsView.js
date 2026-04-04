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
        {/* Header */}
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
            PROFILE CARD — top
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400, borderRadius:16,
          background:S.colors.cardBg, border:'1px solid ' + S.colors.cardBorder,
          padding:'16px', display:'flex', alignItems:'center', gap:14, marginBottom:4}}>
          {/* Avatar */}
          <div style={{width:52, height:52, borderRadius:'50%',
            background: 'linear-gradient(135deg, ' + S.colors.accent1 + '40, ' + S.colors.accent2 + '40)',
            border:'2px solid ' + S.colors.accent1,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            <img src={prefs.avatar} alt="avatar" style={{width:44, height:44, borderRadius:'50%', objectFit:'contain'}} />
          </div>
          {/* Name, email, badge */}
          <div style={{flex:1}}>
            <div style={{fontSize:14, fontWeight:700, color:S.colors.textPrimary}}>
              {prefs.name || userAccount?.email?.split('@')[0] || 'User'}
            </div>
            <div style={{fontSize:11, color:S.colors.textSecondary, marginTop:1}}>
              {userAccount?.email || 'Piano Free'}
            </div>
          </div>
          {/* Modifica link */}
          <button onClick={() => setView('home')}
            style={{background:'none', border:'none', color:S.colors.textSecondary, cursor:'pointer',
              fontSize:14, fontWeight:600, padding:0}}>
            Modifica ›
          </button>
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION: Preferenze voce
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400}}>
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', marginBottom:0}}>
            Preferenze voce
          </div>

          {/* Row: Lingua principale */}
          <div style={{borderRadius:'12px 12px 0 0', overflow:'hidden',
            background:S.colors.cardBg, border:'1px solid ' + S.colors.cardBorder}}>
            <button onClick={() => setShowLangDropdown(!showLangDropdown)}
              style={{width:'100%', padding:'12px 14px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left',
                transition:'background 0.15s'}}>
              <span style={{fontSize:16, flexShrink:0}}>🌐</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>Lingua principale</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                  {LANGS.find(l => l.code === prefs.lang)?.name || 'Italiano'}
                </span>
                <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
              </div>
            </button>
            {showLangDropdown && (
              <div style={{borderTop:'1px solid ' + S.colors.cardBorder, padding:'8px'}}>
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => { setPrefs({...prefs, lang:l.code}); setShowLangDropdown(false); }}
                    style={{width:'100%', padding:'8px 12px', background:'none', border:'none',
                      cursor:'pointer', textAlign:'left', fontSize:12, color:S.colors.textPrimary,
                      borderRadius:6}}>
                    {l.flag} {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row: Motore STT */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🎤</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Motore STT</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>Auto (Deepgram)</span>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>

          {/* Row: Voce TTS */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🔊</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Voce TTS</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                {prefs.ttsEngine === 'elevenlabs' ? 'ElevenLabs' : prefs.ttsEngine === 'openai' ? 'OpenAI' : 'Edge TTS'}
              </span>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>

          {/* Row: Voice Clone */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🗣️</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Voice Clone</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                {clonedVoiceId ? 'Configurato' : 'Non configurato'}
              </span>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>

          {/* Row: E2E Encryption */}
          <div style={{borderTop:'none', borderRadius:'0 0 12px 12px', background:S.colors.cardBg,
            borderLeft:'1px solid ' + S.colors.cardBorder, borderRight:'1px solid ' + S.colors.cardBorder,
            borderBottom:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🔒</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Crittografia E2E</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <button onClick={() => setPrefs({...prefs, e2eEncryption: !prefs.e2eEncryption})}
                style={{...S.toggle, background:prefs.e2eEncryption ? S.colors.accent1 : S.colors.toggleOff,
                  width:32, height:18}}>
                <div style={{...S.toggleDot, transform:prefs.e2eEncryption ? 'translateX(14px)' : 'translateX(0)', width:14, height:14}} />
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION: Account
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400}}>
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', marginBottom:0}}>
            Account
          </div>

          {/* Row: Crediti */}
          <div style={{borderRadius:'12px 12px 0 0', overflow:'hidden',
            background:S.colors.cardBg, border:'1px solid ' + S.colors.cardBorder}}>
            <button onClick={() => setView('credits')}
              style={{width:'100%', padding:'12px 14px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left',
                transition:'background 0.15s'}}>
              <span style={{fontSize:16, flexShrink:0}}>💳</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>Crediti</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                  {creditBalance !== undefined ? formatCredits(creditBalance) : 'Caricamento...'}
                </span>
                <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
              </div>
            </button>
          </div>

          {/* Row: API Keys */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <button onClick={() => setView('apikeys')}
              style={{width:'100%', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left', padding:0}}>
              <span style={{fontSize:16, flexShrink:0}}>🔑</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>API Keys</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
                <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                  {apiKeyInputs?.length || 0}
                </span>
                <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
              </div>
            </button>
          </div>

          {/* Row: Abbonamento */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>📊</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Abbonamento</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>
                {isTrial ? 'Trial' : isTopPro ? 'Pro' : 'Free'}
              </span>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>

          {/* Row: Referral & Gift */}
          <div style={{borderTop:'none', borderRadius:'0 0 12px 12px', background:S.colors.cardBg,
            borderLeft:'1px solid ' + S.colors.cardBorder, borderRight:'1px solid ' + S.colors.cardBorder,
            borderBottom:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🎁</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Referral & Gift</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION: Strumenti
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400}}>
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', marginBottom:0}}>
            Strumenti
          </div>

          {/* Row: Test voce */}
          <div style={{borderRadius:'12px 12px 0 0', overflow:'hidden',
            background:S.colors.cardBg, border:'1px solid ' + S.colors.cardBorder}}>
            <button onClick={() => setView('voicetest')}
              style={{width:'100%', padding:'12px 14px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
              <span style={{fontSize:16, flexShrink:0}}>🎙️</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>Test voce</div>
              </div>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </button>
          </div>

          {/* Row: Voice Clone tool */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <button onClick={() => setView('voice-clone')}
              style={{width:'100%', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left', padding:0}}>
              <span style={{fontSize:16, flexShrink:0}}>🗣️</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>Voice Clone</div>
              </div>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </button>
          </div>

          {/* Row: Glossario */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>📖</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Glossario personale</div>
            </div>
            <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
          </div>

          {/* Row: Esporta dati */}
          <div style={{borderTop:'none', borderRadius:'0 0 12px 12px', background:S.colors.cardBg,
            borderLeft:'1px solid ' + S.colors.cardBorder, borderRight:'1px solid ' + S.colors.cardBorder,
            borderBottom:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>📤</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Esporta dati</div>
            </div>
            <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            SECTION: Info
           ══════════════════════════════════════════════════ */}
        <div style={{width:'100%', maxWidth:400}}>
          <div style={{fontSize:11, fontWeight:700, color:S.colors.textMuted, textTransform:'uppercase',
            letterSpacing:1.2, padding:'12px 0 6px', marginBottom:0}}>
            Info
          </div>

          {/* Row: Guida */}
          <div style={{borderRadius:'12px 12px 0 0', overflow:'hidden',
            background:S.colors.cardBg, border:'1px solid ' + S.colors.cardBorder}}>
            <button onClick={() => setView('help')}
              style={{width:'100%', padding:'12px 14px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left'}}>
              <span style={{fontSize:16, flexShrink:0}}>📖</span>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:12, color:S.colors.textSecondary}}>Guida</div>
              </div>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </button>
          </div>

          {/* Row: Segnala problema */}
          <div style={{borderTop:'none', background:S.colors.cardBg, borderLeft:'1px solid ' + S.colors.cardBorder,
            borderRight:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>🐛</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Segnala problema</div>
            </div>
            <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
          </div>

          {/* Row: Versione */}
          <div style={{borderTop:'none', borderRadius:'0 0 12px 12px', background:S.colors.cardBg,
            borderLeft:'1px solid ' + S.colors.cardBorder, borderRight:'1px solid ' + S.colors.cardBorder,
            borderBottom:'1px solid ' + S.colors.cardBorder, padding:'12px 14px',
            display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontSize:16, flexShrink:0}}>ℹ️</span>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontSize:12, color:S.colors.textSecondary}}>Versione</div>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, flexShrink:0}}>
              <span style={{fontSize:12, fontWeight:600, color:S.colors.textPrimary}}>BarTalk 2.0.0-P4</span>
              <span style={{fontSize:14, color:S.colors.textTertiary}}>›</span>
            </div>
          </div>
        </div>

        {/* Save preferences button */}
        <button style={{...S.btn, marginTop:12, width:'100%', maxWidth:400}} onClick={() => { savePrefs(prefs); setView('home'); }}>
          Salva modifiche
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

      <style dangerouslySetInnerHTML={{__html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}} />
    </div>
  );
});

export default SettingsView;

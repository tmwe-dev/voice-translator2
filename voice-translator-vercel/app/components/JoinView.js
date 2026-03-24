'use client';
import { useState, useEffect, useRef } from 'react';
import { LANGS, VOICES, AVATARS, AVATAR_NAMES, FONT } from '../lib/constants.js';
import { t } from '../lib/i18n.js';
import getStyles from '../lib/styles.js';
import AvatarImg from './AvatarImg.js';

// ═══════════════════════════════════════════════
// JOIN VIEW — Redesigned with glassmorphism
//
// Invited guests: 3-step wizard (name → lang → audio → join)
// Manual join: single card with room code input
// ═══════════════════════════════════════════════

export default function JoinView({ L, S, prefs, setPrefs, savePrefs, myLang, setMyLang, joinCode,
  setJoinCode, inviteMsgLang, setInviteMsgLang, handleJoinRoom, setView, userToken, setAuthStep,
  status, theme, setTheme }) {

  const _S = getStyles(theme);
  const col = _S.colors || {};
  const C = {
    bg: '#060810',
    textPrimary: col.textPrimary || '#F2F4F7',
    textSecondary: col.textSecondary || 'rgba(242,244,247,0.90)',
    textMuted: col.textMuted || 'rgba(242,244,247,0.60)',
    card: col.glassCard || 'rgba(12,16,30,0.65)',
    cardBorder: col.cardBorder || 'rgba(255,255,255,0.05)',
    input: col.inputBg || 'rgba(14,18,32,0.6)',
    inputBorder: col.inputBorder || 'rgba(255,255,255,0.07)',
    accent: col.accent1 || '#26D9B0',
    purple: col.accent2 || '#8B6AFF',
    red: col.accent3 || '#FF6B6B',
  };

  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [guestStep, setGuestStep] = useState(0);
  const [gender, setGender] = useState(prefs.gender || '');
  const [audioAutoPlay, setAudioAutoPlay] = useState(prefs.autoPlay !== false);
  const [selectedVoicePref, setSelectedVoicePref] = useState(prefs.voice || 'nova');
  const nameInputRef = useRef(null);

  const iL = inviteMsgLang || prefs.lang || 'en';
  const tI = (key) => t(iL, key);
  const isInvited = !!inviteMsgLang;

  useEffect(() => {
    if (guestStep === 0 && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 300);
    }
  }, [guestStep]);

  // i18n helper
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

  // Shared button styles
  const GlassCard = ({ children, style = {} }) => (
    <div style={{
      background: C.card, borderRadius: 22, padding: '24px 20px',
      border: `1px solid ${C.cardBorder}`,
      backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      width: '100%', maxWidth: 400,
      boxShadow: `0 20px 60px -15px rgba(0,0,0,0.5)`,
      animation: 'vtScaleIn 0.35s ease-out',
      ...style,
    }}>
      {children}
    </div>
  );

  const PrimaryBtn = ({ onClick, disabled, children, style = {} }) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '14px 20px', borderRadius: 14, border: 'none',
      background: disabled ? C.card : `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
      color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: FONT,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      boxShadow: disabled ? 'none' : `0 4px 20px ${C.accent}35`,
      WebkitTapHighlightColor: 'transparent',
      transition: 'all 0.2s',
      ...style,
    }}>
      {children}
    </button>
  );

  // ─── MANUAL JOIN (no invite link) ───
  if (!isInvited) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '20px 16px',
        background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient orb */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-30%', width: '70vw', height: '70vw',
          borderRadius: '50%', background: `radial-gradient(circle, ${C.purple}0A 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <GlassCard>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => { window.history.replaceState({}, '', window.location.pathname); setView('home'); setJoinCode(''); setInviteMsgLang(null); }}
              style={{
                width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
                background: `${C.accent}10`, border: `1px solid ${C.accent}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.textMuted, fontSize: 16, WebkitTapHighlightColor: 'transparent',
              }}>
              ‹
            </button>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary }}>{L('joinRoom')}</div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{L('name')}</div>
            <input style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              background: C.input, border: `1px solid ${C.inputBorder}`,
              color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none',
              boxSizing: 'border-box',
            }} placeholder={L('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>

          {/* Room code */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{L('roomCode')}</div>
            <input style={{
              width: '100%', padding: '14px', borderRadius: 12, textAlign: 'center',
              fontSize: 24, letterSpacing: 8, textTransform: 'uppercase', fontWeight: 700,
              background: C.input, border: `1px solid ${joinCode.length >= 4 ? `${C.accent}40` : C.inputBorder}`,
              color: C.textPrimary, fontFamily: FONT, outline: 'none',
              boxSizing: 'border-box', transition: 'border-color 0.2s',
            }} placeholder="ABC123" value={joinCode} maxLength={6}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
          </div>

          {/* Language */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{L('yourLang')}</div>
            <select style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              background: C.input, border: `1px solid ${C.inputBorder}`,
              color: C.textPrimary, fontSize: 14, fontFamily: FONT, outline: 'none',
              boxSizing: 'border-box', appearance: 'none',
            }} value={myLang} onChange={e => { setMyLang(e.target.value); setPrefs(p => ({...p, lang: e.target.value})); }}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          <PrimaryBtn onClick={() => { savePrefs(prefs); handleJoinRoom(); }}
            disabled={joinCode.length < 4 || !prefs.name.trim()}>
            {L('enterRoom')} →
          </PrimaryBtn>

          {status && <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: C.red }}>{status}</div>}
        </GlassCard>

        <style>{`@keyframes vtScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
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
    setPrefs(p => ({ ...p, gender, autoPlay: audioAutoPlay, voice: selectedVoicePref }));
    savePrefs({ ...prefs, gender, autoPlay: audioAutoPlay, voice: selectedVoicePref });
    handleJoinRoom();
  }

  const canProceedStep0 = prefs.name.trim().length >= 1;
  const canJoin = joinCode.length >= 4 && prefs.name.trim();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100dvh', padding: '20px 16px',
      background: C.bg, fontFamily: FONT, position: 'relative', overflow: 'auto',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-20%', width: '60vw', height: '60vw',
        borderRadius: '50%', background: `radial-gradient(circle, ${C.accent}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: guestStep === i ? 24 : 8, height: 8, borderRadius: 4,
            background: guestStep === i
              ? `linear-gradient(135deg, ${C.accent}, ${C.purple})`
              : `${C.accent}20`,
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* ═══ STEP 0: Welcome + Name + Gender ═══ */}
      {guestStep === 0 && (
        <GlassCard>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              border: `1px solid ${C.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
            }}>
              🌍🎙️
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>
              {tI('inviteWelcome')}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
              {tI('inviteInstructions')}
            </div>
          </div>

          {/* Name input */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{tI('name')} *</div>
            <input ref={nameInputRef} style={{
              width: '100%', fontSize: 18, fontWeight: 600, padding: '14px 16px',
              textAlign: 'center', borderRadius: 14, boxSizing: 'border-box',
              border: `2px solid ${prefs.name.trim() ? C.accent : C.inputBorder}`,
              background: C.input, color: C.textPrimary, fontFamily: FONT, outline: 'none',
              transition: 'border-color 0.2s',
            }} placeholder={tI('namePlaceholder')} value={prefs.name}
              onChange={e => setPrefs({...prefs, name:e.target.value})} maxLength={20} />
          </div>

          {/* Gender */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>{tx('gender')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { key: 'male', icon: '♂️', label: tx('male') },
                { key: 'female', icon: '♀️', label: tx('female') },
                { key: 'other', icon: '⚧️', label: tx('other') },
              ].map(g => (
                <button key={g.key} onClick={() => setGender(g.key)} style={{
                  flex: 1, padding: '12px 8px', borderRadius: 14, cursor: 'pointer',
                  border: `2px solid ${gender === g.key ? C.accent : C.cardBorder}`,
                  background: gender === g.key ? `${C.accent}12` : 'transparent',
                  fontFamily: FONT, fontSize: 13, textAlign: 'center',
                  color: gender === g.key ? C.accent : C.textPrimary,
                  fontWeight: gender === g.key ? 700 : 400,
                  transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{g.icon}</div>
                  <div>{g.label}</div>
                </button>
              ))}
            </div>
          </div>

          <PrimaryBtn onClick={handleNext} disabled={!canProceedStep0} style={{ marginTop: 16 }}>
            {tx('continue')} →
          </PrimaryBtn>
        </GlassCard>
      )}

      {/* ═══ STEP 1: Language + Avatar ═══ */}
      {guestStep === 1 && (
        <GlassCard>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary }}>{tx('yourLang')}</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>{tx('yourLangDesc')}</div>
          </div>

          {/* Language grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
            marginBottom: 18, maxHeight: 240, overflowY: 'auto', padding: 2,
          }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => { setMyLang(l.code); setPrefs(p => ({...p, lang: l.code})); }}
                style={{
                  padding: '10px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontFamily: FONT,
                  border: `2px solid ${myLang === l.code ? C.accent : 'transparent'}`,
                  background: myLang === l.code ? `${C.accent}12` : `rgba(255,255,255,0.03)`,
                  color: C.textPrimary, fontSize: 11, fontWeight: myLang === l.code ? 700 : 400,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>{l.flag}</div>
                <div style={{ lineHeight: 1.2 }}>{l.name}</div>
              </button>
            ))}
          </div>

          {/* Avatar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>Avatar</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {AVATARS.map((av, i) => (
                <div key={i} onClick={() => setPrefs(p => ({...p, avatar: av}))}
                  style={{
                    cursor: 'pointer', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    opacity: prefs.avatar === av ? 1 : 0.5,
                    transform: prefs.avatar === av ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s',
                  }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 23,
                    border: `2px solid ${prefs.avatar === av ? C.accent : 'transparent'}`,
                    overflow: 'hidden',
                  }}>
                    <AvatarImg src={av} size={46} />
                  </div>
                  <div style={{ fontSize: 8, color: prefs.avatar === av ? C.accent : C.textMuted }}>{AVATAR_NAMES[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setGuestStep(0)} style={{
              width: 48, height: 48, borderRadius: 14, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.cardBorder}`,
              color: C.textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>←</button>
            <PrimaryBtn onClick={handleNext} style={{ flex: 1 }}>
              {tx('continue')} →
            </PrimaryBtn>
          </div>
        </GlassCard>
      )}

      {/* ═══ STEP 2: Audio + Voice + Join ═══ */}
      {guestStep === 2 && (
        <GlassCard>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary }}>{tx('audioPrefs')}</div>
          </div>

          {/* Auto-play toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', background: `rgba(255,255,255,0.03)`, borderRadius: 14, marginBottom: 12,
            border: `1px solid ${C.cardBorder}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{tx('autoPlay')}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{tx('autoPlayDesc')}</div>
            </div>
            <button onClick={() => setAudioAutoPlay(!audioAutoPlay)} style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: audioAutoPlay ? C.accent : `rgba(255,255,255,0.1)`,
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: 'white',
                position: 'absolute', top: 3,
                left: audioAutoPlay ? 25 : 3, transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>

          {/* Voice grid */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>{tx('transVoice')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setSelectedVoicePref(v)} style={{
                  padding: '10px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', fontFamily: FONT,
                  border: `2px solid ${selectedVoicePref === v ? C.accent : 'transparent'}`,
                  background: selectedVoicePref === v ? `${C.accent}12` : `rgba(255,255,255,0.03)`,
                  color: selectedVoicePref === v ? C.accent : C.textPrimary,
                  fontSize: 12, fontWeight: selectedVoicePref === v ? 700 : 400,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>
                    {v === 'nova' || v === 'shimmer' || v === 'fable' ? '♀️' : '♂️'}
                  </div>
                  <div style={{ textTransform: 'capitalize' }}>{v}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: C.textMuted, textAlign: 'center', marginTop: 4 }}>{tx('changeVoiceLater')}</div>
          </div>

          {/* Edge TTS gender */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: `rgba(255,255,255,0.03)`, borderRadius: 12, marginBottom: 14,
            border: `1px solid ${C.cardBorder}`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary }}>{tx('freeVoice')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['female', 'male'].map(g => (
                <button key={g} onClick={() => setPrefs(p => ({...p, edgeTtsVoiceGender: g}))} style={{
                  padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: FONT, fontSize: 11,
                  background: (prefs.edgeTtsVoiceGender || 'female') === g ? C.accent : 'transparent',
                  color: (prefs.edgeTtsVoiceGender || 'female') === g ? '#fff' : C.textMuted,
                  fontWeight: (prefs.edgeTtsVoiceGender || 'female') === g ? 600 : 400,
                }}>
                  {g === 'female' ? '♀️' : '♂️'} {g === 'female' ? tx('female') : tx('male')}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div style={{
            background: `${C.accent}10`, borderRadius: 14, padding: '12px 14px',
            marginBottom: 8, border: `1px solid ${C.accent}15`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', flexShrink: 0 }}>
                <AvatarImg src={prefs.avatar} size={40} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{prefs.name || '...'}</div>
                <div style={{ fontSize: 11, color: C.textSecondary }}>
                  {LANGS.find(l => l.code === myLang)?.flag} {LANGS.find(l => l.code === myLang)?.name}
                  {gender && ` · ${gender === 'male' ? '♂️' : gender === 'female' ? '♀️' : '⚧️'}`}
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>
                {AVATAR_NAMES[AVATARS.indexOf(prefs.avatar)] || ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setGuestStep(1)} style={{
              width: 48, height: 48, borderRadius: 14, cursor: 'pointer',
              background: 'transparent', border: `1px solid ${C.cardBorder}`,
              color: C.textMuted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>←</button>
            <PrimaryBtn onClick={handleJoin} disabled={!canJoin} style={{ flex: 1 }}>
              {tI('inviteJoinBtn') || tx('joinChat')} 🎙️
            </PrimaryBtn>
          </div>

          {!userToken && (
            <button style={{
              marginTop: 10, background: 'none', border: 'none', color: C.textMuted,
              fontSize: 11, cursor: 'pointer', fontFamily: FONT, padding: 6,
              textDecoration: 'underline', width: '100%', textAlign: 'center',
            }} onClick={() => setShowInvitePopup(true)}>
              {tI('inviteInfoLink')}
            </button>
          )}

          {status && <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.red }}>{status}</div>}
        </GlassCard>
      )}

      {/* Info popup */}
      {showInvitePopup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setShowInvitePopup(false)}>
          <div style={{
            background: C.card, borderRadius: 22, padding: '24px 20px', maxWidth: 360, width: '100%',
            border: `1px solid ${C.cardBorder}`,
            backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            boxShadow: '0 20px 60px -15px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, margin: '0 auto 12px',
              background: `linear-gradient(135deg, ${C.accent}15, ${C.purple}15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>🌍🎙️</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.textPrimary, textAlign: 'center', marginBottom: 10 }}>
              {tI('invitePopupTitle')}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
              {tI('invitePopupDesc')}
            </div>
            <div style={{
              fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 14,
              padding: '10px 12px', background: `${C.purple}10`, borderRadius: 12,
              border: `1px solid ${C.purple}15`,
            }}>
              {tI('invitePopupFeatures')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <PrimaryBtn onClick={() => { setShowInvitePopup(false); setView('account'); setAuthStep('email'); }}
                style={{ flex: 1, fontSize: 13 }}>
                {tI('invitePopupCreateAccount')}
              </PrimaryBtn>
              <button style={{
                flex: 1, padding: '10px 14px', borderRadius: 14,
                border: `1px solid ${C.cardBorder}`, background: 'transparent',
                color: C.textPrimary, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
              }} onClick={() => setShowInvitePopup(false)}>
                {tI('invitePopupJoinNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes vtScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

'use client';
import { memo, useState } from 'react';
import { FONT, MODES, CONTEXTS, AI_MODELS, VOICES } from '../lib/constants.js';
import { IconCheck, IconChevronDown } from './Icons.js';
import { bandieraVoce, ordinaVociPerPaese } from '../lib/bandiereVoci.js';

const VoiceEngineBar = memo(function VoiceEngineBar({
  L, S, prefs, savePrefs, isTrial, isTopPro, canUseElevenLabs,
  useOwnKeys, apiKeyInputs,
  elevenLabsVoices, selectedELVoice, setSelectedELVoice,
  clonedVoiceId, clonedVoiceName,
  audioEnabled, roomMode, roomInfo, isHost, myLang,
  totalCost, msgCount, modeInfo, roomCtx,
  showModeSelector, setShowModeSelector, changeRoomMode,
}) {
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  return (
    <>
      {/* Mode + Info bar */}
      <div style={{padding:'4px 12px', background:S.colors.overlayBg,
        borderBottom:`1px solid ${S.colors.overlayBorder}`, display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0, minHeight:28}}>
        <button onClick={() => isHost && setShowModeSelector(!showModeSelector)}
          style={{background:'none', border:'none', padding:'2px 6px', cursor:isHost ? 'pointer' : 'default',
            display:'flex', alignItems:'center', gap:4, borderRadius:6,
            WebkitTapHighlightColor:'transparent', transition:'background 0.15s'}}>
          <span style={{fontSize:12, color:S.colors.textMuted, fontWeight:500}}>
            {modeInfo.icon} {L(modeInfo.nameKey)}
            {roomCtx.id !== 'general' && <span style={{marginLeft:4}}>{roomCtx.icon} {L(roomCtx.nameKey)}</span>}
          </span>
          {isHost && <span style={{fontSize:10, color:S.colors.textMuted}}>{<IconChevronDown size={8}/>}</span>}
          {!isHost && roomMode === 'classroom' && (
            <span style={{fontSize:10, color:S.colors.textTertiary}}>
              {' \u2022 '}{roomInfo?.host || 'Host'} presenta
            </span>
          )}
        </button>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {isHost && (
            <span style={{fontSize:9, fontWeight:700, letterSpacing:0.5, padding:'2px 8px', borderRadius:6,
              background: isTrial ? S.colors.accent4Bg : isTopPro ? `${S.colors.goldAccent}26` : S.colors.accent3Bg,
              color: isTrial ? S.colors.statusOk : isTopPro ? S.colors.goldAccent : S.colors.accent3,
              border: `1px solid ${isTrial ? S.colors.accent4Border : isTopPro ? `${S.colors.goldAccent}40` : S.colors.accent3Border}`}}>
              {isTrial ? 'FREE' : isTopPro ? 'TOP PRO' : 'PRO'}
            </span>
          )}
          {isHost && !isTrial && (
            <span style={{fontSize:10, color:S.colors.textTertiary, fontFamily:'monospace'}}>
              ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(3)} {'\u00B7'} {msgCount}msg
            </span>
          )}
        </div>
      </div>

      {/* Mode selector dropdown */}
      {showModeSelector && isHost && (
        <div style={{padding:'8px 12px', background:'rgba(0,0,0,0.6)', backdropFilter:'blur(10px)',
          borderBottom:`1px solid ${S.colors.overlayBorder}`, flexShrink:0}}>
          <div style={{display:'flex', gap:6}}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => changeRoomMode(m.id)}
                style={{...S.modeBtn, flex:1, padding:'8px 4px',
                  ...(roomMode === m.id ? S.modeBtnSel : {})}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <span style={{fontSize:9, fontWeight:600, marginTop:1}}>{L(m.nameKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice engine + AI info bar */}
      <div style={{padding:'3px 12px', background:S.colors.accent1Bg,
        borderBottom:`1px solid ${S.colors.overlayBorder}`, display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0, gap:6, position:'relative'}}>
        <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0}}>
          {/* Voice engine — tappable to cycle */}
          <button onClick={() => {
            if (isTrial) return;
            const voiceEngine = prefs.voiceEngine || 'auto';
            const engines = canUseElevenLabs
              ? ['auto', 'elevenlabs', 'openai', 'edge']
              : ['auto', 'openai', 'edge'];
            const nextIdx = (engines.indexOf(voiceEngine) + 1) % engines.length;
            savePrefs({...prefs, voiceEngine: engines[nextIdx]});
          }} style={{background:'none', border:'none', padding:'1px 4px', cursor: isTrial ? 'default' : 'pointer',
            display:'flex', alignItems:'center', gap:4, borderRadius:4,
            transition:'background 0.15s', WebkitTapHighlightColor:'transparent'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const engineLabel = ve === 'auto'
                ? (isTrial ? 'Edge TTS' : canUseElevenLabs ? 'ElevenLabs' : 'OpenAI')
                : ve === 'elevenlabs' ? 'ElevenLabs'
                : ve === 'openai' ? 'OpenAI'
                : 'Edge TTS';
              return (
                <span style={{fontSize:9, color:S.colors.textSecondary, fontWeight:600, whiteSpace:'nowrap'}}>
                  {engineLabel}
                  {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted, marginLeft:2}}>{<IconChevronDown size={8}/>}</span>}
                </span>
              );
            })()}
          </button>
          {/* Voice name badge */}
          <button onClick={() => { if (!isTrial) setShowVoicePicker(!showVoicePicker); }}
            style={{fontSize:8, color:S.colors.textMuted, fontWeight:500,
              padding:'1px 5px', borderRadius:4, background:S.colors.overlayBg,
              border: showVoicePicker ? `1px solid ${S.colors.accent4Border}` : `1px solid ${S.colors.overlayBorder}`,
              whiteSpace:'nowrap', cursor: isTrial ? 'default' : 'pointer',
              fontFamily:FONT, transition:'border 0.15s', WebkitTapHighlightColor:'transparent'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const activeEngine = ve === 'auto'
                ? (isTrial ? 'edge' : canUseElevenLabs ? 'elevenlabs' : 'openai')
                : ve;
              if (activeEngine === 'elevenlabs') {
                if (selectedELVoice && clonedVoiceId && selectedELVoice === clonedVoiceId) {
                  return '\uD83C\uDFA4 ' + (clonedVoiceName || 'My Voice');
                }
                const elVoice = elevenLabsVoices?.find(v => v.id === selectedELVoice);
                return elVoice ? elVoice.name : 'Auto';
              }
              if (activeEngine === 'openai') return (prefs.voice || 'nova');
              if (activeEngine === 'edge') return (prefs.edgeTtsVoiceGender || 'female') === 'female' ? '\u2640 Female' : '\u2642 Male';
              return 'AUTO';
            })()}
            {!isTrial && <span style={{fontSize:6, marginLeft:2}}>{<IconChevronDown size={8}/>}</span>}
          </button>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          {/* AI model — tappable */}
          <button onClick={() => { if (!isTrial) setShowAiPicker(!showAiPicker); }}
            style={{background:'none', border:'none', padding:'1px 4px', cursor: isTrial ? 'default' : 'pointer',
              display:'flex', alignItems:'center', gap:3, borderRadius:4,
              outline: showAiPicker ? `1px solid ${S.colors.accent4Border}` : 'none',
              transition:'background 0.15s', WebkitTapHighlightColor:'transparent'}}>
            <span style={{fontSize:9, color:S.colors.textMuted, whiteSpace:'nowrap'}}>
              {isTrial ? 'AI: Free' : `AI: ${(AI_MODELS.find(m => m.id === (prefs?.aiModel || 'gpt-4o-mini'))?.name || 'GPT-4o Mini')}`}
            </span>
            {!isTrial && <span style={{fontSize:7, color:S.colors.textMuted}}>{<IconChevronDown size={8}/>}</span>}
          </button>
          {!audioEnabled && (
            <span style={{fontSize:8, fontWeight:700, padding:'1px 4px', borderRadius:3,
              background:S.colors.accent3Bg, color:S.colors.statusError, border:`1px solid ${S.colors.accent3Border}`}}>
              MUTED
            </span>
          )}
        </div>
      </div>

      {/* AI model picker dropdown */}
      {showAiPicker && (
        <>
          <div onClick={() => setShowAiPicker(false)}
            style={{position:'fixed', inset:0, zIndex:98, background:'transparent'}} />
          <div style={{position:'absolute', top:120, right:12, zIndex:100,
            background:S.colors.glassCard,
            border:`1px solid ${S.colors.cardBorder}`,
            borderRadius:12, padding:'4px 0', width:220, maxHeight:260, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
              textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
              AI Translation Model
            </div>
            {AI_MODELS.filter(m => !m.ownKeyOnly || (useOwnKeys && apiKeyInputs?.[m.provider]?.trim())).map(m => (
              <button key={m.id} onClick={() => {
                savePrefs({...prefs, aiModel: m.id});
                setShowAiPicker(false);
              }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'8px 12px', background: m.id === (prefs?.aiModel || 'gpt-4o-mini') ? S.colors.accent4Bg : 'transparent',
                border:'none', cursor:'pointer', fontFamily:FONT, fontSize:11,
                color:S.colors.textPrimary, transition:'background 0.1s',
                gap:6}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                  <span style={{fontWeight:600}}>{m.name}</span>
                  <span style={{fontSize:9, color:S.colors.textMuted}}>{m.desc}</span>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:4, flexShrink:0}}>
                  <span style={{fontSize:8, color:S.colors.textTertiary}}>{m.cost}</span>
                  {m.id === (prefs?.aiModel || 'gpt-4o-mini') && (
                    <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Voice picker dropdown */}
      {showVoicePicker && (
        <>
          <div onClick={() => setShowVoicePicker(false)}
            style={{position:'fixed', inset:0, zIndex:98, background:'transparent'}} />
          <div style={{position:'absolute', top:120, left:12, zIndex:100,
            background:S.colors.glassCard,
            border:`1px solid ${S.colors.cardBorder}`,
            borderRadius:12, padding:'4px 0', width:220, maxHeight:320, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            {(() => {
              const ve = prefs.voiceEngine || 'auto';
              const activeEngine = ve === 'auto'
                ? (isTrial ? 'edge' : canUseElevenLabs ? 'elevenlabs' : 'openai')
                : ve;

              // OpenAI voices
              if (activeEngine === 'openai') return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce OpenAI
                  </div>
                  {VOICES.map(v => (
                    <button key={v} onClick={() => {
                      savePrefs({...prefs, voice: v});
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'8px 12px',
                      background: v === (prefs.voice || 'nova') ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                      color:S.colors.textPrimary, transition:'background 0.1s'}}>
                      <span style={{fontWeight:500, textTransform:'capitalize'}}>{v}</span>
                      {v === (prefs.voice || 'nova') && (
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                      )}
                    </button>
                  ))}
                </>
              );

              // ElevenLabs voices
              if (activeEngine === 'elevenlabs') return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce ElevenLabs
                  </div>
                  {clonedVoiceId && (
                    <button onClick={() => {
                      if (setSelectedELVoice) setSelectedELVoice(clonedVoiceId);
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'8px 12px',
                      background: selectedELVoice === clonedVoiceId ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                      color:S.colors.textPrimary, transition:'background 0.1s',
                      borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                      <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                        <span style={{fontWeight:600}}>{'\uD83C\uDFA4'} {clonedVoiceName || L('myVoiceSingular')}</span>
                        <span style={{fontSize:9, color:S.colors.accent4Border}}>{L('clonedVoiceLabel')}</span>
                      </div>
                      {selectedELVoice === clonedVoiceId && <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>}
                    </button>
                  )}
                  <button onClick={() => {
                    if (setSelectedELVoice) setSelectedELVoice('');
                    setShowVoicePicker(false);
                  }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', padding:'8px 12px',
                    background: !selectedELVoice ? S.colors.accent4Bg : 'transparent',
                    border:'none', cursor:'pointer', fontFamily:FONT, fontSize:12,
                    color:S.colors.textPrimary, transition:'background 0.1s'}}>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1}}>
                      <span style={{fontWeight:500}}>{L('autoAvatarVoice')}</span>
                      <span style={{fontSize:9, color:S.colors.textMuted}}>{L('avatarBasedVoice')}</span>
                    </div>
                    {!selectedELVoice && <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>}
                  </button>
                  {(elevenLabsVoices || []).length > 0 && (() => {
                    const females = elevenLabsVoices.filter(v => v.gender === 'female');
                    const males = elevenLabsVoices.filter(v => v.gender === 'male');
                    const other = elevenLabsVoices.filter(v => v.gender !== 'female' && v.gender !== 'male');
                    const groups = [
                      { label: '\u2640 Femminile', voices: females },
                      { label: '\u2642 Maschile', voices: males },
                      ...(other.length > 0 ? [{ label: 'Altro', voices: other }] : []),
                    ];
                    // \u2500\u2500 INIZIO b.205 \u2014 la tendina voci era disallineata, senza
                    // bandiere e senza ordine. Ora: dentro ogni genere le voci
                    // sono ORDINATE PER PAESE, con un'intestazione bandiera+paese
                    // ad ogni cambio, e ogni riga \u00e8 allineata a sinistra con la
                    // bandiera davanti al nome. \u2500\u2500 (Luca)
                    return groups.map(g => {
                      if (g.voices.length === 0) return null;
                      const ordinate = ordinaVociPerPaese(g.voices);
                      let paeseCorr = null;
                      return (
                        <div key={g.label}>
                          <div style={{padding:'4px 12px', fontSize:8, fontWeight:700, color:S.colors.textMuted,
                            textTransform:'uppercase', letterSpacing:0.5, background:S.colors.overlayBg,
                            borderTop:`1px solid ${S.colors.overlayBorder}`}}>
                            {g.label} ({g.voices.length})
                          </div>
                          {ordinate.map(v => {
                            const bv = bandieraVoce(v);
                            const nuovoPaese = bv.p !== paeseCorr;
                            paeseCorr = bv.p;
                            return (
                              <div key={v.id}>
                                {nuovoPaese && (
                                  <div style={{display:'flex', alignItems:'center', gap:6, padding:'5px 12px 3px',
                                    fontSize:9, fontWeight:700, color:S.colors.textSecondary || S.colors.textMuted,
                                    textTransform:'uppercase', letterSpacing:0.4}}>
                                    <span style={{fontSize:12}}>{bv.f}</span>{bv.p}
                                  </div>
                                )}
                                <button onClick={() => {
                                  if (setSelectedELVoice) setSelectedELVoice(v.id);
                                  setShowVoicePicker(false);
                                }} style={{display:'flex', alignItems:'center', gap:9,
                                  width:'100%', padding:'6px 12px 6px 16px', textAlign:'left',
                                  background: selectedELVoice === v.id ? S.colors.accent4Bg : 'transparent',
                                  border:'none', cursor:'pointer', fontFamily:FONT, fontSize:11,
                                  color:S.colors.textPrimary, transition:'background 0.1s'}}>
                                  <span style={{fontSize:14, flexShrink:0, width:18, textAlign:'center'}}>{bv.f}</span>
                                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:0, flex:1, minWidth:0}}>
                                    <span style={{fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%', display:'block'}}>{v.name}</span>
                                    {v.useCase && (
                                      <span style={{fontSize:8, color:S.colors.textMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%', display:'block'}}>
                                        {String(v.useCase).replace(/_/g, ' ')}
                                      </span>
                                    )}
                                  </div>
                                  {selectedELVoice === v.id && <span style={{color:S.colors.statusOk, fontSize:12, flexShrink:0}}>{<IconCheck size={12}/>}</span>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                  {(!elevenLabsVoices || elevenLabsVoices.length === 0) && (
                    <div style={{padding:'10px 12px', fontSize:10, color:S.colors.textMuted, textAlign:'center'}}>
                      Caricamento voci...
                    </div>
                  )}
                </>
              );

              // Edge TTS
              return (
                <>
                  <div style={{padding:'6px 12px', fontSize:9, fontWeight:700, color:S.colors.textMuted,
                    textTransform:'uppercase', letterSpacing:0.5, borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                    Voce Edge TTS
                  </div>
                  {[{id:'female', label:'Femminile', icon:'\u2640'}, {id:'male', label:'Maschile', icon:'\u2642'}].map(g => (
                    <button key={g.id} onClick={() => {
                      savePrefs({...prefs, edgeTtsVoiceGender: g.id});
                      setShowVoicePicker(false);
                    }} style={{display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'10px 12px',
                      background: (prefs.edgeTtsVoiceGender || 'female') === g.id ? S.colors.accent4Bg : 'transparent',
                      border:'none', cursor:'pointer', fontFamily:FONT, fontSize:13,
                      color:S.colors.textPrimary, transition:'background 0.1s'}}>
                      <span style={{fontWeight:500}}>{g.icon} {g.label}</span>
                      {(prefs.edgeTtsVoiceGender || 'female') === g.id && (
                        <span style={{color:S.colors.statusOk, fontSize:12}}>{<IconCheck size={12}/>}</span>
                      )}
                    </button>
                  ))}
                </>
              );
            })()}
          </div>
        </>
      )}
    </>
  );
});

export default VoiceEngineBar;

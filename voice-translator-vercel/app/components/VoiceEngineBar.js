'use client';
import { memo, useState, useEffect } from 'react';
import { FONT, MODES, CONTEXTS, AI_MODELS, VOICES } from '../lib/constants.js';
import { IconCheck, IconChevronDown } from './Icons.js';
import { bandieraVoce, ordinaVociPerPaese } from '../lib/bandiereVoci.js';

const VoiceEngineBar = memo(function VoiceEngineBar({
  L, S, prefs, savePrefs, isTrial, isTopPro, canUseElevenLabs,
  useOwnKeys, apiKeyInputs,
  elevenLabsVoices, selectedELVoice, setSelectedELVoice,
  clonedVoiceId, clonedVoiceName,
  audioEnabled, roomMode, roomInfo, isHost, myLang,
  totalCost, msgCount, modeInfo, roomCtx, badge,
  showModeSelector, setShowModeSelector, changeRoomMode,
}) {
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  // b.262 — scelta ESPLICITA del motore (via la rotazione alla cieca).
  const [showEnginePicker, setShowEnginePicker] = useState(false);
  // b.262 — il catalogo curato dal backend per la lingua dell'utente:
  // null = non ancora chiesto; [] = lingua non curata (elenco pieno).
  const [vociCurate, setVociCurate] = useState(null);
  useEffect(() => {
    if (!showVoicePicker || vociCurate !== null) return;
    fetch(`/api/voci?lang=${encodeURIComponent(myLang || 'en')}`)
      .then(r => r.ok ? r.json() : { curate: [] })
      .then(d => setVociCurate(Array.isArray(d.curate) ? d.curate : []))
      .catch(() => setVociCurate([]));
  }, [showVoicePicker, vociCurate, myLang]);
  // b.261 — con piu di cento voci un elenco senza ricerca non si usa:
  // si filtra per nome o per paese, scrivendo.
  const [filtroVoce, setFiltroVoce] = useState('');

  // b.262 — il motore che parlera DAVVERO al prossimo messaggio, risolto
  // con la stessa regola di procuraVoce: e quello che la spilla mostra.
  const ve = prefs.voiceEngine || 'auto';
  const motoreAttivo = ve === 'auto'
    ? (isTrial ? 'edge' : canUseElevenLabs ? 'elevenlabs' : 'openai')
    : ve;
  // Le scelte offerte: solo cio che questa persona puo davvero usare.
  const motoriDisponibili = [
    ...(canUseElevenLabs ? [{ id: 'elevenlabs', nome: 'ElevenLabs', sotto: L('enginePremiumDesc'), colore: S.colors.goldAccent || '#d4a24e' }] : []),
    ...(!isTrial ? [{ id: 'openai', nome: 'OpenAI', sotto: L('engineOpenaiDesc'), colore: S.colors.accent2 || S.colors.accent1 }] : []),
    { id: 'edge', nome: 'Edge TTS', sotto: L('engineStandardDesc'), colore: S.colors.textMuted },
    ...(!isTrial ? [{ id: 'auto', nome: L('engineAuto'), sotto: L('engineAutoDesc'), colore: S.colors.accent1 }] : []),
  ];

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
          {/* b.250 — il badge del fornitore sta QUI, nella riga: prima era
              un absolute in RoomView che copriva il selettore modalita. */}
          {badge}
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
          {/* ═══ INIZIO b.262 — il motore si VEDE e si CAMBIA, sempre (Luca) ═══
              Prima: etichetta da 9px che al tocco RUOTAVA i motori alla
              cieca, e per i trial era spenta. Ora e una spilla colorata —
              oro = ElevenLabs (premium), viola = OpenAI, neutra = Edge TTS —
              e il tocco apre una scelta ESPLICITA. Il cambio vale dal
              messaggio successivo, senza ricaricare: chi parla legge le
              preferenze al momento di parlare (procuraVoce). */}
          <button onClick={() => setShowEnginePicker(!showEnginePicker)}
            aria-expanded={showEnginePicker}
            style={{border:'none', padding:'2px 8px', cursor:'pointer', borderRadius:999,
              display:'flex', alignItems:'center', gap:5,
              background: motoreAttivo === 'elevenlabs' ? `${S.colors.goldAccent || '#d4a24e'}22`
                : motoreAttivo === 'openai' ? S.colors.accent2Bg || S.colors.accent1Bg
                : S.colors.overlayBg,
              outline: `1px solid ${motoreAttivo === 'elevenlabs' ? (S.colors.goldAccent || '#d4a24e') + '66' : S.colors.overlayBorder}`,
              transition:'background 0.15s', WebkitTapHighlightColor:'transparent'}}>
            <span style={{width:6, height:6, borderRadius:3, flexShrink:0,
              background: motoreAttivo === 'elevenlabs' ? (S.colors.goldAccent || '#d4a24e')
                : motoreAttivo === 'openai' ? (S.colors.accent2 || S.colors.accent1)
                : S.colors.textMuted}} />
            <span style={{fontSize:10, fontWeight:700, whiteSpace:'nowrap',
              color: motoreAttivo === 'elevenlabs' ? (S.colors.goldAccent || '#d4a24e') : S.colors.textSecondary}}>
              {motoreAttivo === 'elevenlabs' ? 'ElevenLabs' : motoreAttivo === 'openai' ? 'OpenAI' : 'Edge TTS'}
            </span>
            <span style={{color:S.colors.textMuted, lineHeight:0}}><IconChevronDown size={8}/></span>
          </button>
          {showEnginePicker && (
            <>
              <div onClick={() => setShowEnginePicker(false)}
                style={{position:'fixed', inset:0, zIndex:298, background:'rgba(0,0,0,0.35)'}} />
              <div style={{position:'absolute', top:'100%', left:8, zIndex:300, marginTop:4,
                background:S.colors.bg || '#0a0f1f', border:`1px solid ${S.colors.cardBorder}`,
                borderRadius:12, padding:4, width:210, boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
                {motoriDisponibili.map(m => (
                  <button key={m.id}
                    onClick={() => { savePrefs({ ...prefs, voiceEngine: m.id }); setShowEnginePicker(false); }}
                    style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'9px 10px',
                      borderRadius:8, border:'none', cursor:'pointer', fontFamily:FONT, textAlign:'left',
                      background: (prefs.voiceEngine || 'auto') === m.id ? S.colors.accent4Bg : 'transparent',
                      color:S.colors.textPrimary, fontSize:12}}>
                    <span style={{width:6, height:6, borderRadius:3, background:m.colore, flexShrink:0}} />
                    <span style={{flex:1}}>
                      <span style={{display:'block', fontWeight:700}}>{m.nome}</span>
                      <span style={{display:'block', fontSize:10, color:S.colors.textMuted}}>{m.sotto}</span>
                    </span>
                    {(prefs.voiceEngine || 'auto') === m.id && <IconCheck size={12}/>}
                  </button>
                ))}
              </div>
            </>
          )}
          {/* ═══ FINE b.262 ═══ */}
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
          {/* ═══ INIZIO b.261 — il pannello voci era di vetro e sotto i tocchi ═══
              TROVATO DAL VIVO (Luca): fondo glassCard al 6%% di opacita — i
              messaggi si leggevano ATTRAVERSO l'elenco — e le bolle con le
              reazioni si disegnavano sopra, intercettando i clic: una voce
              non si riusciva proprio a selezionare. Ora fondo pieno del tema
              e quota sopra ogni cosa della stanza. */}
          <div onClick={() => setShowVoicePicker(false)}
            style={{position:'fixed', inset:0, zIndex:298, background:'rgba(0,0,0,0.35)'}} />
          <div style={{position:'absolute', top:120, left:12, zIndex:300,
            background:S.colors.bg || '#0a0f1f',
            border:`1px solid ${S.colors.cardBorder}`,
            borderRadius:12, padding:'4px 0', width:240, maxHeight:360, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
          {/* ═══ FINE b.261 ═══ */}
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
                  {(elevenLabsVoices || []).length > 5 && (
                    <div style={{padding:'6px 10px', borderBottom:`1px solid ${S.colors.overlayBorder}`}}>
                      <input
                        value={filtroVoce}
                        onChange={(e) => setFiltroVoce(e.target.value)}
                        placeholder={L('search')}
                        aria-label={L('search')}
                        style={{width:'100%', boxSizing:'border-box', padding:'6px 8px',
                          borderRadius:8, border:`1px solid ${S.colors.overlayBorder}`,
                          background:'rgba(255,255,255,0.05)', color:S.colors.textPrimary,
                          fontSize:12, fontFamily:FONT, outline:'none'}} />
                    </div>
                  )}
                  {(elevenLabsVoices || []).length > 0 && (() => {
                    // b.262 — se il backend ha curato questa lingua, il
                    // selettore mostra SOLO le voci approvate (le
                    // predefinite in testa); altrimenti l'elenco pieno,
                    // come sempre — ripiego dichiarato, non un buco.
                    const idCurati = (vociCurate || []).length > 0
                      ? new Map(vociCurate.map((v, i) => [v.voice_id, { predefinita: v.predefinita, ordine: i }]))
                      : null;
                    const base = idCurati
                      ? elevenLabsVoices
                          .filter(v => idCurati.has(v.id))
                          .sort((a, b) => {
                            const ca = idCurati.get(a.id), cb = idCurati.get(b.id);
                            return (cb.predefinita ? 1 : 0) - (ca.predefinita ? 1 : 0) || ca.ordine - cb.ordine;
                          })
                      : elevenLabsVoices;
                    // b.261 — il filtro guarda nome e paese, senza maiuscole.
                    const cerca = filtroVoce.trim().toLowerCase();
                    const visibili = cerca
                      ? base.filter(v =>
                          (v.name || '').toLowerCase().includes(cerca) ||
                          (v.country || '').toLowerCase().includes(cerca) ||
                          (v.description || '').toLowerCase().includes(cerca))
                      : base;
                    const females = visibili.filter(v => v.gender === 'female');
                    const males = visibili.filter(v => v.gender === 'male');
                    const other = visibili.filter(v => v.gender !== 'female' && v.gender !== 'male');
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

'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FONT } from '../lib/constants.js';
import { getVoiceScript } from '../lib/voiceScripts.js';
import useVoiceRecorder from '../hooks/useVoiceRecorder.js';
import Icon from './Icon.js';

const MIN_DURATION = 30; // ElevenLabs requires at least 30s for instant voice cloning

export default function VoiceCloneView({ L, S, prefs, userToken, userTokenRef, setView, onVoiceCloned, creditBalance, theme }) {
  const isIT = L('createRoom') === 'Crea Stanza';
  const [step, setStep] = useState(0); // 0=mic, 1=record, 2=review
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState('');
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const audioRef = useRef(null);

  const recorder = useVoiceRecorder();
  const script = getVoiceScript(prefs.lang);
  const C = S.colors;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recorder.cleanup();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // ── Step 0: Mic Setup ──
  async function handleMicSetup() {
    const ok = await recorder.requestPermission();
    if (ok) setStep(1);
  }

  // ── Step 1: Recording ──
  function handleToggleRecord() {
    if (recorder.isRecording) {
      recorder.stopRecording();
      // Advance to next paragraph
      if (currentParagraph < script.paragraphs.length - 1) {
        setCurrentParagraph(p => p + 1);
      }
    } else {
      recorder.startRecording();
    }
  }

  // ── Playback ──
  function playSegment(idx) {
    if (audioRef.current) { audioRef.current.pause(); }
    if (playingIdx === idx) { setPlayingIdx(-1); return; }
    const audio = new Audio(recorder.segments[idx].url);
    audio.onended = () => setPlayingIdx(-1);
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingIdx(idx);
  }

  // ── Step 2: Clone ──
  async function handleClone() {
    setCloning(true);
    setCloneError('');
    try {
      const blob = recorder.getCombinedBlob();
      if (!blob) throw new Error('No audio recorded');

      const formData = new FormData();
      formData.append('userToken', userTokenRef?.current || userToken);
      formData.append('voiceName', prefs.name || 'My Voice');
      formData.append('audio', blob, 'voice-sample.webm');

      const res = await fetch('/api/voice-clone', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Clone failed (${res.status})`);
      }

      setCloneSuccess(true);
      if (onVoiceCloned) onVoiceCloned(data.voiceId, data.name);
    } catch (e) {
      setCloneError(e.message);
    } finally {
      setCloning(false);
    }
  }

  const pct = Math.min(100, (recorder.totalDuration / MIN_DURATION) * 100);
  const ready = recorder.totalDuration >= MIN_DURATION;

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        {/* Header */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', maxWidth:400, marginBottom:16}}>
          <button style={{background:'none', border:'none', color:C.textMuted, cursor:'pointer', padding:8, fontFamily:FONT}}
            onClick={() => setView('settings')}>
            <Icon name="chevDown" size={20} color={C.textMuted} style={{transform:'rotate(90deg)'}} />
          </button>
          <div style={{fontSize:18, fontWeight:800, color:C.textPrimary}}>
            {isIT ? 'Campiona la tua Voce' : 'Clone Your Voice'}
          </div>
          <div style={{width:36}} />
        </div>

        {/* Step indicator */}
        <div style={{display:'flex', gap:8, marginBottom:20, justifyContent:'center'}}>
          {[0,1,2].map(s => (
            <div key={s} style={{width:step===s?32:12, height:4, borderRadius:2, transition:'all 0.3s',
              background: step > s ? C.accent4 || C.onlineColor : step === s ? C.accent1 : C.overlayBorder}} />
          ))}
        </div>

        {/* ═══ STEP 0: MIC SETUP ═══ */}
        {step === 0 && (
          <div style={{...S.card, width:'100%', maxWidth:400, textAlign:'center', padding:'30px 24px'}}>
            <div style={{fontSize:56, marginBottom:16}}>{'\u{1F3A4}'}</div>
            <div style={{fontSize:16, fontWeight:700, color:C.textPrimary, marginBottom:8}}>
              {isIT ? 'Configura il Microfono' : 'Setup Microphone'}
            </div>
            <div style={{fontSize:12, color:C.textMuted, marginBottom:20, lineHeight:1.5}}>
              {isIT
                ? 'Per creare la tua voce personalizzata, registrerai alcuni paragrafi leggendoli ad alta voce. Assicurati di essere in un ambiente silenzioso.'
                : 'To create your custom voice, you\'ll record a few paragraphs by reading them aloud. Make sure you\'re in a quiet environment.'}
            </div>

            {recorder.hasPermission === false && (
              <div style={{fontSize:12, color:C.accent3 || '#FF6B6B', marginBottom:12, padding:'8px 12px',
                borderRadius:10, background:C.accent3Bg || 'rgba(255,107,107,0.1)'}}>
                {isIT ? 'Permesso microfono negato. Controlla le impostazioni del browser.' : 'Microphone permission denied. Check browser settings.'}
              </div>
            )}

            <button onClick={handleMicSetup}
              style={{width:'100%', padding:'14px 20px', borderRadius:14, border:'none', cursor:'pointer',
                background:`linear-gradient(135deg, ${C.accent1}, ${C.accent2 || C.accent1})`,
                color:'#fff', fontSize:14, fontWeight:700, fontFamily:FONT}}>
              {isIT ? 'Attiva Microfono' : 'Enable Microphone'}
            </button>

            {/* Tips */}
            <div style={{marginTop:20, textAlign:'left'}}>
              {[
                isIT ? 'Ambiente silenzioso, senza eco' : 'Quiet environment, no echo',
                isIT ? 'Parla a volume normale e naturale' : 'Speak at normal, natural volume',
                isIT ? 'Tieni il telefono a 15-20 cm dalla bocca' : 'Hold phone 15-20 cm from mouth',
                isIT ? 'Minimo 30 secondi di registrazione' : 'Minimum 30 seconds of recording',
              ].map((tip, i) => (
                <div key={i} style={{fontSize:11, color:C.textTertiary, display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                  <span style={{color:C.accent4 || C.onlineColor}}>{'\u2705'}</span> {tip}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 1: RECORDING ═══ */}
        {step === 1 && (
          <div style={{width:'100%', maxWidth:400}}>
            {/* Audio level meter */}
            <div style={{display:'flex', gap:2, height:24, marginBottom:12, justifyContent:'center'}}>
              {Array.from({length:20}).map((_, i) => {
                const threshold = i / 20;
                const active = recorder.audioLevel > threshold;
                const color = i > 16 ? (C.accent3 || '#FF6B6B') : i > 10 ? (C.accent1) : (C.accent4 || C.onlineColor);
                return (
                  <div key={i} style={{width:8, borderRadius:2, transition:'background 0.05s',
                    background: active ? color : (C.overlayBg || 'rgba(255,255,255,0.05)')}} />
                );
              })}
            </div>

            {/* Teleprompter */}
            <div style={{...S.card, padding:'16px 18px', marginBottom:12, maxHeight:200, overflowY:'auto'}}>
              <div style={{fontSize:10, fontWeight:700, color:C.textMuted, marginBottom:8, textTransform:'uppercase', letterSpacing:0.5}}>
                {isIT ? `Paragrafo ${currentParagraph + 1} di ${script.paragraphs.length}` : `Paragraph ${currentParagraph + 1} of ${script.paragraphs.length}`}
              </div>
              <div style={{fontSize:14, lineHeight:1.6, color:C.textPrimary}}>
                {script.paragraphs[currentParagraph]}
              </div>
            </div>

            {/* Paragraph navigation */}
            <div style={{display:'flex', gap:4, marginBottom:12, justifyContent:'center', flexWrap:'wrap'}}>
              {script.paragraphs.map((_, i) => (
                <button key={i} onClick={() => setCurrentParagraph(i)}
                  style={{width:24, height:24, borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer',
                    border: i === currentParagraph ? `2px solid ${C.accent1}` : `1px solid ${C.overlayBorder}`,
                    background: i < recorder.segments.length ? (C.accent4Bg || 'rgba(0,255,0,0.1)') : 'transparent',
                    color: i === currentParagraph ? C.accent1 : C.textMuted}}>
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Record button */}
            <div style={{display:'flex', justifyContent:'center', marginBottom:16}}>
              <button onClick={handleToggleRecord}
                style={{width:72, height:72, borderRadius:36, border:'none', cursor:'pointer',
                  background: recorder.isRecording
                    ? `linear-gradient(135deg, ${C.accent3 || '#FF6B6B'}, ${C.accent3 || '#FF4444'})`
                    : `linear-gradient(135deg, ${C.accent1}, ${C.accent2 || C.accent1})`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow: recorder.isRecording ? `0 0 20px ${C.accent3 || '#FF6B6B'}40` : `0 0 20px ${C.accent1}40`,
                  transition:'all 0.2s'}}>
                <span style={{fontSize:28}}>{recorder.isRecording ? '\u23F9' : '\u{1F3A4}'}</span>
              </button>
            </div>

            {/* Current segment timer */}
            {recorder.isRecording && (
              <div style={{textAlign:'center', fontSize:20, fontWeight:700, color:C.accent3 || '#FF6B6B', marginBottom:8, fontFamily:'monospace'}}>
                {Math.floor(recorder.duration)}s
              </div>
            )}

            {/* Progress bar */}
            <div style={{marginBottom:16}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:C.textMuted, marginBottom:4}}>
                <span>{Math.floor(recorder.totalDuration)}s / {MIN_DURATION}s {isIT ? 'minimo' : 'minimum'}</span>
                <span style={{color: ready ? (C.accent4 || C.onlineColor) : C.textMuted}}>
                  {ready ? (isIT ? 'Pronto!' : 'Ready!') : `${Math.round(pct)}%`}
                </span>
              </div>
              <div style={{height:6, borderRadius:3, background:C.overlayBg || 'rgba(255,255,255,0.05)', overflow:'hidden'}}>
                <div style={{height:'100%', borderRadius:3, transition:'width 0.3s',
                  width:`${pct}%`,
                  background: ready
                    ? `linear-gradient(90deg, ${C.accent4 || C.onlineColor}, ${C.accent1})`
                    : C.accent1}} />
              </div>
            </div>

            {/* Recorded segments list */}
            {recorder.segments.length > 0 && (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:10, fontWeight:700, color:C.textMuted, marginBottom:6, textTransform:'uppercase'}}>
                  {isIT ? 'Segmenti registrati' : 'Recorded segments'} ({recorder.segments.length})
                </div>
                {recorder.segments.map((seg, i) => (
                  <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:4,
                    borderRadius:10, background:C.overlayBg || 'rgba(255,255,255,0.03)',
                    border:`1px solid ${C.overlayBorder}`}}>
                    <button onClick={() => playSegment(i)}
                      style={{width:28, height:28, borderRadius:8, border:'none', cursor:'pointer',
                        background:C.accent1 + '20', color:C.accent1, fontSize:12,
                        display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {playingIdx === i ? '\u23F8' : '\u25B6'}
                    </button>
                    <div style={{flex:1, fontSize:12, color:C.textSecondary}}>
                      {isIT ? 'Segmento' : 'Segment'} {i + 1} — {Math.floor(seg.duration)}s
                    </div>
                    <button onClick={() => recorder.deleteSegment(i)}
                      style={{width:24, height:24, borderRadius:6, border:`1px solid ${C.overlayBorder}`,
                        background:'transparent', color:C.textMuted, cursor:'pointer', fontSize:10,
                        display:'flex', alignItems:'center', justifyContent:'center'}}>
                      {'\u2716'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Continue to review */}
            {ready && !recorder.isRecording && (
              <button onClick={() => setStep(2)}
                style={{width:'100%', padding:'14px 20px', borderRadius:14, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg, ${C.accent4 || C.onlineColor}, ${C.accent1})`,
                  color:'#fff', fontSize:14, fontWeight:700, fontFamily:FONT}}>
                {isIT ? 'Prosegui \u2192' : 'Continue \u2192'}
              </button>
            )}
          </div>
        )}

        {/* ═══ STEP 2: REVIEW & CLONE ═══ */}
        {step === 2 && !cloneSuccess && (
          <div style={{width:'100%', maxWidth:400}}>
            <div style={{...S.card, padding:'20px 18px', marginBottom:16, textAlign:'center'}}>
              <div style={{fontSize:40, marginBottom:12}}>{'\u{1F3B5}'}</div>
              <div style={{fontSize:16, fontWeight:700, color:C.textPrimary, marginBottom:6}}>
                {isIT ? 'Anteprima Registrazione' : 'Recording Preview'}
              </div>
              <div style={{fontSize:24, fontWeight:800, color:C.accent1, marginBottom:4}}>
                {Math.floor(recorder.totalDuration)}s
              </div>
              <div style={{fontSize:11, color:C.textMuted}}>
                {recorder.segments.length} {isIT ? 'segmenti' : 'segments'}
              </div>
            </div>

            {/* Segments review */}
            {recorder.segments.map((seg, i) => (
              <div key={i} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 12px', marginBottom:4,
                borderRadius:10, background:C.overlayBg || 'rgba(255,255,255,0.03)',
                border:`1px solid ${C.overlayBorder}`}}>
                <button onClick={() => playSegment(i)}
                  style={{width:32, height:32, borderRadius:10, border:'none', cursor:'pointer',
                    background:C.accent1 + '20', color:C.accent1, fontSize:14,
                    display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {playingIdx === i ? '\u23F8' : '\u25B6'}
                </button>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:600, color:C.textPrimary}}>
                    {isIT ? 'Segmento' : 'Segment'} {i + 1}
                  </div>
                  <div style={{fontSize:10, color:C.textMuted}}>{Math.floor(seg.duration)}s</div>
                </div>
                <button onClick={() => { recorder.deleteSegment(i); if (recorder.segments.length <= 1) setStep(1); }}
                  style={{width:28, height:28, borderRadius:8, border:`1px solid ${C.overlayBorder}`,
                    background:'transparent', color:C.textMuted, cursor:'pointer', fontSize:11,
                    display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {'\u2716'}
                </button>
              </div>
            ))}

            {/* Back to record more */}
            <button onClick={() => setStep(1)}
              style={{width:'100%', marginTop:12, padding:'10px', borderRadius:10,
                background:'transparent', border:`1px solid ${C.overlayBorder}`,
                color:C.textSecondary, fontSize:12, cursor:'pointer', fontFamily:FONT}}>
              {isIT ? '\u{1F3A4} Registra ancora' : '\u{1F3A4} Record more'}
            </button>

            {/* Clone button */}
            <button onClick={handleClone}
              disabled={cloning}
              style={{width:'100%', marginTop:12, padding:'16px 20px', borderRadius:16, border:'none', cursor:'pointer',
                background: cloning ? C.overlayBg : `linear-gradient(135deg, ${C.accent1}, ${C.accent2 || C.accent1})`,
                color:'#fff', fontSize:15, fontWeight:700, fontFamily:FONT,
                opacity: cloning ? 0.6 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
              {cloning ? (
                <>{isIT ? 'Creazione voce in corso...' : 'Creating voice...'}</>
              ) : (
                <><span>{'\u2728'}</span> {isIT ? 'Crea la tua Voce' : 'Create Your Voice'}</>
              )}
            </button>

            {/* Cost info */}
            <div style={{fontSize:10, color:C.textMuted, textAlign:'center', marginTop:8}}>
              {isIT ? 'Costo: 500 crediti (\u20AC5.00)' : 'Cost: 500 credits (\u20AC5.00)'}
            </div>

            {cloneError && (
              <div style={{marginTop:12, fontSize:12, color:C.accent3 || '#FF6B6B', padding:'10px 14px',
                borderRadius:10, background:C.accent3Bg || 'rgba(255,107,107,0.1)', textAlign:'center'}}>
                {cloneError}
              </div>
            )}
          </div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {cloneSuccess && (
          <div style={{width:'100%', maxWidth:400, textAlign:'center'}}>
            <div style={{...S.card, padding:'30px 24px'}}>
              <div style={{fontSize:56, marginBottom:16}}>{'\u{1F389}'}</div>
              <div style={{fontSize:20, fontWeight:800, color:C.accent4 || C.onlineColor, marginBottom:8}}>
                {isIT ? 'Voce Creata!' : 'Voice Created!'}
              </div>
              <div style={{fontSize:13, color:C.textSecondary, marginBottom:20, lineHeight:1.5}}>
                {isIT
                  ? 'La tua voce personalizzata è pronta. Ora puoi selezionarla nel voice picker della chat come "La mia voce".'
                  : 'Your custom voice is ready. You can now select it in the chat voice picker as "My Voice".'}
              </div>

              <button onClick={() => setView('settings')}
                style={{width:'100%', padding:'14px 20px', borderRadius:14, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg, ${C.accent1}, ${C.accent4 || C.onlineColor})`,
                  color:'#fff', fontSize:14, fontWeight:700, fontFamily:FONT}}>
                {isIT ? 'Torna alle Impostazioni' : 'Back to Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

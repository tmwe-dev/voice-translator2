'use client';
import { memo, useState, useRef, useCallback } from 'react';
import { VOICES, FONT, getLang } from '../lib/constants.js';
import Icon from './Icon.js';

const VoiceTestView = memo(function VoiceTestView({ L, S, prefs, setView, isTrial, isTopPro,
  useOwnKeys, apiKeyInputs, platformHasEL, elevenLabsVoices, selectedELVoice,
  setElevenLabsVoices, userToken, userTokenRef, creditBalance, theme }) {

  const [playingVoice, setPlayingVoice] = useState(null);
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState({});
  const [loadingEL, setLoadingEL] = useState(false);
  const audioRef = useRef(null);

  // Default sample texts per language
  const SAMPLES = {
    it: 'Ciao! Questa è una prova della voce di traduzione. Come suona?',
    en: 'Hello! This is a translation voice test. How does it sound?',
    es: 'Hola! Esta es una prueba de la voz de traducción. ¿Cómo suena?',
    fr: 'Bonjour! Ceci est un test de la voix de traduction. Comment ça sonne?',
    de: 'Hallo! Dies ist ein Test der Übersetzungsstimme. Wie klingt es?',
    pt: 'Olá! Este é um teste da voz de tradução. Como soa?',
    zh: '你好！这是翻译语音测试。听起来怎么样？',
    ja: 'こんにちは！これは翻訳音声のテストです。どう聞こえますか？',
    ko: '안녕하세요! 이것은 번역 음성 테스트입니다. 어떻게 들리나요?',
    th: 'สวัสดี! นี่คือการทดสอบเสียงแปล ฟังดูเป็นอย่างไร?',
    ar: 'مرحبا! هذا اختبار لصوت الترجمة. كيف يبدو؟',
    hi: 'नमस्ते! यह अनुवाद आवाज़ का परीक्षण है। यह कैसा लगता है?',
    ru: 'Привет! Это тест голоса для перевода. Как звучит?',
    tr: 'Merhaba! Bu bir çeviri sesi testidir. Nasıl duyuluyor?',
    vi: 'Xin chào! Đây là bài kiểm tra giọng dịch. Nghe thế nào?',
  };

  const sampleText = testText.trim() || SAMPLES[prefs.lang] || SAMPLES.en;
  const langInfo = getLang(prefs.lang);
  const hasApiAccess = userToken && (useOwnKeys || creditBalance > 0);

  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setPlayingVoice(null);
  }, []);

  // Test OpenAI voice
  const testOpenAIVoice = useCallback(async (voiceName) => {
    stopAudio();
    if (playingVoice === voiceName) return;

    setPlayingVoice(voiceName);
    setTestResults(prev => ({ ...prev, [voiceName]: 'loading' }));

    if (!hasApiAccess) {
      setTestResults(prev => ({ ...prev, [voiceName]: 'no_api' }));
      setPlayingVoice(null);
      return;
    }

    try {
      const start = Date.now();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voice: voiceName, userToken: userTokenRef?.current })
      });

      if (res.ok) {
        const blob = await res.blob();
        const elapsed = Date.now() - start;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); setTestResults(prev => ({ ...prev, [voiceName]: 'error' })); };
        await audio.play();
        setTestResults(prev => ({ ...prev, [voiceName]: `ok_${elapsed}ms_${(blob.size/1024).toFixed(1)}kb` }));
        return;
      } else {
        setTestResults(prev => ({ ...prev, [voiceName]: `error_${res.status}` }));
      }
    } catch (e) {
      setTestResults(prev => ({ ...prev, [voiceName]: `error_${e.message}` }));
    }
    setPlayingVoice(null);
  }, [playingVoice, sampleText, hasApiAccess, userTokenRef, stopAudio]);

  // Test ElevenLabs voice
  const testELVoice = useCallback(async (voice) => {
    stopAudio();
    const key = `el_${voice.id}`;
    if (playingVoice === key) return;

    setPlayingVoice(key);
    setTestResults(prev => ({ ...prev, [key]: 'loading' }));

    try {
      // Try preview_url first (free)
      if (voice.preview) {
        const start = Date.now();
        const audio = new Audio(voice.preview);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); };
        audio.onerror = () => { setPlayingVoice(null); setTestResults(prev => ({ ...prev, [key]: 'preview_error' })); };
        await audio.play();
        const elapsed = Date.now() - start;
        setTestResults(prev => ({ ...prev, [key]: `ok_preview_${elapsed}ms` }));
        return;
      }

      // Fallback: TTS API
      const start = Date.now();
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sampleText, voiceId: voice.id, langCode: prefs.lang, userToken: userTokenRef?.current })
      });
      if (res.ok) {
        const blob = await res.blob();
        const elapsed = Date.now() - start;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setPlayingVoice(null); URL.revokeObjectURL(url); };
        await audio.play();
        setTestResults(prev => ({ ...prev, [key]: `ok_tts_${elapsed}ms_${(blob.size/1024).toFixed(1)}kb` }));
        return;
      } else {
        setTestResults(prev => ({ ...prev, [key]: `error_${res.status}` }));
      }
    } catch (e) {
      setTestResults(prev => ({ ...prev, [key]: `error_${e.message}` }));
    }
    setPlayingVoice(null);
  }, [playingVoice, sampleText, prefs.lang, userTokenRef, stopAudio]);

  // Test browser speech
  const testBrowserSpeech = useCallback(() => {
    stopAudio();
    if (playingVoice === 'browser') return;

    setPlayingVoice('browser');
    setTestResults(prev => ({ ...prev, browser: 'loading' }));

    try {
      if (typeof speechSynthesis === 'undefined') {
        setTestResults(prev => ({ ...prev, browser: 'not_supported' }));
        setPlayingVoice(null);
        return;
      }
      const utt = new SpeechSynthesisUtterance(sampleText);
      utt.lang = langInfo?.speech || 'en-US';
      utt.rate = 1;
      utt.onend = () => { setPlayingVoice(null); setTestResults(prev => ({ ...prev, browser: 'ok_free' })); };
      utt.onerror = () => { setPlayingVoice(null); setTestResults(prev => ({ ...prev, browser: 'error' })); };
      speechSynthesis.speak(utt);
      setTestResults(prev => ({ ...prev, browser: 'playing_free' }));
    } catch {
      setTestResults(prev => ({ ...prev, browser: 'error' }));
      setPlayingVoice(null);
    }
  }, [playingVoice, sampleText, langInfo, stopAudio]);

  // Load EL voices
  const loadELVoices = useCallback(async () => {
    setLoadingEL(true);
    try {
      const res = await fetch(`/api/tts-elevenlabs?action=voices&token=${userTokenRef?.current || ''}`);
      if (res.ok) {
        const data = await res.json();
        setElevenLabsVoices(data.voices || []);
      }
    } catch(e) { console.error(e); }
    setLoadingEL(false);
  }, [userTokenRef, setElevenLabsVoices]);

  // Status badge helper
  function StatusBadge({ result }) {
    if (!result) return null;
    if (result === 'loading') return <span style={{fontSize:10, color:'#ffd700'}}>...</span>;
    if (result === 'no_api') return <span style={{fontSize:10, color:'#FF6B9D'}}>No API</span>;
    if (result.startsWith('ok')) {
      const parts = result.split('_').slice(1);
      return <span style={{fontSize:10, color:'#00FF94'}}>{'\u2713'} {parts.join(' ')}</span>;
    }
    if (result.startsWith('error')) {
      return <span style={{fontSize:10, color:'#FF6B9D'}}>{'\u2715'} {result.replace('error_', '')}</span>;
    }
    if (result.startsWith('playing')) return <span style={{fontSize:10, color:'#00D2FF'}}>{'\u266B'}</span>;
    return <span style={{fontSize:10, color:'rgba(232,234,255,0.3)'}}>{result}</span>;
  }

  // Voice descriptions
  const VOICE_DESC = {
    alloy: 'Neutra, versatile',
    echo: 'Maschile, calda',
    fable: 'Espressiva, narrativa',
    onyx: 'Profonda, autorevole',
    nova: 'Femminile, naturale',
    shimmer: 'Luminosa, chiara',
  };

  // API status info
  const hasOpenAI = !!(apiKeyInputs?.openai?.trim());
  const hasElevenLabs = !!(apiKeyInputs?.elevenlabs?.trim());
  const elAvailable = !isTrial && ((useOwnKeys && hasElevenLabs) || platformHasEL);

  return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('settings')}>{'←'}</button>
          <span style={{fontWeight:600, fontSize:17}}>{L('voiceTest') || 'Test Voci'}</span>
        </div>

        {/* ── API Status Summary ── */}
        <div style={{width:'100%', maxWidth:400, marginBottom:16, borderRadius:16,
          background:'rgba(108,99,255,0.04)', border:'1px solid rgba(108,99,255,0.1)',
          padding:'14px 16px'}}>
          <div style={{fontSize:11, fontWeight:700, color:'rgba(232,234,255,0.4)',
            textTransform:'uppercase', letterSpacing:1, marginBottom:10}}>
            {L('systemStatus') || 'Stato Sistema'}
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:6}}>
            {[
              { name: 'Browser Speech', status: typeof speechSynthesis !== 'undefined' ? 'ok' : 'no', tier: 'FREE', color: '#00FF94' },
              { name: 'OpenAI TTS', status: hasApiAccess ? 'ok' : 'no', tier: 'PRO', color: '#00D2FF',
                detail: useOwnKeys ? (hasOpenAI ? 'API key' : 'No key') : (creditBalance > 0 ? `${creditBalance} credits` : 'No credits') },
              { name: 'ElevenLabs', status: elAvailable ? 'ok' : 'no', tier: 'TOP PRO', color: '#ffd700',
                detail: useOwnKeys ? (hasElevenLabs ? 'API key' : 'No key') : (platformHasEL ? 'Piattaforma' : 'N/A') },
            ].map(s => (
              <div key={s.name} style={{display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', borderRadius:10,
                background: s.status === 'ok' ? 'rgba(0,255,148,0.04)' : 'rgba(232,234,255,0.02)',
                border: `1px solid ${s.status === 'ok' ? 'rgba(0,255,148,0.1)' : 'rgba(232,234,255,0.05)'}`}}>
                <span style={{fontSize:14, width:20, textAlign:'center'}}>
                  {s.status === 'ok' ? '\u2713' : '\u2715'}
                </span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:600, color: s.status === 'ok' ? s.color : 'rgba(232,234,255,0.35)'}}>
                    {s.name}
                  </div>
                  {s.detail && <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:1}}>{s.detail}</div>}
                </div>
                <span style={{fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:6,
                  background:`rgba(${s.tier === 'FREE' ? '0,255,148' : s.tier === 'PRO' ? '0,210,255' : '255,215,0'},0.1)`,
                  color: s.color}}>{s.tier}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Custom text input ── */}
        <div style={{...S.card, width:'100%', maxWidth:400}}>
          <div style={{fontSize:11, fontWeight:700, color:'rgba(232,234,255,0.4)',
            textTransform:'uppercase', letterSpacing:1, marginBottom:8}}>
            {L('testText') || 'Testo di prova'}
          </div>
          <textarea
            style={{...S.input, minHeight:60, resize:'vertical', fontSize:13, lineHeight:1.5}}
            value={testText}
            onChange={e => setTestText(e.target.value)}
            placeholder={SAMPLES[prefs.lang] || SAMPLES.en}
          />
          <div style={{fontSize:10, color:'rgba(232,234,255,0.25)', marginTop:4}}>
            {L('testTextHint') || 'Lascia vuoto per usare il testo di esempio'} ({langInfo?.flag} {langInfo?.name})
          </div>
        </div>

        {/* ── Browser Speech (FREE) ── */}
        <div style={{...S.card, width:'100%', maxWidth:400}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:'#00FF94', display:'flex', alignItems:'center', gap:6}}>
                {'\u{1F50A}'} Browser Speech
              </div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:2}}>FREE — {L('noCost') || 'Nessun costo'}</div>
            </div>
            <StatusBadge result={testResults.browser} />
          </div>
          <button onClick={testBrowserSpeech}
            style={{width:'100%', padding:'10px 14px', borderRadius:12, cursor:'pointer',
              background: playingVoice === 'browser' ? 'rgba(255,107,157,0.1)' : 'rgba(0,255,148,0.06)',
              border: playingVoice === 'browser' ? '1px solid rgba(255,107,157,0.2)' : '1px solid rgba(0,255,148,0.15)',
              color: playingVoice === 'browser' ? '#FF6B9D' : '#00FF94',
              fontSize:13, fontWeight:600, fontFamily:FONT, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              WebkitTapHighlightColor:'transparent'}}>
            <Icon name={playingVoice === 'browser' ? 'stop' : 'play'} size={16}
              color={playingVoice === 'browser' ? '#FF6B9D' : '#00FF94'} />
            {playingVoice === 'browser' ? 'Stop' : (L('testBrowserVoice') || 'Testa voce browser')}
          </button>
          <div style={{fontSize:10, color:'rgba(232,234,255,0.2)', marginTop:6, lineHeight:1.4}}>
            {L('browserVoiceNote') || 'Voce del dispositivo. Qualità variabile, stessa voce per tutti i nomi.'}
          </div>
        </div>

        {/* ── OpenAI TTS (PRO) ── */}
        <div style={{...S.card, width:'100%', maxWidth:400}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:'#00D2FF', display:'flex', alignItems:'center', gap:6}}>
                {'\u{1F3A4}'} OpenAI TTS
              </div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:2}}>PRO — 6 {L('uniqueVoices') || 'voci uniche'}</div>
            </div>
            {!hasApiAccess && (
              <span style={{fontSize:10, padding:'3px 8px', borderRadius:6,
                background:'rgba(255,107,157,0.1)', color:'#FF6B9D'}}>
                {L('needsApi') || 'Richiede API'}
              </span>
            )}
          </div>

          <div style={{display:'flex', flexDirection:'column', gap:5}}>
            {VOICES.map(v => {
              const isPlaying = playingVoice === v;
              return (
                <div key={v} style={{display:'flex', alignItems:'center', gap:8,
                  padding:'8px 12px', borderRadius:12,
                  background: isPlaying ? 'rgba(0,210,255,0.06)' : 'rgba(232,234,255,0.02)',
                  border: isPlaying ? '1px solid rgba(0,210,255,0.15)' : '1px solid rgba(232,234,255,0.05)'}}>
                  <button onClick={() => testOpenAIVoice(v)}
                    style={{width:34, height:34, borderRadius:9, cursor: hasApiAccess ? 'pointer' : 'not-allowed', flexShrink:0,
                      background: isPlaying ? 'rgba(255,107,157,0.15)' : 'rgba(232,234,255,0.04)',
                      border: isPlaying ? '1.5px solid rgba(255,107,157,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity: hasApiAccess ? 1 : 0.4,
                      WebkitTapHighlightColor:'transparent'}}>
                    <Icon name={isPlaying ? 'stop' : 'play'} size={15}
                      color={isPlaying ? '#FF6B9D' : 'rgba(232,234,255,0.5)'} />
                  </button>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, fontWeight:600, color:'rgba(232,234,255,0.7)'}}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </div>
                    <div style={{fontSize:10, color:'rgba(232,234,255,0.3)'}}>
                      {VOICE_DESC[v] || ''}
                    </div>
                  </div>
                  <StatusBadge result={testResults[v]} />
                </div>
              );
            })}
          </div>

          {!hasApiAccess && (
            <div style={{fontSize:11, color:'rgba(232,234,255,0.35)', marginTop:10, padding:'8px 12px',
              borderRadius:10, background:'rgba(255,107,157,0.04)', border:'1px solid rgba(255,107,157,0.08)',
              lineHeight:1.5}}>
              {L('openaiTestNote') || 'Per testare le voci OpenAI, accedi con un account PRO o configura le tue API key nelle impostazioni.'}
            </div>
          )}

          {hasApiAccess && (
            <button onClick={async () => {
              for (const v of VOICES) {
                await new Promise(r => {
                  testOpenAIVoice(v);
                  const check = setInterval(() => {
                    if (!audioRef.current || audioRef.current.paused) { clearInterval(check); setTimeout(r, 300); }
                  }, 200);
                  setTimeout(() => { clearInterval(check); r(); }, 15000);
                });
              }
            }}
              style={{width:'100%', padding:'10px 14px', borderRadius:12, cursor:'pointer', marginTop:10,
                background:'rgba(0,210,255,0.06)', border:'1px solid rgba(0,210,255,0.15)',
                color:'#00D2FF', fontSize:13, fontWeight:600, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                WebkitTapHighlightColor:'transparent'}}>
              <Icon name="play" size={16} color="#00D2FF" />
              {L('testAllVoices') || 'Testa tutte le voci'}
            </button>
          )}
        </div>

        {/* ── ElevenLabs (TOP PRO) ── */}
        <div style={{...S.card, width:'100%', maxWidth:400}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:'#ffd700', display:'flex', alignItems:'center', gap:6}}>
                {'\u2B50'} ElevenLabs
              </div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginTop:2}}>TOP PRO — {L('premiumVoices') || 'Voci premium'}</div>
            </div>
            {!elAvailable && (
              <span style={{fontSize:10, padding:'3px 8px', borderRadius:6,
                background:'rgba(255,215,0,0.1)', color:'#ffd700'}}>
                {L('needsELKey') || 'Richiede chiave EL'}
              </span>
            )}
          </div>

          {elAvailable && elevenLabsVoices.length === 0 && (
            <button onClick={loadELVoices} disabled={loadingEL}
              style={{width:'100%', padding:'10px 14px', borderRadius:12, cursor:'pointer',
                background:'rgba(255,215,0,0.06)', border:'1px solid rgba(255,215,0,0.15)',
                color:'#ffd700', fontSize:13, fontWeight:600, fontFamily:FONT,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity: loadingEL ? 0.5 : 1,
                WebkitTapHighlightColor:'transparent'}}>
              <Icon name="refresh" size={16} color="#ffd700" />
              {loadingEL ? (L('loading') || 'Caricamento...') : (L('loadVoices') || 'Carica voci ElevenLabs')}
            </button>
          )}

          {elAvailable && elevenLabsVoices.length > 0 && (
            <div>
              <div style={{fontSize:10, color:'rgba(232,234,255,0.3)', marginBottom:8}}>
                {elevenLabsVoices.length} {L('voicesAvailable') || 'voci disponibili'} — {L('previewFree') || 'anteprima gratuita'}
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:4, maxHeight:350, overflowY:'auto'}}>
                {elevenLabsVoices.map(v => {
                  const key = `el_${v.id}`;
                  const isPlaying = playingVoice === key;
                  const isSel = selectedELVoice === v.id;
                  return (
                    <div key={v.id} style={{display:'flex', alignItems:'center', gap:8,
                      padding:'8px 12px', borderRadius:12,
                      background: isSel ? 'rgba(255,215,0,0.06)' : (isPlaying ? 'rgba(255,215,0,0.03)' : 'rgba(232,234,255,0.02)'),
                      border: isSel ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(232,234,255,0.05)'}}>
                      <button onClick={() => testELVoice(v)}
                        style={{width:32, height:32, borderRadius:8, cursor:'pointer', flexShrink:0,
                          background: isPlaying ? 'rgba(255,107,157,0.15)' : 'rgba(232,234,255,0.04)',
                          border: isPlaying ? '1.5px solid rgba(255,107,157,0.3)' : '1.5px solid rgba(232,234,255,0.08)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          WebkitTapHighlightColor:'transparent'}}>
                        <Icon name={isPlaying ? 'stop' : 'play'} size={14}
                          color={isPlaying ? '#FF6B9D' : 'rgba(232,234,255,0.5)'} />
                      </button>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:12, fontWeight: isSel ? 700 : 500,
                          color: isSel ? '#ffd700' : 'rgba(232,234,255,0.6)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {v.name}
                        </div>
                        <div style={{fontSize:9, color:'rgba(232,234,255,0.25)', marginTop:1}}>
                          {v.category}{v.labels?.accent ? ` \u2022 ${v.labels.accent}` : ''}{v.labels?.gender ? ` \u2022 ${v.labels.gender}` : ''}
                        </div>
                      </div>
                      <StatusBadge result={testResults[key]} />
                      {isSel && <span style={{fontSize:11, color:'#ffd700'}}>{'\u2713'}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!elAvailable && (
            <div style={{fontSize:11, color:'rgba(232,234,255,0.35)', padding:'8px 12px',
              borderRadius:10, background:'rgba(255,215,0,0.04)', border:'1px solid rgba(255,215,0,0.08)',
              lineHeight:1.5}}>
              {L('elTestNote') || 'ElevenLabs richiede una chiave API propria o l\'accesso piattaforma. Configura nelle impostazioni > API Keys.'}
            </div>
          )}
        </div>

        {/* ── Legend / Info ── */}
        <div style={{width:'100%', maxWidth:400, padding:'12px 16px', marginBottom:20,
          borderRadius:14, background:'rgba(232,234,255,0.02)', border:'1px solid rgba(232,234,255,0.05)'}}>
          <div style={{fontSize:10, fontWeight:700, color:'rgba(232,234,255,0.3)',
            textTransform:'uppercase', letterSpacing:1, marginBottom:8}}>
            {L('legend') || 'Legenda'}
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:4, fontSize:11, color:'rgba(232,234,255,0.4)'}}>
            <div>{'\u2713'} <span style={{color:'#00FF94'}}>Verde</span> = {L('testOk') || 'Funziona correttamente'}</div>
            <div>{'\u2715'} <span style={{color:'#FF6B9D'}}>Rosso</span> = {L('testError') || 'Errore o non disponibile'}</div>
            <div>ms = {L('responseTime') || 'Tempo di risposta'} \u2022 kb = {L('fileSize') || 'Dimensione audio'}</div>
          </div>
        </div>

      </div>
    </div>
  );
});

export default VoiceTestView;

'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const LANGS = [
  { code:'it', name:'Italiano', flag:'🇮🇹', speech:'it-IT' },
  { code:'th', name:'ไทย (Thai)', flag:'🇹🇭', speech:'th-TH' },
  { code:'en', name:'English', flag:'🇬🇧', speech:'en-US' },
  { code:'es', name:'Español', flag:'🇪🇸', speech:'es-ES' },
  { code:'fr', name:'Français', flag:'🇫🇷', speech:'fr-FR' },
  { code:'de', name:'Deutsch', flag:'🇩🇪', speech:'de-DE' },
  { code:'pt', name:'Português', flag:'🇧🇷', speech:'pt-BR' },
  { code:'zh', name:'中文', flag:'🇨🇳', speech:'zh-CN' },
  { code:'ja', name:'日本語', flag:'🇯🇵', speech:'ja-JP' },
  { code:'ko', name:'한국어', flag:'🇰🇷', speech:'ko-KR' },
  { code:'ar', name:'العربية', flag:'🇸🇦', speech:'ar-SA' },
  { code:'hi', name:'हिन्दी', flag:'🇮🇳', speech:'hi-IN' },
  { code:'ru', name:'Русский', flag:'🇷🇺', speech:'ru-RU' },
  { code:'tr', name:'Türkçe', flag:'🇹🇷', speech:'tr-TR' },
  { code:'vi', name:'Tiếng Việt', flag:'🇻🇳', speech:'vi-VN' },
  { code:'id', name:'Bahasa Indonesia', flag:'🇮🇩', speech:'id-ID' },
  { code:'ms', name:'Bahasa Melayu', flag:'🇲🇾', speech:'ms-MY' },
  { code:'nl', name:'Nederlands', flag:'🇳🇱', speech:'nl-NL' },
  { code:'pl', name:'Polski', flag:'🇵🇱', speech:'pl-PL' },
  { code:'sv', name:'Svenska', flag:'🇸🇪', speech:'sv-SE' },
  { code:'el', name:'Ελληνικά', flag:'🇬🇷', speech:'el-GR' },
  { code:'cs', name:'Čeština', flag:'🇨🇿', speech:'cs-CZ' },
  { code:'ro', name:'Română', flag:'🇷🇴', speech:'ro-RO' },
  { code:'hu', name:'Magyar', flag:'🇭🇺', speech:'hu-HU' },
  { code:'fi', name:'Suomi', flag:'🇫🇮', speech:'fi-FI' },
];
const langMap = {};
LANGS.forEach(l => langMap[l.code] = l);

export default function Home() {
  const [view, setView] = useState('landing'); // 'landing' | 'room'
  const [langA, setLangA] = useState('it');
  const [langB, setLangB] = useState('th');
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState('a');
  const [joinCode, setJoinCode] = useState('');
  const [myMsgs, setMyMsgs] = useState([]);
  const [theirMsgs, setTheirMsgs] = useState([]);
  const [status, setStatus] = useState('Pronto');
  const [isRecording, setIsRecording] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const pollRef = useRef(null);
  const msgIndexRef = useRef(0);
  const spokenRef = useRef(new Set());

  const myLang = role === 'a' ? langMap[langA] : langMap[langB];
  const theirLang = role === 'a' ? langMap[langB] : langMap[langA];

  // ── Room creation ──
  async function createRoom() {
    if (langA === langB) { alert('Seleziona due lingue diverse!'); return; }
    try {
      const res = await fetch('/api/room', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ langA, langB })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRoomId(data.id);
      setRole('a');
      setView('room');
      window.history.pushState({}, '', `?room=${data.id}&a=${langA}&b=${langB}`);
    } catch (e) { alert('Errore: ' + e.message); }
  }

  async function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { alert('Inserisci un codice stanza'); return; }
    try {
      const res = await fetch(`/api/room?id=${code}`);
      if (!res.ok) { alert('Stanza non trovata!'); return; }
      const data = await res.json();
      setLangA(data.langA);
      setLangB(data.langB);
      setRoomId(data.id);
      setRole('b');
      setView('room');
      window.history.pushState({}, '', `?room=${data.id}&a=${data.langA}&b=${data.langB}&role=b`);
    } catch (e) { alert('Errore: ' + e.message); }
  }

  // ── Check URL on load ──
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('room')) {
      setRoomId(p.get('room'));
      setLangA(p.get('a') || 'it');
      setLangB(p.get('b') || 'th');
      setRole(p.get('role') || 'a');
      setView('room');
    }
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.getVoices();
      speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
  }, []);

  // ── Polling for messages ──
  useEffect(() => {
    if (view !== 'room' || !roomId) return;
    msgIndexRef.current = 0;
    spokenRef.current = new Set();

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?roomId=${roomId}&since=${msgIndexRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(msg => {
            const msgKey = `${msg.ts}-${msg.fromRole}`;
            if (msg.fromRole === role) {
              // My own message echoed back - skip
            } else {
              // Message from the other person
              setTheirMsgs(prev => [...prev, msg]);
              // Speak it if not already spoken
              if (!spokenRef.current.has(msgKey)) {
                spokenRef.current.add(msgKey);
                speak(msg.translated, myLang?.speech || 'it-IT');
              }
            }
          });
          msgIndexRef.current = data.total;
        }
      } catch (e) { /* ignore poll errors */ }
    };

    pollRef.current = setInterval(poll, 2000);
    poll(); // initial
    return () => clearInterval(pollRef.current);
  }, [view, roomId, role]);

  // ── Recording ──
  async function startRec(e) {
    e.preventDefault();
    if (isRecording) return;
    setIsRecording(true);
    setStatus('Ascoltando...');
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      recorderRef.current = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current.start(100);
    } catch (err) {
      alert('Errore microfono: ' + err.message);
      setIsRecording(false);
      setStatus('Pronto');
    }
  }

  async function stopRec(e) {
    e.preventDefault();
    if (!isRecording || !recorderRef.current) return;
    setIsRecording(false);
    setStatus('Elaborazione...');

    return new Promise(resolve => {
      recorderRef.current.onstop = async () => {
        recorderRef.current.stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorderRef.current.mimeType });
        if (blob.size < 1000) { setStatus('Pronto'); resolve(); return; }

        try {
          const form = new FormData();
          const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
          form.append('audio', blob, `audio.${ext}`);
          form.append('sourceLang', myLang.code);
          form.append('targetLang', theirLang.code);
          form.append('sourceLangName', myLang.name);
          form.append('targetLangName', theirLang.name);

          const res = await fetch('/api/process', { method: 'POST', body: form });
          if (!res.ok) throw new Error('Errore server');
          const { original, translated } = await res.json();

          if (original) {
            setMyMsgs(prev => [...prev, { original, ts: Date.now() }]);
            // Send to room for the other person
            await fetch('/api/messages', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, original, translated, fromRole: role })
            });
          }
        } catch (err) {
          setMyMsgs(prev => [...prev, { original: '⚠️ ' + err.message, ts: Date.now() }]);
        }
        setStatus('Pronto');
        resolve();
      };
      recorderRef.current.stop();
    });
  }

  // ── TTS ──
  async function speak(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play().catch(() => speakBrowser(text, lang));
    } catch {
      speakBrowser(text, lang);
    }
  }

  function speakBrowser(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  // ── Share URL ──
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?room=${roomId}&a=${langA}&b=${langB}&role=b`
    : '';

  function copyUrl() {
    navigator.clipboard.writeText(shareUrl).catch(() => alert(shareUrl));
  }

  function doShare() {
    if (navigator.share) navigator.share({ title: 'VoiceTranslate', url: shareUrl });
    else copyUrl();
  }

  // ════════════════════════════════════
  // RENDER
  // ════════════════════════════════════

  if (view === 'landing') return (
    <div style={S.landing}>
      <div style={{fontSize:56}}>🌐</div>
      <div style={S.title}>VoiceTranslate</div>
      <div style={S.subtitle}>Traduttore vocale in tempo reale</div>

      <div style={S.section}>
        <div style={S.label}>LA TUA LINGUA</div>
        <select style={S.sel} value={langA} onChange={e=>setLangA(e.target.value)}>
          {LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>

      <button style={S.swap} onClick={()=>{setLangA(langB);setLangB(langA);}}>⇅</button>

      <div style={S.section}>
        <div style={S.label}>LINGUA DELL'ALTRA PERSONA</div>
        <select style={S.sel} value={langB} onChange={e=>setLangB(e.target.value)}>
          {LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>

      <button style={S.btnMain} onClick={createRoom}>Crea Stanza ▶</button>

      <div style={S.joinRow}>
        <input style={S.joinInput} maxLength={6} placeholder="CODICE" value={joinCode}
          onChange={e=>setJoinCode(e.target.value.toUpperCase())} />
        <button style={S.joinBtn} onClick={joinRoom}>Entra</button>
      </div>

      <div style={S.note}>Crea una stanza e condividi il codice con l'altra persona.</div>
    </div>
  );

  // ── ROOM VIEW ──
  return (
    <div style={S.room}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <span style={{fontSize:11,color:'rgba(255,255,255,.4)'}}>STANZA </span>
          <span style={{fontFamily:'monospace',fontSize:18,fontWeight:700,letterSpacing:3}}>{roomId}</span>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button style={S.iconBtn} onClick={()=>setFlipped(!flipped)}>🔄</button>
          <button style={S.iconBtn} onClick={()=>setShowShare(true)}>📤</button>
        </div>
      </div>

      {/* My panel */}
      <div style={{...S.half, background:'linear-gradient(180deg,#1a1a2e,#12122a)'}}>
        <div style={S.langHdr}>
          <span style={{fontSize:22}}>{myLang?.flag}</span>
          <span style={{fontSize:15,fontWeight:600}}>{myLang?.name}</span>
          <span style={{marginLeft:'auto',fontSize:11,color:'rgba(255,255,255,.4)'}}>{status}</span>
        </div>
        <div style={S.texts}>
          {myMsgs.length === 0 && <div style={S.empty}>Tieni premuto il microfono per parlare</div>}
          {myMsgs.map((m,i) => (
            <div key={i} style={S.msg}><div style={S.msgOrig}>"{m.original}"</div></div>
          ))}
        </div>
        <div style={S.talkWrap}>
          <div style={{textAlign:'center'}}>
            <button style={{...S.talkBtn, ...(isRecording ? S.talkRec : {})}}
              onTouchStart={startRec} onTouchEnd={stopRec}
              onMouseDown={startRec} onMouseUp={stopRec}>🎤</button>
            <div style={S.talkLbl}>TIENI PREMUTO</div>
          </div>
        </div>
      </div>

      <div style={{height:2,background:'linear-gradient(90deg,#e94560,#0f3460)',flexShrink:0}} />

      {/* Their panel */}
      <div style={{...S.half, background:'linear-gradient(0deg,#16213e,#0d1b36)',
        ...(flipped ? {transform:'rotate(180deg)'} : {})}}>
        <div style={S.langHdr}>
          <span style={{fontSize:22}}>{theirLang?.flag}</span>
          <span style={{fontSize:15,fontWeight:600}}>{theirLang?.name}</span>
        </div>
        <div style={S.texts}>
          {theirMsgs.length === 0 && <div style={S.empty}>In attesa di traduzione...</div>}
          {theirMsgs.map((m,i) => (
            <div key={i} style={S.msg}>
              <div style={S.msgOrig}>{m.original}</div>
              <div style={S.msgTrans}>{m.translated}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <div style={S.modalBg} onClick={()=>setShowShare(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <button style={S.modalX} onClick={()=>setShowShare(false)}>✕</button>
            <h3 style={{marginBottom:12}}>📤 Condividi</h3>
            <p style={{color:'rgba(255,255,255,.6)',fontSize:13,marginBottom:8}}>
              L'altra persona può: scansionare il QR, aprire il link, o digitare il codice <strong>{roomId}</strong>
            </p>
            <div style={{textAlign:'center',margin:'16px 0'}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareUrl)}&size=200x200&bgcolor=1a1a2e&color=ffffff`}
                width={200} height={200} style={{borderRadius:12,background:'white',padding:8}} alt="QR" />
            </div>
            <div style={{...S.joinInput,fontSize:11,padding:10,wordBreak:'break-all'}}>{shareUrl}</div>
            <button style={{...S.btnMain,marginTop:10,fontSize:14}} onClick={copyUrl}>📋 Copia Link</button>
            <button style={{...S.btnMain,marginTop:6,fontSize:14,background:'#0f3460'}} onClick={doShare}>📤 Condividi via...</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline styles ──
const S = {
  landing: { display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
    height:'100vh',padding:24,background:'linear-gradient(135deg,#0a0a0f,#1a1a2e 50%,#16213e)',color:'white' },
  title: { fontSize:32,fontWeight:800,background:'linear-gradient(90deg,#e94560,#0f3460)',
    WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' },
  subtitle: { color:'rgba(255,255,255,.6)',fontSize:14,marginBottom:28 },
  section: { width:'100%',maxWidth:360,marginBottom:16 },
  label: { fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'rgba(255,255,255,.6)',marginBottom:6 },
  sel: { width:'100%',padding:'13px 16px',borderRadius:12,background:'rgba(255,255,255,.08)',
    border:'1px solid rgba(255,255,255,.12)',color:'white',fontSize:15 },
  swap: { width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,.08)',
    border:'1px solid rgba(255,255,255,.12)',color:'white',fontSize:20,cursor:'pointer',marginBottom:10 },
  btnMain: { width:'100%',maxWidth:360,padding:15,borderRadius:14,border:'none',
    background:'linear-gradient(135deg,#e94560,#c23152)',color:'white',fontSize:17,fontWeight:700,cursor:'pointer' },
  joinRow: { display:'flex',gap:8,width:'100%',maxWidth:360,marginTop:10 },
  joinInput: { flex:1,padding:'13px 16px',borderRadius:12,background:'rgba(255,255,255,.08)',
    border:'1px solid rgba(255,255,255,.12)',color:'white',fontSize:18,fontFamily:'monospace',
    textTransform:'uppercase',letterSpacing:3,textAlign:'center' },
  joinBtn: { padding:'13px 20px',borderRadius:12,border:'none',background:'#0f3460',color:'white',
    fontSize:15,fontWeight:600,cursor:'pointer' },
  note: { color:'rgba(255,255,255,.35)',fontSize:11,marginTop:14,maxWidth:360,textAlign:'center' },
  room: { display:'flex',flexDirection:'column',height:'100vh',width:'100%',background:'#0a0a0f',color:'white' },
  topBar: { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',
    background:'rgba(0,0,0,.4)',flexShrink:0 },
  iconBtn: { width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,.08)',
    border:'1px solid rgba(255,255,255,.12)',color:'white',fontSize:16,cursor:'pointer',
    display:'flex',alignItems:'center',justifyContent:'center' },
  half: { flex:1,display:'flex',flexDirection:'column',padding:'10px 16px',overflow:'hidden',minHeight:0 },
  langHdr: { display:'flex',alignItems:'center',gap:8,marginBottom:6,flexShrink:0 },
  texts: { flex:1,overflowY:'auto',minHeight:0 },
  empty: { color:'rgba(255,255,255,.35)',fontSize:13,textAlign:'center',marginTop:16 },
  msg: { padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.05)' },
  msgOrig: { fontSize:13,color:'rgba(255,255,255,.6)',fontStyle:'italic' },
  msgTrans: { fontSize:18,fontWeight:600,marginTop:3,lineHeight:1.4 },
  talkWrap: { display:'flex',justifyContent:'center',flexShrink:0,paddingBottom:4 },
  talkBtn: { width:68,height:68,borderRadius:'50%',border:'3px solid rgba(255,255,255,.2)',
    background:'rgba(255,255,255,.08)',color:'white',fontSize:26,cursor:'pointer',
    display:'flex',alignItems:'center',justifyContent:'center' },
  talkRec: { borderColor:'#e94560',background:'rgba(233,69,96,.3)',
    boxShadow:'0 0 0 8px rgba(233,69,96,.2)' },
  talkLbl: { fontSize:9,textTransform:'uppercase',letterSpacing:1,color:'rgba(255,255,255,.35)',marginTop:3 },
  modalBg: { position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:100,
    display:'flex',alignItems:'center',justifyContent:'center',padding:24 },
  modal: { background:'#1a1a2e',borderRadius:20,padding:24,width:'100%',maxWidth:380,
    maxHeight:'80vh',overflowY:'auto',color:'white' },
  modalX: { float:'right',background:'none',border:'none',color:'white',fontSize:22,cursor:'pointer' },
};

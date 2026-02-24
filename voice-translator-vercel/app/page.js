'use client';
import { useState, useRef } from 'react';

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

export default function Home() {
  const [view, setView] = useState('setup');
  const [langA, setLangA] = useState('it');
  const [langB, setLangB] = useState('th');
  const [flipped, setFlipped] = useState(false);
  const [activeSide, setActiveSide] = useState(null);
  const [statusA, setStatusA] = useState('Pronto');
  const [statusB, setStatusB] = useState('Pronto');
  const [msgsA, setMsgsA] = useState([]);
  const [msgsB, setMsgsB] = useState([]);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const lA = LANGS.find(l => l.code === langA);
  const lB = LANGS.find(l => l.code === langB);

  async function startTalk(side, e) {
    e.preventDefault();
    if (activeSide) return;
    setActiveSide(side);
    if (side === 'a') setStatusA('Ascoltando...');
    else setStatusB('Ascoltando...');
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
      recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.start(100);
    } catch (err) {
      alert('Errore microfono: ' + err.message);
      setActiveSide(null);
      setStatusA('Pronto'); setStatusB('Pronto');
    }
  }

  async function stopTalk(side, e) {
    e.preventDefault();
    if (activeSide !== side || !recRef.current) return;
    if (side === 'a') setStatusA('Elaborazione...');
    else setStatusB('Elaborazione...');

    recRef.current.onstop = async () => {
      recRef.current.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
      if (blob.size < 1000) { reset(); return; }

      const myLang = side === 'a' ? lA : lB;
      const otherLang = side === 'a' ? lB : lA;

      try {
        const form = new FormData();
        form.append('audio', blob, 'audio.webm');
        form.append('sourceLang', myLang.code);
        form.append('targetLang', otherLang.code);
        form.append('sourceLangName', myLang.name);
        form.append('targetLangName', otherLang.name);

        const res = await fetch('/api/process', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Errore server');
        const { original, translated } = await res.json();

        if (original) {
          if (side === 'a') {
            setMsgsA(p => [...p, { text: original }]);
            setMsgsB(p => [...p, { text: translated, isTrans: true }]);
          } else {
            setMsgsB(p => [...p, { text: original }]);
            setMsgsA(p => [...p, { text: translated, isTrans: true }]);
          }
          speak(translated, otherLang.speech);
        }
      } catch (err) {
        alert('Errore: ' + err.message);
      }
      reset();
    };
    recRef.current.stop();
  }

  function reset() {
    setActiveSide(null);
    setStatusA('Pronto'); setStatusB('Pronto');
  }

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
      await audio.play().catch(() => browserSpeak(text, lang));
    } catch { browserSpeak(text, lang); }
  }

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  // ── SETUP ──
  if (view === 'setup') return (
    <div style={S.center}>
      <div style={{fontSize:56}}>🌐</div>
      <div style={S.title}>VoiceTranslate</div>
      <div style={S.sub}>Traduttore vocale in tempo reale</div>
      <div style={S.sec}>
        <div style={S.lbl}>LA TUA LINGUA</div>
        <select style={S.sel} value={langA} onChange={e=>setLangA(e.target.value)}>
          {LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>
      <button style={S.swp} onClick={()=>{const t=langA;setLangA(langB);setLangB(t);}}>⇅</button>
      <div style={S.sec}>
        <div style={S.lbl}>ALTRA PERSONA</div>
        <select style={S.sel} value={langB} onChange={e=>setLangB(e.target.value)}>
          {LANGS.map(l=><option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>
      <button style={S.btn} onClick={()=>setView('translate')}>Avvia Traduttore ▶</button>
      <div style={S.note}>Metti il telefono tra te e l'altra persona. Ognuno parla dal suo lato.</div>
    </div>
  );

  // ── TRANSLATOR ──
  return (
    <div style={S.room}>
      {/* TOP = Language A */}
      <div style={{...S.half, background:'linear-gradient(180deg,#1a1a2e,#12122a)'}}>
        <div style={S.hdr}>
          <span style={{fontSize:22}}>{lA.flag}</span>
          <span style={{fontWeight:600}}>{lA.name}</span>
          <span style={{marginLeft:'auto',fontSize:11,color:'#fff6'}}>{statusA}</span>
        </div>
        <div style={S.msgs}>
          {msgsA.length===0 && <div style={S.empty}>Tieni premuto 🎤 per parlare</div>}
          {msgsA.map((m,i)=><div key={i} style={{...S.msgBox, ...(m.isTrans?S.trans:S.orig)}}>{m.text}</div>)}
        </div>
        <div style={S.tWrap}>
          <button style={{...S.tBtn,...(activeSide==='a'?S.tRec:{})}}
            disabled={activeSide && activeSide!=='a'}
            onTouchStart={e=>startTalk('a',e)} onTouchEnd={e=>stopTalk('a',e)}
            onMouseDown={e=>startTalk('a',e)} onMouseUp={e=>stopTalk('a',e)}>🎤</button>
        </div>
      </div>

      <div style={{height:2,background:'linear-gradient(90deg,#e94560,#0f3460)',flexShrink:0,position:'relative'}}>
        <div style={{position:'absolute',top:'50%',right:12,transform:'translateY(-50%)',display:'flex',gap:6}}>
          <button style={S.iBtn} onClick={()=>setFlipped(!flipped)}>🔄</button>
          <button style={S.iBtn} onClick={()=>setView('setup')}>⚙️</button>
        </div>
      </div>

      {/* BOTTOM = Language B */}
      <div style={{...S.half, background:'linear-gradient(0deg,#16213e,#0d1b36)',
        ...(flipped?{transform:'rotate(180deg)'}:{})}}>
        <div style={S.hdr}>
          <span style={{fontSize:22}}>{lB.flag}</span>
          <span style={{fontWeight:600}}>{lB.name}</span>
          <span style={{marginLeft:'auto',fontSize:11,color:'#fff6'}}>{statusB}</span>
        </div>
        <div style={S.msgs}>
          {msgsB.length===0 && <div style={S.empty}>Hold 🎤 to speak</div>}
          {msgsB.map((m,i)=><div key={i} style={{...S.msgBox, ...(m.isTrans?S.trans:S.orig)}}>{m.text}</div>)}
        </div>
        <div style={S.tWrap}>
          <button style={{...S.tBtn,...(activeSide==='b'?S.tRec:{})}}
            disabled={activeSide && activeSide!=='b'}
            onTouchStart={e=>startTalk('b',e)} onTouchEnd={e=>stopTalk('b',e)}
            onMouseDown={e=>startTalk('b',e)} onMouseUp={e=>stopTalk('b',e)}>🎤</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  center:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
    height:'100vh',padding:24,background:'linear-gradient(135deg,#0a0a0f,#1a1a2e 50%,#16213e)',color:'#fff'},
  title:{fontSize:32,fontWeight:800,background:'linear-gradient(90deg,#e94560,#0f3460)',
    WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'},
  sub:{color:'#fff9',fontSize:14,marginBottom:28},
  sec:{width:'100%',maxWidth:360,marginBottom:16},
  lbl:{fontSize:11,textTransform:'uppercase',letterSpacing:1,color:'#fff9',marginBottom:6},
  sel:{width:'100%',padding:'13px 16px',borderRadius:12,background:'#fff1',border:'1px solid #fff2',color:'#fff',fontSize:15},
  swp:{width:44,height:44,borderRadius:'50%',background:'#fff1',border:'1px solid #fff2',color:'#fff',fontSize:20,cursor:'pointer',marginBottom:10},
  btn:{width:'100%',maxWidth:360,padding:15,borderRadius:14,border:'none',
    background:'linear-gradient(135deg,#e94560,#c23152)',color:'#fff',fontSize:17,fontWeight:700,cursor:'pointer'},
  note:{color:'#fff5',fontSize:11,marginTop:14,maxWidth:360,textAlign:'center'},
  room:{display:'flex',flexDirection:'column',height:'100vh',width:'100%',background:'#0a0a0f',color:'#fff',
    touchAction:'manipulation'},
  half:{flex:1,display:'flex',flexDirection:'column',padding:'10px 16px',overflow:'hidden',minHeight:0},
  hdr:{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexShrink:0},
  msgs:{flex:1,overflowY:'auto',minHeight:0},
  empty:{color:'#fff5',fontSize:13,textAlign:'center',marginTop:16},
  msgBox:{padding:'6px 10px',borderRadius:10,marginBottom:4,maxWidth:'85%',fontSize:15,lineHeight:1.4},
  orig:{background:'#fff1',color:'#fffc',fontStyle:'italic'},
  trans:{background:'rgba(233,69,96,0.2)',color:'#fff',fontWeight:600,fontSize:17},
  tWrap:{display:'flex',justifyContent:'center',flexShrink:0,paddingBottom:6},
  tBtn:{width:68,height:68,borderRadius:'50%',border:'3px solid #fff3',background:'#fff1',
    color:'#fff',fontSize:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  tRec:{borderColor:'#e94560',background:'rgba(233,69,96,0.3)',boxShadow:'0 0 0 8px rgba(233,69,96,0.2)'},
  iBtn:{width:32,height:32,borderRadius:'50%',background:'#0a0a0f',border:'1px solid #fff2',
    color:'#fff',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
};

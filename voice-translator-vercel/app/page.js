'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const LANGS = [
  { code:'it', name:'Italiano', flag:'\u{1F1EE}\u{1F1F9}', speech:'it-IT' },
  { code:'th', name:'\u0E44\u0E17\u0E22 (Thai)', flag:'\u{1F1F9}\u{1F1ED}', speech:'th-TH' },
  { code:'en', name:'English', flag:'\u{1F1EC}\u{1F1E7}', speech:'en-US' },
  { code:'es', name:'Espa\u00F1ol', flag:'\u{1F1EA}\u{1F1F8}', speech:'es-ES' },
  { code:'fr', name:'Fran\u00E7ais', flag:'\u{1F1EB}\u{1F1F7}', speech:'fr-FR' },
  { code:'de', name:'Deutsch', flag:'\u{1F1E9}\u{1F1EA}', speech:'de-DE' },
  { code:'pt', name:'Portugu\u00EAs', flag:'\u{1F1E7}\u{1F1F7}', speech:'pt-BR' },
  { code:'zh', name:'\u4E2D\u6587', flag:'\u{1F1E8}\u{1F1F3}', speech:'zh-CN' },
  { code:'ja', name:'\u65E5\u672C\u8A9E', flag:'\u{1F1EF}\u{1F1F5}', speech:'ja-JP' },
  { code:'ko', name:'\uD55C\uAD6D\uC5B4', flag:'\u{1F1F0}\u{1F1F7}', speech:'ko-KR' },
  { code:'ar', name:'\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag:'\u{1F1F8}\u{1F1E6}', speech:'ar-SA' },
  { code:'hi', name:'\u0939\u093F\u0928\u094D\u0926\u0940', flag:'\u{1F1EE}\u{1F1F3}', speech:'hi-IN' },
  { code:'ru', name:'\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag:'\u{1F1F7}\u{1F1FA}', speech:'ru-RU' },
  { code:'tr', name:'T\u00FCrk\u00E7e', flag:'\u{1F1F9}\u{1F1F7}', speech:'tr-TR' },
  { code:'vi', name:'Ti\u1EBFng Vi\u1EC7t', flag:'\u{1F1FB}\u{1F1F3}', speech:'vi-VN' },
  { code:'id', name:'Bahasa Indonesia', flag:'\u{1F1EE}\u{1F1E9}', speech:'id-ID' },
  { code:'ms', name:'Bahasa Melayu', flag:'\u{1F1F2}\u{1F1FE}', speech:'ms-MY' },
  { code:'nl', name:'Nederlands', flag:'\u{1F1F3}\u{1F1F1}', speech:'nl-NL' },
  { code:'pl', name:'Polski', flag:'\u{1F1F5}\u{1F1F1}', speech:'pl-PL' },
  { code:'sv', name:'Svenska', flag:'\u{1F1F8}\u{1F1EA}', speech:'sv-SE' },
  { code:'el', name:'\u0395\u03BB\u03BB\u03B7\u03BD\u03B9\u03BA\u03AC', flag:'\u{1F1EC}\u{1F1F7}', speech:'el-GR' },
  { code:'cs', name:'\u010Ce\u0161tina', flag:'\u{1F1E8}\u{1F1FF}', speech:'cs-CZ' },
  { code:'ro', name:'Rom\u00E2n\u0103', flag:'\u{1F1F7}\u{1F1F4}', speech:'ro-RO' },
  { code:'hu', name:'Magyar', flag:'\u{1F1ED}\u{1F1FA}', speech:'hu-HU' },
  { code:'fi', name:'Suomi', flag:'\u{1F1EB}\u{1F1EE}', speech:'fi-FI' },
];

const VOICES = ['alloy','echo','fable','onyx','nova','shimmer'];
const AVATARS = ['\u{1F9D1}\u200D\u{1F4BB}','\u{1F468}\u200D\u{1F4BC}','\u{1F469}\u200D\u{1F4BC}','\u{1F9D1}\u200D\u{1F3A8}','\u{1F468}\u200D\u{1F3EB}','\u{1F469}\u200D\u{1F3EB}','\u{1F9D1}\u200D\u{1F52C}','\u{1F468}\u200D\u{1F373}','\u{1F469}\u200D\u{1F680}','\u{1F9D1}\u200D\u{1F3A4}','\u{1F47D}','\u{1F916}'];

function getLang(code) { return LANGS.find(l => l.code === code) || LANGS[0]; }

export default function Home() {
  // --- State ---
  const [view, setView] = useState('loading');
  const [prefs, setPrefs] = useState({ name: '', lang: 'it', avatar: AVATARS[0], voice: 'nova', autoPlay: true });
  const [roomId, setRoomId] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [myLang, setMyLang] = useState('it');
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('');
  const [recording, setRecording] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const pollRef = useRef(null);
  const lastMsgRef = useRef(0);
  const msgsEndRef = useRef(null);

  // --- Load prefs on mount ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vt-prefs');
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (saved) {
        const p = JSON.parse(saved);
        setPrefs(p);
        setMyLang(p.lang);
        if (roomParam) {
          setJoinCode(roomParam.toUpperCase());
          setView('join');
        } else {
          setView('home');
        }
      } else {
        if (roomParam) {
          setJoinCode(roomParam.toUpperCase());
        }
        setView('welcome');
      }
    } catch { setView('welcome'); }
  }, []);

  // --- Auto-scroll messages ---
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Polling for messages ---
  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        // Poll messages
        const mRes = await fetch(`/api/messages?room=${rid}&after=${lastMsgRef.current}`);
        if (mRes.ok) {
          const { messages: newMsgs } = await mRes.json();
          if (newMsgs && newMsgs.length > 0) {
            setMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter(m => !ids.has(m.id));
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
            lastMsgRef.current = Math.max(...newMsgs.map(m => m.timestamp));
            // Auto-play latest translation for me
            const latest = newMsgs[newMsgs.length - 1];
            if (latest && latest.sender !== prefs.name && latest.translated && prefs.autoPlay) {
              speak(latest.translated, getLang(latest.targetLang).speech);
            }
          }
        }
        // Poll room info (heartbeat + check partner)
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', roomId: rid, name: prefs.name })
        });
        if (rRes.ok) {
          const { room } = await rRes.json();
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
        }
      } catch (e) { console.error('Poll error:', e); }
    }, 1500);
  }, [prefs.name, prefs.autoPlay]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // --- Save preferences ---
  function savePrefs(newPrefs) {
    setPrefs(newPrefs);
    setMyLang(newPrefs.lang);
    localStorage.setItem('vt-prefs', JSON.stringify(newPrefs));
  }

  // --- Create Room ---
  async function handleCreateRoom() {
    try {
      setStatus('Creazione stanza...');
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: prefs.name, lang: myLang })
      });
      if (!res.ok) throw new Error('Errore creazione');
      const { room } = await res.json();
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setView('lobby');
      startPolling(room.id);
      setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  // --- Join Room ---
  async function handleJoinRoom() {
    if (!joinCode.trim()) return;
    try {
      setStatus('Connessione...');
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: joinCode.trim().toUpperCase(), name: prefs.name, lang: myLang })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Stanza non trovata');
      }
      const { room } = await res.json();
      setRoomId(room.id);
      setRoomInfo(room);
      setMessages([]);
      setView('room');
      startPolling(room.id);
      setStatus('');
    } catch (e) { setStatus('Errore: ' + e.message); }
  }

  // --- Enter room from lobby ---
  function enterRoom() {
    setView('room');
  }

  // --- Leave Room ---
  function leaveRoom() {
    stopPolling();
    setRoomId(null);
    setRoomInfo(null);
    setMessages([]);
    setView('home');
  }

  // --- Recording ---
  async function startRecording(e) {
    e.preventDefault();
    if (recording) return;
    setRecording(true);
    setStatus('Ascoltando...');
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      recRef.current = new MediaRecorder(stream, { mimeType: mime });
      recRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recRef.current.start(100);
    } catch (err) {
      setStatus('Errore microfono: ' + err.message);
      setRecording(false);
    }
  }

  async function stopRecording(e) {
    e.preventDefault();
    if (!recording || !recRef.current) return;
    setStatus('Elaborazione...');

    recRef.current.onstop = async () => {
      recRef.current.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
      if (blob.size < 1000) { setRecording(false); setStatus(''); return; }

      const myL = getLang(myLang);
      // Find other language from room members or default
      let otherLangCode = myLang === 'it' ? 'th' : 'it';
      if (roomInfo && roomInfo.members) {
        const other = roomInfo.members.find(m => m.name !== prefs.name);
        if (other) otherLangCode = other.lang;
      }
      const otherL = getLang(otherLangCode);

      try {
        const form = new FormData();
        form.append('audio', blob, 'audio.webm');
        form.append('sourceLang', myL.code);
        form.append('targetLang', otherL.code);
        form.append('sourceLangName', myL.name);
        form.append('targetLangName', otherL.name);

        const res = await fetch('/api/process', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Errore server');
        const { original, translated } = await res.json();

        if (original && roomId) {
          // Send to room
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId,
              sender: prefs.name,
              original,
              translated,
              sourceLang: myL.code,
              targetLang: otherL.code
            })
          });
        }
      } catch (err) {
        setStatus('Errore: ' + err.message);
      }
      setRecording(false);
      setStatus('');
    };
    recRef.current.stop();
  }

  // --- TTS ---
  async function speak(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: prefs.voice || 'nova' })
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

  // --- Share ---
  function shareRoom() {
    const url = `${window.location.origin}?room=${roomId}`;
    if (navigator.share) {
      navigator.share({ title: 'VoiceTranslate', text: `Join my translation room: ${roomId}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setStatus('Link copiato!');
      setTimeout(() => setStatus(''), 2000);
    }
  }

  const qrUrl = roomId ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window!=='undefined'?window.location.origin:''}?room=${roomId}`)}` : '';

  // ========================================
  // VIEWS
  // ========================================

  if (view === 'loading') return <div style={S.page}><div style={S.center}><div style={{fontSize:48}}>...</div></div></div>;

  // --- WELCOME ---
  if (view === 'welcome') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={{fontSize:64, marginBottom:8}}>{'\u{1F30D}'}</div>
        <div style={S.title}>VoiceTranslate</div>
        <div style={S.sub}>Traduttore vocale in tempo reale</div>
        <div style={S.card}>
          <div style={S.cardTitle}>Benvenuto! Configura il tuo profilo</div>

          <div style={S.field}>
            <div style={S.label}>IL TUO NOME</div>
            <input style={S.input} placeholder="Come ti chiami?" value={prefs.name}
              onChange={e => setPrefs({...prefs, name: e.target.value})} maxLength={20} />
          </div>

          <div style={S.field}>
            <div style={S.label}>AVATAR</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar: a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {})}}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <div style={S.label}>LA TUA LINGUA</div>
            <select style={S.select} value={prefs.lang}
              onChange={e => setPrefs({...prefs, lang: e.target.value})}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          <div style={S.field}>
            <div style={S.label}>VOCE TRADUZIONE</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice: v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={S.label}>RIPRODUZIONE AUTOMATICA</span>
              <button onClick={() => setPrefs({...prefs, autoPlay: !prefs.autoPlay})}
                style={{...S.toggle, background: prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform: prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>

          <button style={{...S.btn, marginTop:16, opacity: prefs.name.trim()?1:0.5}}
            disabled={!prefs.name.trim()}
            onClick={() => { savePrefs(prefs); setView(joinCode ? 'join' : 'home'); }}>
            Iniziamo! {'\u25B6'}
          </button>
        </div>
      </div>
    </div>
  );

  // --- SETTINGS ---
  if (view === 'settings') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>&larr;</button>
          <span style={{fontWeight:700, fontSize:18}}>Impostazioni</span>
        </div>
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>IL TUO NOME</div>
            <input style={S.input} value={prefs.name}
              onChange={e => setPrefs({...prefs, name: e.target.value})} maxLength={20} />
          </div>

          <div style={S.field}>
            <div style={S.label}>AVATAR</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
              {AVATARS.map(a => (
                <button key={a} onClick={() => setPrefs({...prefs, avatar: a})}
                  style={{...S.avatarBtn, ...(prefs.avatar===a ? S.avatarSel : {})}}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <div style={S.label}>LA TUA LINGUA</div>
            <select style={S.select} value={prefs.lang}
              onChange={e => setPrefs({...prefs, lang: e.target.value})}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          <div style={S.field}>
            <div style={S.label}>VOCE TRADUZIONE</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
              {VOICES.map(v => (
                <button key={v} onClick={() => setPrefs({...prefs, voice: v})}
                  style={{...S.voiceBtn, ...(prefs.voice===v ? S.voiceSel : {})}}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div style={S.field}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={S.label}>RIPRODUZIONE AUTOMATICA</span>
              <button onClick={() => setPrefs({...prefs, autoPlay: !prefs.autoPlay})}
                style={{...S.toggle, background: prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform: prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>

          <button style={{...S.btn, marginTop:16}} onClick={() => { savePrefs(prefs); setView('home'); }}>
            Salva {'\u2713'}
          </button>
        </div>
      </div>
    </div>
  );

  // --- HOME ---
  if (view === 'home') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={{fontSize:48, marginBottom:4}}>{prefs.avatar}</div>
        <div style={{fontSize:20, fontWeight:700, marginBottom:2}}>Ciao, {prefs.name}!</div>
        <div style={{color:'#fff8', fontSize:13, marginBottom:28}}>{getLang(prefs.lang).flag} {getLang(prefs.lang).name}</div>

        <button style={S.bigBtn} onClick={handleCreateRoom}>
          <span style={{fontSize:28}}>{'\u2795'}</span>
          <div>
            <div style={{fontWeight:700, fontSize:16}}>Crea Stanza</div>
            <div style={{fontSize:12, color:'#fffa'}}>Avvia una nuova traduzione</div>
          </div>
        </button>

        <button style={{...S.bigBtn, background:'linear-gradient(135deg,#0f3460,#16213e)'}}
          onClick={() => setView('join')}>
          <span style={{fontSize:28}}>{'\u{1F517}'}</span>
          <div>
            <div style={{fontWeight:700, fontSize:16}}>Entra nella Stanza</div>
            <div style={{fontSize:12, color:'#fffa'}}>Inserisci il codice o scansiona il QR</div>
          </div>
        </button>

        <button style={S.settingsBtn} onClick={() => setView('settings')}>
          {'\u2699\uFE0F'} Impostazioni
        </button>

        {status && <div style={S.statusMsg}>{status}</div>}
      </div>
    </div>
  );

  // --- JOIN ---
  if (view === 'join') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => { setView('home'); setJoinCode(''); }}>&larr;</button>
          <span style={{fontWeight:700, fontSize:18}}>Entra nella Stanza</span>
        </div>
        <div style={S.card}>
          <div style={S.field}>
            <div style={S.label}>CODICE STANZA</div>
            <input style={{...S.input, textAlign:'center', fontSize:24, letterSpacing:6, textTransform:'uppercase'}}
              placeholder="ABC123" value={joinCode} maxLength={6}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} />
          </div>

          <div style={S.field}>
            <div style={S.label}>LA TUA LINGUA</div>
            <select style={S.select} value={myLang} onChange={e => setMyLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>

          <button style={{...S.btn, marginTop:12, opacity: joinCode.length>=4?1:0.5}}
            disabled={joinCode.length<4} onClick={handleJoinRoom}>
            Entra {'\u25B6'}
          </button>

          {status && <div style={S.statusMsg}>{status}</div>}
        </div>
      </div>
    </div>
  );

  // --- LOBBY (waiting for partner) ---
  if (view === 'lobby') return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={leaveRoom}>&larr;</button>
          <span style={{fontWeight:700, fontSize:18}}>La tua Stanza</span>
        </div>
        <div style={S.card}>
          <div style={{textAlign:'center', marginBottom:16}}>
            <div style={S.label}>CODICE STANZA</div>
            <div style={{fontSize:36, fontWeight:800, letterSpacing:8, color:'#e94560'}}>{roomId}</div>
          </div>

          <div style={{textAlign:'center', marginBottom:16}}>
            <img src={qrUrl} alt="QR Code" style={{width:180, height:180, borderRadius:12, background:'#fff', padding:8}} />
          </div>

          <div style={{textAlign:'center', marginBottom:12}}>
            <button style={S.shareBtn} onClick={shareRoom}>
              {'\u{1F4E4}'} Condividi Link
            </button>
          </div>

          <div style={{textAlign:'center', color:'#fff8', fontSize:13, marginBottom:12}}>
            {partnerConnected
              ? <span style={{color:'#4ecdc4'}}>{'\u2705'} Partner connesso! ({roomInfo?.members?.[1]?.name})</span>
              : <span>{'\u23F3'} In attesa dell{"'"}altra persona...</span>
            }
          </div>

          {partnerConnected && (
            <button style={S.btn} onClick={enterRoom}>
              Inizia a Tradurre {'\u25B6'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // --- ROOM (translator) ---
  if (view === 'room') {
    const partner = roomInfo?.members?.find(m => m.name !== prefs.name);
    const myL = getLang(myLang);
    const otherL = partner ? getLang(partner.lang) : getLang('en');

    return (
      <div style={S.roomPage}>
        {/* Header */}
        <div style={S.roomHeader}>
          <button style={S.backBtnSmall} onClick={leaveRoom}>&larr;</button>
          <div style={{flex:1, textAlign:'center'}}>
            <span style={{fontSize:14}}>{myL.flag} {myL.name}</span>
            <span style={{margin:'0 8px', color:'#e94560'}}>{'\u21C4'}</span>
            <span style={{fontSize:14}}>{otherL.flag} {otherL.name}</span>
          </div>
          <div style={{fontSize:11, color: partnerConnected ? '#4ecdc4' : '#ff6b6b'}}>
            {partnerConnected ? '\u{1F7E2}' : '\u{1F534}'}
          </div>
        </div>

        {/* Messages */}
        <div style={S.chatArea}>
          {messages.length === 0 && (
            <div style={{textAlign:'center', color:'#fff5', marginTop:40, fontSize:14}}>
              Tieni premuto il microfono per parlare.<br/>
              La traduzione apparir{"à"} qui.
            </div>
          )}
          {messages.map((m, i) => {
            const isMine = m.sender === prefs.name;
            return (
              <div key={m.id || i} style={{display:'flex', flexDirection:'column',
                alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom:12}}>
                <div style={{fontSize:11, color:'#fff6', marginBottom:2}}>
                  {isMine ? 'Tu' : m.sender}
                </div>
                <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                  <div style={{fontSize:15, fontWeight:600}}>{isMine ? m.original : m.translated}</div>
                  <div style={{fontSize:12, color:'#fff8', fontStyle:'italic', marginTop:3}}>
                    {isMine ? m.translated : m.original}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgsEndRef} />
        </div>

        {/* Push to talk */}
        <div style={S.talkBar}>
          {status && <div style={{fontSize:12, color:'#e94560', marginBottom:6}}>{status}</div>}
          <button style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {})}}
            onTouchStart={startRecording} onTouchEnd={stopRecording}
            onMouseDown={startRecording} onMouseUp={stopRecording}>
            <span style={{fontSize:28}}>{'\u{1F3A4}'}</span>
            <span style={{fontSize:12, marginTop:4}}>{recording ? 'Rilascia per inviare' : 'Tieni premuto'}</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ========================================
// STYLES
// ========================================
const S = {
  page: { minHeight:'100vh', background:'linear-gradient(135deg,#0a0a0f,#1a1a2e 50%,#16213e)', color:'#fff',
    fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' },
  center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    minHeight:'100vh', padding:'24px 16px' },
  title: { fontSize:32, fontWeight:800, background:'linear-gradient(90deg,#e94560,#c23152)',
    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:4 },
  sub: { color:'#fff9', fontSize:14, marginBottom:24 },
  card: { width:'100%', maxWidth:380, background:'rgba(255,255,255,0.06)', borderRadius:20,
    padding:'24px 20px', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)' },
  cardTitle: { fontSize:16, fontWeight:600, textAlign:'center', marginBottom:20, color:'#fffc' },
  field: { marginBottom:16 },
  label: { fontSize:11, textTransform:'uppercase', letterSpacing:1, color:'#fff9', marginBottom:6 },
  input: { width:'100%', padding:'12px 14px', borderRadius:12, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'12px 14px', borderRadius:12, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' },
  btn: { width:'100%', padding:'14px', borderRadius:14, border:'none',
    background:'linear-gradient(135deg,#e94560,#c23152)', color:'#fff', fontSize:16, fontWeight:700,
    cursor:'pointer', textAlign:'center' },
  bigBtn: { width:'100%', maxWidth:380, display:'flex', alignItems:'center', gap:14, padding:'18px 20px',
    borderRadius:16, border:'1px solid rgba(255,255,255,0.1)', color:'#fff', cursor:'pointer', marginBottom:12,
    background:'linear-gradient(135deg,#e94560,#c23152)', textAlign:'left' },
  settingsBtn: { marginTop:20, padding:'10px 20px', borderRadius:12, background:'transparent',
    border:'1px solid rgba(255,255,255,0.2)', color:'#fff9', fontSize:14, cursor:'pointer' },
  avatarBtn: { width:44, height:44, borderRadius:12, border:'2px solid transparent', background:'rgba(255,255,255,0.06)',
    fontSize:24, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  avatarSel: { borderColor:'#e94560', background:'rgba(233,69,96,0.15)' },
  voiceBtn: { padding:'6px 14px', borderRadius:20, border:'1px solid rgba(255,255,255,0.15)',
    background:'transparent', color:'#fff9', fontSize:13, cursor:'pointer', textTransform:'capitalize' },
  voiceSel: { borderColor:'#e94560', background:'rgba(233,69,96,0.2)', color:'#fff' },
  toggle: { width:44, height:24, borderRadius:12, border:'none', padding:2, cursor:'pointer',
    display:'flex', alignItems:'center', transition:'background 0.2s' },
  toggleDot: { width:20, height:20, borderRadius:10, background:'#fff', transition:'transform 0.2s' },
  topBar: { display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:380, marginBottom:20 },
  backBtn: { width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:20, cursor:'pointer' },
  shareBtn: { padding:'10px 24px', borderRadius:12, border:'1px solid rgba(255,255,255,0.2)',
    background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:14, cursor:'pointer' },
  statusMsg: { marginTop:12, fontSize:13, color:'#e94560', textAlign:'center' },
  // Room styles
  roomPage: { display:'flex', flexDirection:'column', height:'100vh', background:'#0a0a0f', color:'#fff',
    fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' },
  roomHeader: { display:'flex', alignItems:'center', padding:'10px 12px', background:'rgba(255,255,255,0.04)',
    borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 },
  backBtnSmall: { width:32, height:32, borderRadius:8, background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
    color:'#fff', fontSize:16, cursor:'pointer' },
  chatArea: { flex:1, overflowY:'auto', padding:'16px 12px', minHeight:0 },
  bubble: { maxWidth:'80%', padding:'10px 14px', borderRadius:16 },
  bubbleMine: { background:'rgba(233,69,96,0.2)', borderBottomRightRadius:4 },
  bubbleOther: { background:'rgba(15,52,96,0.5)', borderBottomLeftRadius:4 },
  talkBar: { flexShrink:0, padding:'12px 16px 24px', display:'flex', flexDirection:'column', alignItems:'center',
    background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.08)' },
  talkBtn: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    width:80, height:80, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.2)',
    background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer', touchAction:'manipulation' },
  talkBtnRec: { borderColor:'#e94560', background:'rgba(233,69,96,0.25)',
    boxShadow:'0 0 0 10px rgba(233,69,96,0.15), 0 0 0 20px rgba(233,69,96,0.08)' },
};

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
  const [partnerSpeaking, setPartnerSpeaking] = useState(false);
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioTestOk, setAudioTestOk] = useState(false);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const pollRef = useRef(null);
  const lastMsgRef = useRef(0);
  const msgsEndRef = useRef(null);
  const prefsRef = useRef(prefs);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const myLangRef = useRef(myLang);
  const roomInfoRef = useRef(roomInfo);

  // Keep refs in sync
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { roomInfoRef.current = roomInfo; }, [roomInfo]);

  // --- Unlock audio on first user interaction ---
  function unlockAudio() {
    if (audioUnlocked) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      // Also play a silent HTML audio
      const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      a.volume = 0.01;
      a.play().catch(() => {});
      setAudioUnlocked(true);
      console.log('Audio unlocked!');
    } catch (e) { console.log('Audio unlock failed:', e); }
  }

  // --- Test audio ---
  async function testAudio() {
    unlockAudio();
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Audio test OK!', voice: prefsRef.current.voice || 'nova' })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setAudioTestOk(true); };
      audio.onerror = () => { URL.revokeObjectURL(url); setAudioTestOk(false); };
      await audio.play();
      setAudioTestOk(true);
    } catch {
      // Fallback: browser speech
      if (typeof speechSynthesis !== 'undefined') {
        const u = new SpeechSynthesisUtterance('Audio test OK');
        u.lang = 'en-US'; u.rate = 0.9;
        speechSynthesis.speak(u);
        setAudioTestOk(true);
      } else {
        setAudioTestOk(false);
      }
    }
  }

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
        if (roomParam) setJoinCode(roomParam.toUpperCase());
        setView('welcome');
      }
    } catch { setView('welcome'); }
  }, []);

  // Auto-scroll
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Audio queue system ---
  async function queueAudio(text, lang) {
    audioQueueRef.current.push({ text, lang });
    processAudioQueue();
  }

  async function processAudioQueue() {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const { text, lang } = audioQueueRef.current.shift();
    try {
      await playTTS(text, lang);
    } catch (e) { console.error('Audio play error:', e); }
    isPlayingRef.current = false;
    processAudioQueue();
  }

  async function playTTS(text, lang) {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: prefsRef.current.voice || 'nova' })
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); reject(); };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          // Fallback to browser speech
          browserSpeak(text, lang);
          resolve();
        });
      });
    } catch {
      browserSpeak(text, lang);
    }
  }

  function browserSpeak(text, lang) {
    if (typeof speechSynthesis === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  // Play a specific message manually
  async function playMessage(msg) {
    unlockAudio();
    setPlayingMsgId(msg.id);
    // If it's my message, play the translated version (what partner hears)
    // If it's partner's message, play the translated version (what I should hear)
    const text = msg.translated;
    const lang = getLang(msg.targetLang).speech;
    await playTTS(text, lang);
    setPlayingMsgId(null);
  }

  // --- Polling ---
  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    lastMsgRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
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
            // Auto-play translations from partner
            for (const msg of newMsgs) {
              if (msg.sender !== prefsRef.current.name && msg.translated && prefsRef.current.autoPlay) {
                queueAudio(msg.translated, getLang(msg.targetLang).speech);
              }
            }
          }
        }
        // Heartbeat + room info
        const rRes = await fetch('/api/room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'heartbeat', roomId: rid, name: prefsRef.current.name })
        });
        if (rRes.ok) {
          const { room } = await rRes.json();
          setRoomInfo(room);
          setPartnerConnected(room.members.length >= 2);
          // Check if partner is speaking
          const partner = room.members.find(m => m.name !== prefsRef.current.name);
          if (partner && partner.speaking && (Date.now() - partner.speakingAt < 30000)) {
            setPartnerSpeaking(true);
          } else {
            setPartnerSpeaking(false);
          }
        }
      } catch (e) { console.error('Poll error:', e); }
    }, 1200);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function savePrefs(newPrefs) {
    setPrefs(newPrefs);
    setMyLang(newPrefs.lang);
    localStorage.setItem('vt-prefs', JSON.stringify(newPrefs));
  }

  // --- Notify server of speaking state ---
  async function setSpeakingState(rid, speaking) {
    try {
      await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speaking', roomId: rid, name: prefsRef.current.name, speaking })
      });
    } catch (e) { /* ignore */ }
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

  function enterRoom() { setView('room'); }

  function leaveRoom() {
    stopPolling();
    setRoomId(null);
    setRoomInfo(null);
    setMessages([]);
    setPartnerSpeaking(false);
    setView('home');
  }

  // --- Recording ---
  async function startRecording(e) {
    e.preventDefault();
    if (recording) return;
    unlockAudio(); // Unlock audio on user gesture!
    setRecording(true);
    setStatus('Ascoltando...');
    if (roomId) setSpeakingState(roomId, true);
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
      if (roomId) setSpeakingState(roomId, false);
    }
  }

  async function stopRecording(e) {
    e.preventDefault();
    if (!recording || !recRef.current) return;
    setStatus('Elaborazione...');
    if (roomId) setSpeakingState(roomId, false);

    recRef.current.onstop = async () => {
      recRef.current.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: recRef.current.mimeType });
      if (blob.size < 1000) { setRecording(false); setStatus(''); return; }

      // Use refs for current values (avoids stale closures)
      const currentMyLang = myLangRef.current;
      const currentRoomInfo = roomInfoRef.current;
      const currentPrefs = prefsRef.current;
      const myL = getLang(currentMyLang);

      // Find the other member's language from room info
      let otherLangCode = null;
      if (currentRoomInfo && currentRoomInfo.members) {
        const other = currentRoomInfo.members.find(m => m.name !== currentPrefs.name);
        if (other) otherLangCode = other.lang;
      }
      // Fallback: if no partner found, use a sensible default
      if (!otherLangCode) {
        otherLangCode = currentMyLang === 'en' ? 'it' : 'en';
      }
      const otherL = getLang(otherLangCode);

      console.log('Translation:', myL.code, '->', otherL.code, '| Room members:', currentRoomInfo?.members?.map(m => m.name + ':' + m.lang));

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
          await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId, sender: currentPrefs.name, original, translated,
              sourceLang: myL.code, targetLang: otherL.code
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

  // --- Share ---
  function shareRoom() {
    const url = `${window.location.origin}?room=${roomId}`;
    if (navigator.share) {
      navigator.share({ title: 'VoiceTranslate', text: `Entra nella traduzione: ${roomId}`, url });
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
      <div style={S.scrollCenter}>
        <div style={{fontSize:48, marginBottom:4}}>{'\u{1F30D}'}</div>
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
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
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
              <span style={S.label}>AUTO-PLAY</span>
              <button onClick={() => setPrefs({...prefs, autoPlay: !prefs.autoPlay})}
                style={{...S.toggle, background: prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform: prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>
          <button style={{...S.btn, marginTop:12, opacity: prefs.name.trim()?1:0.5}}
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
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={() => setView('home')}>{'\u2190'}</button>
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
            <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
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
              <span style={S.label}>AUTO-PLAY</span>
              <button onClick={() => setPrefs({...prefs, autoPlay: !prefs.autoPlay})}
                style={{...S.toggle, background: prefs.autoPlay ? '#e94560' : '#333'}}>
                <div style={{...S.toggleDot, transform: prefs.autoPlay ? 'translateX(20px)' : 'translateX(0)'}} />
              </button>
            </div>
          </div>
          <button style={{...S.btn, marginTop:12}} onClick={() => { savePrefs(prefs); setView('home'); }}>
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
        <div style={{fontSize:44, marginBottom:4}}>{prefs.avatar}</div>
        <div style={{fontSize:18, fontWeight:700, marginBottom:2}}>Ciao, {prefs.name}!</div>
        <div style={{color:'#fff8', fontSize:13, marginBottom:24}}>{getLang(prefs.lang).flag} {getLang(prefs.lang).name}</div>
        <button style={S.bigBtn} onClick={handleCreateRoom}>
          <span style={{fontSize:24}}>{'\u2795'}</span>
          <div>
            <div style={{fontWeight:700, fontSize:15}}>Crea Stanza</div>
            <div style={{fontSize:11, color:'#fffa'}}>Avvia una nuova traduzione</div>
          </div>
        </button>
        <button style={{...S.bigBtn, background:'linear-gradient(135deg,#0f3460,#16213e)'}}
          onClick={() => setView('join')}>
          <span style={{fontSize:24}}>{'\u{1F517}'}</span>
          <div>
            <div style={{fontWeight:700, fontSize:15}}>Entra nella Stanza</div>
            <div style={{fontSize:11, color:'#fffa'}}>Inserisci il codice o scansiona il QR</div>
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
          <button style={S.backBtn} onClick={() => { setView('home'); setJoinCode(''); }}>{'\u2190'}</button>
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

  // --- LOBBY ---
  if (view === 'lobby') return (
    <div style={S.page}>
      <div style={S.scrollCenter}>
        <div style={S.topBar}>
          <button style={S.backBtn} onClick={leaveRoom}>{'\u2190'}</button>
          <span style={{fontWeight:700, fontSize:18}}>La tua Stanza</span>
        </div>
        <div style={S.card}>
          <div style={{textAlign:'center', marginBottom:12}}>
            <div style={S.label}>CODICE STANZA</div>
            <div style={{fontSize:32, fontWeight:800, letterSpacing:8, color:'#e94560'}}>{roomId}</div>
          </div>
          <div style={{textAlign:'center', marginBottom:12}}>
            <img src={qrUrl} alt="QR Code" style={{width:160, height:160, borderRadius:12, background:'#fff', padding:6}} />
          </div>
          <div style={{textAlign:'center', marginBottom:10}}>
            <button style={S.shareBtn} onClick={shareRoom}>
              {'\u{1F4E4}'} Condividi Link
            </button>
          </div>
          <div style={{textAlign:'center', color:'#fff8', fontSize:13, marginBottom:10}}>
            {partnerConnected
              ? <span style={{color:'#4ecdc4'}}>{'\u2705'} Partner connesso! ({roomInfo?.members?.[1]?.name})</span>
              : <span>{'\u23F3'} In attesa dell{"'"}altra persona...</span>
            }
          </div>
          {partnerConnected && (
            <button style={S.btn} onClick={() => { unlockAudio(); enterRoom(); }}>
              Inizia a Tradurre {'\u25B6'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // --- ROOM ---
  if (view === 'room') {
    const partner = roomInfo?.members?.find(m => m.name !== prefs.name);
    const myL = getLang(myLang);
    const otherL = partner ? getLang(partner.lang) : getLang('en');

    return (
      <div style={S.roomPage}>
        {/* Header */}
        <div style={S.roomHeader}>
          <button style={S.backBtnSmall} onClick={leaveRoom}>{'\u2190'}</button>
          <div style={{flex:1, textAlign:'center'}}>
            <span style={{fontSize:13}}>{myL.flag} {myL.name}</span>
            <span style={{margin:'0 6px', color:'#e94560'}}>{'\u21C4'}</span>
            <span style={{fontSize:13}}>{otherL.flag} {otherL.name}</span>
          </div>
          {/* Audio status indicator */}
          <button onClick={testAudio} style={S.audioIndicator}
            title={audioUnlocked ? 'Audio attivo - tocca per test' : 'Audio non attivo - tocca per attivare'}>
            {audioUnlocked ? '\u{1F50A}' : '\u{1F507}'}
          </button>
          <div style={{fontSize:10, color: partnerConnected ? '#4ecdc4' : '#ff6b6b', marginLeft:4}}>
            {partnerConnected ? '\u{1F7E2}' : '\u{1F534}'}
          </div>
        </div>

        {/* Partner speaking indicator */}
        {partnerSpeaking && (
          <div style={S.speakingBar}>
            <div style={S.speakingDots}>
              <span style={{...S.dot, animationDelay:'0s'}}/>
              <span style={{...S.dot, animationDelay:'0.2s'}}/>
              <span style={{...S.dot, animationDelay:'0.4s'}}/>
            </div>
            <span style={{fontSize:13}}>{partner?.name || 'Partner'} sta parlando...</span>
          </div>
        )}

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
                alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom:10}}>
                <div style={{fontSize:10, color:'#fff6', marginBottom:2}}>
                  {isMine ? 'Tu' : m.sender} {'\u2022'} {getLang(m.sourceLang).flag}{'\u2192'}{getLang(m.targetLang).flag}
                </div>
                <div style={{...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther)}}>
                  <div style={{fontSize:14, fontWeight:600, paddingRight:30}}>
                    {isMine ? m.original : m.translated}
                  </div>
                  <div style={{fontSize:11, color:'#fff8', fontStyle:'italic', marginTop:2}}>
                    {isMine ? m.translated : m.original}
                  </div>
                  {/* Play button */}
                  <button
                    onClick={() => playMessage(m)}
                    style={{...S.playBtn, ...(playingMsgId === m.id ? S.playBtnActive : {})}}>
                    {playingMsgId === m.id ? '\u{1F50A}' : '\u{1F509}'}
                  </button>
                </div>
              </div>
            );
          })}
          <div ref={msgsEndRef} />
        </div>

        {/* Status + Push to talk */}
        <div style={S.talkBar}>
          {status && <div style={{fontSize:12, color:'#e94560', marginBottom:4}}>{status}</div>}
          {!audioUnlocked && (
            <div style={{fontSize:11, color:'#ff9', marginBottom:4, textAlign:'center'}}>
              Tocca {'\u{1F50A}'} in alto o il microfono per attivare l{"'"}audio
            </div>
          )}
          <button style={{...S.talkBtn, ...(recording ? S.talkBtnRec : {})}}
            onTouchStart={startRecording} onTouchEnd={stopRecording}
            onMouseDown={startRecording} onMouseUp={stopRecording}>
            <span style={{fontSize:26}}>{'\u{1F3A4}'}</span>
            <span style={{fontSize:10, marginTop:2}}>{recording ? 'Rilascia per inviare' : 'Tieni premuto'}</span>
          </button>
        </div>

        {/* CSS animation for speaking dots */}
        <style>{`
          @keyframes vtPulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

// ========================================
// STYLES
// ========================================
const S = {
  page: { height:'100dvh', height:'100vh', background:'linear-gradient(135deg,#0a0a0f,#1a1a2e 50%,#16213e)', color:'#fff',
    fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif', overflow:'hidden', position:'fixed', top:0, left:0, right:0, bottom:0 },
  center: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    height:'100%', padding:'20px 16px', boxSizing:'border-box' },
  scrollCenter: { display:'flex', flexDirection:'column', alignItems:'center',
    height:'100%', padding:'20px 16px', boxSizing:'border-box', overflowY:'auto', WebkitOverflowScrolling:'touch',
    justifyContent:'safe center' },
  title: { fontSize:28, fontWeight:800, background:'linear-gradient(90deg,#e94560,#c23152)',
    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', marginBottom:2 },
  sub: { color:'#fff9', fontSize:13, marginBottom:16 },
  card: { width:'100%', maxWidth:380, background:'rgba(255,255,255,0.06)', borderRadius:16,
    padding:'18px 16px', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.1)' },
  cardTitle: { fontSize:15, fontWeight:600, textAlign:'center', marginBottom:14, color:'#fffc' },
  field: { marginBottom:12 },
  label: { fontSize:10, textTransform:'uppercase', letterSpacing:1, color:'#fff9', marginBottom:4 },
  input: { width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' },
  btn: { width:'100%', padding:'12px', borderRadius:12, border:'none',
    background:'linear-gradient(135deg,#e94560,#c23152)', color:'#fff', fontSize:15, fontWeight:700,
    cursor:'pointer', textAlign:'center' },
  bigBtn: { width:'100%', maxWidth:380, display:'flex', alignItems:'center', gap:12, padding:'14px 16px',
    borderRadius:14, border:'1px solid rgba(255,255,255,0.1)', color:'#fff', cursor:'pointer', marginBottom:10,
    background:'linear-gradient(135deg,#e94560,#c23152)', textAlign:'left' },
  settingsBtn: { marginTop:16, padding:'8px 18px', borderRadius:10, background:'transparent',
    border:'1px solid rgba(255,255,255,0.2)', color:'#fff9', fontSize:13, cursor:'pointer' },
  avatarBtn: { width:40, height:40, borderRadius:10, border:'2px solid transparent', background:'rgba(255,255,255,0.06)',
    fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  avatarSel: { borderColor:'#e94560', background:'rgba(233,69,96,0.15)' },
  voiceBtn: { padding:'5px 12px', borderRadius:16, border:'1px solid rgba(255,255,255,0.15)',
    background:'transparent', color:'#fff9', fontSize:12, cursor:'pointer', textTransform:'capitalize' },
  voiceSel: { borderColor:'#e94560', background:'rgba(233,69,96,0.2)', color:'#fff' },
  toggle: { width:44, height:24, borderRadius:12, border:'none', padding:2, cursor:'pointer',
    display:'flex', alignItems:'center', transition:'background 0.2s' },
  toggleDot: { width:20, height:20, borderRadius:10, background:'#fff', transition:'transform 0.2s' },
  topBar: { display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:380, marginBottom:14, flexShrink:0 },
  backBtn: { width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.08)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:18, cursor:'pointer' },
  shareBtn: { padding:'8px 20px', borderRadius:10, border:'1px solid rgba(255,255,255,0.2)',
    background:'rgba(255,255,255,0.06)', color:'#fff', fontSize:13, cursor:'pointer' },
  statusMsg: { marginTop:10, fontSize:12, color:'#e94560', textAlign:'center' },
  // Room
  roomPage: { display:'flex', flexDirection:'column', height:'100dvh', background:'#0a0a0f', color:'#fff',
    fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
    position:'fixed', top:0, left:0, right:0, bottom:0 },
  roomHeader: { display:'flex', alignItems:'center', padding:'8px 10px', background:'rgba(255,255,255,0.04)',
    borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 },
  backBtnSmall: { width:30, height:30, borderRadius:8, background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
    color:'#fff', fontSize:14, cursor:'pointer', flexShrink:0 },
  audioIndicator: { width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.06)',
    border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:14, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  speakingBar: { display:'flex', alignItems:'center', gap:8, padding:'6px 14px',
    background:'rgba(233,69,96,0.15)', borderBottom:'1px solid rgba(233,69,96,0.3)',
    color:'#e94560', fontSize:12, flexShrink:0 },
  speakingDots: { display:'flex', gap:3, alignItems:'center' },
  dot: { width:7, height:7, borderRadius:'50%', background:'#e94560',
    animation:'vtPulse 1.2s infinite ease-in-out', display:'inline-block' },
  chatArea: { flex:1, overflowY:'auto', padding:'12px 10px', minHeight:0, WebkitOverflowScrolling:'touch' },
  bubble: { maxWidth:'82%', padding:'8px 12px', borderRadius:14, position:'relative' },
  bubbleMine: { background:'rgba(233,69,96,0.2)', borderBottomRightRadius:4 },
  bubbleOther: { background:'rgba(15,52,96,0.5)', borderBottomLeftRadius:4 },
  playBtn: { position:'absolute', top:4, right:4, width:26, height:26, borderRadius:'50%',
    background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:12,
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  playBtnActive: { background:'rgba(233,69,96,0.4)' },
  talkBar: { flexShrink:0, padding:'8px 16px 16px', display:'flex', flexDirection:'column', alignItems:'center',
    background:'rgba(255,255,255,0.02)', borderTop:'1px solid rgba(255,255,255,0.08)' },
  talkBtn: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    width:72, height:72, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.2)',
    background:'rgba(255,255,255,0.06)', color:'#fff', cursor:'pointer', touchAction:'manipulation' },
  talkBtnRec: { borderColor:'#e94560', background:'rgba(233,69,96,0.25)',
    boxShadow:'0 0 0 8px rgba(233,69,96,0.15), 0 0 0 16px rgba(233,69,96,0.08)' },
};

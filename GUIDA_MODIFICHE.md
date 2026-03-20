# Guida Completa — Modifiche Voice Translator 2

**Progetto:** voice-translator2
**Repo:** https://github.com/tmwe-dev/voice-translator2
**Deploy:** https://voice-translator2.vercel.app
**Cartella sorgente:** `voice-translator-vercel/`

---

## Panoramica delle Modifiche

Sono state implementate 3 macro-feature:

1. **HomeView Redesign** — Pagina home trasformata in social hub
2. **Voice Call (audio-only)** — Chiamate vocali WebRTC senza video
3. **Interpreter Mode** — Traduzione simultanea bidirezionale (STT → Translate → TTS)

Tutti i 528 test passavano dopo le modifiche. Di seguito ogni file modificato/creato con le istruzioni esatte.

---

## FILE MODIFICATI

### 1. `app/components/HomeView.js` — RISCRITTURA COMPLETA

**Stato attuale:** 1013 righe con PRO/Free badges, tutorial, PWA install banner, notification prompt, referral system, share app.

**Obiettivo:** Riscrivere come "social hub" semplice (~818 righe).

**Cosa RIMUOVERE:**
- Tutto il sistema di badge PRO/Free/API (freeBadgeBg, proBadgeBg, apiBadgeBg e relativo JSX)
- TutorialOverlay e relativo import
- Banner installazione PWA (showInstallBanner, handleInstallApp, dismissInstallBanner)
- Prompt notifiche (notifPermission, requestNotifPermission)
- Sistema referral (referralCode e relativo JSX)
- Pannello "Share App" (showShareApp, shareAppLang, shareApp)
- Stats bar (crediti, account, voice clone, API key)
- Card tier/piano

**Cosa AGGIUNGERE:**
- **Top bar:** avatar + nome utente + flag lingua + voice picker dropdown + pulsante contatti + pulsante settings
- **Door CTA:** porta come pulsante principale per creare/entrare in una stanza (mantenere SVG porta esistente)
- **Due tab:** "Le mie" (chat personali) e "Mondo" (chat pubbliche — placeholder per ora)
- **Lista stanze attive** con pulsante rejoin
- **Amici online** con pallino verde e pulsante "Chatta"
- **Link alla cronologia chat**

**Nuovi props da aggiungere alla signature:**
```javascript
contacts, fetchContacts
```

**Import modificato:**
```javascript
import { memo, useState, useMemo, useEffect } from 'react';
import { VOICES, CONTEXTS, FONT, getLang, vibrate } from '../lib/constants.js';
```
(Rimossi: `useRef`, `LANGS`, `APP_URL`, `formatCredits`, `TutorialOverlay`)

**Struttura JSX della nuova HomeView:**
```
<div> (container principale)
  <!-- Top Bar -->
  <div> avatar | nome | flag lingua | voice picker dropdown | btn contatti | btn settings </div>

  <!-- Door CTA (porta SVG animata) -->
  <div onClick={handleCreateRoom}> ... porta SVG ... </div>

  <!-- Tabs: Le mie | Mondo -->
  <div>
    <button "Le mie" selected={tab===0} />
    <button "Mondo" selected={tab===1} />
  </div>

  <!-- Tab Content -->
  {tab === 0 ? (
    <>
      <!-- Stanze attive -->
      {activeRooms.map(room => <div> ... rejoin button ... </div>)}

      <!-- Amici Online -->
      {onlineFriends.map(friend => (
        <div> avatar | nome | pallino verde | "Chatta" button </div>
      ))}

      <!-- Link cronologia -->
      <button onClick={() => setView('history')}> Cronologia chat </button>
    </>
  ) : (
    <!-- Mondo tab placeholder -->
    <div> Le chat pubbliche saranno disponibili presto </div>
  )}
</div>
```

**Voice Picker Dropdown:**
```javascript
const [showVoicePicker, setShowVoicePicker] = useState(false);
// Dropdown che mostra VOICES array ['alloy','echo','fable','onyx','nova','shimmer']
// Selezionando una voce aggiorna prefs.voice e chiama savePrefs
```

---

### 2. `app/hooks/useWebRTC.js` — AGGIUNTA AUDIO-ONLY MODE

**Stato attuale:** 781 righe, supporta solo video call.

**Modifiche da fare:**

**A) Aggiungere stato `callType`:**
```javascript
const [callType, setCallType] = useState(null); // 'voice' | 'video' | null
const callTypeRef = useRef(null);
```

**B) Modificare `initiateConnection`:**
```javascript
const initiateConnection = useCallback(async (withVideo = false) => {
  const type = withVideo ? 'video' : 'voice';
  setCallType(type);
  callTypeRef.current = type;
  // ... resto invariato, passa withVideo nel signal ...
}, [/* deps */]);
```

**C) Modificare handler `call-accepted`:**
Dentro la creazione del RTCPeerConnection, condizionare il video transceiver:
```javascript
const wantVideo = callTypeRef.current === 'video';
pc.addTransceiver('audio', { direction: 'sendrecv' });
if (wantVideo) {
  pc.addTransceiver('video', { direction: 'sendrecv' });
}
const stream = await getMediaWithFallback(wantVideo);
```

**D) Modificare `acceptIncomingCall`:**
Rilevare il tipo di chiamata dall'oggetto incomingCall:
```javascript
const type = incomingCall.withVideo ? 'video' : 'voice';
setCallType(type);
callTypeRef.current = type;
```

**E) Aggiornare auto-reconnect:**
Preservare il callType durante la riconnessione:
```javascript
await sendSignal('call-request', {
  withVideo: callTypeRef.current === 'video',
  reconnect: true
});
```

**F) Aggiungere `callType` al return object:**
```javascript
return {
  // ... tutto l'esistente ...
  callType,  // NUOVO
};
```

---

### 3. `app/components/RoomView.js` — VOICE CALL + INTERPRETER

**Stato attuale:** 1068 righe, solo video call.

**Modifiche da fare:**

**A) Aggiungere import VoiceCallOverlay:**
```javascript
import VoiceCallOverlay from './VoiceCallOverlay.js';
```

**B) Aggiungere stato `showVoiceCall`:**
```javascript
const [showVoiceCall, setShowVoiceCall] = useState(false);
```

**C) Auto-apertura voice vs video call:**
```javascript
useEffect(() => {
  const state = webrtc?.webrtcState;
  if (state === 'connected') {
    const type = webrtc?.callType;
    if (type === 'voice') {
      setShowVoiceCall(true);
      setShowVideoCall(false);
    } else {
      if (!showVideoCall) setShowVideoCall(true);
      if (!videoFullscreen) setVideoFullscreen(true);
    }
  }
}, [webrtc?.webrtcState]);
```

**D) Separare pulsanti voce e video nella toolbar:**
Dove c'è il pulsante video call, aggiungere un pulsante separato per voice call:

```javascript
{/* Voice call button - telefono 📞 */}
<button onClick={() => {
  if (webrtc.webrtcConnected && webrtc.callType === 'voice') {
    setShowVoiceCall(true);
  } else if (webrtc.webrtcState === 'idle') {
    webrtc.initiateConnection(false); // audio-only
  }
}} title="Voice call">
  <Icon name="phone" size={18} /> {/* o SVG telefono */}
</button>

{/* Video call button - videocamera 📹 (già esistente) */}
<button onClick={() => {
  if (!showVideoCall) {
    setShowVideoCall(true);
    if (webrtc.webrtcState === 'idle') webrtc.initiateConnection(true);
  } else {
    setShowVideoCall(false);
  }
}} title="Video call">
  ...icona video esistente...
</button>
```

**E) Modificare incoming call banner per distinguere voce/video:**
```javascript
{webrtc?.incomingCall && (() => {
  const isVideo = webrtc.incomingCall.withVideo !== false;
  return (
    <div style={{/* banner styles */}}>
      <div>
        {isVideo ? '📹' : '📞'} {webrtc.incomingCall.from}
        {isVideo ? L('videoCallIncoming') : L('voiceCallIncoming')}
      </div>
      <div>
        <button onClick={() => webrtc.declineIncomingCall()}>Rifiuta</button>
        <button onClick={() => {
          webrtc.acceptIncomingCall();
          if (isVideo) {
            setShowVideoCall(true);
            setVideoFullscreen(true);
          }
          // Per voice call, l'auto-open useEffect gestisce tutto
        }}>Accetta</button>
      </div>
    </div>
  );
})()}
```

**F) Scollegare interpreter dal video:**
Il pulsante interpreter NON deve più richiedere `showVideoCall`. Deve funzionare sia su voice che video call.
Rimuovere qualsiasi condizione tipo `if (!showVideoCall) setShowVideoCall(true)` dal toggle interpreter.

**G) Renderizzare VoiceCallOverlay:**
```javascript
{showVoiceCall && webrtc?.webrtcConnected && webrtc?.callType === 'voice' && (
  <VoiceCallOverlay
    webrtc={webrtc}
    partner={partner}
    getSenderAvatar={getSenderAvatar}
    S={S}
    partnerVolume={partnerVolume}
    setPartnerVolume={setPartnerVolume}
    partnerSpeaking={partnerSpeaking}
    partnerTyping={partnerTyping}
    interpreterActive={interpreterActive}
    setInterpreterActive={setInterpreterActive}
    interpreter={interpreter}
    onClose={() => setShowVoiceCall(false)}
    onUpgradeToVideo={() => {
      setShowVoiceCall(false);
      setShowVideoCall(true);
      setVideoFullscreen(true);
      // Aggiungere video transceiver alla connessione esistente
    }}
  />
)}
```

---

### 4. `app/components/Icon.js` — AGGIUNGERE ICONA

**Modifica:** Aggiungere `chevRight` all'oggetto `paths`:
```javascript
chevRight: 'M9 18l6-6-6-6',
```

---

### 5. `app/page.js` — PASSARE CONTACTS A HOMEVIEW

**Modifica:** Aggiungere `contacts` e `fetchContacts` ai props di HomeView:
```javascript
<HomeView
  // ... tutti i props esistenti ...
  contacts={contactsHook.contacts}
  fetchContacts={contactsHook.fetchContacts}
/>
```

---

## FILE NUOVI DA CREARE

### 6. `app/components/VoiceCallOverlay.js` — NUOVO (~148 righe)

UI full-screen per chiamate audio-only.

**Props:**
```javascript
export default function VoiceCallOverlay({
  webrtc, partner, getSenderAvatar, S,
  partnerVolume, setPartnerVolume,
  partnerSpeaking, partnerTyping,
  interpreterActive, setInterpreterActive, interpreter,
  onClose, onUpgradeToVideo,
})
```

**Struttura JSX:**
```
<div> (fullscreen overlay, sfondo scuro glassmorphism)
  <!-- Header: "Voice Call" + timer durata -->
  <div> Chiamata vocale — 00:00 </div>

  <!-- Centro: Avatar partner con onde audio animate -->
  <div style={centro}>
    <div> (cerchi concentrici animati quando partnerSpeaking)
      <Avatar partner />
      <span>{partner.name}</span>
    </div>
  </div>

  <!-- Sottotitoli interpreter (se attivo) -->
  {interpreterActive && interpreter?.lastSubtitle && (
    <div>{interpreter.lastSubtitle}</div>
  )}

  <!-- Volume slider (0-200%) sulla destra -->
  <input type="range" min={0} max={2} step={0.01}
    value={partnerVolume} onChange={e => setPartnerVolume(e.target.value)} />

  <!-- Controlli in basso -->
  <div style={bottomBar}>
    <button mute onClick={webrtc.toggleAudio}>
      <Icon name={webrtc.audioEnabled ? 'mic' : 'mute'} />
    </button>
    <button interpreter onClick={() => setInterpreterActive(!interpreterActive)}>
      <Icon name="globe" />
    </button>
    <button upgrade-to-video onClick={onUpgradeToVideo}>
      📹
    </button>
    <button end-call onClick={() => { webrtc.disconnect(); onClose(); }}
      style={{background:'red'}}>
      📞
    </button>
  </div>
</div>
```

**Timer durata:**
```javascript
const [duration, setDuration] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setDuration(d => d + 1), 1000);
  return () => clearInterval(interval);
}, []);
const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
```

**Onde audio animate (CSS):**
```css
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.4; }
  100% { transform: scale(1.5); opacity: 0; }
}
/* 3 cerchi concentrici con delay diversi, attivi solo quando partnerSpeaking */
```

---

### 7. `app/hooks/useInterpreterMode.js` — NUOVO (~487 righe)

Hook per traduzione simultanea bidirezionale.

**Firma:**
```javascript
export default function useInterpreterMode({
  webrtc, myLang, partnerLang, roomId, userToken, useOwnKeys
})
```

**Funzionamento:**
1. Cattura audio locale in chunk da 3 secondi via MediaRecorder
2. Invia ogni chunk all'API STT (Speech-to-Text) per trascrizione
3. Invia il testo trascritto all'API Translate
4. Invia la traduzione all'API TTS (Text-to-Speech)
5. Riproduce l'audio TTS sul lato del partner via DataChannel
6. Mostra i sottotitoli via DataChannel

**State:**
```javascript
const [active, setActive] = useState(false);
const [mySubtitles, setMySubtitles] = useState([]);
const [partnerSubtitles, setPartnerSubtitles] = useState([]);
const [lastSubtitle, setLastSubtitle] = useState(null);
```

**Return:**
```javascript
return {
  active, setActive,
  mySubtitles, partnerSubtitles,
  lastSubtitle,
  start: startInterpreter,
  stop: stopInterpreter,
};
```

**Flusso tecnico dettagliato:**
- MediaRecorder con `mimeType: 'audio/webm;codecs=opus'`
- Chunk ogni 3000ms via `timeslice` parameter
- `ondataavailable` → blob → fetch POST `/api/transcribe`
- Testo trascritto → fetch POST `/api/translate`
- Testo tradotto → fetch POST `/api/tts-edge` → audio blob
- Audio blob → `webrtc.sendDirectMessage({ type: 'interpreter-audio', data: base64 })`
- Sottotitoli → `webrtc.sendDirectMessage({ type: 'interpreter-subtitle', text: ... })`

---

### 8. `app/components/InterpreterView.js` — NUOVO (~350 righe)

Vista full-screen dell'interprete con sottotitoli.

**Props:**
```javascript
export default function InterpreterView({
  interpreter, webrtc, partner, S, L,
  onClose
})
```

**Struttura:**
- Sfondo full-screen con sottotitoli scorrevoli
- Due colonne: testo originale (sinistra) e tradotto (destra)
- Controlli auto-hiding: volume, pausa, chiudi
- Auto-scroll dei sottotitoli

---

## ALTRI FILE MODIFICATI (minori)

Questi file avevano modifiche nella sessione precedente ma il summary non contiene i dettagli esatti del codice. Sono elencati per completezza:

- `app/components/AudioQueue.js`
- `app/components/ConnectionQuality.js`
- `app/components/HistoryView.js`
- `app/components/Icons.js`
- `app/components/JoinView.js`
- `app/components/LobbyView.js`
- `app/components/MessageList.js`
- `app/components/SettingsView.js`
- `app/components/VideoCallOverlay.js`
- `app/hooks/useTranslation.js`
- `app/hooks/useTranslationAPI.js`
- `app/lib/constants.js`
- `app/lib/edgeVoices.js`
- `app/lib/i18n.js`
- `app/lib/roomActions.js`
- `app/lib/store.js`
- `app/lib/styles.js`
- `app/lib/validate.js`
- `.gitignore`
- `middleware.js`
- `package-lock.json`
- `public/manifest.json`
- `public/sw.js`

E questi file nuovi:
- `app/api/chat-action/route.js`
- `app/api/provider-route/route.js`
- `app/components/ChatActionsPanel.js`
- `app/components/PermissionGuide.js`
- `app/components/ProviderBadge.js`
- `app/hooks/useLocalChat.js`
- `app/lib/chatActions.js`
- `app/lib/chatStorage.js`
- `app/lib/providerRouter.js`
- `app/lib/providers/` (intera cartella con asia/ e global/ backends)
- `app/lib/ttsRouter.js`
- `__tests__/lib/chatActions.test.js`
- `__tests__/lib/chatStorage.test.js`
- `__tests__/lib/providerRouter.test.js`
- `.env.asia.example`

---

## CONCETTI TECNICI CHIAVE

### WebRTC Audio-Only vs Video
- `callType: 'voice'` → solo `pc.addTransceiver('audio', { direction: 'sendrecv' })`
- `callType: 'video'` → audio + `pc.addTransceiver('video', { direction: 'sendrecv' })`
- Il segnale `call-request` include `{ withVideo: true/false }`

### Interpreter Mode
- Bidirezionale: entrambi parlano nella propria lingua
- STT → Translate → TTS in chunk da 3 secondi
- Audio tradotto inviato via DataChannel (base64)
- Sottotitoli inviati via DataChannel come JSON
- Funziona sia su voice call che video call (scollegato dal video)

### E2E Encryption
- ECDH key exchange dopo apertura DataChannel
- AES-GCM per cifrare messaggi
- Chiave derivata condivisa tra i due peer

### Design System
- Glassmorphism con palette theme-aware (dark/light/brown/orange)
- `getHomeColors(theme)` restituisce la palette completa
- Font system in `FONT` constant

---

## ISTRUZIONI PER IL DEPLOY

1. Applicare tutte le modifiche ai file nella cartella `voice-translator-vercel/`
2. Eseguire i test: `cd voice-translator-vercel && npx jest --passWithNoTests`
3. Commit: `git add -A && git commit -m "Voice calls, interpreter, HomeView social hub"`
4. Push: `git push origin main`
5. Vercel farà il deploy automatico dal push su main

---

## NOTE IMPORTANTI

- Il token GitHub PAT: configurato localmente via `git remote set-url` (non salvare qui per sicurezza)
- Il progetto Vercel è: `prj_k01GU1JJ3Ges8p0bJjmejI5aHJPQ` nel team `team_TEHvZOZ0xhNUdU9tnVJ5GV73`
- Google Auth su Vercel non funziona ancora (env vars presenti ma auth fallisce)
- Le chat pubbliche/mondo sono solo placeholder per ora

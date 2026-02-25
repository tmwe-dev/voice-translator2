# VoiceTranslator - Guida Completa del Progetto

> **Ultimo aggiornamento:** 25 Febbraio 2026
> **Commit corrente:** `f574127`
> **URL produzione:** https://voice-translator2.vercel.app

---

## 1. PANORAMICA

App di traduzione vocale in tempo reale per 2 persone. Ogni utente parla nella propria lingua, l'app trascrive, traduce e riproduce audio nella lingua dell'altro. Supporta 24 lingue, 4 modalità di conversazione, 12 contesti tematici.

**Stack tecnologico:**
- Frontend: Next.js 14 App Router (single page `app/page.js`, ~2650 righe, client-side React)
- Backend: Next.js API Routes (serverless su Vercel)
- Database: Upstash Redis (REST API, no npm package)
- AI: OpenAI (Whisper STT, GPT-4o-mini traduzione, TTS-1 sintesi vocale)
- Pagamenti: Stripe Checkout (EUR)
- Auth: Magic code via email (Resend API)
- UI: Glassmorphism, 14 avatar SVG, icone emoji

---

## 2. STRUTTURA FILE

```
voice-translator-vercel/          ← Root Vercel
├── package.json                   (next 14.2.3, openai, react 18, stripe)
├── next.config.mjs                (vuoto, default)
├── .gitignore
├── PROJECT_GUIDE.md               (QUESTO FILE)
├── public/
│   └── avatars/
│       ├── 1.svg ... 14.svg       (avatar SVG)
└── app/
    ├── layout.js                   (layout base, metadata)
    ├── page.js                     (⭐ COMPONENTE PRINCIPALE ~2650 righe)
    ├── lib/
    │   ├── store.js                (Redis: rooms, messaggi, conversazioni)
    │   ├── users.js                (Redis: utenti, crediti, auth, pagamenti)
    │   └── i18n.js                 (traduzioni UI per 15 lingue)
    └── api/
        ├── room/route.js           (crea/join/heartbeat/speaking/changeMode)
        ├── messages/route.js       (invia/ricevi messaggi tradotti)
        ├── translate/route.js      (traduzione testo GPT-4o-mini)
        ├── process/route.js        (pipeline completa: Whisper→GPT→costo)
        ├── tts/route.js            (text-to-speech OpenAI TTS-1)
        ├── auth/route.js           (send-code/verify/me)
        ├── user/route.js           (profile/update/save-keys/credits/payments)
        ├── stripe/route.js         (crea checkout session)
        ├── stripe/webhook/route.js (webhook Stripe per accreditare crediti)
        ├── conversation/route.js   (end room e salva, lista cronologia)
        └── summary/route.js        (genera summary AI della conversazione)
```

---

## 3. VARIABILI D'AMBIENTE (Vercel)

```env
OPENAI_API_KEY=sk-proj-***                  (OpenAI API key - vedi Vercel dashboard)

UPSTASH_REDIS_REST_URL=https://climbing-wasp-54272.upstash.io
UPSTASH_REDIS_REST_TOKEN=***                (vedi Vercel dashboard)

STRIPE_PUBLISHABLE_KEY=pk_test_***          (Stripe publishable key)
STRIPE_SECRET_KEY=sk_test_***               (Stripe secret key)
STRIPE_WEBHOOK_SECRET=                      (opzionale, per validare webhook)

RESEND_API_KEY=                             (NON ANCORA CONFIGURATO - auth ritorna testCode)
RESEND_FROM=VoiceTranslator <noreply@resend.dev>
```

> **NOTA:** Tutte le chiavi reali sono configurate nel dashboard Vercel del progetto.
> Per accedervi: https://vercel.com → progetto voice-translator2 → Settings → Environment Variables

---

## 4. REPOSITORY GIT

```
Remote: https://github.com/tmwe-dev/voice-translator2.git
Vercel root directory: voice-translator-vercel
```

> Per clonare con accesso push, usa un GitHub Personal Access Token.

**Comandi deploy:**
```bash
cd voice-translator2/voice-translator-vercel
git add -A && git commit -m "messaggio" && git push
# Vercel fa deploy automatico su push
```

---

## 5. COMPONENTE PRINCIPALE (app/page.js)

### 5.1 Costanti Globali

- **APP_URL**: `https://voice-translator2.vercel.app` (hardcoded per QR code e link)
- **LANGS**: 24 lingue con code, name, flag emoji, speech locale
- **VOICES**: 6 voci OpenAI (alloy, echo, fable, onyx, nova, shimmer)
- **AVATARS**: 14 avatar SVG (`/avatars/1.svg` ... `/avatars/14.svg`)
- **AVATAR_NAMES**: nomi italiani per ogni avatar
- **MODES**: 4 modalità conversazione (conversation, classroom, freetalk, simultaneous)
- **CONTEXTS**: 12 contesti tematici (general, tourism, medical, education, business, restaurant, personal, legal, shopping, realestate, tech, emergency)
- **FONT**: Inter/SF Pro Display font stack
- **vibrate()**: helper per vibrazione aptica

### 5.2 Views (Navigazione Single-Page)

L'app usa un sistema di viste con `useState('view')`:

| View | Descrizione |
|------|-------------|
| `loading` | Schermata caricamento iniziale |
| `welcome` | Prima visita - scelta lingua e nome |
| `account` | Login/registrazione (email → code → choose name) con step: `email`, `code`, `choose` |
| `home` | Dashboard principale - crea room, join, cronologia, impostazioni |
| `join` | Inserisci codice room + nome (per invitati) |
| `lobby` | Sala d'attesa pre-conversazione (scelta mode, context, description) |
| `room` | ⭐ Conversazione attiva con chat e controlli audio |
| `history` | Lista conversazioni passate |
| `summary` | Dettaglio/summary AI di una conversazione |
| `credits` | Acquisto crediti (pacchetti Stripe) |
| `apikeys` | Configurazione API keys proprie |
| `settings` | Impostazioni (voce, avatar, lingua, autoplay, logout) |

### 5.3 Flusso di Init

1. `useEffect` su mount: legge `localStorage` per `vtPrefs` e `vtToken`
2. Se `?room=XXX` nel URL → view `join` (sempre, anche senza prefs)
3. Se `?payment=success` → accredita pagamento
4. Se ha token → verifica sessione con `/api/auth` action `me`
5. Se ha prefs salvate → view `home`
6. Altrimenti → view `welcome`

### 5.4 Sistema Audio

**Registrazione duale:**
1. `SpeechRecognition` (Web Speech API) per trascrizione in tempo reale (interim results visibili)
2. `MediaRecorder` parallelo che registra audio raw → inviato a Whisper come fallback

**Modalità conversazione:**
- **Conversation** (💬): Push-to-talk, registra → trascrive → traduce → TTS → invia messaggio
- **Classroom** (🏫): Come conversation, ottimizzato per contesto educativo
- **FreeTalk** (🎉): Registrazione continua, riconosce frasi e le processa una alla volta
- **Simultaneous** (⚡): Come FreeTalk ma con indicatore visivo LIVE e traduzione a chunk progressivi

**Pipeline messaggi:**
1. Utente parla → SpeechRecognition cattura testo (mostrato live)
2. Contemporaneamente MediaRecorder cattura audio
3. Testo inviato a `/api/translate` (GPT-4o-mini)
4. Audio tradotto generato da `/api/tts` (TTS-1)
5. Messaggio salvato via `/api/messages`
6. Partner riceve via polling (ogni 1.2s)
7. Audio auto-play se abilitato

### 5.5 Live Speech Broadcasting

- Quando uno parla, il testo interim viene inviato al server via `setSpeakingState()`
- Throttled a 800ms per evitare eccesso di chiamate API
- Il partner vede il testo live sotto indicatore typing dots (stile WhatsApp)
- Distingue speaking (🎙️) vs typing (⌨️)

### 5.6 i18n (Internazionalizzazione)

- `const L = (key) => t(prefs.lang, key)` definito nel render
- Tutte le stringhe UI usano `L('nomeChiave')`
- Callback usano `t(prefsRef.current?.lang||'en', key)`
- 15 lingue UI: it, en, es, fr, de, pt, zh, ja, ko, th, ar, hi, ru, tr, vi
- Fallback chain: lingua richiesta → en → it

### 5.7 Polling e Stato Room

- `pollInterval` ogni 1.2s: GET `/api/room?id=XXX` + GET `/api/messages?room=XXX&after=TIMESTAMP`
- Aggiorna: partner connesso, partner speaking, live text, typing state
- Heartbeat ogni 10s via `updateHeartbeat`
- Pulizia automatica partner inattivi (>30s senza heartbeat)

### 5.8 Haptic Feedback

- `vibrate(ms)` su click di: mic, send, create room, join room
- Default 15ms, personalizzabile

---

## 6. API ENDPOINTS

### 6.1 Room (`/api/room`)

**POST** - Actions: `create`, `join`, `heartbeat`, `speaking`, `changeMode`

```json
// create
{ "action": "create", "name": "Luca", "lang": "it", "mode": "conversation", "avatar": "/avatars/1.svg", "context": "tourism", "contextPrompt": "...", "description": "..." }
→ { "room": { "id": "ABC123", "members": [...], ... } }

// join
{ "action": "join", "roomId": "ABC123", "name": "Jane", "lang": "en", "avatar": "/avatars/3.svg" }

// heartbeat
{ "action": "heartbeat", "roomId": "ABC123", "name": "Luca" }

// speaking (con live text e typing)
{ "action": "speaking", "roomId": "ABC123", "name": "Luca", "speaking": true, "liveText": "ciao come...", "typing": false }

// changeMode
{ "action": "changeMode", "roomId": "ABC123", "mode": "simultaneous" }
```

**GET** `?id=ABC123` → room info

### 6.2 Messages (`/api/messages`)

**POST** `{ roomId, sender, original, translated, sourceLang, targetLang }`
**GET** `?room=ABC123&after=1708900000000`

### 6.3 Translate (`/api/translate`)

**POST** `{ text, sourceLang, targetLang, sourceLangName, targetLangName, roomId, context, isReview, domainContext, description, userToken }`
→ `{ translated, cost }`

- Usa API key dell'utente se `useOwnKeys=true`
- Altrimenti deduce crediti piattaforma
- Errore 402 se crediti esauriti

### 6.4 Process (`/api/process`)

**POST** FormData: `audio, sourceLang, targetLang, sourceLangName, targetLangName, roomId, domainContext, description, userToken`
→ `{ original, translated, cost }`

Pipeline: Whisper STT → GPT-4o-mini traduzione

### 6.5 TTS (`/api/tts`)

**POST** `{ text, voice }`
→ Binary audio/mpeg (MP3)

### 6.6 Auth (`/api/auth`)

**POST** Actions:
- `send-code`: `{ email }` → `{ ok, emailSent, testCode? }`
- `verify`: `{ email, code, name?, lang?, avatar? }` → `{ ok, token, user }`
- `me`: `{ token }` → `{ user }`

### 6.7 User (`/api/user`)

**POST** (richiede `token`):
- `profile` → user data (API keys mascherate)
- `update`: `{ name?, lang?, avatar? }`
- `save-keys`: `{ apiKeys: { openai, anthropic, gemini }, useOwnKeys }`
- `credits` → `{ credits, useOwnKeys }`
- `payments` → lista pagamenti

### 6.8 Stripe (`/api/stripe`)

**POST** `{ action: 'checkout', packageId: 'pack_5', token }`
→ `{ url, sessionId }` (redirect a Stripe Checkout)

### 6.9 Stripe Webhook (`/api/stripe/webhook`)

Riceve eventi `checkout.session.completed`, accredita crediti all'utente.

### 6.10 Conversation (`/api/conversation`)

**POST**:
- `end`: `{ roomId }` → salva conversazione con TTL 7 giorni
- `list`: `{ userName }` → lista conversazioni utente

**GET** `?id=ABC123` → conversazione completa con messaggi

### 6.11 Summary (`/api/summary`)

**POST** `{ convId }` → genera summary AI (GPT-4o-mini) con title, summary, keyPoints, topics, sentiment

---

## 7. DATA MODEL (Redis)

### Room (`room:{ID}`)
```json
{
  "id": "ABC123",
  "created": 1708900000000,
  "mode": "conversation",
  "host": "Luca",
  "members": [
    {
      "name": "Luca", "lang": "it", "joined": 1708900000000,
      "role": "host", "avatar": "/avatars/1.svg",
      "speaking": false, "speakingAt": 0,
      "liveText": "", "typing": false, "typingAt": 0,
      "lastSeen": 1708900050000
    }
  ],
  "context": "tourism",
  "contextPrompt": "...",
  "description": "...",
  "totalCost": 0.001234,
  "msgCount": 5,
  "ended": false
}
```
TTL: 7200s (2 ore)

### Messages (`msgs:{ID}`) - Redis List
```json
{ "id": "abc123xyz", "timestamp": 1708900010000, "sender": "Luca", "original": "Ciao", "translated": "Hello", "sourceLang": "it", "targetLang": "en" }
```
Max 200 messaggi, TTL 7200s

### User (`user:{email}`)
```json
{
  "email": "user@example.com",
  "name": "Luca",
  "lang": "it",
  "avatar": "/avatars/1.svg",
  "credits": 550,
  "totalSpent": 120,
  "totalMessages": 47,
  "apiKeys": { "openai": "sk-...", "anthropic": "", "gemini": "" },
  "useOwnKeys": false,
  "created": 1708800000000,
  "lastLogin": 1708900000000
}
```
Nessun TTL (persistente)

### Session (`session:{token}`) - TTL 7 giorni
### Auth Code (`authcode:{email}`) - TTL 10 minuti
### Conversation (`conv:{ID}`) - TTL 7 giorni
### Conversation List (`convlist:{userName}`) - TTL 7 giorni, max 50

---

## 8. SISTEMA CREDITI

| Pacchetto | Prezzo | Crediti (cent €) | Messaggi stimati | Bonus |
|-----------|--------|-----------------|------------------|-------|
| pack_2 | €2 | 200 | ~400 | - |
| pack_5 | €5 | 550 | ~1100 | +10% |
| pack_10 | €10 | 1200 | ~2400 | +20% |
| pack_20 | €20 | 2600 | ~5200 | +30% |

**Costi per messaggio (stima):**
- Traduzione testo: ~0.1-0.5 cent €
- Pipeline completa (Whisper+GPT+TTS): ~0.2-1.0 cent €
- Minimo addebito: 0.1 cent € (translate), 0.2 cent € (process)

---

## 9. i18n - LINGUE UI SUPPORTATE

15 lingue per l'interfaccia: Italiano, English, Español, Français, Deutsch, Português, 中文, 日本語, 한국어, ไทย, العربية, हिन्दी, Русский, Türkçe, Tiếng Việt

File: `app/lib/i18n.js` (~110+ chiavi per lingua)

Categorie chiavi principali:
- Navigazione: welcome, home, settings, credits, history, etc.
- Room: createRoom, joinRoom, startConversation, endRoom, etc.
- Modi: conversation, classroom, freeTalk, simultaneous + descrizioni
- Contesti: ctxGeneral, ctxTourism, ctxMedical, etc. + descrizioni
- Account: enterEmail, sendCode, enterCode, chooseYourName, etc.
- Crediti: buyCredits, yourCredit, useOwnKeys, etc.
- Status: translating, recording, playing, partnerSpeaking, etc.

---

## 10. FEATURES IMPLEMENTATE

### Core
- [x] Traduzione vocale bidirezionale in tempo reale (24 lingue)
- [x] 4 modalità: Conversazione, Classe, FreeTalk, Simultaneous
- [x] 12 contesti tematici con prompt specializzati
- [x] QR code per invitare partner
- [x] Chat con messaggi originali + tradotti
- [x] Auto-play audio traduzione
- [x] 6 voci TTS selezionabili
- [x] 14 avatar SVG

### Live & Social
- [x] Live text broadcasting (testo in tempo reale al partner)
- [x] Typing dots stile WhatsApp
- [x] Indicatore modo microfono attivo (LIVE per simultaneous)
- [x] Vibrazione aptica su click

### Account & Pagamenti
- [x] Auth magic code (email + 6 cifre)
- [x] Sistema crediti con 4 pacchetti
- [x] Stripe Checkout (EUR)
- [x] Opzione "usa le tue API keys" (OpenAI, Anthropic, Gemini)
- [x] Storico pagamenti
- [x] Storico conversazioni con summary AI

### UI/UX
- [x] Glassmorphism design
- [x] i18n completo (15 lingue UI)
- [x] Responsive mobile-first
- [x] Persistent mic stream (evita ripetute richieste permesso)
- [x] Dropdown contesti con icone

---

## 11. TODO / FEATURES DA IMPLEMENTARE

- [ ] **Resend API key**: Configurare per invio email reali (attualmente testCode in risposta)
- [ ] **Guest account prompt**: Mostrare invito registrazione in angolo per utenti invitati
- [ ] **Pacchetto €0.90**: Micro-pacchetto starter con crediti bonus per utenti low-income
- [ ] **PayPal**: Aggiungere come metodo di pagamento alternativo
- [ ] **Guide API keys**: Link/guide per aiutare utenti a creare account OpenAI/Anthropic/Gemini
- [ ] **Stripe production keys**: Passare da test a produzione
- [ ] **Dominio custom**: Configurare dominio personalizzato su Vercel

---

## 12. STILE UI

Design: Glassmorphism con sfondo gradient animato (#0a0a2e → #1a1a4e → #0f3460)

Elementi chiave:
- Container glassmorphism: `background: rgba(255,255,255,0.08)`, `backdrop-filter: blur(20px)`, `border: 1px solid rgba(255,255,255,0.15)`
- Bottoni primari: gradient `#667eea → #764ba2`
- Bottoni danger: gradient `#ff6b6b → #ee5a24`
- Bottoni success: gradient `#00b894 → #00cec9`
- Testo: bianco con opacità variabile
- Font: Inter / SF Pro Display
- Border radius: 16-20px per card, 12-14px per bottoni
- Avatar: cerchio 48-56px con bordo colorato per host/guest

---

## 13. COME CONTINUARE LO SVILUPPO

### Setup locale
```bash
git clone https://github.com/tmwe-dev/voice-translator2.git
cd voice-translator2/voice-translator-vercel
npm install
# Crea .env.local con le variabili della sezione 3
npm run dev
```

### Deploy
Push su main → Vercel deploya automaticamente.
Root directory su Vercel: `voice-translator-vercel`

### Architettura chiave da ricordare
1. **TUTTO in un file**: `page.js` contiene tutta la UI (~2650 righe). È un singolo componente React client-side.
2. **Redis via REST**: Nessun npm package per Redis. Tutto via fetch a Upstash REST API.
3. **Polling, non WebSocket**: La comunicazione tra utenti usa polling HTTP ogni 1.2s.
4. **Doppia registrazione audio**: SpeechRecognition (browser) + MediaRecorder (Whisper fallback).
5. **Crediti in euro-cents**: 200 crediti = €2.00. Costo medio per messaggio: ~0.5 cent.
6. **Token sessione in localStorage**: `vtToken` per auth, `vtPrefs` per preferenze.
7. **APP_URL hardcoded**: Non usare `window.location.origin` per link/QR (può dare URL preview Vercel).

### Pattern per aggiungere una nuova view
1. Aggiungi stato se serve in `useState` declarations
2. Aggiungi la view nel blocco `if (view === 'nuovaView')` in render
3. Aggiungi chiavi i18n in `app/lib/i18n.js` per tutte le 15 lingue
4. Usa `L('chiave')` per tutte le stringhe nella view

### Pattern per aggiungere un nuovo endpoint API
1. Crea `app/api/nomeendpoint/route.js`
2. Esporta `async function POST(req)` e/o `GET(req)`
3. Usa `NextResponse.json()` per le risposte
4. Per auth: `getSession(token)` da `users.js`
5. Per Redis: importa da `store.js` o `users.js`

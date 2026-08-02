# BarTalk — Fase 0: Audit e Mappa Completa

## 1. MAPPA DELLO STATO ATTUALE

### Architettura
- **Framework:** Next.js 15.5.22 App Router (SPA navigation via `view` state + `setView()`)
- **React:** 19.2.8
- **Data store primario:** Redis (Upstash REST API) — 12 Lua scripts per operazioni atomiche
- **Data store secondario:** Supabase (analytics, glossary, vault, webhook tracking)
- **Deploy:** Vercel, progetto `prj_k01GU1JJ3Ges8p0bJjmejI5aHJPQ`
- **URL:** https://voice-translator2.vercel.app
- **Test:** Vitest 4.x — 516 test, 30 file, tutti verdi

### Numeri chiave
- **43 API route** (4 stubs 410, 39 attive)
- **46 componenti** (42 attivi, 4 orfani)
- **26 hooks** (23 attivi, 3 orfani)
- **60 moduli lib/** (56 usati, 4 orfani)
- **21 viste** navigabili via `view` state
- **~50 pattern chiave Redis** con TTL vari

### Funzioni esistenti e loro stato

| # | Funzione | Stato | Componenti coinvolti | Note |
|---|----------|-------|---------------------|------|
| 1 | **Faccia a faccia (QR)** | FUNZIONANTE | HomeView → LobbyView → RoomView | Flusso completo: crea room → QR → join → chat tradotta |
| 2 | **Invito a distanza** | FUNZIONANTE | QuickInvite, ContactsView | Link/QR condivisibile, ingresso senza registrazione |
| 3 | **Videochiamata tradotta** | FUNZIONANTE | VideoCallOverlay, useWebRTC, useE2EEncryption | WebRTC P2P con E2EE, PiP, camera/mic controls |
| 4 | **Chiamata audio** | FUNZIONANTE | VoiceCallOverlay, useWebRTC | Audio-only con sottotitoli |
| 5 | **Interprete live** | FUNZIONANTE | InterpreterView, useInterpreterMode, useStreamingInterpreter | Sottotitoli streaming Deepgram + traduzione + TTS |
| 6 | **TaxiTalk** | PARZIALE | SpeakerView, TaxiMode | STT live + traduzione + mappa OSM, ma NO geocoding strutturato, NO QR destinazione, NO pagina tassista separata |
| 7 | **Community (Mondo)** | BASICA | MondoView | Solo lista room pubbliche con ricerca. NO ruoli, NO moderazione, NO categorie, NO "alza la mano" |
| 8 | **Contatti** | FUNZIONANTE | ContactsView, useContacts | CRUD, presenza online, inviti con regalo crediti |
| 9 | **Cronologia** | FUNZIONANTE | HistoryView, DetailView, SummaryView | Archivio conversazioni con riassunto AI |
| 10 | **Account/Auth** | FUNZIONANTE | AccountView, WelcomeView, useAuth | Email OTP, Google, Apple Sign-In |
| 11 | **Crediti/Pagamenti** | FUNZIONANTE | CreditsView, useAuth | Stripe Checkout, 5 pacchetti, atomicità Lua |
| 12 | **Impostazioni** | FUNZIONANTE | SettingsView | Voce, tema, account, strumenti, info — tutto in una pagina |
| 13 | **Voice Clone** | FUNZIONANTE | VoiceCloneView | ElevenLabs, 3 step wizard, Pro-tier gate |
| 14 | **Voice Studio** | FUNZIONANTE | VoiceTestView | ElevenLabs voice browser, preview, engine dashboard |
| 15 | **API Keys personali** | FUNZIONANTE | ApiKeysView | OpenAI, Anthropic, Gemini, ElevenLabs — encrypted vault |
| 16 | **AI Actions** | FUNZIONANTE | AIView, ChatActionsPanel | Summary, report, analysis, advice, vocabulary post-chat |
| 17 | **FreeTalk (VAD)** | FUNZIONANTE | useFreeTalkVAD, TalkControls | "Always listening" con noise gate |
| 18 | **Traduzione free** | FUNZIONANTE | useTranslationAPI | Microsoft/Google/MyMemory chain, 50K chars/day |
| 19 | **Traduzione consensus** | FUNZIONANTE | useTranslationAPI | 3 provider paralleli, scoring Levenshtein |
| 20 | **Glossario** | PARZIALE | SettingsView → /api/glossary | API completa, ma UI glossary nel frontend è minimale |
| 21 | **PWA/Push** | PARZIALE | usePWAInstall, useNotifications, sw.js | SW funzionale, ma push-subscribe usa Map in-memory (perde dati al cold start) |
| 22 | **Help/FAQ** | SOLO VISIVO | HelpView | Accordion FAQ statico, nessun sistema di supporto |
| 23 | **Admin** | FUNZIONANTE | admin/page.js, startrek/page.js | Dashboard admin, debug, analytics |

### Funzioni nel piano MA assenti

| Funzione dal piano | Stato attuale |
|---|---|
| TaxiTalk completo (geocoding, QR destinazione, pagina tassista) | Solo STT+traduzione+mappa base |
| Community con ruoli/moderazione/categorie | Solo lista room |
| Stanze protette (approvazione ingresso) | Non implementate |
| Stanze private con crittografia | WebRTC E2EE esiste ma solo per chiamate |
| "Alza la mano" completo | API esiste, UI minimale |
| Navigazione URL reali | Tutto su `/` con `view` state |
| Design system centralizzato | Stili inline, `styles.js` ma non componenti condivisi |
| BarTalk Direct (P2P senza cloud) | Non implementato |
| Traduzione on-device | Non implementato |
| Schermo invertito TaxiTalk | TaxiMode esiste ma basico |

---

## 2. DIFFERENZE RISPETTO AL PIANO

### Identità
- Il prodotto si chiama "VoiceTranslate" nel codice, "BarTalk" nel branding recente — **incoerenza**
- `APP_NAME` centralizzato non esiste ancora
- Il manifest, i metadati e il logging usano nomi diversi

### Navigazione
- **Piano:** 5 tab (Home, Conversazioni, Nuova, Community, Profilo) con route reali
- **Attuale:** 4 tab BottomNav (Home, Esplora, Archivio, Profilo) + tutto su `view` state in `page.js`
- Nessuna route reale — back browser non funziona, deep link impossibili

### Home
- **Piano:** "Con chi vuoi parlare?" con 4 azioni chiare
- **Attuale:** Talk button + language selector + nav cards + active rooms — mostra info tecniche

### TaxiTalk
- **Piano:** Flusso completo geocoding → QR → pagina tassista → navigatore
- **Attuale:** SpeakerView è un traduttore live con mappa OSM, non il flusso taxi descritto

### Community
- **Piano:** Pubblico/Protetto/Privato, ruoli, moderazione, categorie
- **Attuale:** MondoView è una lista flat di room pubbliche

### Privacy/E2EE
- **Piano:** BarTalk Direct con zero cloud, DataChannel, E2EE applicativa
- **Attuale:** E2EE esiste solo per WebRTC DataChannel (chiamate), non per messaggi di testo

---

## 3. COMPONENTI DA RIUTILIZZARE

| Componente | Perché riutilizzabile |
|---|---|
| `RoomView` + sub-components | Architettura solida, gestisce tutti i modi conversazione |
| `useWebRTC` + `useE2EEncryption` | Base per BarTalk Direct già presente |
| `useTranslation` pipeline | STT/traduzione/TTS chain completa e testata |
| `useTTSEngine` (4-engine fallback) | ElevenLabs > OpenAI > Edge > Browser già funzionante |
| `useRoomPolling` + `useRealtimeRoom` | Polling + Realtime Supabase per presenza |
| `store.js` + `redisLua.js` | Data access atomico con 12 Lua scripts |
| `apiGuard.js` | Rate limiting + body size + Sentry wrapper universale |
| `config.js` | Pricing, limiti, guard centralizzati |
| `logger.js` | Logging strutturato appena introdotto |
| `sw.js` | Service Worker completo (push, badge, cache, offline) |

---

## 4. COMPONENTI DA CONSOLIDARE

| Cosa | Azione |
|---|---|
| `BottomNav` → nuova navigazione 5 tab | Aggiungere tab Community e rinominare |
| `HomeView` → nuova Home "Con chi vuoi parlare?" | Ridisegnare gerarchia contenuti |
| `SettingsView` → 5 pagine separate | Dividere in Profile, Voice, Billing, Privacy, Advanced |
| `SpeakerView` → TaxiTalk dedicato | Estrarre logica taxi in componente separato |
| `MondoView` → Community completa | Estendere con ruoli, moderazione, categorie |
| `styles.js` → design tokens + componenti condivisi | Estrarre Page, Button, Card, Modal etc. |
| `view` state → route reali Next.js | Migrazione progressiva a App Router pages |

---

## 5. COMPONENTI OBSOLETI (candidati alla rimozione)

### Componenti orfani (0 import)
- `MainMenu.js` — sostituito da HomeView
- `ResultView.js` — mai usato
- `LiveSubtitles.js` — sostituito da InterpreterView
- `AudioQueue.js` — useAudioSystem ha la sua coda

### Hook orfani (0 import)
- `useVAD.js` — sostituito da useFreeTalkVAD
- `useRoomActions.js` — logica spostata inline in page.js
- `useDualPersist.js` — mai usato

### Lib orfani (0 import)
- `adaptiveVideo.js` — mai usato
- `memory.js` — mai usato
- `translationQuality.js` — mai usato
- `providerFactory.js` — mai usato (solo importa sttAsia.js internamente)
- `dualPersistence.js` — solo usato da useDualPersist (anche orfano)

### Endpoint 410 Gone (0 frontend caller)
- `/api/translate-stream`
- `/api/lending`
- `/api/provider-route`
- `/api/process`

**Totale: 15 file eliminabili senza rischio.**

---

## 6. RISCHI DI REGRESSIONE

| Rischio | Gravità | Mitigazione |
|---|---|---|
| Rinominare VoiceTranslate → BarTalk tocca manifest, SW, OG, metadati | MEDIA | Batch dedicato con grep esaustivo |
| Migrare da `view` state a route reali | ALTA | Una route alla volta, mantenendo fallback |
| Dividere SettingsView in 5 pagine | MEDIA | Estrarre senza cambiare logica |
| Ridisegnare HomeView | MEDIA | Feature flag per A/B |
| Toccare RoomView/useTranslation | ALTA | Test E2E obbligatori, 516 unit test già verdi |
| Implementare BarTalk Direct | ALTA | Nuova pipeline parallela, non toccare quella esistente |
| push-subscribe in-memory Map | BASSA | Già non persistente, migrare a Redis |

---

## 7. PROPOSTA DEL PRIMO BATCH (Fase 1: Identità)

### Obiettivo
Unificare l'identità del prodotto: "BarTalk" ovunque, versione unica, tagline unica.

### Interventi
1. Creare `app/lib/brand.js` con `APP_NAME`, `APP_VERSION`, `APP_TAGLINE`
2. Aggiornare `public/manifest.json` (name, short_name, description)
3. Aggiornare `app/layout.js` (metadata, title, description, OG)
4. Aggiornare `WelcomeView.js` (titoli, descrizioni)
5. Aggiornare `HomeView.js` (titoli, hero)
6. Aggiornare `HelpView.js` (riferimenti)
7. Aggiornare `sw.js` (offline page title)
8. Grep + sostituire "VoiceTranslate" → "BarTalk" in tutti i file

### Comportamento precedente
Nomi misti: VoiceTranslate, BarTalk, BarChat in vari punti.

### Comportamento nuovo
"BarTalk" unico ovunque, con tagline "Tu parli la tua lingua. L'altra persona sente la sua."

### Rischi
- OG image potrebbe avere testo hardcoded → verificare `/api/og`
- Email/inviti potrebbero avere riferimenti vecchi → grep

---

## 8. FILE CHE VERRANNO MODIFICATI (Batch 1)

```
NUOVO:  app/lib/brand.js
EDIT:   public/manifest.json
EDIT:   app/layout.js
EDIT:   app/components/WelcomeView.js
EDIT:   app/components/HomeView.js
EDIT:   app/components/HelpView.js
EDIT:   public/sw.js
EDIT:   app/api/og/route.js
EDIT:   Qualsiasi file risultante dal grep "VoiceTranslate"
```

---

## 9. TEST PREVISTI (Batch 1)

- `npx vitest run` — tutti i 516 test devono rimanere verdi
- Grep post-modifica: zero occorrenze di "VoiceTranslate" e "BarChat"
- Verifica visiva: manifest.json produce PWA con nome "BarTalk"
- Verifica OG image: titolo corretto
- Build pulita senza errori

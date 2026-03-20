# BARCHAT — Piano di Implementazione Completo

## Stato Attuale
Il sistema ha una base solida: 36 API, 17 hook, 27 componenti, 56 moduli lib.
Funzionano: auth 3-tier, WebRTC P2P, traduzione con fallback chain, TTS multi-engine, E2E encryption, Stripe billing, admin dashboard.

**Cosa manca** (perso dalla sessione precedente): tutto il sistema provider regionale, storage client-side, InterpreterView, classroom mode avanzato, espansione lingue, UI redesign completato.

---

## FASE 1 — Provider Router Intelligente
**Obiettivo**: Routing automatico per coppia linguistica. Qwen per CJK, OpenAI/Anthropic per EU, fallback chain.

### 1.1 Costanti Asia (`app/lib/providers/asia/asiaConstants.js`)
- Pricing Qwen: Flash $0.10/$0.40, Plus $0.40/$2.40, Max $1.20/$6.00 per 1M token
- Model remap: gpt-4o-mini → qwen3.5-flash, gpt-4o → qwen3.5-plus, claude-sonnet → qwen3-max
- Endpoint DashScope: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- API Key via env: `DASHSCOPE_API_KEY`

### 1.2 LLM Asia (`app/lib/providers/asia/llmAsia.js`)
- Wrapper compatibile OpenAI SDK (DashScope è OpenAI-compatible)
- `callQwen(opts)` — stessa interfaccia di callLLM
- Gestione errori specifica (rate limit DashScope, token budget)

### 1.3 STT Asia (`app/lib/providers/asia/sttAsia.js`)
- Paraformer v2 via DashScope per lingue CJK
- Fallback a Whisper se Paraformer fallisce
- Sync mode per audio <60s, async polling per audio più lungo

### 1.4 TTS Asia (`app/lib/providers/asia/ttsAsia.js`)
- CosyVoice v2 primario per zh/ja/ko/th/vi
- Edge TTS fallback (gratuito, sempre disponibile)
- Selezione voce automatica per lingua + genere

### 1.5 Translate Asia (`app/lib/providers/asia/translateAsia.js`)
- Qwen-MT Turbo primario (~$0.02/1000 chars, 92 coppie)
- Qwen LLM fallback per coppie non supportate da MT
- Validazione script CJK integrata

### 1.6 Provider Globali (`app/lib/providers/global/`)
- 4 file wrapper (sttGlobal, ttsGlobal, translateGlobal, llmGlobal)
- Riorganizzano le funzioni già esistenti in providers.js e llmCaller.js
- Interfaccia identica ai provider Asia → intercambiabili

### 1.7 Factory (`app/lib/providers/index.js`)
- `getSTTProvider(langPair)` → ritorna modulo asia o global
- `getTTSProvider(langPair)` → idem
- `getTranslationProvider(langPair)` → idem
- `getLLMProvider(langPair)` → idem
- Lazy loading dei moduli per regione

### 1.8 Provider Router (`app/lib/providerRouter.js`)
- Famiglie linguistiche: CJK, SEA, SouthAsian, MiddleEast, European, African
- Regole routing:
  - CJK↔CJK → Qwen (95%)
  - CJK↔qualsiasi → Qwen (90%)
  - SEA↔CJK → Qwen (90%)
  - EU↔EU → Global (90%)
  - Arabo↔EU → Global (85%)
- Output: `{ provider, model, reason, confidence }`
- Override utente esplicito ha priorità

### 1.9 TTS Router (`app/lib/ttsRouter.js`)
- Gerarchia: ElevenLabs (premium) > CosyVoice (CJK) > OpenAI TTS > Edge TTS (free)
- Score per lingua per provider
- Fallback chain automatico

### 1.10 Test (`__tests__/lib/providerRouter.test.js`)
- 26+ test: routing CJK, fallback, override utente, edge cases

---

## FASE 2 — Storage Client-Side (Modello WhatsApp)
**Obiettivo**: Zero memoria server. Chat persistenti su dispositivo utente via IndexedDB.

### 2.1 Chat Storage (`app/lib/chatStorage.js`)
- Database IndexedDB "barchat" con 3 object store: chats, messages, settings
- `saveChat(chat)` — salva/aggiorna metadata chat
- `saveMessage(chatId, msg)` — salva singolo messaggio
- `saveMessages(chatId, msgs)` — bulk save
- `getChat(chatId)` — leggi metadata
- `getMessages(chatId, { limit, before })` — paginazione
- `getAllChats()` — lista chat ordinate per ultimo messaggio
- `deleteChat(chatId)` — elimina chat + messaggi
- `exportChat(chatId, format)` — export JSON o TXT
- `importChat(file)` — import da file
- `getStorageUsage()` — quota monitoring
- `saveSetting(key, val)` / `getSetting(key)` — preferenze

### 2.2 Chat Actions (`app/lib/chatActions.js`)
- 5 azioni AI post-chat:
  1. **Summary** — riassunto conversazione
  2. **Report** — report formale (business use)
  3. **Analysis** — analisi linguistica errori/miglioramenti
  4. **Advice** — consigli contestuali
  5. **Vocabulary** — glossario termini chiave estratti
- `buildCompactTranscript(messages, maxMsgs=100)` — comprime per contesto AI
- Provider routing: Qwen per conversazioni CJK, OpenAI per altre
- Rate limit: 5/minuto

### 2.3 Hook React (`app/hooks/useLocalChat.js`)
- Wrapper React per chatStorage
- State: chats, currentChat, messages, loading
- Auto-sync con room polling (salva messaggi in arrivo)
- Lazy loading messaggi (scroll pagination)

### 2.4 API Route (`app/api/chat-action/route.js`)
- POST: riceve conversazione da device + tipo azione
- Auth: userToken o lendingCode
- Routing provider intelligente via providerRouter
- Risposta: testo generato + costo

### 2.5 Test (`__tests__/lib/chatStorage.test.js`, `__tests__/lib/chatActions.test.js`)
- 11+ test storage, 20+ test actions

---

## FASE 3 — Espansione Lingue (25 → 45+)
**Obiettivo**: Copertura mondiale completa con varianti regionali.

### 3.1 Nuove lingue in `constants.js`
Aggiungere: uk (ucraino), da (danese), nb (norvegese), he (ebraico), fil (filippino), bg (bulgaro), hr (croato), sk (slovacco), ca (catalano), bn (bengali), ta (tamil), sw (swahili), af (afrikaans)

### 3.2 Varianti regionali in `constants.js`
Aggiungere: en-GB, es-MX, fr-CA, pt-PT, zh-TW, ar-EG — con flag e speech locale corretti

### 3.3 Voci Edge in `edgeVoices.js`
- 1 voce femminile + 1 maschile per ogni nuova lingua
- Lookup: match esatto prima, fallback a codice 2 lettere

### 3.4 Aggiornamento flag
- English default: 🇺🇸 (US), en-GB: 🇬🇧
- Nomi nativi per tutte le varianti

### 3.5 Test (`__tests__/lib/constants.test.js` update)
- Verifica ogni lingua ha voce, speech locale, flag

---

## FASE 4 — Classroom Mode Avanzato
**Obiettivo**: Alza mano + gestione turni parlata per aule.

### 4.1 Store (`store.js`)
- `setHandRaised(roomId, memberName, raised)` — toggle alzata mano
- `grantSpeaking(roomId, memberName)` — host concede parola
- Campo member: `handRaised: boolean, handRaisedAt: timestamp`

### 4.2 Room Actions (`roomActions.js`)
- `handleRaiseHand` — azione raise/lower
- `handleGrantSpeak` — host grant con auto-lower di tutti gli altri

### 4.3 API Route update (`app/api/room/route.js`)
- Aggiungere 'raiseHand' e 'grantSpeak' a needsIdentity

### 4.4 UI in RoomView
- Pulsante "alza mano" visibile solo in mode classroom
- Lista mani alzate visibile all'host
- Tap su mano alzata → grant speaking

---

## FASE 5 — InterpreterView (Overlay Traduzione Simultanea)
**Obiettivo**: Fullscreen overlay durante videocall con sottotitoli tradotti in tempo reale.

### 5.1 Componente (`app/components/InterpreterView.js`)
- Overlay fullscreen sopra VideoCallOverlay
- Video partner al centro
- Sottotitoli partner in basso (grandi, glass blur)
- Sottotitoli propri in alto-sinistra (piccoli)
- Stats pill: latenza media
- Auto-hide controlli dopo 5s inattività
- Pulsante chiudi per tornare a VideoCallOverlay

### 5.2 Integrazione in page.js
- Render `<InterpreterView>` quando `interpreterActive && webrtc.webrtcConnected`
- Pulsante "Interprete Live" in RoomView (verifica webrtc connesso)

### 5.3 Componenti accessori
- `ChatActionsPanel.js` — pannello 5 azioni AI post-chat
- `ProviderBadge.js` — badge che mostra provider attivo (Qwen/OpenAI/etc)

---

## FASE 6 — UI Redesign Completo
**Obiettivo**: Glassmorphism moderno, icone sottili, animazioni fluide.

### 6.1 Icons.js
- strokeWidth: 2 → 1.5 (thin modern style)
- Prop `sw` per override personalizzato
- Nuove icone: IconInterpreter, IconWaveform, IconSubtitlesAlt, IconBrainAI
- Transizione `all 0.2s ease` su tutti SVG

### 6.2 styles.js — Token espansi
- Animazioni: vtSpin, vtPulse, vtFadeIn, vtSlideUp, vtScaleIn, vtGlow, vtShimmer, vtWave, vtBreathe, vtRipple, vtRecordPulse, vtConnecting, vtSubtitleIn (16 keyframes)
- Shadows: xs/sm/md/lg/xl + glow() + innerGlow
- Blur: none/sm(4px)/md(12px)/lg(24px)/xl(40px)
- Spacing: xs(4)/sm(8)/md(12)/lg(16)/xl(24)/xxl(32)/xxxl(48)
- Radius: xs(6)/sm(10)/md(14)/lg(18)/xl(24)/full(999)
- Focus: ring + outline con accent1

### 6.3 ConnectionQuality.js — Rewrite
- Barre con gradiente: `linear-gradient(to top, ${color}CC, ${color})`
- Glow shadow, barre inattive scalate a 0.85
- Animazione ingresso

### 6.4 VideoCallOverlay.js
- Emoji → SVG icons
- Glass ControlBtn con spring easing
- Sottotitoli dark glass

### 6.5 RoomView buttons
- Glass borders, backdropFilter blur(8px)
- Glow shadow, scale press effect (0.92)
- vtBreathe animation su status indicator

### 6.6 Interaction patterns globali
- Spring easing: cubic-bezier(0.4,0,0.2,1)
- Press effect: onPointerDown/Up/Leave per scale
- Entrance: vtSubtitleIn con spring
- Breathing: vtBreathe su indicatori di stato
- WCAG 2.1 AA: touch target 44px, aria-label, aria-pressed, focus ring

---

## FASE 7 — TTL Ridotti + Privacy
**Obiettivo**: Server come relay temporaneo, non storage.

### 7.1 store.js TTL updates
- Messaggi: 7200s → 3600s (2h → 1h)
- Conversazioni: 604800s → 86400s (7gg → 24h)
- Conv list: max 20 (era 50), TTL 24h

---

## FASE 8 — API Provider Route
**Obiettivo**: Endpoint per UI che mostra quale provider è attivo.

### 8.1 `app/api/provider-route/route.js`
- GET: riceve sourceLang + targetLang
- Ritorna: { provider, model, reason, confidence, region }
- Usato da ProviderBadge.js per mostrare info in tempo reale

---

## FASE 9 — Verifica Finale
### 9.1 Syntax check tutti i file nuovi/modificati
### 9.2 Test suite completa (target: 550+ pass, 0 regression)
### 9.3 Build Vercel locale (`next build`)
### 9.4 Deploy e test E2E su https://voice-translator2.vercel.app

---

## Ordine di Esecuzione

| Priorità | Fase | File | Stima |
|----------|------|------|-------|
| 1 | FASE 3 | constants.js, edgeVoices.js | Basso rischio, fondazione |
| 2 | FASE 1 | 12 file provider system | Core architecture |
| 3 | FASE 2 | 5 file storage + API | User experience |
| 4 | FASE 4 | store.js, roomActions.js, route.js | Classroom |
| 5 | FASE 5 | InterpreterView, ChatActionsPanel, ProviderBadge | Components |
| 6 | FASE 6 | Icons, styles, ConnectionQuality, RoomView | UI polish |
| 7 | FASE 7 | store.js TTL | Privacy |
| 8 | FASE 8 | provider-route API | Info endpoint |
| 9 | FASE 9 | Test + Deploy | Verifica |

**Standard di qualità**: ogni file segue W3C, RFC, React best practices. Zero warning ESLint. WCAG 2.1 AA. Performance budget: <3s LCP, <100ms FID.

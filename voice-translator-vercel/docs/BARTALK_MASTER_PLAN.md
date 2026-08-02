# BarTalk — Piano Completo di Sviluppo

## OBIETTIVO GENERALE

BarTalk permette a persone che parlano lingue differenti di comunicare:
- di persona
- tramite invito
- mediante chiamata o videochiamata
- all'interno di discussioni multilingua
- in situazioni specifiche come taxi e trasporti

**Promessa fondamentale:** Tu parli la tua lingua. L'altra persona sente la sua.

Ogni utente deve: parlare, scrivere, leggere, ascoltare nella propria lingua.
Il sistema deve nascondere la complessità tecnica di STT, traduzione, TTS, WebRTC, provider AI e gestione delle sessioni.

---

## 1. REGOLE OPERATIVE

Prima di modificare il codice:
1. analizza l'intero repository
2. identifica tutte le funzioni esistenti
3. ricostruisci il percorso reale di ogni funzione
4. individua componenti duplicati o sovrapposti
5. verifica quali funzioni sono realmente funzionanti
6. verifica quali funzioni sono incomplete
7. verifica quali funzioni sono solamente visive
8. verifica tutte le dipendenze tra componenti, hook, API e Redis
9. prepara una mappa `funzione → interfaccia → componenti → API → dati`
10. non eliminare nulla finché non sono stati controllati i caller

Non aggiungere nuove funzioni prima di avere stabilizzato quelle principali.
Non modificare contemporaneamente UX, logica, sicurezza e database nello stesso batch.
Procedere con piccoli batch verificabili.

Per ogni batch indicare: obiettivo, file modificati, comportamento precedente, comportamento nuovo, rischi, test effettuati, problemi ancora aperti.

Non pubblicare automaticamente in produzione.
Non cambiare regole commerciali, prezzi, permessi o struttura dei dati senza segnalarlo.

---

## 2. IDENTITÀ DEL PRODOTTO

Il prodotto deve chiamarsi ovunque: **BarTalk**

```js
export const APP_NAME = 'BarTalk';
export const APP_VERSION = '...';
export const APP_TAGLINE = 'Tu parli la tua lingua. L\'altra persona sente la sua.';
```

Questi dati devono alimentare: Home, onboarding, impostazioni, metadati, manifest, schermate di caricamento, email, inviti, pagine pubbliche, footer, logging.

---

## 3. STRUTTURA DEL PRODOTTO

**Area A — Comunicazione diretta:** Di persona, Invita, Videochiamata, TaxiTalk, Conversazioni private.

**Area B — Community BarTalk:** stanze pubbliche, protette, private, discussioni tematiche, inviti ricevuti, stanze create, stanze frequentate.

Le funzioni tecniche devono essere separate e nascoste nelle impostazioni avanzate.

---

## 4. NUOVA NAVIGAZIONE

1. Home
2. Conversazioni
3. Nuova conversazione
4. Community
5. Profilo

Il pulsante centrale "Nuova conversazione" apre quattro opzioni:
- Parla con chi hai davanti
- Invita una persona
- Avvia una videochiamata
- TaxiTalk

---

## 5. HOME

Titolo: **Con chi vuoi parlare?**

Azione principale: **Parla con chi hai davanti** — Mostra il QR e parlate ciascuno nella propria lingua.

Azioni secondarie: Invita una persona, Videochiamata tradotta, TaxiTalk.

Sezione inferiore: **Community BarTalk** — Partecipa a discussioni internazionali senza barriere linguistiche. Pulsanti: Scopri i BarTalk, Crea un BarTalk.

Non mostrare: numero tecnico di build, provider AI, motore STT/TTS, API key, strumenti in costruzione.

---

## 6. CONVERSAZIONE FACCIA A FACCIA

Flusso: seleziona "Parla con chi hai davanti" → crea sessione → mostra QR → scansione → selezione lingua → connessione → parla/scrivi → trascrizione → traduzione → visualizzazione → riproduzione → termina/salva.

Stati obbligatori: creazione sessione, attesa partecipante, partecipante collegato, microfono negato, trascrizione, traduzione, riproduzione, connessione debole, partecipante disconnesso, sessione scaduta, errore recuperabile, sessione terminata.

---

## 7. INVITO A DISTANZA

Canali: WhatsApp, SMS, email, Telegram, copia link, QR.

Il destinatario deve poter: aprire il link, comprendere chi lo ha invitato, selezionare lingua, inserire nome, entrare, parlare/scrivere senza registrazione obbligatoria.

---

## 8. VIDEOCHIAMATA TRADOTTA

Pipeline: Voce originale → STT → Traduzione → Sottotitoli → TTS → Riproduzione nella lingua del destinatario.

Profili audio: Solo traduzione, Traduzione + originale basso, Solo sottotitoli, Voce originale.

Stati utente: In ascolto, Traduco, Riproduco, Connessione lenta.

---

## 9. TAXITALK

Flusso: inserimento destinazione → geocoding → normalizzazione → selezione → dettagli aggiuntivi → genera QR → mostra al tassista → scansione → visualizzazione nella lingua del tassista → conferma → navigatore → conversazione tradotta.

Oggetto destinazione strutturato con: destinationName, originalAddress, normalizedAddress, lat/lng, terminal, entrance, stops, flightNumber, hotelName, notes, timestamps, expiry.

QR deve aprire una destinazione temporanea firmata e non modificabile.

---

## 10. COMMUNITY BARTALK

Riservata ai clienti registrati. Ogni stanza è un "BarTalk" — tavolo virtuale internazionale.

Tipi: Pubblico, Protetto (approvazione), Privato (invito), Temporaneo.

Ruoli: proprietario, moderatore, partecipante, ascoltatore, invitato.

Permessi verificati server-side. Funzione "Alza la mano" per conversazioni vocali.

---

## 11. CONVERSAZIONI PRIVATE

Solo invitati, partecipanti visibili, nessuna indicizzazione, link revocabile, messaggi/audio tradotti, chiamata opzionale, cronologia secondo consenso.

---

## 12. PROFILO E IMPOSTAZIONI

Sezioni: Profilo, Voce e traduzione, Piano e pagamenti, Privacy e sicurezza, Impostazioni avanzate (provider, API key, STT/TTS, Voice Clone, diagnostica).

Eliminare funzioni "Presto". Mostrarle solo quando utilizzabili.

---

## 13. MODELLO COMMERCIALE

Messaggio: "La traduzione base è gratuita. Voci premium, video traduzione e funzioni AI possono richiedere crediti o un piano superiore."

Prima di funzioni a pagamento mostrare: costo previsto, credito disponibile, limite, conferma.

---

## 14. DESIGN SYSTEM

Componenti condivisi: Page, PageHeader, PrimaryButton, SecondaryButton, IconButton, Card, ListItem, Modal, BottomSheet, LanguageSelector, EmptyState, ErrorState, LoadingState, StatusBadge, ParticipantCard, ConversationModeCard.

Token centrali: colori, font, dimensioni, spaziature, bordi, ombre, animazioni, breakpoint, z-index, dimensioni touch (min 44×44px, preferibilmente 48×48px).

---

## 15. RESPONSIVE

Mobile: azione principale raggiungibile col pollice, controlli audio grandi, bottom navigation.
Tablet: sfruttare spazio, modalità divisa, utile per hotel/reception/taxi.
Desktop: colonna navigazione, area conversazione, pannello partecipanti.
TaxiTalk: schermo invertito, split screen, testo grande, alta luminosità, pulsanti grandi.

---

## 16. ACCESSIBILITÀ

WCAG 2.2 AA. Contrasto, focus, tastiera, screen reader, etichette, modali, sottotitoli, RTL, testi lunghi (tedesco), ideogrammi.

---

## 17. ARCHITETTURA DELLE SESSIONI

sessionType: face_to_face, remote_private, video_call, taxi, public_bartalk, protected_bartalk, private_bartalk.

Non duplicare logica di: join, leave, invito, autenticazione, traduzione, messaggi, presenza, autorizzazioni.

---

## 18. NAVIGAZIONE E URL

Route reali: /, /new, /conversations, /conversations/:id, /community, /community/:id, /contacts, /taxi, /taxi/:sessionId, /profile, /settings/*, ecc.

---

## 19. SICUREZZA

Token QR sicuri, scadenza link, revoca inviti, permessi server-side, rate limiting, anti-spam, blocco utenti, audit moderazione, nessun token negli URL, nessuna API key nel client, operazioni Redis atomiche.

---

## 20. PRIVACY

Distinguere: audio temporaneo, trascrizione, traduzione, cronologia, registrazione, dati posizione, destinazioni TaxiTalk, Voice Clone.

Default: audio non conservato, trascrizioni solo se richiesto, sessioni TaxiTalk con scadenza breve, stanze private non indicizzate.

---

## 21. OSSERVABILITÀ

Metriche per: creazione sessione, QR scan, ingresso, latenze, errori, completamento, abbandono, inviti, conversioni, TaxiTalk, Community.

Non registrare contenuti sensibili.

---

## 22. TEST OBBLIGATORI

Unit, Integration, E2E (due browser), Dispositivi reali (iPhone/Safari, Android/Chrome, desktop, Bluetooth, orientamento).

---

## 23. PIANO DI ESECUZIONE

- Fase 0: Audit e mappa
- Fase 1: Identità e terminologia
- Fase 2: Architettura informativa
- Fase 3: Home
- Fase 4: Faccia a faccia e QR
- Fase 5: Inviti
- Fase 6: Videochiamata tradotta
- Fase 7: TaxiTalk
- Fase 8: Community
- Fase 9: Design system
- Fase 10: Stabilizzazione

---

## 24. PRIORITÀ ASSOLUTE

1. unificare identità e versioni
2. chiarire navigazione e gerarchia
3. perfezionare comunicazione faccia a faccia
4. perfezionare invito
5. completare videochiamata tradotta
6. costruire TaxiTalk corretto
7. completare Community
8. rifattorizzare design system
9. ottimizzare strumenti secondari

---

## 25. CRITERI FINALI DI ACCETTAZIONE

- capire BarTalk entro 5 secondi
- conversazione faccia a faccia entro 3 azioni
- QR senza spiegazioni
- scansione QR → conversazione pronta: < 15 secondi
- latenza traduzione vocale: < 2 secondi
- nessun token esposto
- nessuna funzione "Presto" visibile
- nessuna incoerenza BarTalk/BarChat
- navigazione browser corretta
- nessun errore critico
- test con due dispositivi reali

---

# APPENDICE — PRIVACY, P2P ED E2EE

## BarTalk Direct

Modalità senza traduzione cloud, senza trascrizione, senza conservazione server. E2EE per messaggi, WebRTC per audio/video, DataChannel per allegati.

### Tre modalità separate

1. **BarTalk Direct** — nessuna traduzione, E2EE, P2P, cronologia locale
2. **BarTalk Translate** — traduzione cloud, elaborazione temporanea, provider dichiarati
3. **BarTalk Private On-device** (futuro) — STT/traduzione/TTS locale, E2EE

### Guard server-side

```js
function assertCloudProcessingAllowed(session) {
  if (session.mode === 'direct') {
    throw new Error('Cloud processing is forbidden in Direct mode');
  }
}
```

### Messaggi P2P

Mittente → cifratura sul dispositivo → WebRTC DataChannel → decifratura sul dispositivo destinatario.

Redis può contenere SOLO: sessione, presenza, partecipanti, permessi, stato signaling, scadenza.
NON può contenere: testo, contenuto cifrato, trascrizioni, audio, allegati, riassunti.

### Cifratura E2EE

- Chiavi generate sul dispositivo, mai inviate al backend
- Chiavi effimere per sessione
- Forward secrecy
- Rotazione chiavi
- Protezione replay
- Nessuna chiave nei log/query string/localStorage

### Cronologia locale

Default: non conservare dopo chiusura. Se IndexedDB, cifrare prima della scrittura.

### Criteri di accettazione BarTalk Direct

- nessun messaggio in Redis
- nessun contenuto in database
- nessun contenuto nei log
- nessun provider AI contattato
- E2EE per testo e allegati
- WebRTC sicuro per audio/video
- chiavi private sui dispositivi
- TURN inoltra solo traffico cifrato
- cronologia solo locale
- nessun fallback cloud senza consenso
- token QR temporanei e revocabili
- test con due dispositivi superati
- audit sicurezza indipendente

### Ordine esecuzione privacy

1. Audit (mappa dati, scritture Redis, endpoint, logging, provider, WebRTC)
2. Separazione modalità (direct/translate, blocchi server-side, indicatori UI)
3. Messaggi P2P (DataChannel, consegna, acknowledgment)
4. Cifratura applicativa (protocollo, chiavi, verifica partecipanti)
5. Audio/video (verifica WebRTC, TURN, consenso cambio modalità)
6. Cronologia e allegati (archivio locale cifrato, trasferimento P2P)
7. Logging e metadati (redazione, Sentry, analytics, test assenza contenuti)
8. Collaudo (due dispositivi, due reti, TURN forzato, audit completo)

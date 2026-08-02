# BarTalk — Fasi 4-6: Miglioramenti UX (da fare con dispositivi reali)

Queste fasi riguardano perfezionamenti di flussi **già funzionanti**. Richiedono iterazione visiva e test su dispositivi reali.

## Fase 4: Faccia a faccia e QR

### Stato attuale: FUNZIONANTE
HomeView → LobbyView → RoomView. Flusso completo: crea room → QR → join → chat tradotta.

### Miglioramenti da fare
1. **Stati visivi espliciti** — aggiungere indicatori per: creazione sessione, attesa partecipante, partecipante collegato, microfono negato, trascrizione in corso, traduzione, riproduzione, connessione debole, partecipante disconnesso, sessione scaduta, errore recuperabile, sessione terminata
2. **Feedback audio** — suono breve quando partecipante si collega
3. **Animazione QR** — pulse/glow per indicare "in attesa di scansione"
4. **Timeout sessione** — mostrare countdown quando la sessione sta per scadere
5. **Riconnessione automatica** — se la connessione cade, tentare riconnessione senza intervento utente

### File coinvolti
- `app/components/LobbyView.js` — stati attesa
- `app/components/RoomView.js` — stati conversazione
- `app/hooks/useRoomPolling.js` — gestione timeout/riconnessione

---

## Fase 5: Inviti a distanza

### Stato attuale: FUNZIONANTE
QuickInvite + ContactsView. Link/QR condivisibile, ingresso senza registrazione.

### Miglioramenti da fare
1. **Anteprima invito** — mostrare come appare il messaggio prima di inviare
2. **Canali espliciti** — pulsanti dedicati per WhatsApp, SMS, email, Telegram, copia link, QR (attualmente solo "condividi" generico)
3. **Tracking invito** — mostrare se l'invito è stato aperto/accettato
4. **Invito con lingua** — pre-selezionare la lingua dell'invitato basandosi sulla lingua del contatto
5. **Nome del mittente nell'invito** — "X ti invita a parlare su BarTalk"

### File coinvolti
- `app/components/QuickInvite.js` — canali, anteprima
- `app/hooks/useContacts.js` — lingua contatto

---

## Fase 6: Videochiamata tradotta

### Stato attuale: FUNZIONANTE
VideoCallOverlay + useWebRTC + useE2EEncryption. WebRTC P2P con E2EE, PiP, camera/mic controls.

### Miglioramenti da fare
1. **Profili audio** — implementare 4 opzioni: solo traduzione, traduzione + originale basso, solo sottotitoli, voce originale
2. **Indicatori stato** — mostrare visivamente: In ascolto, Traduco, Riproduco, Connessione lenta
3. **Picture-in-Picture migliorato** — sottotitoli nel PiP
4. **Cambio layout** — split screen orizzontale per tablet/landscape
5. **Qualità adattiva** — abbassare risoluzione automaticamente su connessione lenta

### File coinvolti
- `app/components/VideoCallOverlay.js` — profili audio, indicatori
- `app/components/VoiceCallOverlay.js` — audio-only variant
- `app/hooks/useWebRTC.js` — qualità adattiva
- `app/lib/adaptiveVideo.js` — logica qualità (attualmente orfano, da integrare)

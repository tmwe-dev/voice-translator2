# BarTalk API v1 — riferimento operativo

Base path: `/api/v1`.

Snapshot Core auditato: **b.419 / push #711** (`d83df8455b08fbd7837c6a547f32b7d6ad9b9db9`).

## Autenticazione

```http
POST /api/v1/auth/exchange
Authorization: Bearer <sessione-bartalk>
Content-Type: application/json

{"scopes":["translate","speech:stt","speech:tts"],"ttlDays":6}
```

Senza `scopes` viene emesso un insieme **read/basic**. Gli scope di scrittura, wallet e BYOK vanno richiesti esplicitamente.

## Account

- `GET /me` — profilo
- `PATCH /me` — aggiorna profilo
- `DELETE /me/data` — avvia il perimetro di cancellazione del Core
- `GET /preferences`
- `PUT /preferences`

### Cancellazione dati: contratto preciso

Il Core b.419 revoca tutte le sessioni e cancella Redis + le superfici persistenti Life/Compagni/PeepOff previste dal cancellatore centrale. b.419 aggiunge anche i metadati personali Mondo auditati:

- `mondo_follows` (da entrambi i lati);
- `mondo_comment_likes`;
- `mondo_segnalazioni`.

Restano per policy il ledger wallet e i contenuti pubblici Mondo (`mondo_discussions`, `mondo_comments`).

La vecchia superficie `translations` esiste ma nel database vivo auditato e a zero righe. Il percorso attuale che dovrebbe popolarla dipende da `profiles`, tabella non presente nel progetto; quindi la Public API **non la dichiara cancellata** e non la tratta come residuo attivo.

Una risposta riuscita di `DELETE /me/data` aggiunge:

```json
{
  "deletionCoverage": {
    "status": "partial",
    "auditedCore": "b.419",
    "retainedByPolicy": ["wallet_accounting", "public_mondo_content"],
    "notGuaranteedByCore": [],
    "legacyInactiveSurfaces": ["translation_history"]
  }
}
```

`partial` significa che esistono retention esplicite; non significa che follow/like/segnalazioni siano ancora dimenticati dal Core.

## Chiavi provider BYOK

- `GET /provider-keys` — restituisce soltanto presenza/stato
- `POST /provider-keys` — salva `{ "keys": { "openai": "...", ... } }`
- `DELETE /provider-keys?provider=openai`

Scope: `keys:read`, `keys:write`. I valori non vengono restituiti dal Core.

## Wallet

- `GET /wallet` — saldo contabile attuale, uso e storico recente
- `GET /wallet/payments` — storico compatibilita account
- `POST /wallet/topups` — body `{ "pacchetto": "..." }`, restituisce URL checkout
- `POST /wallet/gifts/redeem` — body `{ "codice": "..." }`
- `POST /wallet/vouchers/redeem` — body `{ "codice": "..." }`

Scope scrittura: `wallet:write`.

`POST /wallet/gifts` non esiste volutamente nella v1: l'invio di credito non viene promosso finche il Core non garantisce idempotenza della mutazione.

## Traduzione e voce

- `POST /translate`
- `POST /transcribe` (`multipart/form-data`)
- `POST /tts`
- `POST /tts/elevenlabs`
- `GET /voices`
- `POST /voices/clone`

Il gateway sostituisce sempre l'identita dichiarabile dal client con la sessione incapsulata nella API key.

## Compagni

- `GET /companions`
- `POST /companions`
- `DELETE /companions/{id}`
- `DELETE /companions/{id}/memory` — **Dimentica** tutti i ricordi di quell'utente per quel Compagno
- `POST /companions/{id}/messages`
- `POST /companions/{id}/live-sessions`
- `POST /live-sessions/{sessionId}/heartbeat`
- `DELETE /live-sessions/{sessionId}`
- `POST /podcast/turns`
- `POST /table`
- `POST /companions/avatar`
- `POST /companions/generate`

L'id nel path e autoritativo: un id inserito nel body non puo sostituirlo.

### Live b.419

Il Core non usa piu un unico tetto da 15 minuti. La sessione Live viene contabilizzata a **tratti da 3 minuti parlati**, con una sola riserva attiva per volta e un solo Live per account.

L'apertura restituisce almeno:

```json
{
  "sessioneId": "...",
  "signedUrl": "...",
  "tettoSecondi": 540,
  "battitoSecondi": 60
}
```

`tettoSecondi` e il tetto del **singolo tratto di credito**, non la durata massima della telefonata.

Il client deve inviare:

```http
POST /api/v1/live-sessions/{sessionId}/heartbeat
Authorization: Bearer bt_live_...
Content-Type: application/json

{}
```

con la cadenza restituita da `battitoSecondi`. Il gateway forza `azione=rinnova` e il `sessionId` del path, quindi il body non puo trasformare un heartbeat in chiusura o scegliere un'altra sessione.

Risposte rilevanti:

- `200` — sessione viva; `rinnovato` indica se e stato ruotato il tratto;
- `402` — credito terminato, la linea deve essere chiusa;
- `403` — sessione non dell'account;
- `409` — all'apertura esiste gia un Live attivo;
- `410` — sessione non piu attiva.

La chiusura resta `DELETE /live-sessions/{sessionId}` e il Core misura la durata server-side.

## Life / studio

- `POST /learning/course`
- `POST /learning/dossier`
- `POST /learning/homework`
- `POST /learning/scans/deposit`
- `POST /learning/scans/retrieve`

La porta `scans/deposit` replica l'eccezione QR usa-e-getta gia prevista dal Core; il recupero richiede account. Il deposito logico e progettato per una vita breve, ma la pulizia Core e opportunistica (nuovo deposito/ritiro), quindi non va usato come archivio.

## Topics

`GET /topics/search?q=...&lang=it&cat=notizie&fresh=1&deep=1&fonti=6`

Il gateway inoltra `application/x-ndjson` senza convertirlo in JSON.

## Stanze, messaggi e realtime

- `GET|POST /rooms`
- `GET|POST|PATCH /messages`
- `GET /realtime/ice`
- `POST /realtime/group-video`
- `POST /reactions`

Quando il Core richiede membership di stanza, restano necessari `roomSessionToken`/`X-Room-Session`.

### TURN

`GET /realtime/ice` espone il contratto reale di `/api/turn`. Il codice genera credenziali se esistono `TURN_SECRET` e `TURN_URLS`, ma coturn non risulta ancora installato/configurato. Se le env mancano, la risposta puo essere `{ "iceServers": [] }` e i client proseguono solo con STUN.

## Archivio, contatti, glossari, community

- `GET /conversations`
- `GET|DELETE /conversations/{id}`
- `POST /conversations/end`
- `GET|POST /contacts`
- `GET|POST /glossaries`
- `GET|PATCH|DELETE /glossaries/{id}`
- `GET|POST /community`
- `POST /moderation`
- `POST /summary`

## PeepOff e TaxiTalk

- `POST /peepoff`
- `POST|GET|DELETE /taxi/destination`

TaxiTalk mantiene il ciphertext-only del Core; la chiave di decifratura non viene inviata al server.

## Errori gateway

- `401` API key/sessione non valida
- `402` credito insufficiente/terminato
- `403` scope o ownership insufficienti
- `409` conflitto di stato
- `410` sessione non piu attiva
- `413` payload troppo grande
- `429` rate limit
- `502` Core non disponibile
- `504` timeout Core

Ogni errore generato dal gateway include `requestId`. Le risposte del Core espongono `X-BarTalk-Core-Status`.

Specifica macchina: `/openapi`.

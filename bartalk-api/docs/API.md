# BarTalk API v1 — riferimento operativo

Base path: `/api/v1`.

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
- `DELETE /me/data` — esegue il perimetro di cancellazione dati che il Core dichiara
- `GET /preferences`
- `PUT /preferences`

Nota GDPR: `/me/data` non promette una cancellazione assoluta diversa da quella del Core; i record contabili possono essere trattenuti e le altre sessioni seguono il comportamento corrente del Core.

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
- `DELETE /live-sessions/{sessionId}`
- `POST /podcast/turns`
- `POST /table`
- `POST /companions/avatar`
- `POST /companions/generate`

L'id nel path e autoritativo: un id inserito nel body non puo sostituirlo.

## Life / studio

- `POST /learning/course`
- `POST /learning/dossier`
- `POST /learning/homework`
- `POST /learning/scans/deposit`
- `POST /learning/scans/retrieve`

La porta `scans/deposit` replica l'eccezione QR usa-e-getta gia prevista dal Core; il recupero richiede account.

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
- `403` scope insufficiente o rifiuto Core
- `413` payload troppo grande
- `429` rate limit
- `502` Core non disponibile
- `504` timeout Core

Ogni errore generato dal gateway include `requestId`. Le risposte del Core espongono `X-BarTalk-Core-Status`.

Specifica macchina: `/openapi`.

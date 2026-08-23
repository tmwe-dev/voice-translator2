# BarTalk API v1 — riferimento operativo

Base path: `/api/v1`.

Snapshot Core auditato: **b.420 / push #712** (`ee1a845845417ce43e0c4af8464531b53e8bbe8c`).

## Autenticazione

```http
POST /api/v1/auth/exchange
Authorization: Bearer <sessione-bartalk>
Content-Type: application/json

{"scopes":["translate","speech:stt","speech:tts"],"ttlDays":6}
```

- TTL ammesso: 1-7 giorni.
- Se `scopes` e omesso vengono applicati i default least-privilege.
- Se `scopes: []`, la chiave nasce volutamente senza privilegi.
- La API key e una credenziale **server-side**; non va inserita in URL, repository o JavaScript pubblico.
- La sessione BarTalk sottostante resta autorevole. Dove il Core non riceve direttamente il token account, il gateway verifica la sessione prima di inoltrare la capability.

## Health

`GET /health`

Readiness reale del gateway. Risponde `200` solo se Core e signing secret sono disponibili; altrimenti `503`.

## Account

- `GET /me`
- `PATCH /me`
- `DELETE /me/data`

### Cancellazione dati

Core b.420 mantiene il perimetro GDPR chiuso in b.419:

- rimuove profilo Redis, tutte le sessioni, dati Life/Compagni/PeepOff e attivita personale Mondo auditata;
- mantiene il ledger wallet per retention contabile;
- mantiene i contenuti pubblici Mondo per policy/procedura separata;
- `translation_history` e una superficie legacy inattiva, non viene dichiarata come cancellata.

La risposta aggiunge `deletionCoverage` per descrivere queste retention senza chiamarle erasure totale.

## Wallet

- `GET /wallet`
- `GET /wallet/payments`
- `POST /wallet/topups`
- `POST /wallet/gifts/redeem`
- `POST /wallet/vouchers/redeem`

`POST /wallet/gifts` non esiste nella v1: l'invio credito non viene pubblicato senza contratto idempotente.

## Traduzione e voce

- `POST /translate`
- `POST /transcribe` (`multipart/form-data`)
- `POST /tts`
- `POST /tts/elevenlabs`
- `GET /voices`
- `POST /voices/clone`

Il gateway sostituisce sempre l'identita dichiarabile dal client con la sessione incapsulata nella API key quando il Core usa `token/userToken`.

## Compagni

- `GET /companions`
- `POST /companions`
- `DELETE /companions/{id}`
- `DELETE /companions/{id}/memory`
- `POST /companions/{id}/messages`
- `POST /companions/{id}/live-sessions`
- `POST /live-sessions/{sessionId}/heartbeat`
- `DELETE /live-sessions/{sessionId}`
- `POST /podcast/turns`
- `POST /table`
- `POST /companions/avatar`
- `POST /companions/generate`

### Live

L'apertura restituisce `sessioneId` e `battitoSecondi`. Il client manda un heartbeat secondo quella cadenza. Il Core b.420:

- paga a tratti, senza tetto-condono da 15 minuti;
- permette una sola linea per persona;
- serializza apertura/rinnovo/chiusura;
- impedisce che un heartbeat resusciti una linea chiusa;
- considera scalato solo un commit wallet riuscito;
- recupera in modo controllato i tratti se un heartbeat manca.

## Life / studio

- `POST /learning/course`
- `POST /learning/dossier`
- `POST /learning/homework`
- `POST /learning/scans/deposit`
- `POST /learning/scans/retrieve`

`scans/deposit` e pubblico come il QR usa-e-getta del Core, ma ha rate-limit per client e limite JSON reale da 6 MB.

## Topics

`GET /topics/search?...`

NDJSON inoltrato come stream. Prima dell'inoltro il gateway riverifica che la sessione BarTalk contenuta nella API key sia ancora valida.

## Stanze, messaggi e realtime

- `GET|POST /rooms`
- `GET|POST|PATCH /messages`
- `GET /conversations`
- `GET|DELETE /conversations/{id}`
- `POST /conversations/end`
- `POST /reactions`
- `GET /realtime/ice`
- `POST /realtime/group-video`

`roomSessionToken` / `X-Room-Session` resta un secondo livello di autorizzazione e viene validato dal Core. La API key non sostituisce la membership stanza.

### TURN

`GET /realtime/ice` espone il contratto reale del Core. Se coturn e le env TURN non sono configurati, `iceServers` puo essere vuoto e il client usa solo STUN.

## Contatti, community e altre capability vive

- `GET /contacts`
- `POST /contacts` — soltanto azioni non finanziarie: `heartbeat`, `offline`, `add`, `remove`, `start-chat`, `create-invite` senza credito, `get-gift-info`
- `GET|POST /community`
- `POST /moderation`
- `POST /summary`
- `POST /peepoff`
- `POST|GET|DELETE /taxi/destination`

`POST /contacts` e fail-closed: azioni Core future non diventano pubbliche automaticamente. `create-invite` con `giftAmount` e `accept-invite` sono rifiutate dalla v1 prima del Core perche possono muovere credito e il relativo flusso legacy non offre idempotenza end-to-end sufficiente per un gateway pubblico.

## Capability escluse perche il Core non e operativo oggi

Non sono pubblicate:

- `/preferences` — il Core dipende da `profiles/user_settings`, assenti nel DB vivo;
- `/provider-keys` — `/api/keys` dipende da `profiles/api_keys_vault`; il BYOK usato davvero dall'app e Redis-backed attraverso `/api/user`;
- `/glossaries*` — `/api/glossary` dipende da `profiles/glossaries`, assenti nel DB vivo.

La scelta e intenzionale: **una route presente nel sorgente non equivale a una capability funzionante**.

## Limiti e framing

- JSON standard: 512 KB reali.
- Homework/scans: 6 MB reali.
- Multipart: limite applicato ai byte realmente letti, non soltanto a `Content-Length`.
- `Content-Length` upstream non viene copiato verso il client.
- Parametri path decodificati in modo fail-closed e limitati.
- Query sensibili (`token`, `userToken`, `roomSessionToken`, `apiKey`, `authorization`) non vengono propagate dalla query del client.

## Errori

- `400` richiesta non valida / azione non pubblicata
- `401` API key/sessione account/sessione stanza non valida
- `402` credito insufficiente
- `403` scope/ownership/membership negata
- `409` conflitto di stato
- `410` sessione non piu attiva
- `413` payload troppo grande
- `429` rate limit
- `502` Core non disponibile
- `503` gateway/capability non disponibile
- `504` timeout Core

Ogni risposta gateway include un `requestId` normalizzato. Specifica macchina: `/openapi`.

# BarTalk API v1 — riferimento operativo

Base path: `/api/v1`.

Snapshot Core auditato: **b.416 / push #710** (`8e831153f5a29e0e66ef506d4207a9826accdb4e`).

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

Il Core b.415/b.416 revoca tutte le sessioni e cancella Redis + le superfici persistenti Life/Compagni/PeepOff previste dal cancellatore centrale. Restano per scelta il ledger wallet e i contenuti pubblici Mondo.

L'audit b.416 ha pero verificato che il contratto non e ancora una prova di cancellazione **totale**: `translations` puo contenere testo originale/tradotto legato a `user_id`, mentre Mondo possiede anche follow, like e segnalazioni con identificativi utente. Nel database vivo controllato durante l'audit queste tabelle risultavano senza righe utente, ma il gateway non basa il contratto sul fatto che oggi siano vuote.

Per questo una risposta riuscita di `DELETE /me/data` aggiunge:

```json
{
  "deletionCoverage": {
    "status": "partial",
    "auditedCore": "b.416",
    "retainedByPolicy": ["wallet_accounting", "public_mondo_content"],
    "notGuaranteedByCore": [
      "translation_history_rows",
      "mondo_follows",
      "mondo_comment_likes",
      "mondo_reports"
    ]
  }
}
```

`ok: true` significa quindi **richiesta di cancellazione eseguita dal Core**, non certificato assoluto di erasure.

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

### Live: limite economico attuale

Il Core riserva all'apertura un massimo equivalente a **15 minuti di linea**. Con il moltiplicatore corrente 3x, il campo Core `tettoSecondi` e espresso in **secondi di credito**, non in secondi di orologio.

Il Core b.416 non rinnova automaticamente la riserva e `creditoDalVivo()` limita l'addebito alla riserva iniziale. Finche questo non viene cambiato, un integratore deve trattare una sessione Live come **massimo 15 minuti continuativi**, chiuderla e riaprirla se vuole proseguire. Una sessione piu lunga non e un contratto economico supportato dalla Public API v1.

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

`GET /realtime/ice` espone il contratto reale di `/api/turn`. Nel Core b.416 la generazione di credenziali e pronta, ma **coturn non risulta ancora installato/configurato**. Se `TURN_SECRET` e `TURN_URLS` non sono presenti nel Core, la risposta e `{ "iceServers": [] }` e i client proseguono solo con STUN. Questo significa che reti CGNAT/NAT restrittive non sono ancora garantite.

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

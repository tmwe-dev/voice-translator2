# BarTalk API v1 — riferimento operativo

Base path: `/api/v1`.

## Autenticazione

### Scambio sessione → API key

```http
POST /api/v1/auth/exchange
Authorization: Bearer <sessione-bartalk>
Content-Type: application/json

{"scopes":["translate","speech:stt","speech:tts"],"ttlDays":6}
```

Risposta `201`:

```json
{
  "apiKey": "bt_live_...",
  "tokenType": "Bearer",
  "expiresInDays": 6,
  "scopes": ["translate", "speech:stt", "speech:tts"],
  "user": {"email":"...","name":"...","tier":"pro"}
}
```

La TTL è un limite massimo. Ogni richiesta resta subordinata alla sessione BarTalk incapsulata: una sessione Core scaduta/revocata rende inutilizzabile la API key.

## Traduzione

```http
POST /api/v1/translate
Authorization: Bearer bt_live_...
Content-Type: application/json

{
  "text": "Buongiorno",
  "sourceLang": "it",
  "targetLang": "en"
}
```

Il gateway sostituisce sempre `userToken` con quello verificato. Il Core applica schema, Direct Mode, glossario, routing provider, cache e wallet atomico.

## Trascrizione

`POST /api/v1/transcribe` usa `multipart/form-data`. Campi principali del Core: `audio`, `sourceLang`, `durata`, `libera`; il gateway inserisce `userToken`. Il Core rifiuta audio oltre 25 MB.

## TTS

- `POST /api/v1/tts` — motore TTS instradato dal Core.
- `POST /api/v1/tts/elevenlabs` — voce premium.

La risposta audio viene inoltrata in streaming. Il gateway non ricodifica l'audio.

## Compagni

- `GET /api/v1/companions`
- `POST /api/v1/companions`
- `DELETE /api/v1/companions/{id}`
- `POST /api/v1/companions/{id}/messages`
- `POST /api/v1/companions/{id}/live-sessions`
- `DELETE /api/v1/live-sessions/{sessionId}`
- `POST /api/v1/podcast/turns`
- `POST /api/v1/table`
- `POST /api/v1/companions/avatar`
- `POST /api/v1/companions/generate`

L'id presente nel percorso ha precedenza su qualunque id eventualmente inserito nel body. Il Core risolve il Compagno per l'account verificato.

## Life / studio

- `POST /api/v1/learning/course`
- `POST /api/v1/learning/dossier`
- `POST /api/v1/learning/homework`

`POST /api/v1/learning/scans/deposit` è l'unica porta pubblica: usa il `sid` usa-e-getta del QR e riproduce l'eccezione già prevista dal Core. `POST /api/v1/learning/scans/retrieve` richiede invece l'account.

`learning/homework` espone le azioni concrete di `/api/compiti`, comprese agenda, materiali, OCR e PDF. Il gateway accetta fino a 6 MB per rispettare il contratto del Core.

## Glossari

- `GET /api/v1/glossaries`
- `GET /api/v1/glossaries/{id}`
- `POST /api/v1/glossaries`
- `PATCH /api/v1/glossaries/{id}`
- `DELETE /api/v1/glossaries/{id}`

Il gateway usa sempre il campo `token` che il Core richiede e non accetta che il client lo sostituisca.

## Topics

`GET /api/v1/topics/search?q=...&lang=it&cat=notizie&fresh=1&deep=1&fonti=6`

Risposta `application/x-ndjson`: il gateway preserva lo stream originale.

## Stanze, messaggi e realtime

- `GET|POST /api/v1/rooms`
- `GET|POST|PATCH /api/v1/messages`
- `GET /api/v1/realtime/ice`
- `POST /api/v1/realtime/group-video`
- `POST /api/v1/reactions`

Le capability di stanza richiedono ancora `roomSessionToken` nel JSON quando previsto dal Core. Per GET di stanza/messaggi, inviare `X-Room-Session`. La API key account non viene usata per fingere la membership della stanza.

## Archivio conversazioni

- `GET /api/v1/conversations` — elenco dell'account.
- `GET /api/v1/conversations/{id}` — lettura, con verifica di partecipazione nel Core.
- `DELETE /api/v1/conversations/{id}` — eliminazione per il partecipante.
- `POST /api/v1/conversations/end` — chiusura/salvataggio da parte dell'host della stanza.

## Community e moderazione

- `GET|POST /api/v1/community`
- `POST /api/v1/moderation`
- `POST /api/v1/reactions`

Pubblicazione e azioni privilegiate restano legate al `roomSessionToken` dell'host; il gateway non promuove una API key account a host.

## PeepOff

`POST /api/v1/peepoff` conserva soltanto le capability già consentite dal Core: chiavi pubbliche dei dispositivi, presenza e signaling WebRTC allowlistato. Il contenuto dei messaggi non passa da questo endpoint.

## TaxiTalk

- `POST /api/v1/taxi/destination` — salva solo `ciphertext`, restituisce `id` e `revokeSecret`.
- `GET /api/v1/taxi/destination?id=...` — restituisce soltanto il ciphertext.
- `DELETE /api/v1/taxi/destination?id=...&revokeSecret=...` — revoca.

La chiave di cifratura della destinazione non viene inviata al server.

## Errori

Il gateway conserva gli status HTTP del Core e aggiunge `X-BarTalk-Core-Status`. Errori propri del gateway:

- `401` API key assente/non valida/scaduta;
- `403` scope insufficiente;
- `413` payload gateway troppo grande;
- `429` limite gateway superato;
- `502` Core irraggiungibile;
- `504` timeout Core.

Ogni risposta generata dal gateway include `requestId`; quando fornito, `X-Request-Id` viene inoltrato al Core.

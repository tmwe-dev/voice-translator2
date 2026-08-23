# Verifica delle capability esposte

Snapshot del Core usato per il progetto: `403f930ef17fa238575b0822a8edbb97dde8bd96` (b.410 / push 704, 23 agosto 2026).

## Criterio

Un endpoint entra nella Public API solo se esiste nel Core e la responsabilita critica rimane li. Il gateway non ricrea wallet, prompt, memoria, cifratura o provider routing.

| Public API | Core | Evidenza verificata nel codice |
|---|---|---|
| `/v1/health` | `/api/health` | risposta pubblica minimizzata, rate limit, dettaglio solo admin |
| `/v1/translate` | `/api/translate` | schema input, Direct guard, auth, routing, cache, reserve/commit/release |
| `/v1/transcribe` | `/api/transcribe` | multipart, 25MB max, Direct guard, auth, wallet atomico, ricevuta STT |
| `/v1/tts` | `/api/tts` | schema input, Direct guard, router TTS, wallet atomico, streaming audio |
| `/v1/voices/clone` | `/api/voice-clone` | multipart, max 10MB, auth, Direct guard, wallet atomico |
| `/v1/companions` | `/api/compagni/mie` | identita da sessione, CRUD limitato ai propri Compagni |
| `/v1/companions/{id}/messages` | `/api/compagni/amico` | memoria, relazione, controller, profilo, wallet, identita da sessione |
| `/v1/companions/{id}/live-sessions` | `/api/compagni/live/session` | Compagno risolto server-side, signed URL, wallet, durata server-side |
| `/v1/topics/search` | `/api/topics/search` | NDJSON, validazione parametri, streaming, rate limit |
| `/v1/taxi/destination` | `/api/taxi/destination` | ciphertext-only; POST crea id+revokeSecret, GET legge senza consumare, DELETE richiede revokeSecret; production smoke copre POST/GET contract |
| `/v1/learning/homework` | `/api/compiti` | sessione per dati personali; OCR passa dal wallet; PDF server-side; payload Core fino a 6MB |
| `/v1/conversations*` | `/api/conversation` | archivio account-only, GET vincolato a partecipazione, DELETE del solo partecipante, Direct guard |
| `/v1/reactions` | `/api/reazioni` | roomSessionToken, membership corrente, Direct guard e conservazione solo Community |
| `/v1/realtime/ice` | `/api/turn` | credenziali TURN temporanee HMAC; [] se TURN non configurato |
| `/v1/realtime/group-video` | `/api/stanza-video` | signaling destinatario-per-destinatario, roomSessionToken e membership corrente |
| `/v1/contacts` | `/api/contacts` | il Core autentica sul campo `token`; il gateway lo sovrascrive dalla API key |
| `/v1/glossary` | `/api/glossary` | il Core autentica sul campo `token`; limiti su nome, lingue, voci e ownership |
| `/v1/messages` | `/api/messages` | identita di stanza tramite `roomSessionToken`/`X-Room-Session`; membership e Direct mode verificati nel Core |
| `/v1/community` | `/api/mondo` | lettura vetrina; pubblicazione richiede roomSessionToken dell'host |
| `/v1/moderation` | `/api/moderazione` | le azioni privilegiate richiedono roomSessionToken dell'host |

## Prove esistenti del Core

Il Core b.410 dichiara 2445 test verdi su 163 file. Il production smoke test verifica live homepage/hydration, health, Direct guard e TaxiTalk ciphertext-only. Questa API aggiunge test propri per chiavi, scope, route mapping, esclusione delle rotte interne e copertura OpenAPI.

## Limite dichiarato

Questa branch non modifica il Core e quindi non puo creare nuovi contratti interni. Le superfici applicative restano pass-through: il gateway normalizza identita, scope, dimensione e trasporto, mentre il Core resta l'autorita su membership, wallet, privacy e business logic. Gli endpoint interni di test/debug/admin e il checkout Stripe non vengono promossi a Public API: non sono capability di integrazione pubblica.

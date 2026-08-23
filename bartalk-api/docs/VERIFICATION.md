# Verifica delle capability esposte

Snapshot del Core usato per questa revisione: `d83df8455b08fbd7837c6a547f32b7d6ad9b9db9` — **b.419 / push #711**, 23 agosto 2026.

## Regola

Un endpoint entra nella Public API solo se:

1. esiste realmente nel Core corrente;
2. il Core mantiene la responsabilita critica;
3. il gateway puo imporre identita/scope senza indebolire il contratto;
4. non promuove una rotta test/admin/cron/webhook;
5. una mutazione finanziaria non crea un nuovo rischio evidente di duplicazione;
6. la documentazione non promette una garanzia piu forte di quella verificata nel Core.

## Matrice principale

| Public API | Core | Verifica |
|---|---|---|
| `/v1/health` | `/api/health` | porta pubblica di health |
| `/v1/me` | `/api/user` | sessione Core, profilo |
| `/v1/me/data` | `/api/user action=delete-data` | b.419: cancellatore centrale + revoca sessioni + metadati personali Mondo; retention esplicite dichiarate |
| `/v1/preferences` | `/api/user?action=get-prefs` / `sync-prefs` | identita da Bearer |
| `/v1/provider-keys` | `/api/keys` | valori mai restituiti; storage cifrato nel Core |
| `/v1/wallet` | `/api/wallet/saldo` | fonte contabile attuale; identita da sessione |
| `/v1/wallet/topups` | `/api/wallet/ricarica` | crea checkout per l'utente della sessione |
| `/v1/wallet/gifts/redeem` | `/api/wallet/regalo` | riscatto codice, identita sessione |
| `/v1/wallet/vouchers/redeem` | `/api/wallet/voucher` | riscatto codice, identita sessione |
| `/v1/translate` | `/api/translate` | schema, Direct guard, provider routing, wallet |
| `/v1/transcribe` | `/api/transcribe` | multipart, Direct guard, auth, wallet |
| `/v1/tts*` | `/api/tts*` | router/voce premium e wallet nel Core |
| `/v1/companions` | `/api/compagni/mie` | CRUD account-scoped |
| `/v1/companions/{id}/memory` | `/api/compagni/mie azione=dimentica` | capability b.411; id del path prevale sul body |
| `/v1/companions/{id}/messages` | `/api/compagni/amico` | controller/memoria/relazione/wallet |
| `/v1/companions/{id}/live-sessions` | `/api/compagni/live/session azione=apri` | b.418: server-resolved companion, signed URL, una sessione per account, riserva a tratti |
| `/v1/live-sessions/{sessionId}/heartbeat` | `/api/compagni/live/session azione=rinnova` | b.418: rinnova/ruota la riserva; sessionId del path autoritativo |
| `/v1/live-sessions/{sessionId}` | `/api/compagni/live/session azione=chiudi` | durata e contabilita decise dal server |
| `/v1/topics/search` | `/api/topics/search` | NDJSON preservato |
| `/v1/learning/*` | `/api/compagni/*` e `/api/compiti` | Life usa il Core |
| `/v1/conversations*` | `/api/conversation` | account/partecipazione e Direct guard nel Core |
| `/v1/realtime/*` | `/api/turn`, `/api/stanza-video` | endpoint TURN presente; relay operativo dipende dalla configurazione esterna |
| `/v1/contacts` | `/api/contacts` | il gateway sovrascrive il campo `token` |
| `/v1/glossaries` | `/api/glossary` | ownership nel Core |
| `/v1/community` | `/api/mondo` | pubblicazione/privilegi restano nel Core |
| `/v1/peepoff` | `/api/peepoff` | signaling/presenza; contenuto messaggi non memorizzato dalla route |
| `/v1/taxi/destination` | `/api/taxi/destination` | ciphertext-only |

## Correzioni della API v1 fino a b.419

- `/v1/wallet` usa `/api/wallet/saldo`, non il vecchio credits di `/api/user`.
- `DELETE /v1/companions/{id}/memory` espone **Dimentica**.
- BYOK e wallet hanno scope dedicati.
- `fixedBody`, query e identificativi del path sono autoritativi.
- il gateway non espone invio regalo senza idempotenza.
- b.419: `DELETE /v1/me/data` non elenca piu follow/like/segnalazioni come residui: il Core li cancella.
- b.418/b.419: aggiunto `POST /v1/live-sessions/{sessionId}/heartbeat`; senza questa porta la Public API non avrebbe seguito il nuovo contratto economico delle chiamate lunghe.

## Funzioni volutamente NON pubblicate

- admin, debug, test, cron, webhook;
- Stripe raw;
- subscription legacy;
- translate-test/free/test-llm e TTS test;
- invio regalo di credito finche il Core non offre idempotenza.

## Stato audit rilevante

- RLS server-only e funzioni SECURITY DEFINER Mondo: correzioni precedenti restano parte del modello verificato.
- b.418 elimina il vecchio condono oltre 15 minuti: `creditoDalVivo()` non tronca piu l'intera telefonata; le riserve Live ruotano a tratti da 3 minuti parlati.
- b.418 introduce il lock di una sola sessione Live per account nel Core.
- b.419 cancella `mondo_follows`, `mondo_comment_likes`, `mondo_segnalazioni` nel perimetro DELETE USER.
- `translations` esiste nel database vivo ma risultava a 0 righe; il percorso attuale di salvataggio dipende dalla tabella legacy `profiles`, che non esiste. Non viene quindi pubblicizzata ne come storico funzionante ne come dato cancellato.
- risultano inoltre legacy/non presenti nel DB vivo `profiles`, `payments`, `usage_daily` e altre superfici del vecchio wrapper Supabase: e un debito del Core, non business logic da ricreare nel gateway.

## Limiti ancora dichiarati

### Live

La Public API segue il contratto b.418:

1. apertura;
2. heartbeat con cadenza `battitoSecondi`;
3. chiusura.

Il gateway non cerca di correggere race condition interne al Core: se il Core cambia semantica di lock/rinnovo/close, la API deve riallinearsi senza duplicarla.

### TURN

Il codice `/api/turn` genera credenziali temporanee se esistono `TURN_SECRET` e `TURN_URLS`; l'operativita del relay coturn resta una configurazione infrastrutturale esterna. Senza env puo tornare `iceServers: []`.

### Identita Life

L'HMAC Life dipende da `MONDO_ID_SECRET` server-side. La Public API non puo certificare la configurazione dell'ambiente Core.

### Produzione e CI

Il deploy Core b.419 risulta Vercel `success` nella verifica del 23/08/2026. Il conteggio storico `2497 test / 167 file` nel diario Core precede le nuove prove b.417-b.419 e non viene riusato qui come certificazione indipendente della suite attuale.

## Cancellazione dati: stato b.419

La Public API continua a usare `deletionCoverage.status=partial` per un motivo preciso: restano retention deliberate, non residui Mondo dimenticati.

Retained by policy:

- wallet accounting;
- contenuti pubblici Mondo.

Metadati personali Mondo auditati: **cancellati dal Core b.419**.

Superficie legacy inattiva dichiarata separatamente:

- `translation_history`.

La Public API non duplica nessuna cancellazione nel gateway.

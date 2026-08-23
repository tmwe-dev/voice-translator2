# Verifica delle capability esposte

Snapshot del Core usato per questa revisione: `8e831153f5a29e0e66ef506d4207a9826accdb4e` — **b.416 / push #710**, 23 agosto 2026.

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
| `/v1/me/data` | `/api/user action=delete-data` | b.415: cancellatore centrale + revoca sessioni; b.416 audit: copertura non ancora totale, il gateway aggiunge `deletionCoverage.status=partial` |
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
| `/v1/companions/{id}/memory` | `/api/compagni/mie azione=dimentica` | capability introdotta in b.411; id del path prevale sul body |
| `/v1/companions/{id}/messages` | `/api/compagni/amico` | controller/memoria/relazione/wallet |
| `/v1/companions/{id}/live-sessions` | `/api/compagni/live/session` | server-resolved companion, signed URL, wallet; supporto economico dichiarato max 15 minuti continuativi |
| `/v1/topics/search` | `/api/topics/search` | NDJSON preservato |
| `/v1/learning/*` | `/api/compagni/*` e `/api/compiti` | Life usa il Core; b.414 aggiunge smoke produzione sulle porte |
| `/v1/conversations*` | `/api/conversation` | account/partecipazione e Direct guard nel Core |
| `/v1/realtime/*` | `/api/turn`, `/api/stanza-video` | endpoint TURN pronto, relay non ancora configurato in b.416 |
| `/v1/contacts` | `/api/contacts` | il gateway sovrascrive il campo `token` |
| `/v1/glossaries` | `/api/glossary` | ownership nel Core |
| `/v1/community` | `/api/mondo` | pubblicazione/privilegi restano nel Core |
| `/v1/peepoff` | `/api/peepoff` | signaling/presenza; contenuto messaggi non memorizzato dalla route |
| `/v1/taxi/destination` | `/api/taxi/destination` | ciphertext-only |

## Correzioni rispetto alla prima API v1

- `/v1/wallet` non usa piu il vecchio `getCredits()` di `/api/user`: usa `/api/wallet/saldo`.
- aggiunto `DELETE /v1/companions/{id}/memory` per la funzione **Dimentica** di b.411.
- aggiunti `GET/PUT /v1/preferences`.
- aggiunto BYOK `GET/POST/DELETE /v1/provider-keys` con scope dedicati.
- aggiunti checkout ricarica e riscatti wallet sicuri.
- gli scope di default non includono piu automaticamente tutte le scritture sensibili.
- `fixedBody` e query fissate dal gateway sono autoritative e non sovrascrivibili dal client.
- audit b.416: `DELETE /v1/me/data` aggiunge un esito macchina di **copertura parziale** invece di trasformare `ok:true` in una promessa di erasure totale.

## Funzioni volutamente NON pubblicate

- admin, debug, test, cron, webhook;
- Stripe raw;
- subscription legacy;
- translate-test/free/test-llm e TTS test;
- invio regalo di credito: oggi il Core non espone un contratto idempotente per questa mutazione. Un retry non deve poter scalare due volte.

## Stato dei problemi dell'audit rilevanti al Core

Verificato sul database vivo durante questa revisione:

- le 8 tabelle precedentemente senza RLS restano protette secondo il modello server-only verificato nell'audit precedente;
- le funzioni Mondo `SECURITY DEFINER` erano gia state revocate ad `anon/authenticated` e b.416 non tocca quel codice;
- `compagno_memorie` risultava ancora a **0 righe** nell'ultima verifica: la memoria e tecnicamente riparata ma non dimostrata in uso reale;
- `compiti_scansioni` risultava **0 righe**; il codice dichiara TTL 15 minuti ma la pulizia e opportunistica (deposito successivo/ritiro), non una scadenza DB autonoma;
- `translations` risultava **0 righe**, ma lo schema consente `source_text` e `translated_text` associati a `user_id`, e `/api/translate` contiene il percorso di salvataggio;
- `mondo_follows`, `mondo_comment_likes` e `mondo_segnalazioni` risultavano senza righe, ma possiedono identificativi utente e non sono nel cancellatore b.415.

## Limiti ancora dichiarati

### Live

- Via B resta una scelta deliberata: il Live usa il runtime conversazionale ElevenLabs, non il runtime cognitivo completo della chat scritta.
- La sessione riserva `LIVE_TETTO_SECONDI = 15 minuti * moltiplicatore 3`; `creditoDalVivo()` applica `Math.min(...)`, quindi una linea oltre 15 minuti non rinnova la riserva e non ha un contratto economico corretto. La Public API documenta massimo 15 minuti continuativi finche il Core non introduce rinnovo/heartbeat o hard close.
- La privacy ElevenLabs resta volutamente con retention attiva durante il collaudo; deve essere cambiata prima di utenti reali secondo la decisione documentata nel Core.

### TURN

b.416 ha corretto una precedente affermazione falsa: **non esistono script coturn pronti nel repository**. Il codice `/api/turn` genera credenziali temporanee se esistono `TURN_SECRET` e `TURN_URLS`, ma manca ancora il relay coturn installato/configurato. Senza queste env ritorna `iceServers: []` e il sistema usa solo STUN.

### Identita Life

b.413 usa HMAC per l'identita Life **solo se `MONDO_ID_SECRET` e impostato**; senza variabile il Core ricade intenzionalmente sul digest precedente. La configurazione Vercel non e stata verificabile tramite il connettore disponibile, quindi resta un punto operativo aperto.

### Produzione e CI

- b.416 ha Vercel `success`.
- Il diario Core dichiara **2497 test verdi su 167 file** e 0 errori lint; il connettore GitHub disponibile mostra il check Vercel ma non fornisce in questa sessione una prova indipendente della suite completa su push.
- `main` non risulta protetto da required checks nell'ultima verifica precedente: CI e ancora allarme, non barriera di produzione.

## Cancellazione dati: stato corretto dopo il nuovo audit

Il salto di b.415 e reale: il Core ora cancella Redis, Life/Compagni/PeepOff sotto impronta vecchia e nuova e revoca tutte le sessioni. Non e pero corretto chiamarlo ancora **totale**.

Restano per scelta dichiarata:

- wallet accounting;
- contenuti pubblici Mondo.

Non risultano ancora garantiti dal cancellatore centrale:

- eventuali righe `translations` associate all'utente;
- Mondo follow;
- Mondo comment likes;
- Mondo segnalazioni.

La Public API non duplica queste cancellazioni: sarebbe una seconda business logic. Espone invece `deletionCoverage.status=partial` finche il Core non chiude il perimetro in un unico posto.

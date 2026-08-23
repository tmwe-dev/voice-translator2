# Verifica delle capability esposte

Snapshot del Core usato per questa revisione: `86e087369565f01ed748c12281b215b57a4e7feb` — **b.414 / push #708**, 23 agosto 2026.

## Regola

Un endpoint entra nella Public API solo se:

1. esiste realmente nel Core corrente;
2. il Core mantiene la responsabilita critica;
3. il gateway puo imporre identita/scope senza indebolire il contratto;
4. non promuove una rotta test/admin/cron/webhook;
5. una mutazione finanziaria non crea un nuovo rischio evidente di duplicazione.

## Matrice principale

| Public API | Core | Verifica |
|---|---|---|
| `/v1/health` | `/api/health` | porta pubblica di health |
| `/v1/me` | `/api/user` | sessione Core, profilo |
| `/v1/me/data` | `/api/user action=delete-data` | usa esattamente il perimetro GDPR dichiarato dal Core |
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
| `/v1/companions/{id}/live-sessions` | `/api/compagni/live/session` | server-resolved companion, signed URL, wallet |
| `/v1/topics/search` | `/api/topics/search` | NDJSON preservato |
| `/v1/learning/*` | `/api/compagni/*` e `/api/compiti` | Life usa il Core; b.414 aggiunge smoke produzione sulle porte |
| `/v1/conversations*` | `/api/conversation` | account/partecipazione e Direct guard nel Core |
| `/v1/realtime/*` | `/api/turn`, `/api/stanza-video` | TURN temporaneo e membership di stanza |
| `/v1/contacts` | `/api/contacts` | il gateway sovrascrive il campo `token` |
| `/v1/glossaries` | `/api/glossary` | ownership nel Core |
| `/v1/community` | `/api/mondo` | pubblicazione/privilegi restano nel Core |
| `/v1/peepoff` | `/api/peepoff` | signaling/presenza; contenuto messaggi non memorizzato dal route |
| `/v1/taxi/destination` | `/api/taxi/destination` | ciphertext-only |

## Correzioni rispetto alla prima API v1

- `/v1/wallet` non usa piu il vecchio `getCredits()` di `/api/user`: usa `/api/wallet/saldo`.
- aggiunto `DELETE /v1/companions/{id}/memory` per la funzione **Dimentica** di b.411.
- aggiunti `GET/PUT /v1/preferences`.
- aggiunto BYOK `GET/POST/DELETE /v1/provider-keys` con scope dedicati.
- aggiunti checkout ricarica e riscatti wallet sicuri.
- gli scope di default non includono piu automaticamente tutte le scritture sensibili.

## Funzioni volutamente NON pubblicate

- admin, debug, test, cron, webhook;
- Stripe raw;
- subscription legacy;
- translate-test/free/test-llm e TTS test;
- invio regalo di credito: oggi il Core non espone un contratto idempotente per questa mutazione. Un retry non deve poter scalare due volte.

## Stato dei problemi dell'audit rilevanti al Core

Verificato sul database vivo durante questa revisione:

- le 8 tabelle precedentemente senza RLS hanno `RLS=true` e nessun SELECT per `anon/authenticated`;
- le 3 funzioni Mondo `SECURITY DEFINER` non sono eseguibili da `anon/authenticated` e hanno `search_path=public, pg_temp`;
- `compagno_memorie` e ancora a **0 righe**: la memoria e tecnicamente riparata ma non risulta usata nei dati vivi al momento della verifica.

b.410-b.414 hanno inoltre aggiunto isolamento locale tra account, minimizzazione deterministica della memoria sensibile, dimentica/cancellazione ricordi, conteggio server-side dei turni memoria, stato delle fonti, abort del Tavolo e smoke Life.

## Limiti ancora dichiarati

- Il Live usa ancora il runtime cognitivo ElevenLabs scelto dalla Via B; non e lo stesso runtime completo della chat scritta.
- Il tetto/contabilizzazione della sessione Live non risulta modificato da b.411-b.414.
- b.413 usa HMAC per l'identita Life **solo se `MONDO_ID_SECRET` e impostato**; senza variabile il Core ricade intenzionalmente sul digest precedente.
- I test di produzione b.414 verificano le porte Life e i rifiuti 401/contratto Topics, non chiamate AI a pagamento.

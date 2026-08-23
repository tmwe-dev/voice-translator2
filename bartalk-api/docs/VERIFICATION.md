# Verifica delle capability esposte

Snapshot Core: `ee1a845845417ce43e0c4af8464531b53e8bbe8c` — **b.420 / push #712**, 23 agosto 2026.

## Regola

Un endpoint entra nella Public API solo se:

1. esiste realmente nel Core corrente;
2. la capability e realmente operativa sul backend vivo;
3. il Core mantiene la responsabilita critica;
4. il gateway puo imporre identita/scope senza indebolire il contratto;
5. non e test/admin/cron/webhook;
6. le mutazioni finanziarie sono idempotenti o progettate per retry sicuro;
7. la documentazione non promette una garanzia piu forte di quella verificata.

## Stato Core verificato

- main: b.420 / push #712.
- Vercel Core: status `success` sul commit b.420.
- b.420 chiude le tre race Live: apertura concorrente, renew-vs-close e commit contato senza esito.
- Database vivo: wallet, Compagni e tabelle Mondo auditate presenti.
- Database vivo: `profiles`, `user_settings`, `payments`, `usage_daily`, `audit_logs`, `glossaries` assenti; `translations` presente ma a zero righe nell'ultima verifica.
- `contacts`, conversazioni e stanze dell'app sono Redis-backed: l'assenza di omonime tabelle SQL non le rende rotte.

## Matrice pubblicata

| Public API | Core | Nota |
|---|---|---|
| `/health` | gateway + `/api/health` | readiness anche del signing secret |
| `/auth/exchange` | `/api/user?action=profile` | sessione verificata prima dell'emissione |
| `/me*` | `/api/user` | account Redis autorevole |
| `/wallet*` | wallet + `/api/user payments` | ledger + storico Redis |
| `/translate` | `/api/translate` | provider routing/wallet nel Core |
| `/transcribe` | `/api/transcribe` | multipart bounded + auth Core |
| `/tts*` | `/api/tts*` | wallet/provider Core |
| `/companions*` | `/api/compagni/*` | ownership/memoria/wallet Core |
| `/live-sessions/*` | `/api/compagni/live/session` | apri/rinnova/chiudi b.420 |
| `/learning/*` | Life/compiti Core | identita Core; deposito QR pubblico bounded |
| `/topics/search` | `/api/topics/search` | NDJSON + session probe |
| `/rooms`, `/messages` | Redis room/message Core | room capability token + session probe API |
| `/conversations*` | archivio Redis Core | account/partecipazione Core |
| `/realtime/*` | TURN/video Core | TURN puo essere vuoto finche non configurato |
| `/contacts` | Redis contacts Core | account session Core |
| `/community` | Mondo Core | roomSessionToken per pubblicazione + session probe API |
| `/summary`, `/moderation` | Core | scope API + regole Core |
| `/peepoff` | Core | identita/account Core |
| `/taxi/destination` | Core | ciphertext-only + session probe API |

## Superfici volutamente escluse

### Preferenze server

`/api/user?action=get-prefs` e `sync-prefs` dipendono da `profiles/user_settings`. Il DB vivo non ha queste tabelle: GET degrada a `{prefs:{}}` e PUT puo rispondere `ok` pur saltando il salvataggio. Non e un contratto pubblico accettabile.

### Provider-key vault

`/api/keys` / `keyVault.js` dipendono da `profiles` e `api_keys_vault`; il percorso realmente usato dall'app per BYOK e invece Redis-backed via `/api/user action=save-keys`. La v1 non espone il vault legacy finche il Core non unifica il contratto.

### Glossari

`/api/glossary` dipende da `profiles` e `glossaries`, assenti nel DB vivo. Le rotte glossario restano fuori dalla API finche la capability non e realmente persistente.

## Hardening gateway verificabile da test

- `scopes: []` resta vuoto.
- TTL API massimo 7 giorni.
- token enormi/malformati rifiutati prima della decodifica.
- path params non possono contenere slash decodificati.
- heartbeat Live forza azione/sessione dal path.
- `fixedBody` vince sul body client.
- query fissate non possono essere duplicate.
- token sensibili non transitano dalla query.
- multipart controllato sui byte reali.
- `Content-Length` upstream non viene copiato.
- route identityless richiedono session probe.
- public rate limit separato per client.
- health fallisce se manca signing secret o Core.
- OpenAPI copre tutte e sole le route registrate.

## Limiti non classificati come bug API

- TURN/coturn: infrastruttura del Core da configurare.
- `MONDO_ID_SECRET`: configurazione production del Core da verificare.
- retention ElevenLabs: scelta di collaudo da cambiare prima di utenti reali.
- matrice iPhone/Android/Bluetooth/NAT: collaudo fisico, non codice gateway.

## Gate prima della pubblicazione production API

```bash
npm test
npm run lint
npm run build
```

Poi smoke reali:

1. `GET /api/v1/health` -> 200;
2. `GET /openapi` -> 200 OpenAPI 3.1;
3. `/auth/exchange` con sessione valida -> `bt_live_*`;
4. `scopes: []` -> chiave emessa ma endpoint scoped -> 403;
5. chiave alterata -> 401;
6. sessione Core revocata -> API key rifiutata anche su `/topics/search` o `/voices`;
7. Live open -> heartbeat -> close;
8. payload oversize -> 413;
9. DELETE account -> `deletionCoverage.auditedCore=b.420`.

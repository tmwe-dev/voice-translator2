# Deploy autonomo BarTalk API v1

Ultimo allineamento Core verificato: **b.419 / push #711** (`d83df8455b08fbd7837c6a547f32b7d6ad9b9db9`).

## Vercel

- Progetto creato: `bartalk-api`
- Team: `tmweapps-projects`
- Alias produzione assegnato al deploy iniziale: `bartalk-api-tmweapps-projects.vercel.app`
- Deployment produzione iniziale creato: `dpl_H63Gedobxxar2jNeEiFhfFmP3qhy`
- Inspector iniziale: `https://vercel.com/tmweapps-projects/bartalk-api/H63Gedobxxar2jNeEiFhfFmP3qhy`

Il deploy e separato dal progetto BarTalk Core e contiene esclusivamente il runtime della API.

## Configurazione server-side

Necessarie:

- `BARTALK_API_SIGNING_SECRET` — segreto >= 32 caratteri per AES-256-GCM delle API key.
- `BARTALK_CORE_URL` — URL del Core BarTalk (`https://voice-translator2.vercel.app`).
- `BARTALK_API_KEY_TTL_DAYS` — default 6.

Opzionali ma consigliate per rate limit distribuito:

- `API_REDIS_URL`
- `API_REDIS_TOKEN`

I valori segreti **non devono essere committati** in GitHub.

### Stato di verifica delle env

Il connettore usato per creare il progetto/deploy non esponeva in modo coerente la lettura dei progetti/env dello stesso team. Questa documentazione quindi non afferma che il segreto di firma sia persistito nel progetto finche non viene verificato tramite un test reale di `/auth/exchange` o un canale Vercel di lettura coerente.

## Verifica minima di produzione dopo b.419

1. `GET /docs` deve caricare la documentazione.
2. `GET /openapi` deve restituire OpenAPI 3.1 con `/live-sessions/{sessionId}/heartbeat`.
3. `GET /api/v1/health` deve raggiungere il Core.
4. `POST /api/v1/auth/exchange` con sessione BarTalk valida deve emettere una chiave `bt_live_...`.
5. Una chiave alterata/scaduta deve essere rifiutata.
6. Le route account devono sovrascrivere `token/userToken` col valore autenticato dal gateway.
7. Apertura Live deve restituire `sessioneId` e `battitoSecondi`; l'heartbeat deve inoltrare `azione=rinnova` con il `sessionId` del path.
8. `DELETE /api/v1/me/data` deve dichiarare `auditedCore=b.419`, non elencare piu follow/like/segnalazioni come residui, e mantenere esplicite le retention di policy.
9. `GET /api/v1/realtime/ice` puo legittimamente restituire `iceServers: []` finche il Core non ha coturn + `TURN_SECRET/TURN_URLS`.

## Regola di isolamento

Il deploy/API non richiede modifiche a `voice-translator-vercel/`. Qualunque evoluzione della API resta in `bartalk-api/` e deve essere riallineata alle capability reali del Core prima di essere pubblicata.

# Deploy autonomo BarTalk API v1

Ultimo allineamento Core verificato: **b.416 / push #710** (`8e831153f5a29e0e66ef506d4207a9826accdb4e`).

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

Il connettore usato per creare il progetto/deploy non espone in modo coerente la lettura dei progetti/env dello stesso team: `list_projects/get_project/get_deployment` hanno restituito zero progetti/404 anche dopo una creazione riuscita. Di conseguenza questa documentazione **non afferma** che `BARTALK_API_SIGNING_SECRET` sia persistita nel progetto finche non viene verificata da Vercel tramite un canale di lettura funzionante o da un test reale di `/auth/exchange`.

Un deploy che mostra `/docs` ma non possiede il segreto puo comunque costruire l'app; fallira invece l'emissione delle API key. La prova autorevole e quindi il punto 4 qui sotto, non la sola build.

## Verifica minima di produzione

1. `GET /docs` deve caricare la documentazione.
2. `GET /openapi` deve restituire OpenAPI 3.1.
3. `GET /api/v1/health` deve raggiungere il Core.
4. `POST /api/v1/auth/exchange` con una sessione BarTalk valida deve emettere una chiave `bt_live_...`. **Questo verifica anche che il segreto di firma sia realmente disponibile al runtime.**
5. Una chiave alterata/scaduta deve essere rifiutata.
6. Le route account devono continuare a sovrascrivere `token/userToken` col valore autenticato dal gateway.
7. `DELETE /api/v1/me/data` deve restituire `deletionCoverage.status=partial` finche il Core non completa il perimetro di cancellazione.
8. `GET /api/v1/realtime/ice` puo legittimamente restituire `iceServers: []` finche il Core non ha coturn + `TURN_SECRET/TURN_URLS`.

## Regola di isolamento

Il deploy/API non richiede modifiche a `voice-translator-vercel/`. Qualunque evoluzione della API resta in `bartalk-api/` e deve essere riallineata alle capability reali del Core prima di essere pubblicata.

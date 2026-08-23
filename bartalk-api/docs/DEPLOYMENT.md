# Deploy autonomo BarTalk API v1

Ultimo allineamento Core: **b.420 / push #712** (`ee1a845845417ce43e0c4af8464531b53e8bbe8c`).

## Vercel

- Progetto previsto: `bartalk-api`
- Team: `tmweapps-projects`
- Alias storico: `bartalk-api-tmweapps-projects.vercel.app`
- Core: `https://voice-translator2.vercel.app`

Il deploy API e separato dal progetto Core e contiene soltanto `bartalk-api/`.

## Configurazione server-side

Necessarie:

- `BARTALK_API_SIGNING_SECRET` — >=32 caratteri;
- `BARTALK_CORE_URL` — URL Core;
- `BARTALK_API_KEY_TTL_DAYS` — intero 1-7, default 6.

Consigliate:

- `API_REDIS_URL`
- `API_REDIS_TOKEN`

Nessun valore segreto deve essere committato.

## Readiness autorevole

Il vecchio problema era che il progetto poteva costruire e servire `/docs` anche senza il signing secret, mentre `/auth/exchange` sarebbe fallito. Ora:

`GET /api/v1/health`

ritorna **200 soltanto** se:

1. il Core risponde;
2. il signing secret e disponibile al runtime.

Quindi la prova di deploy non dipende piu dalla possibilita del connettore di leggere le env: la verifica avviene dall'interno del runtime senza esporre il valore.

## Gate production

Prima del deploy:

```bash
npm test
npm run lint
npm run build
```

Dopo il deploy:

1. `/api/v1/health` -> 200;
2. `/openapi` -> OpenAPI 3.1 con snapshot b.420;
3. `/auth/exchange` con sessione valida -> chiave `bt_live_*`;
4. chiave scoped valida -> endpoint consentito;
5. chiave con `scopes: []` -> endpoint scoped 403;
6. sessione BarTalk revocata -> la chiave smette di funzionare anche sulle route con session probe;
7. Live open/heartbeat/close;
8. chiave alterata/scaduta -> 401;
9. payload oversize -> 413.

## Regola di isolamento

Qualunque evoluzione della Public API resta in:

- `bartalk-api/**`
- `.github/workflows/bartalk-api.yml`

Nessuna modifica API deve apparire dentro `voice-translator-vercel/**`.

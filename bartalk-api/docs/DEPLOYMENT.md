# Deploy autonomo BarTalk API v1

Ultimo allineamento Core verificato: **b.415 / push #709** (`3451c21916d5f6538f0438d9b318c7df7b4487d0`).

## Vercel

- Progetto: `bartalk-api`
- Team: `tmweapps-projects`
- Alias produzione: `bartalk-api-tmweapps-projects.vercel.app`
- Deployment produzione creato: `dpl_H63Gedobxxar2jNeEiFhfFmP3qhy`
- Inspector: `https://vercel.com/tmweapps-projects/bartalk-api/H63Gedobxxar2jNeEiFhfFmP3qhy`

Il deploy e separato dal progetto BarTalk Core e contiene esclusivamente i file runtime della cartella `bartalk-api/`.

## Configurazione server-side

Necessarie:

- `BARTALK_API_SIGNING_SECRET` — segreto >= 32 caratteri per AES-256-GCM delle API key.
- `BARTALK_CORE_URL` — URL del Core BarTalk (`https://voice-translator2.vercel.app`).
- `BARTALK_API_KEY_TTL_DAYS` — default 6.

Opzionali ma consigliate per rate limit distribuito:

- `API_REDIS_URL`
- `API_REDIS_TOKEN`

I valori segreti **non sono committati** in GitHub. Il primo deploy autonomo e stato creato tramite upload diretto Vercel; la configurazione privata e stata fornita soltanto al pacchetto di deploy.

## Verifica

Il connettore Vercel usato per creare il deploy presenta al momento una incoerenza di lettura: crea correttamente deployment nel team ma le azioni `list_projects/get_deployment` dello stesso collegamento restituiscono zero progetti/404. Per questo il repository non dichiara `READY` sulla sola base di quel canale di lettura.

Controlli da mantenere:

1. `GET /docs` deve caricare la documentazione.
2. `GET /openapi` deve restituire OpenAPI 3.1.
3. `GET /api/v1/health` deve raggiungere il Core.
4. `POST /api/v1/auth/exchange` con una sessione BarTalk valida deve emettere una chiave `bt_live_...`.
5. Una chiave alterata/scaduta deve essere rifiutata.
6. Le route account devono continuare a sovrascrivere `token/userToken` col valore autenticato dal gateway.

## Regola di isolamento

Il deploy/API non richiede modifiche a `voice-translator-vercel/`. Qualunque evoluzione della API resta in `bartalk-api/` e deve essere riallineata alle capability reali del Core prima di essere pubblicata.

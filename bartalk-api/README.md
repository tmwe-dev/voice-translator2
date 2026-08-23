# BarTalk API v1

Gateway API separato per `voice-translator2`.

- Branch: `bartalk-api-v1`
- Sorgente API: `bartalk-api/`
- Core BarTalk: non duplicato e non modificato dalla API
- Snapshot Core verificato: **b.420 / push #712** (`ee1a845845417ce43e0c4af8464531b53e8bbe8c`)

## Principio

`client esterno -> API key/scopes/rate limit -> BarTalk Core -> business logic`

Il Core resta autoritativo su identita, credito, privacy, membership, memoria e provider. La API pubblica soltanto capability che risultano realmente operative sul backend vivo.

## Sicurezza v1

- API key `bt_live_...` cifrata/autenticata AES-256-GCM.
- TTL massimo **7 giorni**, coerente con la sessione BarTalk sottostante.
- `scopes: []` significa zero privilegi; i default si applicano solo se `scopes` viene omesso.
- Lunghezza/formato delle API key limitati prima della decodifica.
- Logout, scadenza o cancellazione della sessione BarTalk revocano anche le route API che non inoltrano direttamente il token: il gateway fa un session probe sul Core.
- `token`/`userToken` sono sempre sostituiti dal gateway sulle route che li usano.
- Identificativi del path prevalgono sul body.
- Query fissate e `fixedBody` sono autoritativi.
- Rate limit delle porte pubbliche separato per client, non globale per tutto Internet.
- JSON limitato sui byte reali; multipart limitato sul corpo realmente letto, anche se `Content-Length` manca o mente.
- Il gateway non inoltra `Content-Length` upstream potenzialmente obsoleto dopo streaming/decompressione.
- Request ID normalizzato prima di essere inoltrato/risposto.
- Admin/debug/test/cron/webhook e Stripe raw esclusi.
- Mutazioni finanziarie non idempotenti non vengono pubblicate.

## Readiness

`GET /api/v1/health` e un health **del gateway**, non soltanto del Core. Torna `200` solo se:

1. il Core `/api/health` risponde;
2. `BARTALK_API_SIGNING_SECRET` e realmente configurato.

Altrimenti torna `503`, senza esporre valori segreti.

## Live Companion

Il Core b.420 usa riserve a tratti e protocollo completo:

1. `POST /companions/{id}/live-sessions` — apre;
2. `POST /live-sessions/{sessionId}/heartbeat` — rinnova con la cadenza `battitoSecondi` restituita dall'apertura;
3. `DELETE /live-sessions/{sessionId}` — chiude.

b.420 serializza apertura/rinnovo/chiusura, impedisce la doppia apertura concorrente e conta come addebitato soltanto cio che il wallet ha realmente confermato.

## Capability volutamente NON pubblicate

Tre superfici del Core esistono come codice ma dipendono oggi dallo schema Supabase legacy non presente nel database vivo:

- preferenze server (`profiles` + `user_settings`);
- `/api/keys` / provider-key vault (`profiles` + `api_keys_vault`);
- glossari (`profiles` + `glossaries`).

Una API corretta non espone una capability morta. Verranno reinserite solo quando il Core avra un contratto persistente realmente funzionante e testato.

Il BYOK usato dall'app BarTalk continua a funzionare tramite il percorso Redis autorevole del Core (`/api/user action=save-keys`); quello che non viene pubblicato e il vecchio vault Supabase incompleto.

## Configurazione

Necessarie:

- `BARTALK_API_SIGNING_SECRET` (>=32 caratteri)
- `BARTALK_CORE_URL` se diverso dalla produzione predefinita
- `BARTALK_API_KEY_TTL_DAYS` (1-7, default 6)

Consigliate per rate limit distribuito:

- `API_REDIS_URL`
- `API_REDIS_TOKEN`

## Verifica

```bash
npm install --ignore-scripts
npm test
npm run lint
npm run build
```

Il workflow `.github/workflows/bartalk-api.yml` esegue gli stessi gate sulla branch.

Vedi:
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/VERIFICATION.md`
- `docs/DEPLOYMENT.md`
- `/openapi`

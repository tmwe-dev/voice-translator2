# BarTalk API v1

Gateway API separato per `voice-translator2`.

- Branch: `bartalk-api-v1`
- Sorgente API: `bartalk-api/`
- Core BarTalk: non duplicato e non modificato dalla API
- Snapshot Core verificato: **b.415 / push #709**

## Principio

La Public API non ricopia traduzione, wallet, memoria, Compagni o provider. Fa da frontiera stabile:

`client esterno -> API key/scopes/rate limit -> BarTalk Core -> business logic`

Il Core resta autoritativo su identita, credito, privacy, membership, Direct Mode, memoria e provider.

## Superfici esposte

- Health
- Profilo, preferenze e cancellazione dati prevista dal Core
- Stato/salvataggio/rimozione chiavi provider BYOK
- Wallet contabile, storico, checkout ricarica, riscatto voucher/regalo
- Traduzione, STT, TTS, ElevenLabs TTS, clonazione voce
- Compagni CRUD, chat, memoria/dimentica, Live, Podcast, Tavolo, avatar, generazione
- Life: corsi, dossier, compiti, scansioni
- Topics NDJSON
- Rooms, messages, archivio conversazioni, reazioni, realtime/TURN
- Contacts, Glossary, Summary, Moderation, Mondo
- PeepOff e TaxiTalk

La lista esatta e sempre generata da `lib/routes.js` e pubblicata su `/openapi`.

## Sicurezza

- API key `bt_live_...` cifrata/autenticata AES-256-GCM.
- La sessione BarTalk incapsulata resta verificata dal Core a ogni operazione.
- Scope espliciti e **least privilege di default**: gli scope di scrittura/finanziari/BYOK vanno richiesti.
- Il gateway sovrascrive `userToken`/`token` con l'identita contenuta nella API key.
- Rate limit per chiave; Redis distribuito opzionale; restano anche i limiti del Core.
- Nessuna service-role o chiave provider esposta.
- Admin/debug/test/cron/webhook e Stripe raw esclusi.
- `POST /wallet/gifts` (invio credito) non e esposto finche il Core non offre idempotenza: un retry di rete non deve poter regalare due volte.

## Configurazione

Copia `.env.example`. Minimo:

- `BARTALK_API_SIGNING_SECRET`
- `BARTALK_CORE_URL` se diverso dalla produzione predefinita
- `API_REDIS_URL` / `API_REDIS_TOKEN` consigliati per rate limit distribuito

## Verifica

```bash
npm install --ignore-scripts
npm test
npm run lint
npm run build
```

Il workflow `.github/workflows/bartalk-api.yml` esegue gli stessi tre gate sulla branch.

Vedi:
- `docs/API.md`
- `docs/ARCHITECTURE.md`
- `docs/VERIFICATION.md`
- `/openapi`

## Allineamento GDPR b.415

`DELETE /api/v1/me/data` usa il nuovo cancellatore centrale del Core b.415: revoca tutte le sessioni e rimuove i dati persistenti Life/Compagni/PeepOff previsti dal Core. Restano volutamente fuori il ledger wallet e i contenuti pubblici Mondo secondo la policy dichiarata dal prodotto.

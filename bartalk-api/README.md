# BarTalk API v1

Gateway API separato per `voice-translator2`.

- Branch: `bartalk-api-v1`
- Sorgente API: `bartalk-api/`
- Core BarTalk: non duplicato e non modificato dalla API
- Snapshot Core verificato: **b.419 / push #711**

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
- Compagni CRUD, chat, memoria/dimentica, Live con heartbeat, Podcast, Tavolo, avatar, generazione
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
- Gli ID nei path sono autoritativi per le mutazioni sensibili (Compagni, Live, conversazioni, glossari).
- Rate limit per chiave; Redis distribuito opzionale; restano anche i limiti del Core.
- Nessuna service-role o chiave provider esposta.
- Admin/debug/test/cron/webhook e Stripe raw esclusi.
- `POST /wallet/gifts` (invio credito) non e esposto finche il Core non offre idempotenza: un retry di rete non deve poter regalare due volte.

## Live b.419

Il Core b.418/b.419 contabilizza il Live a tratti e permette una sola sessione per account. L'apertura restituisce `sessioneId` e `battitoSecondi`.

Un client Public API deve:

1. aprire con `POST /companions/{id}/live-sessions`;
2. inviare `POST /live-sessions/{sessionId}/heartbeat` con la cadenza indicata da `battitoSecondi`;
3. chiudere con `DELETE /live-sessions/{sessionId}`.

Se il rinnovo fallisce per credito esaurito il Core puo rispondere `402` e la linea non deve continuare gratis. Il gateway non calcola costi: inoltra il contratto autorevole del Core.

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

## Allineamento GDPR b.419

`DELETE /api/v1/me/data` usa il cancellatore centrale del Core. b.419 include anche i metadati personali Mondo auditati (`mondo_follows`, `mondo_comment_likes`, `mondo_segnalazioni`). Restano volutamente fuori il ledger wallet e i contenuti pubblici Mondo secondo la policy dichiarata dal prodotto.

La superficie legacy `translation_history` non viene dichiarata cancellata: nel database vivo `translations` e vuota e il percorso attuale non la popola perche dipende dalla vecchia tabella `profiles`, assente. La Public API segnala questa distinzione invece di inventare una garanzia.

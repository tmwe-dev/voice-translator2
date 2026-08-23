# BarTalk API v1

Gateway API separato per `voice-translator2`. Vive nella cartella `bartalk-api/` della branch `bartalk-api-v1`; nessun file del BarTalk Core e stato modificato per costruirlo.

## Funzionamento

1. L'utente ottiene una normale sessione BarTalk.
2. `POST /api/v1/auth/exchange` verifica la sessione contro `/api/user?action=profile` del Core.
3. Il gateway emette una API key `bt_live_...` cifrata AES-256-GCM, con scope e scadenza.
4. Le chiamate v1 decifrano la chiave, ricavano la sessione e la inseriscono nel campo/header atteso dal Core.
5. Il Core continua a decidere autenticazione, credito, privacy, provider, memoria e business logic.

## Endpoint principali

- Health, profilo, wallet, preferenze
- Translate, STT, TTS, ElevenLabs TTS, voci, clonazione voce
- Compagni CRUD, chat, Live, Podcast, Tavolo, corsi, dossier, avatar
- Topics streaming NDJSON
- Rooms, Messages, archivio conversazioni, reazioni, Contacts, Glossary, Summary, Moderation, Mondo
- PeepOff, Taxi destination/revoca, TURN e signaling video di gruppo

Specifica completa: `/openapi` o `lib/openapi.js`.

## Sicurezza

- API key cifrata e autenticata con AES-256-GCM.
- Scope espliciti.
- Sessione BarTalk non viene accettata dal body dei client v1: il gateway sovrascrive il campo con quello contenuto nella API key.
- Rate limit per chiave; Redis distribuito opzionale, Core rate-limit sempre presente.
- Rotte admin/debug/test/Stripe non sono esposte.
- Nessuna chiave provider o service-role nel client.

## Configurazione

Copia `.env.example` e imposta almeno `BARTALK_API_SIGNING_SECRET`.

## Test

```bash
npm ci
npm test
npm run lint
npm run build
```

Vedi `docs/VERIFICATION.md` per la matrice Core -> Public API.

## Durata delle API key

La TTL della chiave API e un **massimo**. La chiave incapsula una sessione BarTalk verificata: se quella sessione viene revocata o scade prima, il Core rifiuta subito anche la API key. Il default del gateway e 6 giorni per non promettere una durata maggiore della sessione applicativa.

## Uso delle chiavi

Le chiavi `bt_live_...` sono credenziali **server-side**. Non vanno incorporate in JavaScript pubblico, repository, app distribuite o URL. Per browser/mobile si usa normalmente la sessione applicativa BarTalk e, nelle stanze, il relativo room session token.

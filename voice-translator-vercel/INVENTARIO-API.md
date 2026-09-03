# Inventario delle rotte API

> Generato da `scripts/inventario-api.mjs`. **Non modificare a mano.**
>
> La prima versione segnalo dieci cose e le prime quattro verificate
> erano tutte false. Cercava stringhe invece di confrontare fatti.
> Ora si segnala solo cio che si sa mettere a confronto: chiave
> contro chiave. Il resto sta sotto "da leggere", e non si chiama
> difetto.

Rotte totali: **84** — vive: **83**, rimosse: **1**

## Come si legge

| Colonna | Cosa significa |
| --- | --- |
| Guardia | passa da `withApiGuard`: limite, dimensione del corpo, corpo malformato |
| Chiave guardia | il secchio su cui conta la guardia |
| Chiavi proprie | i secchi che la rotta conta da se. **Diversi dal primo = limite annidato, voluto.** Uguali = si conta due volte |
| Valida ingresso | controlla i campi con uno schema, non a occhio |
| Rispetta Diretta | rifiuta di lavorare se la sessione e in modalita Diretta |
| Verifica sessione | ricava chi sei da un gettone, non da cio che dichiari |

## Rotte vive

| Rotta | Metodi | Guardia | Chiave guardia | Chiavi proprie | Valida ingresso | Rispetta Diretta | Verifica sessione |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /api/admin | POST | si | admin | — | — | — | si |
| /api/auth | POST | si | auth | auth-otp | — | — | si |
| /api/auth/apple | POST | si | auth-apple | — | — | — | — |
| /api/auth/google | POST | si | auth-google | — | — | — | — |
| /api/auth/google-callback | GET | si | auth-google-callback | auth-google-cb | — | — | — |
| /api/auth/oauth-state | GET | si | oauth-state-guard | oauth-state | — | — | — |
| /api/chat-action | POST | si | chat-action | — | — | — | — |
| /api/compagni/amico | POST | si | compagni-amico | — | — | — | si |
| /api/compagni/avatar | POST | si | compagni-avatar | — | — | — | — |
| /api/compagni/corso | POST | si | compagni-corso | — | — | — | si |
| /api/compagni/dossier | POST | si | compagni-dossier | — | — | — | — |
| /api/compagni/genera | POST | si | compagni-genera | — | — | — | — |
| /api/compagni/live/session | POST | si | compagni-live-session | — | — | — | si |
| /api/compagni/mie | POST | si | compagni-mie | — | — | — | si |
| /api/compagni/podcast | POST | si | compagni-podcast | — | — | — | si |
| /api/compagni/tavolo | POST | si | compagni-tavolo | — | — | — | si |
| /api/compiti | POST | si | compiti | — | — | — | si |
| /api/contacts | POST | si | contacts | — | — | — | si |
| /api/conversation | POST GET | si | conversation | — | — | si | si |
| /api/debug | POST | si | debug | — | — | — | si |
| /api/health | GET | si | health | — | — | — | si |
| /api/messages | POST PATCH GET | si | messages | messages-patch | — | si | si |
| /api/moderazione | POST | si | moderazione | — | — | — | si |
| /api/mondo | POST GET | si | mondo | — | — | — | si |
| /api/mondo/avvisi | GET | si | avvisi-get | — | — | — | — |
| /api/mondo/commenti | POST GET | si | commenti-post | — | — | — | — |
| /api/mondo/discussioni | GET POST | si | mondo-disc-get | — | — | — | si |
| /api/mondo/gradimento | POST GET | si | cuori-post | — | — | — | — |
| /api/mondo/live | GET | si | — | mondo-live-sse | — | — | — |
| /api/mondo/live/ingest | GET | — | — | — | — | — | — |
| /api/mondo/paese | GET | si | mondo-paese | — | — | — | — |
| /api/mondo/push | GET POST DELETE | si | mondo-push-get | — | — | — | — |
| /api/mondo/reazioni | POST GET | si | reazioni-post | — | — | — | — |
| /api/mondo/registro | GET | si | — | mondo-registro | — | — | — |
| /api/mondo/segnali | POST GET | si | segnali-post | — | — | — | — |
| /api/mondo/tema | GET | si | mondo-tema | — | — | — | — |
| /api/og | GET | — | — | — | — | — | — |
| /api/peepoff | POST | si | peepoff | — | — | — | si |
| /api/push-send | POST | si | push-send | — | — | — | si |
| /api/push-subscribe | POST GET DELETE | si | push-subscribe | — | — | — | si |
| /api/reazioni | POST | si | reazioni | — | — | — | si |
| /api/room | POST GET | si | room | — | — | — | si |
| /api/stanza-video | POST | si | stanza-video | — | — | — | si |
| /api/startrek | POST | si | startrek-guard | startrek | — | — | — |
| /api/stripe | POST | si | stripe | — | — | — | — |
| /api/stripe/webhook | POST | si | — | — | — | — | — |
| /api/stt-token | POST | si | stt-token | — | — | — | si |
| /api/subscription | POST | si | subscription | — | — | — | si |
| /api/summary | POST | si | summary | — | — | si | si |
| /api/taxi/destination | POST GET DELETE | si | taxi-dest | taxi taxi-get taxi-del | — | — | — |
| /api/test-login | POST | si | test-login | — | — | — | — |
| /api/topics/fonti | POST GET | si | topics-fonti | — | — | — | — |
| /api/topics/link | GET | si | topics-link | — | — | — | — |
| /api/topics/rami | POST | si | topics-rami | — | — | — | — |
| /api/topics/riassunto | POST | si | topics-sintesi | — | — | — | si |
| /api/topics/search | GET | si | topics | — | — | — | — |
| /api/topics/video | GET | si | topics-video | — | — | — | — |
| /api/transcribe | POST | si | transcribe | — | — | — | — |
| /api/translate | POST | si | translate | — | si | — | — |
| /api/translate-consensus | POST | si | translate-consensus | — | — | — | si |
| /api/translate-free | POST | si | translate-free | free-translate free-chars | — | — | si |
| /api/translate-test | POST | si | translate-test | — | — | — | — |
| /api/translate-test-llm | POST | si | translate-test-llm | — | — | — | — |
| /api/tts | POST | si | tts | — | si | — | — |
| /api/tts-edge | GET POST | si | tts-edge | — | — | — | — |
| /api/tts-elevenlabs | POST GET | si | tts-elevenlabs | — | — | — | si |
| /api/tts-test | POST | si | tts-test | — | — | — | — |
| /api/turn | GET | si | turn | — | — | — | — |
| /api/user | POST GET | si | user | — | — | — | si |
| /api/user/export | GET POST | si | user-export | — | — | — | si |
| /api/video/sottotitoli | GET | si | video-sottotitoli | — | — | — | — |
| /api/voci | GET POST | si | voci | — | — | — | — |
| /api/voice-clone | POST GET | si | voice-clone | — | — | si | si |
| /api/wallet/admin | GET POST | si | wallet-admin | — | — | — | — |
| /api/wallet/benvenuto | POST | si | wallet-benvenuto | — | — | — | si |
| /api/wallet/cron-rilascia-riserve | GET | si | wallet-cron-riserve-guard | wallet-cron-riserve | — | — | — |
| /api/wallet/cron-rimborso-regali | GET | si | wallet-cron-regali-guard | wallet-cron-regali | — | — | — |
| /api/wallet/regalo | POST | si | wallet-regalo | — | — | — | si |
| /api/wallet/ricarica | POST | si | wallet-ricarica | — | — | — | si |
| /api/wallet/saldo | GET | si | wallet-saldo | — | — | — | si |
| /api/wallet/snapshot | GET | si | — | wallet-snapshot | — | — | — |
| /api/wallet/voucher | POST | si | wallet-voucher | — | — | — | si |
| /api/wallet/webhook | POST | si | — | — | — | — | — |

## Rotte rimosse (rispondono 410)

- `/api/lending`

## Difetti (confrontati, non sospettati)

### Rotte che si contano due volte sulla stessa chiave

Nessuna.

### Rotte senza nessuna protezione

Nessuna.

## Da leggere (serve giudizio: NON sono difetti)

### Aperte per scelta, con il motivo scritto accanto (2)

- `/api/health` — un sorvegliante esterno deve poter chiedere se l'applicazione e viva, senza credenziali
- `/api/og` — la chiedono i programmi di WhatsApp e dei social, che non hanno credenziali

### Chiuse in un modo diverso dalla guardia (1)

- `/api/mondo/live/ingest`

Pagine di collaudo dietro un interruttore o una parola d'ordine.

### Prendono un'identita dal corpo senza verificare una sessione (5)

- `/api/auth/apple`
- `/api/auth/google`
- `/api/auth/google-callback`
- `/api/startrek`
- `/api/stripe/webhook`

Da guardare a mano: alcune non decidono niente in base a
quel valore, lo rigirano e basta.

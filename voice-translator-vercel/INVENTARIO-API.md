# Inventario delle rotte API

> Generato da `scripts/inventario-api.mjs`. **Non modificare a mano.**
>
> La prima versione segnalo dieci cose e le prime quattro verificate
> erano tutte false. Cercava stringhe invece di confrontare fatti.
> Ora si segnala solo cio che si sa mettere a confronto: chiave
> contro chiave. Il resto sta sotto "da leggere", e non si chiama
> difetto.

Rotte totali: **42** — vive: **38**, rimosse: **4**

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
| /api/analytics | POST | si | analytics | — | — | — | si |
| /api/auth | POST | si | auth | auth-otp | — | — | si |
| /api/chat-action | POST | si | chat-action | — | — | — | — |
| /api/contacts | POST | si | contacts | — | — | — | si |
| /api/conversation | POST GET | si | conversation | — | — | si | si |
| /api/debug | POST | si | debug | — | — | — | si |
| /api/glossary | POST | si | glossary | — | — | — | si |
| /api/health | GET | — | — | — | — | — | si |
| /api/keys | GET POST DELETE | si | keys | — | — | — | si |
| /api/messages | POST PATCH GET | si | messages | messages-patch | — | si | si |
| /api/moderazione | POST | si | moderazione | — | — | — | si |
| /api/mondo | POST GET | si | mondo | — | — | — | si |
| /api/og | GET | — | — | — | — | — | — |
| /api/push-send | POST | si | push-send | — | — | — | si |
| /api/push-subscribe | POST GET DELETE | si | push-subscribe | — | — | — | si |
| /api/reazioni | POST | si | reazioni | — | — | — | si |
| /api/room | POST GET | si | room | — | — | — | si |
| /api/stanza-video | POST | si | stanza-video | — | — | — | si |
| /api/startrek | POST | — | — | startrek | — | — | — |
| /api/stripe | POST | si | stripe | — | — | — | — |
| /api/stt-token | POST | si | stt-token | — | — | — | si |
| /api/subscription | POST | si | subscription | — | — | — | si |
| /api/summary | POST | si | summary | — | — | — | si |
| /api/test-login | POST | — | — | — | — | — | — |
| /api/transcribe | POST | si | transcribe | — | — | — | — |
| /api/translate | POST | si | translate | — | si | — | — |
| /api/translate-consensus | POST | si | translate-consensus | — | — | — | si |
| /api/translate-free | POST | si | translate-free | free-translate free-chars | — | — | si |
| /api/translate-test | POST | si | translate-test | — | — | — | — |
| /api/translate-test-llm | POST | — | — | — | — | — | — |
| /api/tts | POST | si | tts | — | si | — | — |
| /api/tts-edge | GET POST | si | tts-edge | — | — | — | — |
| /api/tts-elevenlabs | POST GET | si | tts-elevenlabs | — | — | — | si |
| /api/tts-test | POST | — | — | — | — | — | — |
| /api/user | POST GET PUT | si | user | — | — | — | si |
| /api/voci | GET POST | si | voci | — | — | — | — |
| /api/voice-clone | POST GET | si | voice-clone | — | — | si | si |

## Rotte rimosse (rispondono 410)

- `/api/lending`
- `/api/process`
- `/api/provider-route`
- `/api/translate-stream`

## Difetti (confrontati, non sospettati)

### Rotte che si contano due volte sulla stessa chiave

Nessuna.

### Rotte senza nessuna protezione

Nessuna.

## Da leggere (serve giudizio: NON sono difetti)

### Aperte per scelta, con il motivo scritto accanto (2)

- `/api/health` — un sorvegliante esterno deve poter chiedere se l'applicazione e viva, senza credenziali
- `/api/og` — la chiedono i programmi di WhatsApp e dei social, che non hanno credenziali

### Chiuse in un modo diverso dalla guardia (4)

- `/api/startrek`
- `/api/test-login`
- `/api/translate-test-llm`
- `/api/tts-test`

Pagine di collaudo dietro un interruttore o una parola d'ordine.

### Prendono un'identita dal corpo senza verificare una sessione (1)

- `/api/startrek`

Da guardare a mano: alcune non decidono niente in base a
quel valore, lo rigirano e basta.

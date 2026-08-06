# Note di sicurezza — BarTalk b.112

> **Aggiornato in b.112.** Fino a ieri questo documento diceva ancora
> "Next.js 14.2.35, da aggiornare a 15.5.22 — richiede la migrazione a
> React 19, 4-8 ore di lavoro". Quel lavoro era stato fatto in b.60.
> Un documento di sicurezza che descrive vulnerabilita gia chiuse e
> peggio di nessun documento: chi legge non sa piu a cosa credere, e la
> prima reazione davanti a un avviso vero e "sara vecchio anche questo".

## Stato attuale delle dipendenze

| Cosa | Versione | Note |
| --- | --- | --- |
| Next.js | 15.5.22 | Le quattro CVE di denial-of-service della 14.x sono chiuse |
| React | 19.2.8 | Migrazione completata in b.60 |
| PostCSS | incluso in Next 15 | Le tre CVE erano nella catena della 14.x |

Le vulnerabilita elencate nelle versioni precedenti di questo file
**non sono piu aperte**. Per verificarlo, non fidarsi di questa tabella:

```
npm audit --omit=dev
```

## Cio che resta aperto, oggi

### 1. Relay TURN pubblico (P0 · serve una decisione)

Senza `NEXT_PUBLIC_TURN_URL` configurata, il traffico che non riesce a
passare in diretta viene inoltrato da `openrelay.metered.ca` con
credenziali pubbliche uguali per chiunque al mondo.

I contenuti restano cifrati due volte (DTLS di WebRTC piu AES-GCM
nostro): il relay non li legge. Ma vede **chi parla con chi, quando e
per quanto**, e non ha ne quote garantite ne una politica di
conservazione che possiamo mostrare a un utente che la chieda.

Da b.112 il comportamento e cambiato: se si configura un relay proprio,
quello pubblico **esce** dalla lista (prima si aggiungeva, quindi si
continuava a passare da un terzo anche dopo aver pagato). Restano da
mettere le credenziali.

### 2. Le chiavi E2E non sono autenticate (P0 · non ancora fatto)

Lo scambio ECDH P-256 e corretto, la chiave AES-GCM a 256 bit e
derivata bene, le chiavi sono effimere. Ma le chiavi pubbliche passano
dal signaling e **nessuno verifica che siano quelle giuste**: un
signaling compromesso potrebbe sostituirle e mettersi in mezzo.

Serve un confronto fuori banda — impronta nel QR della stanza, o un
"numero di sicurezza" che le due persone si leggono a voce. Finche non
c'e, la cifratura protegge da chi ascolta la rete, non da chi controlla
il signaling. **Va detto cosi, non "cifratura end-to-end" e basta.**

### 3. Le rotte amministrative non sono state censite una per una

`/api/admin`, `/api/debug`, `/api/analytics`, `/api/keys` non sono state
verificate in questa tornata per autenticazione, autorizzazione, limiti
di frequenza e informazioni che escono dai messaggi d'errore.

## Modalita Diretta: cosa e cambiato in b.112

La promessa era: nessun contenuto passa dai nostri server. Il
meccanismo esisteva — dodici rotte chiamavano
`assertCloudProcessingAllowed(req)`, che legge l'intestazione
`x-session-mode`.

**Nessuna riga del programma mandava quell'intestazione.** La guardia
non e mai scattata. In modalita Diretta il testo scritto era davvero
fermato (useTranslationAPI controllava per conto suo), ma la voce
partiva lo stesso verso `/api/transcribe`, e `/api/stt-token`
consegnava al telefono un gettone per aprire un flusso audio dal vivo
verso Deepgram — senza guardia e senza essere nell'elenco delle rotte
vietate.

Da b.112:
- un solo cancello davanti a `fetch` aggiunge sempre l'intestazione;
- in modalita Diretta le rotte vietate **non partono proprio**, invece
  di ricevere un 403 dopo aver gia spedito il contenuto;
- l'elenco `BLOCKED_IN_DIRECT` e passato da 11 a 15 rotte ed e
  finalmente importato da qualcuno;
- `/api/stt-token`, `/api/translate-stream`, `/api/voice-clone` e
  `/api/reazioni` hanno la guardia che non avevano.

Provato in `__tests__/modalita-diretta.test.js`, che non guarda le
intenzioni ma cosa esce dalla rete.

### Quello che si puo promettere, e come

Fuori dalla modalita Diretta la frase corretta non e "i messaggi non
arrivano mai sui nostri server", ma:

> Nella modalita Diretta i messaggi viaggiano da telefono a telefono e
> non vengono conservati. Le funzioni che usano la nuvola — traduzione,
> trascrizione, sintesi vocale — richiedono l'invio del contenuto ai
> servizi indicati.

## Security Hardening Applied (b.49-b.51)

1. ✅ OAuth state CSRF protection (mandatory state parameter)
2. ✅ ADMIN_PASS mandatory for all test endpoints
3. ✅ RLS payments INSERT = service-role only (WITH CHECK false)
4. ✅ Tokens removed from query strings (Authorization header only)
5. ✅ Stripe returnUrl whitelist validation
6. ✅ resolveRoomIdentity fix for conversation retrieval
7. ✅ Name-only access removed from conversation history
8. ✅ OTP with crypto.randomInt + attempt limiting
9. ✅ Google/Apple audience validation mandatory
10. ✅ Impersonation via name removed from live rooms
11. ✅ Service worker cache of private data disabled
12. ✅ Supabase RPC revoked for anon/authenticated
13. ✅ Redis atomic operations with CAS

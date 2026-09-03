# Inventario Fase 1 — Protocollo Bonifica

> Copre le categorie della Fase 1 non gia' coperte da `INVENTARIO-API.md`
> (che resta l'inventario dei punti di ingresso: rotte API + cron).
> Scritto a mano, non generato: ogni voce e' [VERIFICATO] sul codice/DB
> vivo salvo diversa indicazione.

## 1. Punti di ingresso

Vedi `INVENTARIO-API.md` (84 rotte, 5 cron in `vercel.json`). Non ripetuto qui.

## 2. Superficie dati (Supabase, progetto `voicetranslate`)

31 tabelle in `public`, tutte con RLS abilitata [VERIFICATO via `list_tables`].

| Tabella | Righe | Nota |
| --- | --- | --- |
| credit_ledger | 1827 | wallet, movimenti |
| wallet_riserve | 1772 | wallet, riserve |
| mondo_fonti_ambito | 564 | mondo/topics |
| provider_snapshots | 841 | snapshot provider AI |
| mondo_fonti | 343 | mondo/topics |
| translations | 300 | cache traduzioni |
| wallet_riparazione_b614 | 255 | **backup di rollback storico**, vedi sotto |
| corsi_utente | 14 | compagni/corsi |
| mondo_comments | 31 | mondo |
| mondo_discussions | 17 | mondo |
| gifts | 4 | wallet regali |
| ai_config | 5 | config provider AI |
| compagni | 4 | compagni |
| compiti_materiali | 2 | compiti |
| peepoff_dispositivi | 2 | peepoff |
| mondo_comment_likes | 2 | mondo |
| imparare_progresso | 4 | corsi |
| vouchers / voucher_redemptions | 1 / 1 | wallet |
| imparare_studente | 1 | corsi |
| pronuncia_profilo | 1 | corsi |
| compiti_jobs | 1 | compiti |
| mondo_segnalazioni | 1 | moderazione |
| **mondo_comment_translations** | **0** | raggiungibile (moderazioneMondo.js) |
| **mondo_title_translations** | **0** | raggiungibile (mondoDB.js) |
| **mondo_follows** | **0** | raggiungibile (mondoDB.js) |
| **compagno_memorie** | **0** | raggiungibile (compagni/memoria.js) |
| **corsi_pubblici** | **0** | raggiungibile (compagni/corsi/pubblici.js) |
| **voci_lingue** | **0** | raggiungibile (vociCatalogo.js) |
| **profilo_studente** | **0** | raggiungibile (cancellazione.js — solo per GDPR-delete) |
| **compiti_scansioni** | **0** | raggiungibile (compagni/compiti.js) |
| **peepoff_segnali** | **0** | raggiungibile (api/peepoff/route.js) |

**9 tabelle a 0 righe** (su 31). Lente 1 (raggiungibilita' nel codice):
tutte e nove sono chiamate da codice vivo, nessuna e' morta per lente 1.
Verdetto secondo la matrice del Protocollo: **non posso dare un verdetto
definitivo qui** — serve la Lente 2 (traffico reale osservato per un
ciclo intero), che questa sessione non copre. Le dichiaro **in
quarantena osservativa**: se al 03/12/2026 (90 giorni) restano a 0 righe,
si riclassificano come "non abitato" e si decide se completarle o
toglierle. Nessuna riga viene toccata prima di quella data.

`wallet_riparazione_b614`: **non e' una tabella orfana**, e' il backup
pre-fix della riparazione b.614 (migrazione `014_wallet_riserva_ledger_id_ripristino.sql`),
citata in CLAUDE.md come "si torna indietro da li'" e coperta da test
(`b614-riserva-registro-e-nome-a-voce.test.js`). Verdetto: **obbligatorio
invisibile** — si documenta, non si tocca.

## 3. Uscite (il sistema scrive fuori da se')

- Notifiche push via VAPID (`app/lib/notifichePush.js`, `mondo/pushServer.js`).
- Email transazionali via Resend (`app/api/auth/route.js` — OTP di accesso).
- Audio sintetizzato verso il client via TTS (ElevenLabs / Edge / DashScope Asia).
- Testo/audio utente inviato ai provider AI per traduzione/trascrizione
  (OpenAI, Anthropic, Gemini, DashScope, xAI/Grok, Deepgram) — rilevante
  per la Fase "obblighi" sotto.
- Errori applicativi verso Sentry (`sentry.*.config.js`, `captureException`
  in piu' route, incl. `stripe/webhook`).
- Un solo acquisto storico Stripe (2026-08-03) verificato su `credit_ledger`
  nella sessione precedente — nessuna uscita di denaro dal sistema, solo
  incasso.

## 4. Risorse esterne (chiavi/servizi da `process.env`, censite a mano)

| Servizio | Variabili |
| --- | --- |
| Supabase | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY |
| Upstash Redis | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_* (4) |
| OpenAI | OPENAI_API_KEY, OPENAI_ADMIN_KEY |
| Anthropic | ANTHROPIC_API_KEY |
| Google Gemini | GEMINI_API_KEY (nome ufficiale, in `.env.example`) |
| xAI / Grok | XAI_API_KEY, GROK_API_KEY (fallback doppio, voluto) |
| ElevenLabs | ELEVENLABS_API_KEY, ELEVENLABS_AMICO_AGENT_ID, NEXT_PUBLIC_ELEVENLABS_AMICO_AGENT |
| Deepgram | DEEPGRAM_API_KEY, DEEPGRAM_PROJECT_ID |
| DashScope (Asia) | DASHSCOPE_API_KEY |
| YouTube | YOUTUBE_API_KEY, YT_API_KEY (fallback doppio, commento esplicito nel codice: voluto) |
| Resend | RESEND_API_KEY, RESEND_FROM |
| Google OAuth | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_GOOGLE_CLIENT_ID |
| Apple Sign in | APPLE_CLIENT_ID, NEXT_PUBLIC_APPLE_CLIENT_ID |
| Web Push (VAPID) | VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT |
| TURN/WebRTC | NEXT_PUBLIC_TURN_URL/USER/PASS, TURN_SECRET, TURN_URLS |
| Plausible Analytics | NEXT_PUBLIC_PLAUSIBLE_DOMAIN |
| Sentry | SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG/PROJECT/AUTH_TOKEN |
| Sicurezza interna | ADMIN_PASS, ADMIN_SECRET, SESAMO_SECRET, ADMIN_EMAILS/ADMIN_EMAIL, CRON_SECRET, MONDO_ID_SECRET, ENCRYPTION_KEY |

### Difetto confrontato (Lente 1, nome-chiave contro nome-chiave)

- `app/api/test-login/route.js:44` legge `process.env.GOOGLE_GEMINI_KEY`,
  ma il nome ufficiale usato ovunque nel resto del sistema (`apiAuth.js`,
  `translate-test-llm`, `health`, `.env.example`) e' `GEMINI_API_KEY`.
  Se su Vercel non esiste una variabile chiamata `GOOGLE_GEMINI_KEY`
  (probabile: non e' in `.env.example`), quella riga e' sempre falsa —
  la rotta di test/debug non espone mai quella chiave nella risposta.
  **Impatto: basso** — `/api/test-login` e' dietro `ADMIN_PASS` ed e'
  un endpoint di collaudo, non tocca la traduzione vera che usa
  `GEMINI_API_KEY` correttamente. Classificato **impalcatura** (refuso di
  copia, non un guasto funzionale): da correggere in un fix atomico
  separato (un solo file, sola sostituzione di nome), non qui.

## 5. Interruttori (flag, config, ruoli)

- `VERCEL_ENV` (production/preview/development) — cambia comportamento in
  piu' punti (`config.js`, `logger.js`, `auth.js`, `tts-edge`, `topics/video`).
- `DEV_MODE` / `TESTING_MODE` / `NEXT_PUBLIC_TESTING_MODE` — modalita' di
  collaudo, letti in `apiAuth.js`, `health`, `translate-free`, `auth`, `layout.js`.
- Modalita' **Diretta** — presente nel codice (`page.js`, `ChatActionsPanel.js`,
  `useTranslationAPI.js`, locales) e rispettata esplicitamente da 3 rotte
  (`conversation`, `messages`, `summary`, `voice-clone` — colonna "Rispetta
  Diretta" in INVENTARIO-API.md): rifiutano di lavorare se la sessione e'
  in quella modalita'. Coerente con quanto osservato nella QA precedente
  (crittografia end-to-end lato chat).
- Ruoli admin via `ADMIN_EMAILS`/`ADMIN_EMAIL` + `ADMIN_PASS`/`ADMIN_SECRET`/`SESAMO_SECRET`
  (piu' nomi per lo stesso concetto in punti diversi — da leggere, non
  necessariamente un difetto: potrebbero essere livelli diversi).

## 6. Obblighi (legge, tracciabilita', conservazione)

- `app/privacy/page.js`, `app/terms/` — pagine legali presenti.
- `app/api/user/export` (GET/POST) — diritto alla portabilita' dei dati (GDPR).
- `app/lib/cancellazione.js` (usa anche `profilo_studente`, tabella a 0
  righe) — cancellazione dati utente su richiesta.
- `app/lib/encryption.js` (`ENCRYPTION_KEY`) — cifratura a riposo di dati
  sensibili, legata alla modalita' Diretta.
- `wallet_riparazione_b614` — traccia di un intervento su saldi reali,
  conservata per audit: vedi sezione 2.

## Debito residuo dichiarato di questa fase

- Lente 2 (traffico reale) non eseguita su nessuna voce: serve
  strumentazione + osservazione per almeno un ciclo, non comprimibile in
  una sessione. Le 9 tabelle a 0 righe sono in quarantena osservativa
  fino al 03/12/2026 (vedi sezione 2), non "morte" ne' "vive".
  **[ASSUNTO]** il criterio dei 90 giorni: non concordato esplicitamente
  con Luca, proposto come ragionevole default del Protocollo.
  Aggiornato per Cobra: "Chiavi proprie" e "Guardia" restano quelli di
  `INVENTARIO-API.md`.
- Fase 2 (Tre Lenti) applicata solo a `wallet_riparazione_b614` e al
  refuso `GOOGLE_GEMINI_KEY`, non a tutto l'inventario: richiederebbe
  lo stesso tempo di osservazione del punto sopra per ogni voce.
- Il refuso `GOOGLE_GEMINI_KEY` non e' stato ancora corretto: e' solo
  documentato qui. Correggerlo e' un fix atomico da un file, separato
  da questa consegna che e' di sola documentazione/inventario.

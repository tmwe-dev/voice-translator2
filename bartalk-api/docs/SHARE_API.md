# Condividere BarTalk Public API

Questo è il documento da usare quando vuoi dare la BarTalk Public API a uno sviluppatore, a Lovable, Claude, Codex, ChatGPT o a un altro builder.

## Per una persona

Invia soltanto:

```text
Apri https://bartalk-api-tmweapps-projects.vercel.app/start
Segui il quickstart e usa esclusivamente la BarTalk Public API v1.
```

## Per Lovable / Claude / Codex / ChatGPT

Invia soltanto:

```text
Leggi https://bartalk-api-tmweapps-projects.vercel.app/llms.txt e costruisci l'applicazione usando esclusivamente la BarTalk Public API v1 e la relativa OpenAPI. Non collegarti direttamente al BarTalk Core.
```

## Riferimenti ufficiali

- Start: https://bartalk-api-tmweapps-projects.vercel.app/start
- AI instructions: https://bartalk-api-tmweapps-projects.vercel.app/llms.txt
- Quickstart: https://bartalk-api-tmweapps-projects.vercel.app/quickstart.md
- OpenAPI 3.1: https://bartalk-api-tmweapps-projects.vercel.app/openapi
- Developer manifest: https://bartalk-api-tmweapps-projects.vercel.app/developer.json
- Full docs: https://bartalk-api-tmweapps-projects.vercel.app/docs
- API base: https://bartalk-api-tmweapps-projects.vercel.app/api/v1
- Health: https://bartalk-api-tmweapps-projects.vercel.app/api/v1/health

## Sicurezza

Non condividere mai:

- `BARTALK_API_SIGNING_SECRET`;
- la tua sessione BarTalk personale;
- chiavi interne del BarTalk Core;
- endpoint interni non presenti nella OpenAPI pubblica.

Ogni integrazione deve usare una sessione BarTalk autorizzata e ottenere la propria chiave `bt_live_*` tramite `POST /api/v1/auth/exchange`.

## Fonte di verità

Repository: `tmwe-dev/voice-translator2`

Branch: `bartalk-api-v1`

Cartella: `bartalk-api/`

Il Core `voice-translator-vercel/` non deve essere modificato né usato direttamente da integrazioni esterne.

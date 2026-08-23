# Architettura BarTalk API v1

```text
client esterno
  -> API key bt_live_* / scope / rate limit
    -> sessione BarTalk ancora valida
      -> BarTalk Core
        -> wallet / provider / memoria / Compagni / Redis / Supabase vivo
```

## Regole non negoziabili

1. Il gateway non duplica business logic del Core.
2. Una route Core viene pubblicata solo se la capability e realmente operativa nel backend vivo.
3. Identita e ownership restano autoritative nel Core; `token/userToken` vengono sovrascritti dal gateway dove previsti.
4. Le route che non inoltrano la sessione account fanno un **session probe** sul Core prima di eseguire la capability.
5. Gli identificativi nel path prevalgono sui valori dichiarabili nel body.
6. `fixedBody` e query fissate dalla route non sono sovrascrivibili.
7. Le query non possono iniettare token/account secrets.
8. Mutazioni finanziarie non idempotenti non vengono pubblicate.
9. Payload e multipart sono limitati sui byte reali.
10. La branch API non modifica `voice-translator-vercel/**`.

## Credenziali

La API key contiene la sessione BarTalk cifrata AES-256-GCM, non in chiaro. TTL massimo 7 giorni. Un array di scope vuoto resta vuoto. Logout/cancellazione/scadenza della sessione Core invalida l'uso della chiave anche sulle capability Core che non consumano direttamente il token account.

## Rate limiting

Le chiavi API hanno bucket separati. Le porte pubbliche usano un'impronta client (indirizzo proxy + user-agent) invece dell'unico bucket globale `public`. Redis distribuito e consigliato; il fallback locale resta una seconda barriera insieme ai limiti del Core.

## Live

`apri -> heartbeat/rinnova -> chiudi`.

Il gateway non calcola credito. b.420 nel Core serializza le corse fra apertura, rinnovo e chiusura e contabilizza soltanto commit wallet confermati.

## Readiness

`/api/v1/health` e locale al gateway e controlla sia raggiungibilita del Core sia disponibilita del signing secret. Un deploy che mostra la documentazione ma non puo emettere API key non viene dichiarato healthy.

## Superfici legacy

Preferenze server, provider-key vault e glossari non sono pubblicati finche lo schema Supabase autorevole non esiste realmente in produzione. Questo evita una seconda verita fra documentazione/API e backend.

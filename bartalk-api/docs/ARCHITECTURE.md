# Architettura BarTalk API v1

La Public API e un gateway separato dal Core BarTalk.

```text
client esterno
  -> API key bt_live_* / scope / rate limit
    -> sessione BarTalk verificata
      -> BarTalk Core
        -> wallet / provider / memoria / Compagni / Supabase / Redis
```

## Regole

1. Il gateway non duplica business logic del Core.
2. Identita e ownership restano autoritative nel Core; `token/userToken` vengono sempre sostituiti dal gateway quando previsti.
3. Gli identificativi nel path prevalgono sui valori dichiarabili nel body.
4. Mutazioni finanziarie non idempotenti non vengono pubblicate.
5. Il contratto pubblico segue il Core auditato: b.419 / push #711.
6. Il Live b.418+ e un protocollo a tre passi: **apri -> heartbeat/rinnova -> chiudi**. Il gateway espone tutti e tre senza calcolare credito autonomamente.
7. La cancellazione dati resta nel cancellatore centrale del Core. La API descrive retention e superfici legacy senza eseguire DELETE paralleli sul database.
8. La branch API non deve modificare `voice-translator-vercel/**`.

## Live

`POST /companions/{id}/live-sessions` apre la sessione e restituisce `battitoSecondi`.

`POST /live-sessions/{sessionId}/heartbeat` forza `azione=rinnova` e usa il `sessionId` del path.

`DELETE /live-sessions/{sessionId}` forza `azione=chiudi`.

Lock, riserve, durata, idempotenza e gestione del credito restano responsabilita del Core.

## GDPR

La API non promette erasure totale quando esistono retention deliberate. In b.419 il Core cancella anche follow, like e segnalazioni Mondo; wallet accounting e contenuti pubblici Mondo restano per policy. `translation_history` viene marcato come superficie legacy inattiva, non come dato cancellato.

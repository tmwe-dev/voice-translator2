# Architettura

```text
Client esterno
  |
  | Authorization: Bearer bt_live_...
  v
BarTalk API v1 (questo progetto)
  |-- decrypt API key -> sessione BarTalk + scope
  |-- rate limit per API key
  |-- normalizzazione del percorso
  |-- iniezione server-side della sessione
  v
BarTalk Core esistente
  |-- auth autorevole
  |-- wallet
  |-- Direct mode guard
  |-- provider routing
  |-- memoria / Compagni
  |-- privacy rules
  v
Provider / Redis / Supabase
```

La API key non sostituisce l'identita BarTalk: contiene cifrato il token di sessione che il Core continua a verificare a ogni operazione. Se la sessione viene revocata o scade, anche la API key smette di funzionare.

## Cosa non viene copiato

- traduzione;
- STT/TTS;
- wallet;
- memoria dei Compagni;
- prompt e orchestratori;
- accesso Supabase service-role;
- chiavi provider.

Questo evita due versioni divergenti dello stesso prodotto.

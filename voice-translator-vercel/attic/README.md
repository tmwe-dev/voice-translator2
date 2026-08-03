# Attic — codice orfano parcheggiato

File mai importati da nessun modulo attivo, spostati qui il 2026-08-03 (b.59)
per alleggerire `app/lib/` senza perdere il lavoro.

Verifica effettuata con: nessun `import ... from '.../<nome>'` in tutta `app/`.

| File | Righe | Cosa faceva |
|------|-------|-------------|
| offlineQueue.js | 308 | Coda messaggi offline con retry |
| redisLua → NON qui | — | ANCORA USATO da store.js |
| messageQueue.js | 190 | Coda invio messaggi |
| memory.js | 147 | Memoria conversazionale |
| pushManager.js | 139 | Web Push notifications |
| translationQuality.js | 136 | Scoring qualità traduzioni |
| providerFactory.js | 123 | Factory provider AI |
| adaptiveVideo.js | 111 | Bitrate video adattivo |
| ttsFallback.js | 107 | Fallback chain TTS |
| translateAsia.js | 78 | Provider traduzione asiatici |
| sttAsia.js | 57 | Provider STT asiatici |
| analytics.js | 51 | Eventi analytics |
| brand.js | 8 | Costanti brand (duplicate in constants.js) |

Per ripristinare un file: spostarlo di nuovo in `app/lib/` e importarlo.
Se dopo 2-3 release nessuno li ha ripescati, si possono eliminare.

# Audit dell'interprete in videochiamata — 5 settembre 2026

Ordine di Luca: «riesce a farlo ogni tanto… non funziona la gestione del
volume… aspetta minuti infiniti ed è sempre in estremo ritardo. C'è un
blocco, c'è un imbuto, fai una verifica profonda, riga per riga».

C'è. Sono tre cose distinte, e tutte e tre sono dimostrate qui sotto con
dati di produzione, non con letture del codice.

---

## VOTO: 3 / 10

| Misura | Valore | Fonte |
|---|---|---|
| Giro completo per un blocco da 3 s (mediana reale) | **6–8 secondi** | 302 intervalli, tabella `translations`, 2 giorni |
| Intervalli sotto i 4 secondi, su 302 misurati | **ZERO** | idem |
| `/api/translate` da sola (mediana / p95) | **2073 ms / 3431 ms** | 388 traduzioni vere, 7 giorni |
| Percorso streaming Deepgram usato in produzione | **0 %** — `DEEPGRAM_API_KEY` assente | 22 × 503 su `/api/stt-token`, log Vercel 7 gg |
| Blocchi audio che arrivano a Whisper e non producono traduzione | **~50 %** (770 → 388) | conteggi rotte, log Vercel 7 gg |
| Comandi del volume collegati a nulla | **4** | vedi §3 |

Non è un voto sulla qualità della scrittura — il codice è curato e pieno
di correzioni vere. È un voto sul **funzionamento**: in videochiamata
l'interprete oggi non fa il suo mestiere.

---

## 1. L'IMBUTO — dimostrato, non ipotizzato

### La regola che il sistema viola

Il microfono consegna **un blocco ogni 3 secondi**
(`useInterpreterMode.js:43`, `CHUNK_DURATION = 3000`).
La coda li lavora **rigorosamente uno alla volta**
(`useInterpreterMode.js:352-359`: `while` con `await` dentro).

Perché il ritardo resti costante serve una sola cosa:

> tempo del giro completo **< 3000 ms**

Il giro completo è: Whisper → traduzione → sintesi vocale → base64 →
DataChannel. Tre viaggi di rete verso tre fornitori, in fila indiana.

### Quanto dura davvero il giro, in produzione

Dalla tabella `translations` (una riga per ogni blocco tradotto, con
`created_at` al microsecondo), stanza reale `A34669E8`, ultimi 2 giorni,
302 intervalli fra un blocco e il successivo:

| Intervallo fra due blocchi consecutivi | Quanti |
|---|---|
| 0–4 s | **0** |
| 4–6 s | 77 |
| **6–8 s** | **159** |
| 8–10 s | 33 |
| 10–20 s | 33 |

**Nemmeno un intervallo sotto i 4 secondi, su 302.** Se le pause del
parlato fossero la causa, ci sarebbero anche intervalli corti — quando si
parla di fila. Non ce n'è uno. Il ritmo non lo detta chi parla: lo detta
la catena.

Il microfono produce ogni 3 s. La catena consuma ogni 6–8 s. **Entra più
del doppio di quello che esce.**

### Cosa succede allora, minuto per minuto

La coda cresce di circa **un blocco ogni 6 secondi** di parlato continuo.
Il tetto è 12 blocchi (`useInterpreterMode.js:56`), cioè 36 secondi di
parlato in attesa. Da lì in poi si buttano **i più vecchi**
(`useInterpreterMode.js:379-383`).

Quindi, a regime:

- la voce tradotta che si sente corrisponde a una frase detta **~40
  secondi prima**;
- più della metà di quello che si dice **non viene mai tradotto**, e
  sparisce senza che nessuno dei due lo sappia;
- ed è esattamente il «riesce a farlo ogni tanto» di Luca: l'«ogni
  tanto» sono i blocchi che sopravvivono al tetto.

Tre sessioni vere, misurate:

| Lingua | Blocchi tradotti | Durata | Secondi per blocco |
|---|---|---|---|
| it | 149 | 19 m 45 s | **8,0** |
| en | 109 | 25 m 18 s | **14,1** |
| en | 78 | 11 m 36 s | **9,0** |

### Dove se ne va il tempo — anello per anello

`/api/translate` da sola, misurata su 388 traduzioni vere di produzione:
**mediana 2073 ms**, media 2284 ms, p95 3431 ms, massimo 7950 ms.
Il **60 %** supera i 2 secondi. Da sola si mangia due terzi del budget
di 3 secondi, e restano Whisper e la sintesi vocale.

Il resto lo mangiano i viaggi di rete che non servono all'IA. Contati
riga per riga sulle tre rotte:

| Rotta | Viaggi Upstash in serie | Viaggi Supabase in serie | Totale non-IA |
|---|---|---|---|
| `/api/transcribe` | 10 | 4 | **14** |
| `/api/translate` | 9 | 4 | **13** |
| `/api/tts-edge` | 2 | 0 | **2** |

Quaranta round-trip di servizio per tradurre tre secondi di voce. Fra
questi ci sono doppioni veri e propri:

- `getUser` chiamato **due volte sulla stessa chiave**, per rotta
  (`users.js:236-239` dentro `getSession`, poi di nuovo `apiAuth.js:101`);
- `creditoFinito` chiamato **due volte per rotta** — una prima di
  lavorare, una **dopo** che la risposta è pronta, solo per riempire un
  flag informativo (`transcribe:212`, `translate:572`);
- `EXPIRE session:` **atteso** benché il commento dica che non blocca
  (`users.js:233`);
- la guardia «modalità Diretta» rilegge la **stessa** riga della stanza
  a ogni rotta: 3 letture identiche per blocco (`sessionGuard.js:140-148`);
- `/api/transcribe` **scrive l'audio su disco** per poi rileggerlo
  (`route.js:150-155`).

### E il sottotitolo aspetta insieme alla voce

Il sottotitolo parte prima della sintesi (b.277, `useInterpreterMode.js:299-307`)
— ma **dentro la stessa coda**. Guadagna solo il tempo della voce
(~1 s): arriva anche lui con 40 secondi di ritardo. Quando arriva è
scritto bene, ed è per questo che «il testo si legge abbastanza bene»:
è giusto, non è puntuale.

### Due guasti latenti che moltiplicano tutto

1. **Il salvavita della voce non scatta mai.** `chiediVoce`
   (`voceTradotta.js:68-83`) prova 2 motori × 2 tentativi = fino a **4
   richieste in fila da 30 s = 120 s per un solo blocco**. Il commento
   promette che il circuit breaker salti il motore guasto dopo 3 volte
   (`voceTradotta.js:41-43`), ma `apiCircuitBreaker.execute` conta un
   guasto **solo se la funzione lancia** (`circuitBreaker.js:83-97`) — e
   `fetch` **non lancia** su un 503: restituisce una risposta non-ok. Il
   circuito resta chiuso per sempre e ogni blocco ripaga i 4 tentativi.
   Stesso identico difetto sul lato STT (`useInterpreterMode.js:233-245`).

2. **Il taglio a 3 secondi non guarda il parlato.** È un `setTimeout` a
   orologio (`useInterpreterMode.js:447-450`). Il cancello del rumore sa
   già quando si comincia e si smette di parlare (`noiseGate.js:61-70`)
   ma quel segnale serve solo all'attenuazione, mai al taglio. Le due
   metà di una parola finiscono in due chiamate Whisper che non sanno
   l'una dell'altra (nessun `prompt` di continuità, nessuna
   sovrapposizione, e fra `stop()` e il `start()` successivo c'è un buco
   per costruzione, `:442-450`). **Ecco perché metà dei blocchi non
   produce nulla: 770 chiamate a Whisper, 388 traduzioni.**

3. **Il contesto della conversazione arriva e non viene usato.**
   `conversationContext` è passato all'hook (`page.js:456`,
   `useInterpreterMode.js:61`) e il corpo mandato a `/api/translate`
   (`:267-274`) non lo contiene. Ogni mezza frase è tradotta da sola.

---

## 2. IL PERCORSO BUONO ESISTE, ED È SPENTO

`useStreamingInterpreter.js` (687 righe) è l'interprete fatto come si
deve: trascrizione dal vivo via WebSocket, riconoscimento della fine
frase, traduzione incrementale, coda vocale sequenziale, cuscinetto dei
monconi. Non taglia a orologio: taglia dove finisce la frase.

Non è mai entrato in funzione. `startUnified` prova prima lo streaming
(`useInterpreterMode.js:576-580`), lo streaming chiede la chiave a
`/api/stt-token`, e in produzione quella rotta risponde:

```
POST /api/stt-token 503
{"level":"warn","tag":"sttToken","msg":"Trascrizione dal vivo: DEEPGRAM_API_KEY assente"}
```

**22 volte su 22, in 7 giorni.** Il ripiego a blocchi da 3 secondi non è
il piano B: è l'unico piano, da sempre, in silenzio.

---

## 3. IL VOLUME — quattro comandi collegati a nulla

### Morto: l'attenuazione via Web Audio

- `duckingGainRef` (`useAudioSystem.js:70`) **non viene mai creato né
  collegato**: in tutto il repository compare solo in lettura (righe 70,
  203, 210, 218).
- Quindi `startDucking()` esce alla **prima riga utile**
  (`useAudioSystem.js:205`: `if (!gain || !ctx) return;`). Idem
  `stopDucking()`. Sono due funzioni vuote.
- `connectToDucking()` (`:216-225`) **non è chiamata da nessuno**:
  nessun elemento audio è mai entrato in quel grafo.
- Tutte le chiamate sparse in giro — `page.js:454-455`,
  `useInterpreterMode.js:133`, `useStreamingInterpreter.js:588`,
  `voceTradotta.js:175,182` — non fanno niente.

### Morti: due comandi dell'interfaccia

- `duckingLevel` / `setDuckingLevel` sono passati a `RoomHeader`
  (`RoomView.js:612`), destrutturati (`RoomHeader.js:81`) e **mai usati
  nel corpo**. E anche se lo fossero, alimentano solo `startDucking`,
  cioè il meccanismo morto qui sopra.
- `videoDucking` / `setVideoDucking`: stato in `RoomView.js:185`,
  scritto in tre punti, destrutturato in `VideoCallOverlay.js:104`,
  **mai letto**. I preset «mentre parla la traduzione» aggiornano uno
  stato che non pilota nulla.

### Il cursore della voce tradotta viene sovrascritto

`useAudioSystem.js:475` imposta il volume scelto dall'utente, e subito
dopo `useTTSEngine.js:118` fa `audio.volume = 1.0` sullo **stesso**
elemento, prima di suonare. Idem `useTTSEngine.js:129` e
`voceSistema.js:147`. Il cursore «volume traduzione» è quindi inefficace
per tutta la voce che passa dalla coda — compresa **tutta** la voce
della stanza di gruppo (`StanzaVideoGruppo.js:190`).

### Il volume della voce tradotta può restare a zero per sempre

`RoomView.js:403`: se la preferenza è «solo testo», all'aggancio della
chiamata si scrive `setVolumeTTS(0)` — e quella scrittura è
**persistente** (`audioPrefs.js:24`) e **nessuno la ripristina mai**.
Chi ha provato «solo testo» anche una volta sola resta senza voce
tradotta in tutte le chiamate successive, per sempre, su quel
dispositivo. E il cursore mostra il vecchio valore, perché lo legge una
volta sola al montaggio (`VideoCallOverlay.js:159`) e l'overlay è
montato prima che la scrittura avvenga. **Si vede 70 % e non si sente
niente.**

### L'attenuazione può restare accesa e non spegnersi più

`fermaAudio` (`voceTradotta.js:214-217`) fa solo `pause()`, e `pause()`
non scatena `onended`: quindi `finito()` non parte e `avvisaTTS(false)`
non viene mai lanciato (`useStreamingInterpreter.js:568`, e lo
smontaggio a `:660-666` non tocca affatto l'audio in corsa). In
`RoomView.js:509` il flag `tts` resta `true` per sempre e il partner
resta a `partnerVolume × getAttenuazione()` — col preset «solo tradotta»
(valore 0) **resta muto**. `attenuazioneAttivaRef` non viene azzerato
nemmeno a fine chiamata (`RoomView.js:368-377`).

### Due effetti che si annullano

`RoomView.js:502-517` applica l'attenuazione, `RoomView.js:519-521` la
cancella: **stessa dipendenza `[partnerVolume]`**, e il secondo gira
dopo. Muovere il cursore del partner mentre la traduzione parla azzera
l'attenuazione fino all'evento successivo. C'è anche un terzo scrittore
(`:477-487`) che usa `partnerVolume` da una chiusura vecchia.

### E, soprattutto: l'attenuazione arriva 40 secondi fuori tempo

Anche l'unico meccanismo che funziona (eventi `bartalk:tts` →
`remoteAudioRef.volume`) abbassa la voce del partner **mentre parte la
traduzione**. Ma la traduzione parte 40 secondi dopo. Quindi il sistema
abbassa la voce del partner mentre lui sta dicendo una cosa nuova, per
far sentire la traduzione di una cosa di quaranta secondi prima. Da
fuori non si legge come un'attenuazione: si legge come un volume che va
e viene a caso. **Il difetto del volume, in videochiamata, è in buona
parte lo stesso difetto del ritardo.**

---

## 4. STANZA DI GRUPPO — non si sente nessuno

`StanzaVideoGruppo.js:50`: il `<video>` è scritto con l'attributo
`muted` **fisso, per tutti i riquadri, remoti compresi**. L'unico punto
che lo toglie (`:28-30`) ha dipendenze `[volume, muto, mio]`. Ma il
partecipante entra **senza stream** (`useStanzaVideo.js:83`) e lo stream
arriva dopo (`:200`): al primo giro non c'è nessun `<video>` e
l'effetto non fa nulla; quando il `<video muted>` finalmente nasce,
quell'effetto **non rigira**, perché le sue dipendenze non sono
cambiate.

Risultato: **nella videochiamata di gruppo non si sente nessuno**
finché non si tocca a mano il cursore o il tasto muto di quella
persona. E lì non esiste nessuna attenuazione automatica, nessun volume
generale: nessun `startDucking`, nessun ascolto di `bartalk:tts`,
nessun `getAttenuazione`.

---

## 5. QUELLO CHE NON HO POTUTO VERIFICARE

Detto per nome, perché un audit che non lo dice non vale.

1. **Le latenze vere di Whisper, del modello e di Edge TTS.** Ho la
   misura vera solo di `/api/translate` (tabella `translations`). Per
   Whisper e per la voce non esiste nessuna registrazione: i log Vercel
   danno i codici di stato, non i tempi. So che la somma supera i 3
   secondi perché lo misura l'intervallo fra i blocchi, ma non so come
   si divide fra i tre.
2. **Quanto audio si perde fra `stop()` e `start()` del registratore.**
   Dal codice risulta che il buco **esiste per costruzione** (nessuna
   sovrapposizione, nessun pre-roll, nessun secondo registratore). La
   sua durata dipende dal browser. Il commento a `:431` — «nessun buco
   udibile» — non è dimostrato da niente.
3. **La regione di Upstash e Supabase rispetto alle funzioni Vercel.**
   Non è dichiarata da nessuna parte (`vercel.json` non ha `regions`,
   nessuna rotta esporta `preferredRegion`). Se non coincidono, i 40
   viaggi di servizio in serie diventano da soli il collo di bottiglia.
   **È la prima cosa da misurare.**
4. **`perfTelemetry.js` esiste ed è scritto apposta per misurare questa
   catena** (STT, traduzione, consegna, TTS, totale bocca-orecchio). È
   usato **solo** in `useTranslation.js`, cioè nella chat. Nell'interprete
   non è collegato: ecco perché nessuno ha mai visto l'imbuto.
5. **Traduzione vocale reale con due persone** — microfono, seconda
   voce, orecchio: non la posso fare io.

---

## 6. COSA FARE, IN ORDINE

Un intervento per registrazione, come sempre. In quest'ordine, perché
ognuno rende inutile una parte del successivo.

| # | Intervento | Cosa toglie |
|---|---|---|
| 1 | **Accendere `DEEPGRAM_API_KEY` in produzione** — una variabile d'ambiente | Fa entrare in funzione l'interprete vero, quello a frasi. È il cambiamento con il rapporto effetto/rischio più alto di tutto l'elenco. |
| 2 | **Togliere la voce dalla coda seriale** | Il sottotitolo e la sintesi non devono bloccare il blocco successivo. Da solo può portare il giro sotto i 3 s e **fermare l'accumulo**. |
| 3 | **Tagliare sul silenzio, non sull'orologio** | Il cancello del rumore sa già quando finisce la frase: usarlo. Toglie le mezze parole e recupera il ~50 % di blocchi che oggi non producono niente. |
| 4 | **Far contare al circuit breaker le risposte non-ok** | Toglie i fino-a-120 s per blocco quando un motore è degradato. Riga sola. |
| 5 | **Parallelizzare `resolveAuth` e togliere i doppioni** (getUser ×2, creditoFinito ×2, EXPIRE atteso, ricevuta attesa, getRoom ×3) | ~1,2–1,5 s per blocco, cioè ~35 % del giro. |
| 6 | **Il volume: creare il nodo di guadagno o togliere l'impianto morto** | Quattro comandi che oggi mentono all'utente. |
| 7 | **`setVolumeTTS(0)` che non si ripristina mai** | Chi ha provato «solo testo» una volta è senza voce per sempre. |
| 8 | **Stanza di gruppo: il `muted` fisso** | Oggi non si sente nessuno finché non si tocca un cursore. |
| 9 | **Collegare `perfTelemetry` all'interprete** | Senza questo, il prossimo audit ricomincia da zero. |

I punti 6, 7 e 8 sono correzioni piccole e indipendenti: si possono fare
subito. Il punto 1 è una variabile d'ambiente. Il punto 2 è un
rifacimento del cuore della coda ed è **CRITICAL**: merita la sua
registrazione, la sua prova del contrario e il suo collaudo dal vivo.

---

*Fonti dei numeri: tabella `translations` del progetto Supabase
`voicetranslate` (388 righe, 7 giorni; 302 intervalli, 2 giorni; tre
sessioni di chiamata reali); log runtime Vercel del progetto
`voice-translator2`, 7 giorni (conteggi per rotta e per codice di stato,
righe 503 di `/api/stt-token`); lettura riga per riga di
`useInterpreterMode.js`, `useStreamingInterpreter.js`, `voceTradotta.js`,
`apiAuth.js`, `circuitBreaker.js`, `RoomView.js`, `VideoCallOverlay.js`,
`useAudioSystem.js`, `useTTSEngine.js`, `StanzaVideoGruppo.js`,
`useStanzaVideo.js` e delle tre rotte della catena.*

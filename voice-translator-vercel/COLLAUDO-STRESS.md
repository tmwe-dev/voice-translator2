# BarTalk — mappa delle funzioni e piano di collaudo sotto sforzo

Costruita leggendo il codice: 40 rotte API, 22 schermate, 27 hook.
Non e un elenco di intenzioni: ogni voce esiste come file.

---

## Il banco di prova a due utenti, senza secondo telefono

La scoperta che rende possibile tutto il resto.

`localStorage` e isolato **per origine**. Ogni deploy Vercel ha un
proprio indirizzo, e punta allo stesso Redis e allo stesso Supabase.
Quindi:

| | Origine | Identita |
| --- | --- | --- |
| Lato A | `voice-translator2.vercel.app` | Ada · italiano |
| Lato B | `voice-translator2-<hash>-tmweapps-projects.vercel.app` | Bruno · inglese |

Due `localStorage` separati, due identita indipendenti, **una sola
stanza**. Verificato: la stanza creata da A risponde 200 interrogata da
B, e l'onboarding di B parte in inglese perche l'invito porta `gl=en`.

Cosa questo banco copre e cosa no:

- **Copre**: chat, traduzione nei due sensi, conferme di consegna,
  ingresso e uscita, stanze di gruppo, moderazione, archivio, crediti,
  limiti, tutto cio che passa da Redis o da Realtime.
- **Non copre**: WebRTC vero fra due reti diverse (stessa macchina,
  stesso IP), microfono e telecamera reali, comportamento su iOS.
  Per quelli serve ancora un secondo telefono.

---

## Le funzioni, per area

### 1 · Conversazione a due
- Creazione stanza con codice a 8 caratteri
- Invito per link o QR, con lingua dell'ospite (`gl=`)
- Ingresso automatico dall'invito
- Chat testuale con traduzione bidirezionale
- Cinque stati del messaggio: in coda · inviato · consegnato · letto · fallito
- Reazioni (pollice su, pollice giu, cuore) e risposte
- Uscita temporanea e rientro nella stessa stanza
- Chiusura della stanza da parte dell'host

### 2 · Voce
- Registrazione con tasto premi-e-parla
- Rilevamento automatico del parlato (VAD)
- Trascrizione (`/api/transcribe`)
- Lettura ad alta voce della traduzione (Edge TTS gratuito, ElevenLabs premium)
- Clonazione della propria voce
- Attenuazione dell'audio mentre l'altro parla (ducking)
- Coda audio ordinata con prefetch

### 3 · Chiamate
- Chiamata vocale e videochiamata (WebRTC)
- Sottotitoli tradotti durante la chiamata
- Interprete simultaneo (Deepgram + traduzione incrementale)
- Riconnessione automatica, e chiusura che resta chiusa
- Cifratura punto-punto con numero di sicurezza a 20 cifre

### 4 · Gruppo e Community
- Stanze pubbliche, protette, private, temporanee
- Vetrina delle stanze attive (`/api/mondo`)
- Ingresso diretto o su approvazione
- Moderazione: blocco, espulsione, segnalazioni, reputazione
- Stanze "litigio libero" con velo sulle parole pesanti
- Video di gruppo
- Alzata di mano (modalita classroom)

### 5 · Modalita Diretta
- Nessun dato ai nostri server: solo canale P2P
- Cancello davanti a `fetch` che blocca le rotte vietate
- Cifratura obbligatoria (fail-closed)
- Ora dichiarata uno-a-uno

### 6 · TaxiTalk
- Destinazione strutturata, cifrata lato client
- QR con chiave nel frammento (non arriva al server)
- Pagina dedicata al tassista, con mappa e percorso
- Geolocalizzazione

### 7 · Conto e crediti
- Portafoglio: 1 credito = 1 secondo
- Acquisto con Stripe, voucher, regali
- Addebito su traduzione, voce, riassunto, voce premium
- Blocco a credito esaurito
- Prova gratuita con limite giornaliero

### 8 · Archivio e contorno
- Conversazioni salvate 7 giorni, piu copia locale su IndexedDB
- Riassunto AI, esportazione, condivisione, eliminazione
- Glossario personale che pesa sulla traduzione
- Rubrica contatti
- Tre temi, notifiche push, installabile come app

---

## Piano di collaudo sotto sforzo

Ordine deliberato: prima cio che l'utente tocca ogni giorno, poi i
limiti, poi le cose rare. Ogni prova ha un **esito atteso scritto
prima**, altrimenti si finisce per accettare quello che succede.

### S1 · Le fondamenta (devono reggere sempre)
| # | Prova | Atteso |
|---|---|---|
| 1.1 | A scrive, B riceve | tradotto, < 3 s |
| 1.2 | B scrive, A riceve | tradotto, < 3 s |
| 1.3 | spunta sul messaggio di A | ✓ → ✓✓ → verde |
| 1.4 | 20 messaggi alternati rapidi | nessuno perso, ordine rispettato |
| 1.5 | stesso testo due volte di fila | due messaggi, non uno |
| 1.6 | messaggio da 10.000 caratteri | accettato o rifiutato con motivo |

### S2 · Rotture volute
| # | Prova | Atteso |
|---|---|---|
| 2.1 | B chiude la scheda a meta conversazione | A resta, la stanza vive |
| 2.2 | B rientra | ritrova i messaggi |
| 2.3 | A esce e rientra in stanza Diretta | resta Diretta (b.123) |
| 2.4 | rete di B staccata 10 s durante un invio | messaggio in coda, poi parte |
| 2.5 | stanza scaduta, B prova a entrare | errore chiaro, non pagina bianca |

### S3 · I limiti
| # | Prova | Atteso |
|---|---|---|
| 3.1 | 11º partecipante in stanza da 10 | **409**, nessuno espulso (b.126) |
| 3.2 | 130 richieste in un minuto | 429 dopo il limite dichiarato |
| 3.3 | credito a zero, si prova a tradurre | blocco con avviso, non silenzio |
| 3.4 | coppia it→zh | tradotta **e addebitata** (b.123) |

### S4 · Le porte
| # | Prova | Atteso |
|---|---|---|
| 4.1 | archivio con solo un nome | 401 |
| 4.2 | riassunto di conversazione altrui | 403 |
| 4.3 | `/api/room` senza gettone | scheda pubblica, niente hostEmail |
| 4.4 | gettone di stanza X su conversazione Y | 401 |
| 4.5 | corpo JSON malformato su 12 rotte | 400, mai 500 |

### S5 · Le catene laterali
| # | Prova | Atteso |
|---|---|---|
| 5.1 | voci premium con rete instabile | riprova 3 volte, poi avvisa (b.122) |
| 5.2 | reazione in modalita Diretta | torna indietro, non resta finta |
| 5.3 | riassunto di una conversazione | l'archivio resta a 7 giorni |
| 5.4 | eliminazione conversazione | sparisce davvero, anche all'altro |

### S6 · Solo con due telefoni veri
| # | Prova | Atteso |
|---|---|---|
| 6.1 | videochiamata, chiude uno solo | la telecamera dell'altro NON si riaccende |
| 6.2 | numero di sicurezza sui due schermi | identico |
| 6.3 | QR TaxiTalk inquadrato | atterra sulla pagina, chiede la posizione |
| 6.4 | chiamata su due reti diverse | connessione stabilita (serve TURN) |

---

## Regola del ciclo

Si esegue un blocco intero, si annota **ogni** scostamento, si
correggono **tutti**, si riesegue **il blocco intero** — non solo la
prova che era rossa. Una correzione che sistema il caso singolo e ne
rompe un altro si vede solo rifacendo tutto.

Si passa al blocco successivo quando il precedente e interamente verde.

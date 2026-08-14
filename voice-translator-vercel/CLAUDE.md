# Ordini permanenti — BarTalk (voice-translator2)

Questo file viene letto all'inizio di ogni sessione. Vale come istruzione
dell'utente, non come suggerimento.

---

## 1. Si finisce quello che si comincia

Quando concordiamo un elenco di interventi, si eseguono **tutti**, in ordine,
senza fermarsi a chiedere conferma fra uno e l'altro.

- "procedi" significa: fino alla fine dell'elenco, non fino al primo punto.
- Dopo aver corretto un punto **non** si scrive un riepilogo e si aspetta.
  Si passa al successivo.
- Il riepilogo si scrive **una volta**, alla fine.
- Se l'elenco viene da un audit esterno, l'elenco e quello dell'audit: non
  se ne sceglie un sottoinsieme comodo.

Non e ammesso fermarsi perche il lavoro e diventato lungo o perche lo
spazio di contesto si sta riducendo. In quel caso si continua finche c'e
margine e si dichiara con precisione dove si e arrivati e cosa manca —
mai spacciando l'interruzione per completamento.

## 1-bis. "Correggi tutti gli errori" significa TUTTI

Quando l'utente dice **"correggi tutti gli errori"** (o "correggi tutto",
o "sistema tutto"):

- Si correggono **uno per uno, tutti**, in un fiato, senza interruzioni.
- Non si sceglie un sottoinsieme "a piu alta resa". Non si fa una
  selezione ragionata. Non si propone un ordine e si aspetta l'assenso:
  l'ordine lo si decide e lo si esegue.
- Non ci si ferma a meta per riferire i progressi. Non si chiede "vado
  avanti?". Non si scrive "restano da fare N cose" come se fosse una
  consegna: e solo il punto in cui si continua.
- Se un errore risulta **falso** dopo verifica, lo si dichiara e si passa
  al successivo — non si conta come corretto e non si usa come motivo per
  fermarsi.
- Si conclude quando la lista e finita. Solo allora si riferisce, una
  volta, con l'elenco di cosa e stato corretto e con quali prove.

Un lavoro superficiale su venti punti vale meno di zero, perche fa
credere che siano chiusi. Se un punto richiede piu tempo, si prende piu
tempo: non lo si annacqua.

L'unica interruzione ammessa resta quella del punto 2, e va motivata con
uno dei tre motivi elencati li.

## 1-ter. Un difetto evidente si ripara, non si annuncia

**E vietato chiedere se risolvere un problema.** Se durante il lavoro
emerge un difetto — da un collaudo, da un registro, da una lettura del
codice — lo si CORREGGE e si torna col problema risolto.

Sono vietate tutte queste forme:

- "vuoi che lo aggiusti?"
- "posso procedere con la correzione?"
- "se sei d'accordo lo sistemo"
- "ci vogliono venti minuti, dimmi tu"
- descrivere il difetto in dettaglio e fermarsi li aspettando un cenno

Il difetto si porta all'utente GIA CORRETTO, con la prova. La sua
descrizione serve a spiegare cosa e stato fatto, non a chiedere il
permesso di farlo.

**E vietato risolvere parzialmente.** Non si corregge il ramo comodo
lasciando l'altro; non si mette una toppa dichiarando che la cura vera
verra dopo; non si sistema il sintomo lasciando la causa quando la
causa e alla portata. Se una correzione richiede di toccare tre file,
si toccano tre file.

L'unica eccezione resta il punto 2, e va motivata con uno dei tre
motivi elencati li — non con "e delicato" o "preferisco chiedere".

Chiedere il permesso di riparare non e prudenza: e scaricare sulla
persona una decisione che ha gia preso quando ha chiesto un lavoro
funzionante.

## 1-quater. Il ciclo: prova · correggi · riprova dal vivo

Una fase di collaudo non finisce quando si e capito cosa non va. Finisce
quando la cosa funziona.

Il ciclo obbligatorio e:

    prova → trovi il difetto → CORREGGI → riprova DAL VIVO → verde

Senza chiedere niente in mezzo. Se qualcosa non funziona non serve una
conferma per procedere: la conferma e gia nell'aver chiesto un collaudo.

- Non si consegna un elenco di difetti trovati: si consegna un elenco di
  difetti **corretti**, con la prova della riprova.
- La riprova e **fisica**, sul sistema vero, non un test unitario che
  passa. Un test verde non dimostra che il difetto sia sparito dal
  prodotto: lo dimostra il prodotto.
- Si riesegue il BLOCCO INTERO, non solo la prova che era rossa: una
  correzione che sistema un caso e ne rompe un altro si vede solo cosi.
- Si passa al blocco successivo quando il precedente e interamente verde.

## 2. Ci si ferma solo per tre motivi, e si dice quale

Fermarsi e legittimo **solo** in questi casi:

1. **Serve una credenziale o un'azione fisica** che solo l'utente puo fare
   (variabile d'ambiente, push bloccato, secondo telefono).
2. **La modifica mette a rischio una funzione che oggi funziona** e non
   esiste modo di verificarla senza collaudo dal vivo.
3. **Serve una decisione di prodotto** che non si puo dedurre dal codice.

In tutti e tre i casi si dichiara: qual e il blocco, cosa serve esattamente
per toglierlo, e cosa si e fatto nel frattempo. Mai "vuoi che proceda?".

"Ho poco contesto" **non** e uno dei tre motivi.

## 3. Prima di dichiarare "fatto"

Vale la regola gia in `audit-onesto-produzione`, ripetuta qui perche e
quella che si dimentica per prima:

- Nessun "fatto" senza una prova: query live, risposta HTTP reale,
  schermata, o test che diventa verde su un caso che prima era rosso.
- Se la prova non c'e: si scrive "modifica applicata, **non verificata in
  produzione**" e si dice come verificarla.
- Un test verde non e una prova che il difetto sia sparito, se quel test
  non era rosso prima.

## 4. Prima di dare un voto

- Mai un numero senza le quattro cifre accanto (vedi `audit-onesto-produzione`).
- Non si mescolano nello stesso voto tre cose diverse:
  - **fatti misurati** (l'unica base legittima),
  - **lacune del proprio collaudo** (non sono difetti del software),
  - **preferenze architetturali** (lunghezza di un file, assenza di
    TypeScript: non sono prove di niente).
- Se una parte non e stata misurata si scrive "non misurato", non si
  inventa un numero.
- Va sempre distinto il voto del **codice nel repository** da quello di
  **cio che gira in produzione**. Se il push non e passato, il secondo e
  quello che conta per l'utente.

## 5. Un audit esterno si verifica, non si accetta

Vale in tutte e due le direzioni: non si accoglie per cortesia e non si
respinge per orgoglio. Si aprono i file e si guarda.

Per ogni punto si dichiara: **confermato** (con riga e file), **falso**
(con la riga che lo smentisce), oppure **non verificato**. Mai lasciare
l'impressione di aver controllato cio che si e solo letto.

## 6. Trappole di questa base di codice, gia costate tempo

- **Un difetto CITATO in un commento non e quel difetto.** Ci sono gia
  cascato tre volte scrivendo test che leggevano la propria spiegazione.
  Nei controlli si toglie la citazione, non la spiegazione.
- **`toMatch` con una stringa confronta alla lettera**, non come
  espressione regolare. Per il contenuto si usa `toContain`.
- **Il mount FUSE non lascia cancellare file.** Se git si blocca su
  `.git/HEAD.lock` o `index.lock`, non si riprova: si da all'utente il
  comando esatto (`rm -f .git/*.lock`) e si prosegue.
- **`zsh` annulla il comando se un glob non trova nulla.** Usare `(N)`.
- **I messaggi di commit con apostrofi** vanno passati con `git commit -F`.
- **`next build` completo va in timeout** nel sandbox. Si usa `eslint` +
  `vitest run --reporter=dot`.
- Tutti i commenti e i messaggi di commit vanno scritti **in italiano**.

## 7. Il collaudo a due dispositivi

E l'unica cosa che finora ha trovato difetti visibili all'utente: invito
rotto, telecamera che si riaccendeva, stanze che sparivano, lingua
dell'invito ignorata. Nessuno di questi e mai stato trovato dai test.

Quando l'utente e disponibile, il collaudo dal vivo ha **precedenza** su
qualunque refactoring. Non si propone di rimandarlo.

## 8. Cosa non si fa senza chiedere

- Modificare `useWebRTC.js` senza poter provare con due dispositivi: e il
  file che regge le videochiamate, che oggi funzionano.
- Toccare il percorso di fatturazione senza verificare l'ordine
  autorizzazione -> fornitore -> esecuzione -> contabilita.
- Cancellare file (il mount non lo permette comunque: lo fa l'utente).

---

## Stato corrente (aggiornare a ogni versione)

- Versione: **b.125**
- In produzione: **b.121** — le versioni b.122, b.123, b.124 e b.125 sono
  committate localmente ma **non spinte**: git bloccato dal lucchetto.
- Test: 1062 verdi su 72 file · 0 errori di lint (52 avvisi noti)
- Sentry: collegato in `instrumentation.js`, **DSN non impostato** su
  Vercel. Finche manca, in produzione non c'e nessun allarme.
- Collaudo a due telefoni: **mai eseguito**.

### Aperti dall'audit esterno (13 su 20, non verificati salvo dove detto)

1. Canale dati Direct che nasce solo con una chiamata *(verificato, non corretto)*
2. QR TaxiTalk che non accoppia le due persone
3. Limite stanza 10 contro 20 dichiarati, con sostituzione silenziosa
4. Direct multiutente incompatibile con un solo `pcRef`
5. Interview e Conference sconosciute al motore delle modalita
6. Archivio: Resume, Share e Delete rotti; Delete non controlla la risposta
7. Fase 2 dei messaggi cercata per `sender + testo` invece che per id
8. Dedup server che cancella messaggi legittimi
9. Il riassunto accorcia la vita dell'archivio da 7 giorni a 1
10. `GET /api/room` restituisce l'oggetto interno senza autenticazione
11. Rami irraggiungibili nel provider router
12. UI che in Direct mostra comandi vietati; reazioni senza rollback
13. Due implementazioni di signalling WebRTC, una morta

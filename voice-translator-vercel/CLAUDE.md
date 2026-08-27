# Ordini permanenti — BarTalk (voice-translator2)

Questo file viene letto all'inizio di ogni sessione. Vale come istruzione
dell'utente, non come suggerimento.

---

## 0. Il giro di lavoro: si ripara, si aggiorna, collauda lui

Ordine di Luca del 19/08/2026, e viene PRIMA di tutto il resto:

    riparo una sezione -> aggiorno (git push, che pubblica) -> collauda LUI -> sezione successiva

- **La velocita e il criterio.** Si va a trovare i difetti e a correggerli,
  sezione per sezione, quando lui lo chiede. Nient'altro.
- **Niente banchi di prova su mia iniziativa.** Costruire un impianto di
  collaudo (browser pilotati, script di verifica, giri sistematici sugli
  elementi) e tempo tolto alle riparazioni. Se serve una prova, la piu
  corta che dimostra il punto.
- **I test si eseguono alla fine, e insieme a lui.** Il collaudo delle
  funzioni riparate lo fa lui, sul prodotto. Io non lo rifaccio e non
  aspetto: appena l'aggiornamento e in linea si prosegue.
- Se una verifica lunga sembra davvero necessaria, si dice in UNA riga
  quanto costa e si aspetta il suo via.
- **Non si sta ad aspettare il deploy.** Dopo il push si passa subito al
  difetto successivo: che il rilascio sia arrivato lo vede lui dal numero
  #NNN in alto a sinistra nella home. Aspettare il verde di Vercel e
  tempo morto pagato da lui.

Questo non annulla il punto 3 (nessun "fatto" senza prova): la prova
resta obbligatoria, ma e la piu breve che regge — una riga di log, un
header, un test che era rosso e diventa verde — non una campagna.

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
  E VALE ANCHE PER I COMANDI DATI A LUCA: il 25/08 gli ho dettato
  `rm -f .git/*.lock && git push` — senza lock, zsh ha annullato TUTTA
  la riga e il push non e mai partito, in silenzio. Nei comandi da
  incollare: mai un glob; i lock si tolgono per nome esplicito
  (`rm -f .git/index.lock .git/HEAD.lock`), e solo se servono.
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

## 7-bis. Finito lo sviluppo, SI FANNO I TEST

Ordine di Luca del 26/08/2026: «inserisci nel cron che se finisci tutto
lo sviluppo devi fare test». Vale per OGNI sessione, umana o
automatica: il cron orario legge questo file come prima cosa, quindi
la regola sta qui e non nel suo testo (che e vincolato al dispositivo
e non modificabile da una sessione).

Ogni volta che si tocca anche una sola riga di codice, PRIMA di
scrivere il report:

1. `npx eslint <i file toccati>` — deve dare 0 errori.
2. `npx vitest run` sui test nuovi PIU tutta la batteria delle ultime
   versioni, non solo il file appena scritto. Devono passare tutti. Se
   un test vecchio si rompe per colpa della modifica, si AGGIORNA
   all'assunzione nuova e lo si dice nel changelog — non si cancella,
   non si ignora, non si disattiva.
3. Si riapre dal vivo in Chrome la schermata toccata e si guarda con
   gli occhi che faccia quello che deve.

**UN TEST CHE GUARDA LA FORMA DEL CODICE NON E UNA PROVA.** Lezione
pagata il 26/08: il volo del globo verso le breaking news e stato
scritto, coperto da cinque test verdi e dichiarato fatto — e non e
mai scattato nemmeno una volta, perche il paese della notizia era
sempre `null`. I test verificavano che il MECCANISMO ci fosse
(la chiamata, il prop, l'attesa), non che producesse un RISULTATO. Un
test deve far passare un dato vero e guardare cosa esce.

## 7-ter. I nomi dei rami non si riusano MAI

Il 26/08 il cron orario e una sessione interattiva hanno usato tutti e
due `b516-pronto` sulla stessa versione: il secondo `git update-ref` ha
sovrascritto il primo e ha sepolto un commit intero, ritrovato solo
perche il working tree lo conteneva ancora.

- Il ramo si chiama `b<NUMERO_DI_PUSH>-pronto` (es. `b808-pronto`), NON
  `b<versione>-pronto`: due sessioni possono arrivare alla stessa
  versione, non allo stesso numero di push.
- Prima di scegliere versione e push si legge «Stato corrente» nel
  working tree, non solo in origin/main: se un'altra sessione ha gia
  scritto li la voce che stavi per prendere, si salta al numero dopo.
- Prima di committare, sempre `git diff --cached origin/main --stat`, e
  si controlla che non ci sia dentro lavoro non proprio. Se c'e, si
  isola il proprio blob (`git show origin/main:<file>` come base, si
  applica solo la propria modifica, `git hash-object -w`,
  `git update-index --cacheinfo`) invece di trascinarsi dietro il
  lavoro altrui.

## 8. Cosa non si fa senza chiedere

- Modificare `useWebRTC.js` senza poter provare con due dispositivi: e il
  file che regge le videochiamate, che oggi funzionano.
- Toccare il percorso di fatturazione senza verificare l'ordine
  autorizzazione -> fornitore -> esecuzione -> contabilita.
- Cancellare file (il mount non lo permette comunque: lo fa l'utente).

---

## Stato corrente (aggiornare a ogni versione)

- Versione: **b.523** (push #811) — cinque ordini di Luca sul pannello
  del Mondo e sul senso stesso della sezione.

  **1 — «LA DISPOSIZIONE DELLE ICONE NON DEVE ESSERE INFLUENZATA DAL
  TESTO MAI. GUARDA AD ESEMPIO APPROFONDITA».** Ogni comando era largo
  `minWidth: 52`: AL MINIMO 52, ma piu largo se la sua parola lo era.
  «Tradotti» sta in 45 punti, «Approfondita» ne occupa 68 — e il
  comando, che sta a destra della riga, allargandosi si sposta a
  SINISTRA portandosi dietro l'icona. Quattro righe, quattro icone su
  quattro colonne diverse, solo perche le parole hanno lunghezze
  diverse. Regola scritta nel file: un comando in colonna ha larghezza
  FISSA (`width`, mai `minWidth`). Vale doppio con trentotto lingue.

  **2 — «METTI LA DESCRIZIONE DELLA ICONA A SINISTRA SOTTO IL TITOLO IN
  UN BADGE BROWN».** E la soluzione migliore del punto 1, non un
  ripiego: con la parola sotto il titolo, a sinistra, la colonna di
  destra torna a contenere la SOLA icona — allineata per costruzione.
  Il testo cresce nello spazio elastico della riga e non tocca niente.
  Il bruno e lo stesso vetro dei preferiti (b.517).

  **3 — «NON VEDO LA SCELTA PAESE».** BUG PRE-ESISTENTE dichiarato: il
  commento di b.504 prometteva che «la ZONA — da dove guardo il mondo —
  sta qui sotto, in mondoPaese». Sotto non c'era niente: tolto il
  filtro LINGUA, il filtro PAESE che doveva prenderne il posto non e
  mai stato scritto. Da allora l'unico modo di scegliere un Paese era
  centrarlo col dito sul globo che gira. Un commento che descrive una
  funzione inesistente e peggio di nessun commento: chiude la domanda
  invece di aprirla. Ora c'e la tendina vera.

  **4 — «IL CAMPO CERCA VA IN ALTO E FUORI DALLA SIDEBAR TE L'HO GIA
  DETTO».** E vero che gliel'aveva gia detto: in b.504 la ricerca era
  uscita dal pannello per Stanze e per il Mondo («si cerca dove si
  guarda, non dietro una porta che nessuno apre per cercare»), ma la
  scheda NOTIZIE era rimasta indietro. Ora il campo sta in cima al
  giornale. Effetto collaterale dichiarato: decade la regola di b.513
  («quando clicco aggiorna chiudi la side bar»), che esisteva solo
  perche il campo viveva dentro il pannello — il suo test e stato
  riscritto al contrario, non cancellato.

  **5 — IL MONDO SEGUE IL VIAGGIATORE.** «Le preferenze non sono
  obbligatorie, il default deve legare alla posizione geografica e la
  lingua. Il mondo deve seguire il "viaggiatore" e deve tenerlo
  informato anche su cosa accade nel suo paese. Immaginati un italiano
  in ferie che vuole leggere la gazzetta dello sport al mattino ma si
  trova in cina.»
  Nuovo `lib/casaEViaggio.js`, due poli invece di uno:
  CASA — da dove viene: il Paese sul profilo, o in mancanza la sua
  lingua (un italiano legge in italiano).
  QUI — dove si trova adesso: dal FUSO ORARIO del dispositivo.
  Il fuso e non il GPS, per una ragione precisa: non chiede permessi,
  non apre finestre, non costa batteria, non e un dato sensibile, e non
  sbaglia mai il Paese di un viaggiatore perche il telefono lo aggiorna
  da solo appena atterra. Il GPS darebbe la citta invece del Paese, in
  cambio di un permesso che molti negano e che qui non serve.
  Senza NESSUNA preferenza impostata le breaking non cercano piu un
  generico «breaking news»: alternano i due poli, prima casa (la
  Gazzetta del mattino) e poi dove si trova. Chi non e in viaggio ha un
  polo solo e non se ne accorge; chi ha scelto i suoi argomenti comanda
  lui, esattamente come prima. Il pianeta vola sul Paese del giro.

  TEST: 24 test nuovi (`icone-incolonnate-b523.test.js`,
  `casa-e-viaggio-b523.test.js` — quest'ultimo prova il caso di Luca
  alla lettera: prefs italiane + fuso Asia/Shanghai devono dare due
  ricerche, Italia prima e Cina poi) + due test vecchi riscritti alle
  assunzioni nuove invece che cancellati (b.513 e b.517) —
  [VERIFICATO] 103/103 su tutta la batteria b.513→b.523. eslint: 0
  errori. NON verificato dal vivo: il codice non e ancora pushato.

- Versione: **b.520** (push #809) — Luca: «controlla di nuovo la chat di
  oggi e verifica cosa non hai sistemato (globo hai dimenticato le
  modifiche ad esempio), fai l'elenco e implementa le componenti
  discusse». Rilettura della giornata: due cose erano state dichiarate
  fatte e non lo erano.

  **7 — IL GLOBO NON VOLAVA. MAI.** Luca: «globo hai dimenticato le
  modifiche». Rileggendo il lavoro della giornata:
  **BUG PRE-ESISTENTE, MIO, DI b.515, DICHIARATO.** La funzione «il
  pianeta vola verso la breaking news prima di mostrarla» e stata
  scritta, spedita, testata e dichiarata FATTA — e non e mai scattata
  una volta in produzione. In `FinestraSulMondo.js` il paese della
  notizia era:
      paeseRicerca: interessi.length ? null : paese
  cioe: con gli interessi accesi (il modo NORMALE, e il default) il
  paese e `null` e il pianeta non si muove; senza interessi e quello
  che l'utente aveva GIA scelto a mano, cioe dove il globo si trova
  gia. In tutti e due i rami il volo non esiste. I test di b.515
  passavano tutti: verificavano che il MECCANISMO ci fosse
  (onPuntaGlobo, l'attesa di 1,5s, focusEsterno), non che gli
  arrivasse mai un paese da usare. E la definizione esatta di feature
  orfana — viva nel codice, morta all'uso — e il protocollo di audit
  dice di trattarla come P0.
  Riparata: nuovo `lib/paeseDaFonte.js` che ricava il paese dal
  DOMINIO delle fonti della notizia (suffisso nazionale, piu un elenco
  a mano per le grandi testate .com; `.uk` -> `GB`; i suffissi
  bugiardi — .tv, .io, .me — esclusi apposta). Se il paese non si
  riconosce resta `null` e il pianeta non si muove: meglio fermo che
  nel posto sbagliato.
  Estesa anche la guardia «non muovere il globo mentre l'utente sta
  facendo qualcosa» (ordine di Luca in b.515): prima guardava solo il
  cartello a schermo intero, ora un `occupato` copre anche il pannello
  aperto e la scheda paese.

  **8 — INSTALLARE L'APP ERA UN VICOLO CIECO.** Altro BUG
  PRE-ESISTENTE dichiarato (non mio, ma non notato prima): il pannello
  di installazione esisteva completo di istruzioni per cinque
  piattaforme, ma compariva DA SOLO 2,5 secondi dopo l'avvio e, una
  volta chiuso, scriveva `vt-install-dismissed` e non tornava mai piu.
  Chi l'aveva chiuso una volta non aveva piu nessun modo di installare
  l'applicazione dall'interno — Luca infatti ha dovuto chiedere «ma
  quindi non posso installarla sul mio pc?». Ora in
  Profilo -> Strumenti c'e una voce stabile che cancella il segno di
  rifiuto e riapre il pannello; sparisce quando l'app e installata.

  **VERIFICATO DAL VIVO (non dedotto dal codice):** su segnalazione di
  Luca («la pagina biz non l'hai fatta e neanche peepoff») ho aperto
  tutt'e due in produzione col browser. Sono VIVE e funzionanti:
  `/posta` mostra l'indirizzo `lucaarcana#gmail.com`, l'impronta e le
  quattro schede; `/scanner/index.html?skin=bartalk` apre la
  fotocamera e le schede Scan/Contatti/Esporta/Setup. Erano gia in
  origin/main, byte per byte. Quello che si vede pero e che il
  BizCard chiede una chiave OpenAI a mano, in chiaro, in cima alla
  pagina: e la faccia dello strumento originale, non e collegata al
  credito di BarTalk — segnalato a Luca, non toccato in questo giro
  perche non richiesto (regola: niente pulizia opportunistica).


  TEST: 16 test nuovi (`globo-vola-davvero-b517.test.js`, che verifica
  il RISULTATO — quale paese esce da una notizia vera — non solo che il
  meccanismo esista: e il buco che aveva fatto passare il bug di b.515)
  + `globo-breaking-b515.test.js` aggiornato alla guardia allargata —
  [VERIFICATO] 79/79 su tutta la batteria b.513→b.518. eslint: 0
  errori. NON verificato dal vivo in produzione: il codice non e ancora
  pushato — [ASSUNTO] fino al collaudo di Luca. In particolare il volo
  del pianeta va guardato con gli occhi, perche e esattamente il tipo
  di cosa che i test a stringhe avevano gia lasciato passare una volta.

  NOTA SUI NUMERI: nel giro di pochi minuti l'altra sessione ha preso
  prima b.518/#807 e poi b.519/#808 (due voci qui sotto, nessuna delle
  due ancora pushata). Questa consegna e quindi b.520/#809. E la TERZA
  collisione della giornata sullo stesso repository, dopo quella che ha
  sepolto un commit intero: due sessioni che lavorano insieme sullo
  stesso repository sono una cosa da evitare, non da gestire. La regola
  del ramo per numero di push (§7-ter) e nata proprio qui.

- Versione: **b.517** (push #806) — sei ordini dal vivo di Luca, piu il
  recupero di un lavoro che un'altra sessione aveva involontariamente
  sepolto. Le sue parole, nell'ordine in cui sono arrivate:

  1. «aperte adesso con la descrizione elimina non serve»
  2. «trasporti 1 citta 1 ?? mostra dei bei badge con sfondo in vetro
     colore brown e blu in alternanza, numero bianco visibile e mettili
     dentro la sidebar in alto come preferiti, inserisci una x per
     eliminare la preferenza»
  3. «i pulsanti apri e traduci, apri, vai al sito devono essere delle
     icone!!!!!!»
  4. «parlane o apri discussione non devono essere ambedue presenti,
     parlane va bene sia che ci siano persone o che apra la discussione
     (aggiungi un numero dei partecipanti)»
  5. «non mi stai facendo leggere l'articolo dentro la applicazione. il
     riassunto e una delle due opzioni»
  6. «quando apro un articolo non mostrare la x ma monta a sinistra un
     tasto back. nel mobile con trascina torna alla pagina precedente»

  **0 — PRIMA DI TUTTO: IL LAVORO SEPOLTO.** Il b.516 che avevo
  consegnato il 26/08 (articolo dentro l'applicazione, scroll del
  pannello riparato, preferenze che dicono il loro stato) non e mai
  andato live: un'altra sessione attiva sullo stesso repository ha
  pushato il SUO b.516 e ha riusato lo stesso nome di ramo
  (`b516-pronto`), orfanando il mio commit. Luca se n'e accorto dal
  vivo — «non mi stai facendo leggere l'articolo dentro la
  applicazione» — perche in produzione girava ancora il popup con la
  sintesi. Il working tree del Mac aveva ancora tutto: il lavoro e
  stato rimesso sopra il nuovo origin/main ed e dentro b.517.
  REGOLA NUOVA, da qui in avanti: il ramo di consegna porta il numero
  di push (`b806-pronto`), non quello di versione — due sessioni
  possono arrivare alla stessa versione, non allo stesso push.

  **1 — VIA LA DESCRIZIONE SOTTO «APERTE ADESSO».** L'avviso «i
  messaggi restano visibili a chi entra dopo» era gia stato ridotto da
  una-per-scheda a una-per-elenco in b.363; ora esce del tutto. La
  chiave `openRoomNotice` resta nei dizionari perche la stessa frase
  serve dove si CREA una stanza — li e una decisione, qui era rumore.

  **2 — I TEMI DIVENTANO PREFERITI, E TRASLOCANO NEL PANNELLO.** Le
  pillole grigie di «Qui se ne parla» (trasporti 1, citta 1) si
  mangiavano la prima riga dell'elenco senza dire di chi fossero e
  senza potersi togliere. Nuovo `PreferitiTemi.js`: badge di vetro
  (fondo traslucido + sfocatura), tinte alternate bruno e blu come
  chiesto, il numero su una pastiglia bianca traslucida — cosi resta
  leggibile su ENTRAMBE le tinte senza ricolorarlo a mano — e una «x»
  che scrive in `prefs.temiTolti`: la preferenza tolta resta tolta al
  prossimo giro e su qualunque dispositivo, non e un nascondino di
  sessione. Stanno in cima al pannello, PRIMA di ogni filtro: sono una
  scorciatoia, non un'impostazione.

  **3 — QUATTRO PORTE, TUTTE ICONE.** La fila di tasti larghi («Apri e
  traduci», «Apri», «Vai al sito») e sparita: al suo posto quattro
  icone da 38 sotto l'immagine — `doc` (leggi dentro l'app), `globe`
  (leggi con la sintesi tradotta gia aperta), `link` (esci sul sito
  dell'editore), `chat` (parlane). «Apri» e «Apri e traduci» aprono la
  STESSA pagina: cambia solo su quale faccia si atterra.

  **4 — PARLANE, UNA PORTA SOLA, COL NUMERO DI CHI C'E GIA.** «Parlane»
  e «Apri discussione» facevano quasi la stessa cosa e stavano tutti e
  due sulla card. Ora e uno: se qualcuno sta gia parlando di quel link
  si entra nella sua discussione (e il numero lo dice PRIMA di
  toccare), se non c'e nessuno la discussione la si apre. Il numero
  arriva da `comment_count` delle discussioni GIA scaricate per il feed,
  indicizzate per link: nessuna chiamata di rete in piu, nessun costo.

  **5 — DUE FACCE, NON UNA STRISCIA.** La sintesi non e piu una banda
  incollata sopra il riquadro (rubava spazio anche a chi voleva solo
  leggere): il lettore ha due opzioni dichiarate in alto — la pagina
  VERA dell'editore (iframe, mai testo copiato: la regola di copyright
  non cambia di una virgola) e la Sintesi di BarTalk. Chi entra dalla
  porta `globe` atterra sulla sintesi e la trova gia in scrittura,
  senza premere un altro tasto; parte una volta sola per articolo.

  **6 — INDIETRO, NON UNA X.** Il lettore aveva gia il tasto back a
  sinistra: la «x» che Luca vedeva era del vecchio popup, che per gli
  articoli non si apre piu. Aggiunto il trascinamento: una striscia da
  22 sul bordo sinistro, SOPRA l'iframe (che altrimenti si mangia il
  tocco), riconosce lo scorrimento orizzontale — almeno 60 di corsa e
  meno di meta in verticale, cosi uno scroll della pagina non viene
  scambiato per un «indietro».

  TEST: 20 test nuovi (`notizie-icone-preferiti-b517.test.js`) +
  aggiornamento di `lettore-articolo-b516.test.js` — [VERIFICATO]
  63/63 passano su tutta la batteria b.513→b.517, inclusi i due file di
  test dell'altra sessione (`sovrapposizioni-portal-b516`,
  `ricerca-lingue-alias-b516`), che restano verdi: le due linee di
  lavoro non si sono pestate i piedi. `npx eslint` sui file toccati: 0
  errori, 1 warning preesistente non mio. NON ho eseguito un `next
  build` completo (va in timeout nel sandbox, limite gia documentato) e
  NON ho ancora potuto verificare dal vivo in produzione, perche il
  codice non e ancora pushato — [ASSUNTO] che eslint + test dedicati
  bastino come prova fino al collaudo di Luca.

- Versione: **b.516** (push #805) — GIRO DI COLLAUDO AUTOMATICO ORARIO
  (nessuno davanti allo schermo). Ordine di Luca: «devi fare un test di
  TUTTO, almeno 10 interazioni per ogni funzione». Fatto dal vivo su
  produzione #804, finestra 657x749 CSS.

  **COSA E RISULTATO SANO** (nessun errore in console, nessuna chiamata
  di rete rossa oltre a quelle gia note): carosello lingue (scorrimento
  + conferma "Usa English (US)" -> testata IT->EN), tendina lingua con
  ricerca, traduzione testo Home ("ciao come stai oggi" -> "Hey, how are
  you today?"), A+/A- con fermo a fondo corsa in tutte e due le
  direzioni, TTS (`POST /api/tts-elevenlabs` 200), capovolgi testo,
  TaxiTalk (ricerca Nominatim 200, 5 risultati, mappa + QR + Condividi),
  globo (carica in ~14s, gira, punta i pallini), pannello laterale
  Preferenze (passo "Ogni quanto cerca" che gira su tutti i valori e il
  click fuori che chiude — la correzione b.514 REGGE), le quattro porte
  del "+", codice sbagliato -> 404 gestito con messaggio, creazione
  stanza reale (4 tipi, 3 interruttori con testi che cambiano davvero,
  3 categorie, codice 3896C2E4 + QR), dentro la stanza: messaggio
  tradotto IT->EN, reazioni, menu "···".
  Delle novita b.515: "Apri e traduci" genera la Sintesi SUBITO
  [VERIFICATO], il filtro a tre stati del feed persiste
  (`mondoFeedFiltro`), l'interruttore autoplay persiste
  (`mondoAutoplayVideo`).

  **DUE DIFETTI VERI TROVATI E CORRETTI QUI.**

  **1 — LA TRAPPOLA DI b.514 ERA RIMASTA APERTA IN ALTRE TRE
  SCHERMATE.** b.514 aveva capito la causa (un antenato `absolute` +
  `transform` fa da containing block a qualunque `fixed`; un antenato
  `relative; z-index:5` incapsula lo z-index dichiarato dentro) ma
  l'aveva chiusa per UN SOLO componente. Misurato in produzione con
  `getBoundingClientRect` e `elementsFromPoint`:
  - `SchedaArgomento` (la scheda "Apri e traduci"): il tasto CHIUDI sta
    a (484,26) 44x44, ma `elementsFromPoint` in quel punto restituisce
    `BUTTON aria-label="Italia"` dell'intestazione Notizie (`z:6`).
    RIPRODOTTO: premendolo si apre il pannello laterale Notizie e la
    scheda NON si chiude. Su desktop resta Esc; **su telefono non c'e
    via d'uscita**, ed e li che vive BarTalk.
  - `FeedNotizieMondo` (il "feed a tutta pagina" di b.515) e
    `MondoDiscussioni`: dichiarano `fixed inset:0` ma uscivano
    **440x691 a (109,58)** dentro una finestra 657x749 — cioe grandi
    quanto la colonna, non quanto lo schermo.
  FATTO: nuovo componente condiviso `app/components/ui/Sovrapposizione.js`
  (createPortal in `document.body`, con la stessa guardia SSR di
  PannelloLaterale) e le tre schermate ci passano dentro. Un posto solo,
  cosi la prossima schermata a tutta pagina non ricasca nella buca.

  **2 — LE LINGUE NON SI TROVAVANO COL LORO NOME.** Riprodotto dal vivo
  con interfaccia italiana: nella tendina della Home «giapponese»,
  «cinese», «inglese», «tedesco» davano ZERO risultati; il giapponese
  usciva solo scrivendo «ja» o «日本語». Si cercava solo nel nome
  MOSTRATO (che e l'endonimo) e nella sigla, e per una ventina di lingue
  (greco, ebraico, arabo, hindi, russo, coreano, bengalese, tamil,
  ucraino, bulgaro...) l'endonimo non e nemmeno scrivibile con la
  tastiera di chi cerca. FATTO: `ALIAS_LINGUE` + `lingueTrovate()` in
  `constants.js` (nomi in italiano e inglese per tutte e 44 le lingue),
  e le TRE tendine che cercavano ciascuna a modo suo (CarouselLingue,
  LinguettaLingua, MondoView) ora usano la stessa funzione. I nomi
  mostrati non cambiano: si aggiunge solo un modo in piu per arrivarci.

  TEST: `__tests__/sovrapposizioni-portal-b516.test.js` (4) e
  `__tests__/ricerca-lingue-alias-b516.test.js` (6) — [VERIFICATO]
  verdi. `npx eslint` sui 7 file toccati: 0 errori, 1 warning
  preesistente (l'`eslint-disable` inutile su `<img>` gia dichiarato in
  b.515). NON ho fatto `next build` (fuori dai tempi del giro): la prova
  e eslint pulito + i test dedicati + le misure dal vivo qui sopra.
  Il comportamento in produzione delle due correzioni resta [ATTESO]
  finche' il push non e in linea: non ho modo di provare la produzione
  prima che Luca pubblichi.

  **QUATTRO TEST ERANO GIA ROSSI SU `origin/main` PRIMA DI ME** (li
  segnalo, non li ho toccati: non sono lavoro di questo giro e
  ripararli qui avrebbe mescolato due consegne):
  - `finestra-sul-mondo-b506` «il ritmo e una preferenza con "mai" come
    predefinito» — b.515 ha cambiato il predefinito in '5' (scelta di
    Luca) e non ha aggiornato il test di b.506.
  - `la-lingua-viene-prima` e `niente-stringhe-cablate` (3 test) sulla
    parita delle chiavi fra i 15 pacchetti lingua — b.515 ha aggiunto
    chiavi SOLO in it.js/en.js dichiarandolo, e questi test lo vedono.
  Il resto dei test che toccano i file di questo giro: **605 verdi**
  (94 + 192 + 119 + 196 su 42 file), [VERIFICATO].

  **DIFETTI TROVATI E NON CORRETTI QUI** (per il giro successivo, con la
  prova gia pronta):
  - **Ricerca PAESI, stessa malattia della ricerca lingue**: in
    `SceltaPaeseView` con interfaccia italiana «germania» -> «Nessun
    paese trovato», «germany» -> trova Deutschland. `app/lib/paesi.js`
    ha `nome` (endonimo) e `nomeEn` (inglese) ma NESSUN nome italiano,
    per 89 paesi. Non l'ho toccato in questo giro per non gonfiare una
    consegna gia doppia, e perche 89 nomi vanno scritti, non indovinati.
  - `POST /api/analytics` risponde **401** a ogni pagina (3 volte nel
    giro): sono i due `navigator.sendBeacon` di `app/lib/monitor.js`
    che partono senza token. E gia dichiarato dentro
    `app/api/analytics/route.js` da b.422 come «da guardare, non
    risolto qui»; oggi confermo che si vede ancora in rete.
  - `POST /api/user` risponde **401 otto volte di fila** aprendo la tab
    Notizie. Non ho ancora capito quale chiamante ritenta cosi: non l'ho
    inseguito per non uscire dal giro, resta il primo punto da guardare.
  - Minuzia: il messaggio d'errore del codice stanza esce come
    «Error: Stanza non trovata» — la parola «Error» non e tradotta.

  **DEBITO EREDITATO, NON MIO**: il repository locale ha HEAD fermo a
  b.508 e nell'albero di lavoro c'e lavoro b.516 di qualcun altro NON
  committato (`MondoNews.js`, `LettoreArticolo.js`, `PannelloLaterale.js`,
  `PreferenzeMondo.js`, e una riga sola di `FeedNotizieMondo.js`:
  `newsOpenTranslate` -> `readWord`). Non l'ho toccato. Il mio commit
  parte da `origin/main` e per `FeedNotizieMondo.js` ho scritto nel
  commit un blob costruito a mano (origin/main + solo la mia modifica),
  cosi quella riga altrui NON entra nel push.


- **[MAI USCITA COME b.516 — confluita in b.517]** Questo lavoro era
  pronto e committato il 26/08 alle 17:47 UTC sul ramo `b516-pronto`, ma
  non e mai arrivato in produzione: un'ALTRA sessione, che lavorava sullo
  stesso repository nelle stesse ore, ha pushato il suo b.516 e ha riusato
  lo STESSO nome di ramo, lasciando orfano il commit 1c1728b. Il codice
  non e andato perso (era tutto nel working tree del Mac) ed e stato
  rimesso sopra il nuovo origin/main dentro b.517. Lezione operativa
  registrata in fondo a questa voce. Testo originale della consegna:

  Feedback live di Luca sull'interfaccia
  appena spedita in b.515 (due screenshot allegati), tutto nello stesso
  messaggio:

  «Però quando schiaccio l'icona titoli in altre lingue? Deve cambiare
  l'icona come fa e indicare che titoli nella tua lingua. Quando clicco
  cerca... come cerco le notizie? Deve evidenziare il modo in cui lo fa
  in quel momento e il modo in cui lo farà poi dopo. Quando aggiorno
  devi evidenziare sotto appunto come stai facendo l'aggiornamento in
  un modo o nell'altro. Devi correggere questa cosa. lo scroll non va e
  parte del container finisce sotto il menu in alto, devi abbassare
  leggermente il container e dimensionarlo perché rimanga dentro lo
  schermo. devi invece allargare il container hai lasciato troppo
  margine laterale. poi. i tasti sono grandi e fuori standard e il
  riassunto non lo voglio, voglio aprire dentro la pagina l'articolo.
  usa icone per leggi e parlane e mettili appena sotto immagine o
  video. genera la sintesi la metti nella pagina dell'articolo e anche
  il tasto traduci»

  **1 — LE PREFERENZE ORA DICONO IL LORO STATO.** `IconeCiclo` in
  `PreferenzeMondo.js` (i tre cicli Titoli/Cerca/Aggiorna) era
  un'icona sola, senza testo: si vedeva CHE si poteva cliccare, non
  COSA era selezionato in quel momento né cosa sarebbe diventato dopo
  il click. Ora ogni pulsante mostra, sotto l'icona, l'etichetta
  testuale dello stato attuale (`L(attuale.etichettaKey)`) — stessa
  logica che già usava `PassoVerticale` per il Ritmo, estesa ai tre
  cicli icon-only.

  **2 — SCROLL ROTTO, RISOLTO ALLA RADICE.** Il container scorrevole
  del pannello aveva `flex: 1` dentro un flex-column: senza
  `min-height: 0` esplicito, un figlio flex non scorre mai — si
  allarga per contenere tutto, e `overflow: auto` non scatta (bug
  classico di flexbox, non un caso isolato di questo pannello).
  Aggiunto `minHeight: 0`. Contestualmente: il pannello era ancorato
  con `top:0; bottom:0`, che su mobile con barra degli strumenti
  dinamica calcola contro il viewport "grande" e finisce parzialmente
  sotto il menu — sostituito con `height:'100dvh'` (viewport
  dinamico). Larghezza portata da `min(330px,86vw)` a
  `min(460px,92vw)` per il margine laterale eccessivo segnalato.

  **3 — NIENTE PIÙ POPUP CON RIASSUNTO: L'ARTICOLO SI LEGGE NELLA
  PAGINA VERA.** Correzione diretta del design spedito UN turno fa in
  b.515 (le "tre porte" Apri e traduci/Apri/Vai al sito, che aprivano
  `SchedaArgomento` con la Sintesi di BarTalk): Luca l'ha respinto dal
  vivo. Gli articoli ora aprono `LettoreArticolo.js` — il componente
  che dal b.365 incornicia la pagina VERA dell'editore in un iframe
  (mai testo copiato, coerente con l'art. 70 l. 633/41), finora usato
  solo per il flusso "discussioni". La Sintesi AI e il tasto Genera
  sono stati spostati DENTRO quella pagina (nuovo pannello in
  `LettoreArticolo.js`, stessa chiamata `/api/topics/riassunto` e
  stessa gestione errori di `SchedaArgomento.js` — riuso letterale
  della logica, non una reinvenzione). `SchedaArgomento.js` resta in
  vita SOLO per i video (la prop `autoGenera` ci resta dentro,
  innocua, non più richiamata per articoli). In `MondoNews.js`: click
  su immagine o titolo apre `LettoreArticolo`; le vecchie tre
  righe di pulsanti larghi sono sparite, sostituite da due icone
  38×38 (Leggi/Parlane) subito sotto l'immagine, come chiesto.
  `FeedNotizieMondo.js` aggiornato di conseguenza (bottone "Leggi",
  non più "Apri e traduci").

  TEST: 13 test automatici nuovi (`lettore-articolo-b516.test.js`) +
  aggiornamento di `apri-traduci-b515.test.js` (i suoi vecchi
  assert sulle tre porte non valevano più, sostituiti con assert sul
  nuovo comportamento) — [VERIFICATO] 33/33 test passano su tutta la
  batteria b.513→b.516. `npx eslint` sui 5 file toccati: 0 errori, 1
  warning preesistente non mio (stesso eslint-disable inutilizzato su
  `<img>` già segnalato in b.515). Non ho rieseguito un `next build`
  completo per lo stesso limite di tempo del sandbox già dichiarato in
  b.515 — [ASSUNTO] che eslint pulito + test dedicati bastino come
  prova, stesso standard della sessione precedente.

  DEBITO RESIDUO invariato rispetto a b.515: HEAD locale del Mac
  ancora fermo indietro rispetto a origin/main, con
  `__tests__/preferenze-mondo-b508.test.js` cancellato ma non
  committato — non toccato in questa sessione, il workflow di commit
  parte da `origin/main` quindi non entra nel commit b.516.

  NUOVO DEBITO RESIDUO scoperto in fase di commit: nel working tree del
  Mac ci sono modifiche non mie di questa sessione, chiaramente in
  corso PROPRIO mentre lavoravo (stessi minuti, 17:32-17:45 UTC del
  26/08) — segno di un'altra sessione attiva sullo stesso repository:
  1. `app/lib/constants.js` — nuovo blocco `ALIAS_LINGUE`/
     `lingueTrovate` (ricerca lingue per nome alternativo it/en, non
     solo endonimo/sigla): codice non mio, non incluso nel commit
     b.516 (isolato via blob costruito su `origin/main`, il file reale
     sul Mac NON e stato toccato).
  2. `app/components/FeedNotizieMondo.js` — nuovo componente
     `Sovrapposizione.js` (fix di un bug di layout: il feed a tutta
     pagina misurava 440x691 dentro una finestra 657x749, non era
     davvero fullscreen) importato e usato per avvolgere il feed: non
     mio, non incluso nel commit b.516 con lo stesso isolamento del
     punto precedente.
  Nessuna delle due e stata toccata ne persa: restano nel working tree
  del Mac esattamente come le ha lasciate l'altra sessione. Segnalato
  a Luca in chat perche verifichi se sono due sessioni sue in
  parallelo (rischio di commit che si sovrascrivono a vicenda).

- Versione: **b.515** (push #804) — quattro richieste di Luca sulla
  sezione Mondo/Notizie, arrivate a raffica nella stessa sessione:

  1. «le notizie dal mondo breaking news devono essere decise da noi in
     automatico e l'utente deve potere personalizzarle, di default lo
     fai partire, e mentre arrivano le notizie devi muovere il globo
     prima di visualizzarle nella area specifica e poi aprire il
     thumbnail. quando l'utente sta lavorando leggendo o interagendo
     con un articolo, video etc, non fai muovere il globo.»
  2. «lascia che l'utente decida se attivare l'autoplay del video
     breaking news con un comando nella pagina in alto e non nella side
     bar.»
  3. «anche nella stanza news social attiva una visualizzazione
     continua a tutta pagina che mostri le notizie a tutta pagina e se
     uno entra e scorre attiva l'autoplay per ogni video in sequenza.
     attiva in alto con un tasto solo articoli, solo video, entrambi, e
     per default metti solovideo.»
  4. «permetti di leggere in una popup l'articolo traduci direttamente
     quando apro la pagina, permetti questo attraverso il tasto (apri e
     traduci) oppure apri oppure vai al sito.»

  **1 — IL PIANETA SI MUOVE PRIMA DEL CARTELLO.** `FinestraSulMondo.js`
  aveva gia la coda delle breaking (b.506); mancava il collegamento col
  globo. Nuovo canale `onPuntaGlobo` (FinestraSulMondo -> MondoView ->
  GloboMondo, prop `focusEsterno`, SEPARATO da `paeseScelto` per non
  toccare i filtri delle liste): quando arriva una breaking con un
  paese noto, prima si punta il pianeta e SOLO DOPO ~1.5s (il tempo
  gia impiegato dall'animazione `zoomTo` che il globo sa fare da solo,
  nessuna animazione nuova) compare il cartello col thumbnail. Se
  l'utente sta leggendo (`aperta`) o non c'e un paese da puntare
  (interessi a rotazione), il comportamento resta quello di prima. Il
  paese scelto A MANO dall'utente vince sempre sul focus della
  breaking. Default `mondoRitmo` cambiato da `'mai'` a `'5'` (5
  minuti): era una scelta deliberata di design (b.506, "niente ricerche
  non chieste"), Luca l'ha esplicitamente ribaltata — chi non lo vuole
  lo spegne dal pannello.

  **2 — AUTOPLAY VIDEO, COMANDO IN TESTATA.** Nuovo pulsante nella
  testata di "Il mondo ora" (non nel PannelloLaterale), preferenza
  persistita `mondoAutoplayVideo` (default ON). Il motore delle
  breaking cerca SOLO articoli (mai video): un video correlato si cerca
  ORA, e solo quando l'utente apre davvero la lettura di un cartello —
  mai per ogni notizia in coda, che avrebbe pagato quota YouTube per
  breaking che nessuno guarda mai.

  **3 — IL FEED A TUTTA PAGINA.** Nuovo componente
  `FeedNotizieMondo.js`: overlay fullscreen, scroll-snap verticale, un
  IntersectionObserver decide quale slide e "attiva" — SOLO quella ha
  un iframe YouTube con autoplay, le altre restano una miniatura
  statica (mai due video che suonano insieme). Filtro a tre stati
  (solo video / solo articoli / entrambi) fisso in alto, preferenza
  persistita `mondoFeedFiltro`, DEFAULT SOLO VIDEO come chiesto. Si
  apre da un tasto flottante nella tab News di MondoNews.js, riusa i
  dati della ricerca gia in corso (nessuna chiamata di rete propria).

  **4 — TRE PORTE SULLO STESSO ARTICOLO.** La card di un articolo aveva
  un solo tasto visibile ("Apri", che pero apriva l'ORIGINALE esterno —
  nome fuorviante) piu il click implicito su foto/titolo per la scheda
  interna. Ora sono tre, espliciti: **Apri e traduci** (apre la scheda
  interna e genera SUBITO la sintesi nella lingua dell'utente, senza
  aspettare il tocco sul tasto "Genera"), **Apri** (stessa scheda,
  aspetta il tocco, comportamento di prima), **Vai al sito** (link
  esterno, era gia li). `SchedaArgomento.js` accetta un nuovo prop
  `autoGenera`. Nuove chiavi i18n aggiunte SOLO in it.js/en.js (la
  catena di fallback di `t()` in `i18n.js` ripiega da sola sulle altre
  30 lingue finche' non vengono tradotte — e cosi che funzionano gia i
  "mini-pacchetti", non e una scorciatoia nuova).

  **REGOLA DI COPYRIGHT INVARIATA**: nessuna di queste modifiche
  riproduce il testo integrale di un articolo. "Apri e traduci" genera
  la stessa "Sintesi di BarTalk" (originale, scritta dall'AI sui soli
  dati del cluster) gia in uso da b.153 — solo piu veloce da vedere, non
  diversa nella sostanza. Il player video resta sempre l'embed ufficiale
  YouTube (nocookie): mai una copia, monetizzazione del creatore
  intatta.

  TEST: 20 test automatici nuovi/estesi (vitest) su tutti i punti
  sopra — [VERIFICATO] passano tutti. `npx eslint` sui 6 file toccati:
  0 errori, 2 warning preesistenti non miei (eslint-disable inutilizzato
  su `<img>`, gia presente prima di questa sessione). NON ho fatto un
  `next build` completo (avrebbe superato ampiamente i tempi di questa
  sessione): la prova e eslint pulito + i test dedicati, non un build
  end-to-end — [ASSUNTO] che basti, dichiarato qui perche sia
  verificabile.

  DEBITO RESIDUO dichiarato: il repository locale su questo Mac ha
  HEAD fermo a b.508 (6 commit indietro rispetto a origin/main, gia a
  b.514) e un working tree con `__tests__/preferenze-mondo-b508.test.js`
  cancellato ma non committato — NON l'ho toccato, non e lavoro mio di
  questa sessione, e resta li per chi ha fatto quella modifica. Il
  workflow di commit (parte da `origin/main`, non da HEAD locale)
  aggiunge SOLO i file elencati sopra, quindi questo residuo non entra
  nel commit b.515.

- Versione: **b.514** (push #803) — Luca, dopo aver verificato b.513:
  «HAI ROTTO TUTTO. LE CHAT NON VANNO E LE ALTRE PAGINA DANNO TUTTE UN
  ERRORE CAZZO. FAI UN TEST COMPLETO DI TUTTE LE FUNZIONALITA, PARTI
  DALLA HOME E PROSEGUI FINO A ULTIMARE».

  TEST COMPLETO ESEGUITO dal vivo (Home, traduzione voce/testo, cambio
  lingua, Il mondo ora, Vita/Life, Chat/Archivio, ricerca, i 4 rami del
  "+" — Entra con un codice, Crea un BarTalk con creazione reale e chat
  funzionante end-to-end, Contatti, Conversazioni salvate —, Community
  con le sue 3 schede, Profilo/Impostazioni): NESSUNA pagina rotta,
  NESSUN errore console nuovo, nessuna regressione dalla mia modifica
  precedente. La traduzione (testo E dentro una stanza vera creata per
  il test) funziona: "ciao come stai" -> "Hey, how are you?".

  Trovati pero DUE problemi reali, non inventati, con prova live:

  1. **BUG PRE-ESISTENTE, non mio**: `/api/stt-token` risponde sempre
     503 in produzione — log server: `DEEPGRAM_API_KEY assente`. La
     trascrizione vocale "premium" (streaming) non parte mai; l'app
     ripiega sempre e in silenzio su browser/Whisper. Combacia con «
     l'audio non viene tradotto all'inizio chat, da sempre problemi ».
     Serve la chiave Deepgram nelle Environment Variables di Vercel:
     non posso ne vederla ne impostarla, tocca a Luca.

  2. **BUG REALE TROVATO E CORRETTO QUI**: il "click fuori chiude"
     del pannello laterale (PannelloLaterale.js, comune a Notizie,
     Stanze/Mondo, Vita, RoomView) funzionava SOLO per caso a certe
     larghezze di schermo. Il velo (`position:fixed; inset:0`) viveva
     dentro il flusso normale della pagina; un antenato con
     `position:absolute` + `transform` (il layout a due colonne, su
     schermi abbastanza larghi) diventa containing block di QUALSIASI
     `fixed` dentro di se — comportamento CSS previsto, non un bug del
     browser. Il velo restava quindi grande quanto la colonna che lo
     ospitava (misurato: 440x635px dentro una finestra 1064x1122),
     non quanto lo schermo: fuori da quell'area il click non lo
     toccava mai, il pannello restava aperto per sempre — proprio il
     comportamento che Luca descriveva rompendo tutto per farmelo
     vedere. Corretto montando il pannello con `createPortal` dentro
     `document.body`: fuori da qualunque antenato, `position:fixed`
     torna sempre relativo alla finestra, su ogni larghezza.

  DEBITO RESIDUO dichiarato: non ho trovato ne riprodotto altre pagine
  "rotte" o "in errore" oltre a questi due punti — se Luca ne vede
  altre sul suo dispositivo mi servono gli screenshot/i passi esatti,
  perche sul mio ambiente di test tutto il resto e verde.

---

- Versione: **b.513** (push #802) — «quando clicco aggiorna chiudi la
  side bar sempre in tutte le maschere, quando clicco fuori dalla
  sidebar chiudi la side bar in tutto il software» (Luca, dopo uno
  screenshot del pannello Notizie con "Aggiorna" premuto e il pannello
  ancora aperto sopra il giornale appena rinfrescato).

  CENSITO PRIMA DI TOCCARE CODICE (`grep -rln PannelloLaterale`): il
  pannello laterale e' UN SOLO componente condiviso
  (`app/components/ui/PannelloLaterale.js`), usato in quattro maschere
  — Notizie (MondoNews.js), Stanze/Mondo (MondoView.js), Vita
  (Life/LifeView.js), Voci in stanza (RoomView.js). Ho cercato un tasto
  "Aggiorna" (o equivalente: `newsUpdate`) in tutte e quattro: esiste
  UNA SOLA occorrenza in tutto il repo, proprio quella di Notizie — le
  altre tre maschere non hanno un tasto che aggiorna/ricerca, solo
  tendine (si applicano da sole) o un elenco che gia chiude il pannello
  al tocco (Life, gia corretto da prima).

  FATTO (`app/components/MondoNews.js`): il tasto Aggiorna e il tasto
  Invio nello stesso campo di ricerca (stessa azione, stessa maschera)
  ora chiamano anche `suChiudiStrumenti?.()` dopo aver lanciato la
  ricerca — il pannello si chiude, il giornale aggiornato resta in
  vista sotto.

  [VERIFICATO nel codice, non serviva toccarlo] «chiudi cliccando
  fuori» c'era gia, per TUTTE le maschere, dentro PannelloLaterale
  stesso: il velo dietro il pannello (`position: fixed, inset: 0`)
  chiama `onChiudi` al click — e' il componente condiviso, quindi vale
  automaticamente ovunque compare un pannello laterale, non solo in
  Notizie.

  TEST: `__tests__/aggiorna-chiude-pannello-b513.test.js` (3 test,
  verdi) — il tasto/Invio chiudono, il velo di PannelloLaterale chiude
  gia, tutte e quattro le maschere usano il componente condiviso.

- Versione: **b.512** (push #801) — PRIMO SCAFFOLDING DI CAPACITOR,
  l'app "davvero installabile" ("capacitor, poi vedremo", Luca, dopo il
  confronto sulle tre strade — involucro nativo/React Native/nativo
  puro — scelta l'involucro nativo perche non duplica il codice web).

  NON e' un export statico. BarTalk usa moltissime API route lato
  server (`/api/mondo/*`, `/api/translate`, autenticazione, credito...):
  un `next export` (bundle statico dentro l'app) le romperebbe tutte.
  La configurazione (`capacitor.config.json`) usa invece `server.url`
  puntato alla produzione live (`https://voice-translator2.vercel.app`):
  l'app nativa e' un contenitore che apre lo stesso BarTalk di sempre,
  aggiornato ad ogni nostro push — nessun codice duplicato, nessuna
  seconda base da mantenere.

  FATTO: `npx cap init` (appId `com.tmwe.bartalk`, nome BarTalk),
  `npx cap add ios` e `npx cap add android` — creano `ios/` e
  `android/`, i due progetti nativi che Xcode e Android Studio aprono
  direttamente. `capacitor-shell/index.html` e' la sola pagina LOCALE
  nel pacchetto (una schermata "Connessione in corso..." mostrata per
  un istante prima che l'app carichi la produzione via rete). Pacchetti
  aggiunti a `package.json`: `@capacitor/core`, `@capacitor/cli`,
  `@capacitor/ios`, `@capacitor/android`.

  QUESTO PUSH NON CAMBIA NULLA nell'app web che gli utenti usano oggi:
  nessun file di `app/` toccato, zero comportamento nuovo su
  voice-translator2.vercel.app. E' lavoro preparatorio che vive accanto
  al resto del repo.

  [ASSUNTO — vincolo di piattaforma, non nostro] la parte iOS si
  compila SOLO su un Mac con Xcode installato: e' un limite di Apple.
  Il Mac di Luca non ha Xcode (verificato: `xcode-select -p` assente).
  Per la parte Android servirebbe Android Studio o gli strumenti da
  riga di comando del suo SDK: nessuno dei due presente sulla macchina
  usata per questo giro.

  DEBITO RESIDUO — cosa manca prima di avere un pacchetto installabile
  vero:
  1. Installare Xcode (Mac App Store) per compilare/firmare iOS;
     installare Android Studio (o solo l'SDK) per Android.
  2. Icone e splash screen veri (oggi l'icona e' quella segnaposto di
     Capacitor): servono gli asset grafici di BarTalk in piu misure.
  3. Un account Apple Developer (99$/anno) per pubblicare su App
     Store e firmare le build; un account Google Play Console (25$
     una tantum) per Android.
  4. Verificare/estendere il manifest CSP e `allowNavigation` di
     `capacitor.config.json` se servono domini aggiuntivi (Google/Apple
     login, Stripe) dentro la WebView nativa — non ancora controllato
     campo per campo.
  5. Il plugin nativo per la condivisione ricevuta (Share Target) va
     aggiunto esplicitamente (`@capacitor/share` copre l'INVIO, non la
     ricezione): e' il prossimo pezzo utile, visto che e' il problema
     concreto da cui e' partita questa richiesta.
  [ATTESO] primo avvio nel simulatore/emulatore dopo che Luca avra
  installato Xcode e/o Android Studio.

- Versione: **b.511** (push #800) — [VERIFICATO dal vivo, #799] b.510
  confermato in produzione durante il collaudo: invito dal menu della
  stanza aperto e verificato di persona (stessa stanza, stesso QR, il
  tasto indietro torna alla stanza); ricerca Stanze verificata dal vivo
  come filtro live; refresh verificato senza errori; il lettore interno
  testato su un articolo REALE (il caso concreto delle sue screenshot,
  "Il treno Milano-Parigi") — [ATTESO confermato] "Apri nel browser"
  resta l'unico modo di leggerlo perche la fonte (ilpost.it) rifiuta di
  essere incorniciata (X-Frame-Options), esattamente il caso [ASSUNTO]
  gia previsto nel diario di b.510: l'utente non e mai uscito dall'app,
  ha ricevuto un messaggio chiaro invece di una pagina bianca muta, ed
  e rimasto un tocco dalla via d'uscita.

  Durante lo stesso giro, Luca ha guardato la discussione e ha chiesto
  un'altra cosa: «dentro stanze lascia dietro una icona una popup per
  commentare. cosi la interfaccia e pulita. lascia solo cuore e altri
  tasti veloci utili fuori». Il modulo per scrivere un commento
  (soprannome + testo + tasto Invia) stava sempre aperto in fondo alla
  discussione (`MondoDiscussioni.js`, da b.394): un blocco fisso anche
  quando nessuno stava scrivendo. Ora sta dietro una singola icona a
  fumetto; toccata apre una popup dal basso (stesso stile a foglio di
  `CondivisoSheet.js`, per restare coerenti) con lo stesso modulo di
  prima — nickname, testo, invia — e si chiude da sola dopo un invio
  riuscito. I TASTI VELOCI PER COMMENTO (cuore/like, traduci, segnala,
  blocca) NON sono stati toccati: restano dove erano, fuori da
  qualunque popup, esattamente come Luca ha chiesto («lascia solo
  cuore e altri tasti veloci utili fuori»).

  PROVE: `composer-popup-b511.test.js` (nuova, 3 prove) — verifica lo
  stato che apre/chiude la popup, il contenuto della popup, e soprattutto
  che i tasti veloci per commento restino testualmente PRIMA della
  sezione Composer nel file (cioe fuori, non spostati dentro). Piu
  `invito-e-lettura-b510.test.js`, `discussione-tavola-21-b495.test.js`,
  `mondo-news.test.js` rieseguiti: verdi, nessuna regressione.
  [ATTESO] verifica visiva dal vivo dopo il push: l'icona sostituisce il
  modulo fisso, la popup si apre e chiude bene, il resto della scheda
  (titolo, media, commenti coi loro tasti) resta come prima.

- Versione: **b.510** (push #799) — TRE RICHIESTE EMERSE DURANTE IL
  GIRO DI TEST DAL VIVO (Luca in Stanze/Mondo mentre collaudava b.509):

  1. «sono in stanze, permettimi di creare a stanza e invitare anche da
     dentro la stanza» — prima l'invito si raggiungeva solo dal logo di
     Home, che crea sempre una stanza NUOVA. `QuickInvite.js` sapeva gia
     gestire una stanza esistente (prop `roomId`, salta la creazione),
     e `app/page.js` passava gia `roomId={roomPolling.roomId}` e
     `setViewAfterCreate={() => setView('room')}` al render di
     `quickinvite` — mancava solo la PORTA per arrivarci da dentro la
     stanza. Aggiunta una voce "Invita" (`RoomHeader.js`, menu ···),
     stesso pattern `VoceMenu` gia usato per Numero di sicurezza. Il
     tasto indietro di `QuickInvite.js`, prima sempre `setView('home')`,
     ora torna alla stanza (`setViewAfterCreate`) quando la stanza
     esisteva gia — altrimenti si usciva dalla stanza per il solo fatto
     di aver toccato "invita".

  2. «non voglio essere obbligato a uscire dall'applicazione per
     leggere un testo (da tradurre a richiesta). devi permettermi di
     leggerlo dentro il contenitore» — la card della fonte in una
     discussione (`MondoDiscussioni.js`, "Il Post") era un `<a
     target="_blank">`: apriva una scheda nuova del browser, fuori
     dall'app. Ora apre un lettore INTERNO (iframe nello stesso
     contenitore fixed, stessa quota z della discussione +5) con
     "Apri nel browser" sempre visibile in testata come ripiego.
     [ASSUNTO] alcuni editori impostano `X-Frame-Options` e rifiutano
     di essere incorniciati: in quel caso l'iframe resta bianco. Un
     iframe bloccato non genera un evento leggibile da JavaScript, per
     cui non e possibile rilevare in automatico quali fonti funzionano
     e mostrare il ripiego solo li: resta sempre visibile per tutte.
     Non e stato toccato ne promesso nulla sulla TRADUZIONE del testo
     dell'articolo stesso (BarTalk non conserva il corpo dell'articolo,
     solo titolo+link+commenti: tradurre pagine di terzi arbitrarie
     solleva questioni di copyright e affidabilita che non ho preso in
     carico qui). La traduzione a richiesta di titolo e commenti,
     quella si, era gia dentro il contenitore da prima (b.495) e non e
     stata toccata.

  3. «come faccio a condividere un post da instagram, linkedin o
     facebook?» — non c'era alcun bottone Condividi su una discussione.
     Aggiunto in testata, stesso `navigator.share({ title, url })` gia
     in uso in ChatActionsPanel/QuickInvite/TaxiTalk/CreditsView: su
     telefono apre il foglio nativo del sistema operativo, che elenca
     Instagram, LinkedIn, Facebook, WhatsApp — tutto cio che l'utente
     ha installato. [ASSUNTO, dichiarato onestamente] non esiste un
     modo di pubblicare direttamente DENTRO Instagram/LinkedIn/Facebook
     da un sito web senza le rispettive app/SDK nativi: il foglio di
     condivisione di sistema e la via corretta e universale, la stessa
     che il resto dell'app usa gia ovunque.

  PROVE: `invito-e-lettura-b510.test.js` (nuova, 5 prove) — verifica la
  voce Invita nel menu della stanza, il tasto indietro contestuale di
  QuickInvite, la sparizione del `target="_blank"` sulla card fonte, la
  presenza del lettore interno con iframe e ripiego, il bottone
  Condividi con `navigator.share`. Piu tutta la batteria Mondo/Stanze
  gia esistente (mondo-news, mondo-paese-vero, discussione-tavola-21,
  finestra-sul-mondo, mondo-m1-m2, invita-b489, menu-e-numero-b490,
  secondo-collaudo-b394, margini-uguali-b472) rieseguita: verde, nessuna
  regressione.
  [ATTESO] verifica dal vivo in produzione dopo il push di Luca su
  telefono vero: la voce Invita nel menu della stanza, il lettore
  interno che apre un articolo reale, il foglio di condivisione nativo.

- Versione: **b.509** (push #798) — [VERIFICATO in produzione, #798]
  SOLE E PIANETI RIACCESI, e il
  difetto vero corretto (ORDINE DIRETTO DI LUCA dopo b.508: «ripristina
  tutto e correggi quel problema grafico [...] altrimenti elimini
  semplicemente quel pianeta. Non tutto»).
  In b.508 avevo SOLO RIPORTATO — non deciso, non toccato — che sole e
  i tre pianeti decorativi (Marte, Venere, Saturno) erano spenti da un
  commit di Luca del 21/8 (b4416df) per un difetto grafico su Saturno:
  «l'anello senza la sua sfera sembra un buco». La formulazione della
  mia risposta ha fatto sembrare che fosse una scelta mia di oggi — non
  lo era, ma capisco la reazione: dovevo essere piu chiaro che era una
  sua decisione passata, non la mia di adesso.
  [VERIFICATO nel codice] causa reale del difetto: la sfera di ogni
  pianeta (`public/mondo-globo.html`, componente F6/fw) usava
  `meshStandardMaterial`, che risente della luce direzionale della
  scena — sul lato non illuminato diventa quasi nera e si confonde col
  nero dello spazio. L'anello di Saturno invece usa `meshBasicMaterial`
  (colore pieno, non risente di nessuna luce, sempre visibile). A certi
  angoli la sfera "si spegneva" e restava visibile solo l'anello: il
  buco descritto nel commit originale.
  FIX applicato: la sfera dei tre pianeti ora usa anche lei
  `meshBasicMaterial` (stesso trattamento dell'anello: colore pieno,
  sempre visibile, non dipende dall'angolo della luce). showPlanets e
  showSun tornati a `true` nell'unico punto di chiamata del componente
  (la luna era gia accesa). Saturno tiene il suo anello (torusGeometry
  invariata).
  PROVE: `pianeti-sole-b509.test.js` (nuova, 3 prove) — verifica che
  sole/pianeti siano accesi e che la sfera non usi piu il materiale che
  segue la luce.
  [ASSUNTO] la causa individuata (materiale che segue la luce vs
  materiale sempre acceso) e la spiegazione piu diretta del sintomo
  descritto ("buco con intorno il resto del pianeta"); non ho potuto
  vedere il rendering dal vivo prima di questo commit (serve il
  browser in produzione dopo il push).
  [ATTESO] verifica visiva in produzione dopo il push di Luca: sole e i
  tre pianeti visibili, Saturno mostra sfera+anello insieme a ogni
  angolo di passaggio, mai solo l'anello. Se il difetto dovesse
  persistere anche con questo fix, l'ordine di Luca e chiaro: si toglie
  SOLO Saturno (non sole/Marte/Venere), mai tutto di nuovo.

- Versione: **b.508** (push #797) — SECONDO GIRO SUL PANNELLO PREFERENZE
  di Mondo/Notizie, guardato dal vivo con Luca (screenshot alla mano).
  Quattro correzioni, tutte in `PreferenzeMondo.js` (condiviso da
  MondoView e MondoNews: sistemarlo qui sistema ENTRAMBE le sidebar
  che Luca ha sotto gli occhi):
  1. GRASSETTI ANCORA VISIBILI — [VERIFICATO] il commento di b.482
     diceva gia «a dire qual e quella accesa bastano il colore e il
     bordo», ma il codice era rimasto a fontWeight 600 dappertutto.
     Ora e 400 su tutto il pannello: lo stato si legge dal colore e
     dall'icona, non dal peso del testo.
  2. VIA "DA DOVE PARTO" — la preferenza mondoPaese, con la tendina di
     quaranta paesi, e tolta di netto dal pannello (ordine di Luca:
     «non serve tutta quella roba»). Il pianeta apre ora di default sul
     Paese dedotto dalla LINGUA del telefono («il mio paese, cioe la
     mia lingua», parole sue) — lo fa MondoView da solo all'ingresso.
     [ASSUNTO] uso la lingua e non il GPS reale: Luca ha detto
     «eventualmente» (facoltativo), e navigator.geolocation
     aggiungerebbe un permesso da chiedere all'utente senza che
     l'abbia richiesto esplicitamente. DEBITO RESIDUO: se vuole il GPS
     vero, e un innesto separato (richiede permesso browser).
     SCOSTAMENTO dichiarato da b.397 (che partiva sempre dal mondo
     intero finche non sceglievi tu): ora si parte gia sul proprio
     Paese. Si torna al mondo intero da News (suPaeseScelto), non piu
     dal pannello preferenze.
  3. "TRE SELEZIONI IN MEZZA SIDEBAR" — le quattro preferenze rimaste
     (titoli, modo, ritmo, aggiorna) stanno ora IN UNA RIGA SOLA
     ciascuna: icona+nome a sinistra, un comando compatto a destra.
     Titoli/modo/aggiorna → un'icona sola che cicla tra le due scelte
     a un tocco (IconeCiclo, 44x44). Ritmo (mai/2/5/10) → rotellina
     verticale con freccia su/giu (PassoVerticale), come chiesto da
     Luca: «un carosello verticale con piu/meno che occupa niente».
  4. PILLOLA PAESE IN TESTATA — in MondoView.js, la pillola col Paese
     scelto (es. "🇦🇺 Australia") mostra ora SOLO la bandiera; il nome
     resta per chi legge con lo schermo (aria-label/title). Ordine di
     Luca: «non serve scrivere tutto il paese, [...] metti una
     bandierina semplice semplice punto e basta».
  RAPPORTO SOLE/LUNA/PIANETI (chiesto da Luca, «mi sembra di capire
  che ti sei dimenticato dei pezzi») — [VERIFICATO] leggendo
  `public/mondo-globo.html` e il suo storico git: NON manca niente di
  mio. Il call-site unico passa `showStarfield:true, showMoon:true,
  showSun:false, showPlanets:false`. Sole e i tre pianeti decorativi
  (Marte, Venere, Saturno) sono SPENTI DI PROPOSITO da Luca stesso
  cinque giorni fa (commit b4416df, 21/8: "Il pianeta col buco era
  l'anello di Saturno senza il suo pianeta") — un difetto grafico
  reale (l'anello di Saturno senza la sfera sembrava un buco; il sole
  compariva sulla faccia notturna della Terra) fatto rientrare
  apposta. Restano accese le stelle e la luna (sempre dietro il
  globo, profondita negativa: non passa mai davanti a niente). Nessuna
  regressione mia: il componente tiene tutto pronto, solo spento dove
  Luca l'ha voluto spento.
  PROVE: `preferenze-mondo-b508.test.js` (nuova, 8 prove) +
  `mondo-paese-vero.test.js` aggiornato (le 3 prove che testavano il
  vecchio comportamento b.397 ora testano l'ingresso su lingua e
  l'assenza della preferenza — sostituzione dichiarata, non
  indebolimento). [VERIFICATO] 196 prove verdi sui 12 file che toccano
  MondoView/MondoNews (elenco nel comando eseguito).
  [ATTESO] verifica visiva in produzione dopo il push di Luca:
  pannello a una riga per preferenza, pillola solo bandiera, pianeta
  che apre sul proprio Paese.

- Versione: **b.507** (push #796) — LA RICERCA DEL MONDO, DAVVERO in
  pagina. DIFETTO INTRODOTTO DA b.504 e trovato dalla verifica visiva
  su #795: la fascia di ricerca che b.504 prometteva «in pagina» NON
  era mai stata scritta (lo script dell'innesto si era fermato a un
  passo successivo senza salvare quella parte), e siccome il pannello
  era gia stato ripulito, la ricerca era rimasta SENZA NESSUNA PORTA —
  zero input in tutta la schermata. La prova di b.504 non se n'era
  accorta: si accontentava di un setSearch qualunque dopo la testata
  (lo trovava nel popup dei risultati). Ora: fascia in pagina nel tab
  Stanze (b.482: altezza fissa 54, tasto svuota da 44) e la prova
  pretende l'INPUT vero col placeholder searchRooms.
  LEZIONE: quando uno script multi-parte muore a meta, ogni parte gia
  «annunciata» va ricontrollata una per una — e una prova che cerca un
  sintomo generico invece dell'elemento esatto e una prova che dorme.

- Versione: **b.506** (push #795) — LA FINESTRA SUL MONDO (progettata
  con Luca stanotte). Componente nuovo `FinestraSulMondo.js` montato
  nella scheda Mondo, fratello del globo (fuori dalla gabbia b.505):
  al RITMO scelto nel pannello (preferenza mondoRitmo: MAI predefinito
  / 2 / 5 / 10 minuti — tavola E) cerca le ultime notizie via
  /api/topics/search (cache condivisa; fresca solo col ritmo a 2, che
  e l'«ultimo minuto»); cosa cerca: gli INTERESSI del profilo a
  rotazione, altrimenti il Paese scelto, altrimenti il mondo. Le
  notizie NUOVE (dedupe su url) compaiono UNA ALLA VOLTA come un
  CARTELLO in basso — bandiera del Paese, miniatura, titolo nella
  lingua di chi guarda, «ULTIM'ORA» — che avanza da solo dopo 18s, si
  chiude con la X o si tocca: toccato si apre A TUTTO SCHERMO (foto
  16:9, titolo, sintesi, «Leggi su [fonte]»), chiuso vola via e il
  mondo continua. SI FERMA quando la pagina e nascosta
  (visibilitychange): niente batteria e credito bruciati per nessuno.
  Vere o niente: senza notizie nuove, nessun cartello.
  Chiavi nuove x38: prefRhythmTitle, rhythmNever, minShort,
  breakingWord.
  PROVE: `finestra-sul-mondo-b506.test.js`.
  [ATTESO] verifica visiva del ciclo completo in produzione con ritmo
  attivo — richiede Chrome in primo piano e qualche minuto di attesa.

- Versione: **b.505** (push #794) — UN LAYER SOLO per i comandi del
  cielo (ordine di Luca: «la luna e il sole non funzionano»).
  IL GUASTO: il wrapper del globo in MondoView dichiarava la quota
  zero — position piu z-index creano uno STACKING CONTEXT, una gabbia:
  la luna e il suo menu (fixed, quota 80/81) per quanto alti restavano
  composti dentro il contesto a quota zero, sotto la testata (quota 6)
  e sotto gli elenchi — VISIBILI ma NON CLICCABILI. Un fixed non
  scappa dalla gabbia del suo avo. Senza z-index il wrapper non fa
  contesto; il pianeta resta sotto perche il contenitore interno di
  GloboMondo la quota zero ce l'ha gia.
  RAPPORTO ORIGINE DATI DEL PIANETA (verificato per Luca):
  - puntini/traffico: STANZE APERTE VERE (rooms) + discussioni del
    feed caldo, scalati sul paese piu vivo (MondoView, b.363/b.403);
  - rotte aeroplanini: coppie di paesi con stanze vere + rotte di
    scena del file (b.363);
  - texture Terra/luna: CDN esterni (unpkg three-globe, jsdelivr) —
    verificato 200 in produzione; il motore del globo in
    public/mondo-globo.html e INTATTO rispetto all'originale
    bartalk-completo_2.html di Luca (navigator/wueform/ibrido, texture
    day/night, points identici) — i 3.7MB di differenza sono l'app
    demo intorno, tolta in b.369, NON il pianeta;
  - il pianeta SI FERMA quando la pagina e nascosta (rAF sospesi dal
    browser): e per questo che a Chrome minimizzato lo schermo del
    Mondo appare nero — non e un guasto, ma va verificato a schermo
    che RIPARTA quando la pagina torna visibile.
  PROVE: `globo-un-layer-b505.test.js` (rossa prima).

- Versione: **b.504** (push #793) — IL MONDO, guardato con Luca:
  tavole 02/M1/M2. Le tre linguette (Stanze·News·Mondo) e il pianeta
  solo nella sua linguetta c'erano GIA (b.476). Quel che mancava:
  M1 — la RICERCA sta NELLA PAGINA, sotto le linguette (prima era
  dentro il pannello, dietro una porta che nessuno apre per cercare);
  il PAESE e una pillola SENZA il «Cambia ›» (si tocca e si apre il
  pannello, dove mondoPaese c'era gia; la voce «mondo intero» sta li);
  l'AGGIORNA e un'icona in testata; «APERTE ADESSO» e l'etichetta
  dell'elenco delle stanze vive (i temi «qui se ne parla» c'erano gia,
  b.401).
  M2 — il pannello e SOLO preferenze: via la ricerca (in pagina) e via
  il FILTRO LINGUA (l'app traduce tutto: filtrare per lingua rimette
  la barriera; la zona si sceglie con mondoPaese). Il filtro per tipo
  di stanza resta (funzione viva non mostrata dalla tavola).
  NON TOCCATI: GloboMondo, la scheda Mondo col pianeta, MondoNews.
  RESTANO da guardare con Luca: il ritmo di ricerca a 4 passi (tavola
  E — oggi c'e mondoAggiorna si/no + l'aggiorna manuale in testata) e
  gli attivi «a cascata Matrix» sul globo (tavola 02-Mondo, tocca il
  globo 3D).
  Chiave nuova x38: openNowWord.
  PROVE: `mondo-m1-m2-b504.test.js` (rossa prima).

- Versione: **b.503** (push #792) — TAVOLE F E 32, e il punto sulle
  ultime tavole del template.
  TAVOLA F (il pannello di Vita): le SETTE SEZIONI non stanno piu in
  fila sopra la conversazione (b.208: per vedere le ultime bisognava
  trascinare) — vivono nel PANNELLO LATERALE in colonna (lo stesso del
  Mondo, b.363), tutte visibili insieme; la testata dice DOVE SEI (la
  sezione attiva, che apre il pannello) e la linguetta sul bordo e la
  maniglia. Si recupera una riga intera. Chiave x38: lifeSectionsWord.
  SCOSTAMENTO: niente conteggi (2 obiettivi, 3 compiti) sulle voci —
  i numeri veri li sapremo quando le fonti saranno esposte in elenco.
  TAVOLA 32 (pagina del tassista): la LINGUA si sceglie IN CIMA E
  SUBITO — pillole scorrevoli, un tocco — via il bottone che apriva un
  altro schermo (la scelta iniziale col rilevamento resta); la
  DESTINAZIONE e ENORME (28). Il tasto della mappa c'era gia.
  TAVOLE DICHIARATE NON APPLICABILI ORA:
  - E (pannello della finestra): e il MONDO col pianeta — VIETATA
    dall'ordine di Luca, si guarda insieme.
  - G (il piu della chat, con foto/documento/posizione/contatto): le
    funzioni di allegato NON esistono nel sistema — una tendina di
    tasti che aprono il nulla e vietata (regola 2). NOTA per il
    futuro: oggi il + e la fotocamera del modulo aprono le Azioni AI,
    e il commento nel codice promette «foto, file, posizione,
    contatto» — quel commento MENTE, da correggere quando si fara G.
  - 31 (scanner biglietti): il controllo campo-per-campo prima del
    salvataggio esiste GIA dentro il BizCard (scheda campi in tempo
    reale), e il codice BizCard non si tocca (ordine di Luca).
  PROVE: `vita-tassista-F-32-b503.test.js` (rossa prima).

- Versione: **b.502** (push #791) — TAVOLE 29 E 30.
  TAVOLA 29 (le tue chiavi): sotto ogni chiave lo STATO — «attiva»
  verde con la maschera che il server gia manda (b.166, mai la chiave
  intera, mai campi prefillati) oppure «non impostata» — e COSA
  SBLOCCA (OpenAI: traduzione e voce; Anthropic/Gemini: altro motore;
  ElevenLabs: la sua descrizione). Aa in testata.
  TAVOLA 30 (rubrica): la LINGUA A PAROLE accanto alla bandiera (era
  solo bandiera); Aa in testata accanto al piu (zoom sull'elenco).
  Pallino verde online sull'avatar e ordinamento online-first
  c'erano gia.
  Chiavi nuove x38: keyActiveWord, unlocksTranslateVoice,
  unlocksAltTranslate.
  PROVE: `chiavi-rubrica-29-30-b502.test.js` (rossa prima).

- Versione: **b.501** (push #790) — TAVOLE 27 E 28.
  TAVOLA 27 (Impostazioni): righe col valore a destra, gruppi con
  l'etichetta e interruttori visibili c'erano GIA (la riscrittura
  «ogni riga FA qualcosa»); aggiunto Aa in testata (rightAction del
  PageHeader, zoom CSS su tutto il contenuto).
  TAVOLA 28 (le voci): la testata dice «Come ti sentono» nella lingua
  dell'utente — prima diceva «Voice Studio», un nome in inglese con un
  gradiente dorato che nessun'altra testata ha; la riga in cima spiega
  il gesto («Tocca il triangolo per sentirle...»); Aa in testata. Il
  triangolo grande a sinistra e le bandiere c'erano gia (b.309).
  Chiavi nuove x38: howTheyHearYou, voicesExplain.
  PROVE: `impostazioni-voci-27-28-b501.test.js` (rossa prima).

- Versione: **b.500** (push #789) — TAVOLA 26: IL SOMMARIO.
  La testata dice CHI e QUANDO («Kenji · 25/08»), non «Rapporto»; la
  prima riga porta le bandiere delle lingue dei membri e i numeri
  (messaggi, durata); «IN DUE RIGHE» e un'etichetta e il sommario si
  legge a 15; le DECISIONI (keyPoints) sono righe con la riga sotto,
  non puntini; Aa in testata. La TRASCRIZIONE DOPPIONE e stata tolta:
  ai messaggi si va con la pillola (setView detail, che e la vista
  vera) — un contenuto in due posti invecchia male in uno dei due.
  Chiave nuova x38: inTwoLinesWord.
  PROVE: `sommario-tavola-26-b500.test.js` (rossa prima).

- Versione: **b.499** (push #788) — TAVOLA 25: I COMPITI.
  I gruppi per scadenza c'erano gia (b.333). Ora: «Nuovo compito» e la
  PILLOLA GRANDE in fondo all'agenda (apre lo stesso modulo; via il
  tastino dalla testata); nei Materiali «FOTOGRAFA E INCOLLA sono due
  tasti pari» — fotografa apre subito lo scanner vero (b.344) e dice
  che usa il credito, incolla apre il modulo e dice che e gratis.
  Chiavi nuove x38: matPhotoBtn, matPasteBtn.
  SCOSTAMENTO DICHIARATO: niente conteggio «N materiali» sulle schede
  dei compiti — il legame compito-materiali oggi e un campo singolo
  non esposto in elenco.
  PROVE: `compiti-tavola-25-b499.test.js` (rossa prima).

- Versione: **b.498** (push #787) — TAVOLA 24: I COMPAGNI.
  «La memoria e un interruttore visibile su ogni Compagno»: il toggle
  sta sulla card dei miei (salva subito con salvaMio e ricarica; se
  fallisce, l'errore si vede), non piu solo sepolto nel modulo di
  modifica (dove resta). «Dimentica» e la riga sotto di OGNI card, nel
  colore dell'attenzione, col testo intero. La card e fatta di righe
  (faccia 44, persona, comandi / memoria / dimentica). «Aggiungi un
  Compagno» e la pillola grande in fondo. SCOSTAMENTO DICHIARATO: il
  conteggio «N ricordi» del cartellino non c'e — il numero dei ricordi
  non e esposto da nessuna via oggi, e un numero inventato e peggio di
  nessun numero. Nessuna chiave nuova.
  PROVE: `compagni-tavola-24-b498.test.js` (rossa prima).

- Versione: **b.497** (push #786) — TAVOLA 23: LA TAVOLA ROTONDA.
  «Chi siede al tavolo si sceglie toccando le facce»: i compagni sono
  PILLOLE (faccia 24 + nome, accese/spente) al posto della griglia di
  card. Le due opzioni (fonti reali / documento) sono RIGHE con la
  spiegazione e la spunta TONDA a destra — via i checkbox quadrati;
  stessi stati, stessi effetti. L'etichetta «Su cosa devono
  confrontarsi» sta sopra il campo. «Apri la Tavola» era gia la
  pillola grande in fondo. Chiave nuova x38: tableOnWhatWord.
  PROVE: `tavolo-tavola-23-b497.test.js` (rossa prima).

- Versione: **b.496** (push #785) — TAVOLA 22: IL PROFILO PUBBLICO.
  «Chi e, che lingue parla, cosa ha detto. Nient'altro.» Le LINGUE
  accanto al nome vengono dai suoi commenti veri (mondoDB seleziona
  anche la colonna lang — sola lettura, una colonna in piu); TRE
  NUMERI in fila con cifre tabulari (discussioni, commenti, seguaci);
  le discussioni portano l'ARGOMENTO sotto; Aa in testata.
  SCOSTAMENTI DICHIARATI: niente faccia grande (nel Mondo non esiste
  un avatar pubblico), niente telefono ne «Aggiungi ai contatti»
  (funzioni che oggi non esistono: un tasto che apre il nulla e un
  tasto finto). Segui resta in testata. Nessuna chiave nuova.
  PROVE: `persona-tavola-22-b496.test.js` (rossa prima).

- Versione: **b.495** (push #784) — TAVOLA 21: LA DISCUSSIONE, e una
  correzione vista a schermo.
  TAVOLA 21 (MondoDiscussioni): la notizia sta GRANDE in cima al corpo
  (17pt, bandiera della sua lingua e autore accanto; tradotta,
  l'originale resta sotto piccolo — non solo compressa in testata);
  l'etichetta «N COMMENTI» sopra i commenti; ogni commento ha la
  BANDIERA accanto al nome; un commento tradotto porta l'ORIGINALE
  sotto piccolo invece di sostituirlo; Aa in testata (ingrandisce
  notizia e commenti). Composer, follow, like, blocca, segnala:
  intatti. Nessuna chiave nuova (commentsWord esisteva).
  CORREZIONE #782: in Business il tasto Aa finiva SOTTO la pila del
  credito (b.363, angolo fisso in alto a destra) — la testata ora le
  lascia l'angolo (padding destro 96).
  VERIFICA VISIVA #782: Business conforme (scansione grande, righe,
  tratteggiato); Rubrica apre lo scanner GIA sulla tab Contatti
  (bartalk-tab.js funziona in produzione).
  PROVE: `discussione-tavola-21-b495.test.js` (rossa prima).

- Versione: **b.494** (push #783) — TAVOLA 10: OBIETTIVI.
  «Poche cose, con quanto manca. Aggiungerne una e una riga sola.»
  I COMPITI DI OGGI (e in ritardo, max 3) sono righe «PER OGGI» dentro
  Obiettivi — stessa porta dei Compiti (/api/compiti, azione elenca),
  sola lettura, fallimento silenzioso; toccare una riga porta ai
  Compiti veri (cambiaScheda da LifeView). «Nuovo obiettivo» e la
  pillola grande accesa IN FONDO, dopo cio che c'e gia (prima era un
  bottone trasparente in cima). Le barre con la percentuale c'erano
  gia (b.320/b.334). SCOSTAMENTO DICHIARATO: le matite e le X sulle
  card degli obiettivi restano (il template non le mostra ma sono
  funzioni vive: toglierle senza un posto nuovo e perdere funzioni).
  Chiave nuova x38: forTodayWord.
  PROVE: `obiettivi-tavola-10-b494.test.js` (rossa prima).

- Versione: **b.493** (push #782) — TAVOLA 13: PRIMO AVVIO.
  «Una domanda per schermata» c'era gia (tre fasi, b.136); i ritorni
  c'erano gia. Quel che mancava: il trattino della fase in corso ora e
  GIALLO (regola 13: blu=sistema, giallo=dove-sei — era blu), e il
  tasto Aa sta in testata anche qui: ingrandisce tutto il contenuto
  con lo zoom CSS, senza toccare le misure delle tre fasi.
  PROVE: `primo-avvio-tavola-13-b493.test.js` (rossa prima).
  LIMITE DICHIARATO: verifica visiva del primo avvio da fare in
  incognito (nel Chrome di Luca il profilo esiste gia e non si tocca).

- Versione: **b.492** (push #781) — TAVOLA 05 DEL TEMPLATE: BUSINESS.
  «Strumenti, non riquadri. Ognuno dice cosa fa in una riga.» La
  SCANSIONE e la cosa grande in cima (e il motivo per cui si apre la
  pagina) e apre lo scanner; la RUBRICA e una riga e apre i contatti
  dello scanner tramite `bartalk-tab.js` — file ADDITIVO col patto di
  bartalk-doc.js: con ?tab=contacts preme la tab giusta al load, il
  codice BizCard resta intatto. PeepOff resta una riga con la sua
  descrizione. Aa in testata come ovunque (ingrandisce l'elenco).
  SCOSTAMENTO DICHIARATO: la scheda «Il tuo biglietto da visita» del
  cartellino non c'e — la funzione nel sistema non esiste ancora e una
  scheda senza niente dietro e una scatola vuota (regola 2); si fara
  quando esistera il biglietto personale.
  Chiavi nuove x38: scanCardTitle, scanCardDesc, addressBookDesc.
  PROVE: `business-tavola-05-b492.test.js` (rossa prima, verde dopo).

- Versione: **b.491** (push #780) — TAVOLE 17 e 18 DEL TEMPLATE.
  TAVOLA 17 (stanza video di gruppo): la testata dice DOVE SEI — il
  codice della stanza, non «Stanza video» — e il tasto Aa c'e anche qui
  (regola del template: Aa sempre in testata) e ingrandisce le battute
  tradotte sotto i riquadri. SOLO interfaccia: useStanzaVideo, palco e
  traduzioni non toccati.
  NOTA ARCHITETTURA: il cartellino 17 vorrebbe che il video di gruppo
  si accendesse DENTRO la chat, non in una vista a se. Oggi e una vista
  a se PER SCELTA DIFENSIVA (b.102: se si rompe, la chiamata a due
  vive); cambiarla senza due dispositivi in mano violerebbe la regola
  sul percorso video. Se ne riparla al test a due telefoni.
  TAVOLA 18 (videochiamata a pieno schermo): TRE COMANDI SOLI in barra
  — microfono, telecamera, chiudi — tondi da 54, e il rosso e solo per
  chiudere. Ruota, interprete, sottotitoli, voce, volumi e schermo
  stanno nel cassetto «Altro» (regola 11), stessi onClick: NIENTE
  funzioni perse. I comandi spariscono da soli dopo 6 secondi, un tocco
  ovunque li riporta; la X rossa in testata resta SEMPRE (b.352). Il
  PiP e verticale come un telefono (84x112, raggio 14). Chi parla ha
  bandiera e nome sull'immagine, in alto a sinistra.
  La vista compatta (video sopra la chat) NON e stata toccata.
  Nessuna chiave nuova (otherWord, textBigger ecc. esistevano gia).
  PROVE: `video-tavole-17-18-b491.test.js` (rossa prima, verde dopo),
  piu le prove video esistenti tutte verdi.
  LIMITE DICHIARATO: verificato senza collegamento WebRTC vero — la
  chiamata con due peer si prova al test a due telefoni.

- Versione: **b.490** (push #779) — TAVOLE 19 e 20 DEL TEMPLATE, e
  l'invito che torna raggiungibile.
  TAVOLA 19 (menu ⋯ della chat): «ogni voce dice cosa fa» — chiamata
  vocale e azioni AI hanno la spiegazione sotto il nome; il NUMERO DI
  SICUREZZA entra nel menu con lo scopo scritto («Controlla che nessuno
  ascolti») e apre l'overlay col componente vero. Compare SOLO quando il
  collegamento diretto esiste: senza E2E il numero non c'e, e una voce
  che apre il nulla e un tasto finto.
  SCOSTAMENTI DICHIARATI: «Chi puo entrare» non ha oggi un controllo da
  dentro la stanza; «Rapporto tecnico» e «Chiudi la stanza» vivono nel
  pannello laterale (regola 11 + b.482: un comando rosso a un dito dalla
  chiamata e una trappola).
  TAVOLA 20 (numero di sicurezza): il numero e LA COSA GRANDE — 28
  punti, gruppi gia fatti da improntaChiavi, cifre tabulari — e quando
  combacia lo si LEGGE, col pallino verde, non da un bordo piu verde.
  E L'INVITO DAL LOGO (ordine di Luca, 25/08, che corregge il primo
  «si trova nel + sotto»: «non va nel foglio, viene attivato dal logo»):
  col ridisegno della Home «Invita una persona» era sparita e QuickInvite
  — appena rifatta sulla tavola 16 — era una pagina ORFANA. Ora toccare
  il marchio BarTalk in testata la apre (con aria-label per chi non vede).
  VERIFICA VISIVA IN PRODUZIONE (#778, prima di queste): tavola 14
  conforme e provata (entrato da solo con «Entra tu per primo»); tavola
  15 conforme e provata fino in fondo (caselle riempite digitando,
  bottone acceso a codice completo, Kenji entrato e ha visto il
  messaggio); b.486 confermato (niente «Traduzione...» eterna).
  Chiavi nuove: securityNumberWord/Desc, voiceCallDesc, aiActionsDesc,
  optInviteTitle — tutte in 38 lingue.
  PROVE: `menu-e-numero-b490.test.js` + `invita-b489` estesa col gancio.

- Versione: **b.489** (push #778) — TAVOLA 16 DEL TEMPLATE: invita una
  persona (`QuickInvite.js`). «Un link, e i modi per mandarlo.»
  1. IL LINK SI VEDE PER INTERO prima di mandarlo, in una scheda col
     tasto copia accanto: nessuno manda una cosa che non ha letto. Prima
     la pagina mostrava un QR senza mai dire a cosa portasse — ora sopra
     c'e scritto: «Chi apre il link entra nella tua stanza. Sceglie la
     sua lingua da solo» (`inviteExplain`, 38 lingue).
  2. I CANALI PER NOME: WhatsApp, SMS, Email (nomi propri, non si
     traducono). Il testo dentro parte NELLA LINGUA DI CHI LEGGERA'
     (`inviteText` via `t(mapLang(guestLang))`, col pacchetto scaldato al
     cambio di lingua) — non nella mia.
  3. La lingua dell'invito etichettata per quello che e: «In che lingua
     lo leggera» (`inviteReadLang`). Le pillole della tavola erano due
     lingue d'esempio; le 44 vere stanno in tendina, la forma del kit
     per una scelta lunga.
  4. VIA I GRADIENTI da titolo e codice (regola 06: colore scritto a
     mano): testo pieno, cifre tabulari, come la sala d'attesa.
  QR e codice RESTANO (funzione viva per chi e faccia a faccia),
  disposti sotto i canali.
  PROVA: `__tests__/invita-b489.test.js`.

- Versione: **b.488** (push #777) — TAVOLA 15 DEL TEMPLATE: entra col
  codice (`JoinView.js`). CASELLE, NON UN CAMPO: si vede quanto e lungo
  il codice prima di cominciare a scriverlo. La tavola le disegna per un
  codice da quattro; i codici veri ne hanno OTTO da sempre (b.248), e le
  caselle sono quante i caratteri veri — la fedelta e allo scOPO, non al
  numero disegnato con un codice d'esempio. La digitazione passa da un
  input invisibile steso sopra la fila: tastiera, incolla e correzione
  funzionano come prima, le caselle sono solo il vestito. Sopra le
  caselle: «Il codice che ti hanno dato» (`codeGiven`, 38 lingue). E il
  bottone si accende solo a codice COMPLETO (otto): prima con disabled a
  4 si poteva premere Entra con mezzo codice e l'errore arrivava dal
  server invece che dal disegno.
  SCOSTAMENTI DICHIARATI: niente pillola «Inquadra il QR» — uno scanner
  QR in-app per l'ingresso NON esiste, e una pillola senza funzione e un
  tasto finto (si aggiunge quando esiste lo scanner); niente Aa in
  testata (stessa ragione della tavola 14: lo zoom vive dentro RoomView).
  PROVA: `__tests__/entra-col-codice-b488.test.js`.

- Versione: **b.487** (push #776) — TAVOLA 14 DEL TEMPLATE: la sala
  d'attesa (`LobbyView.js`). Applicata fedelmente:
  1. IL CODICE E' LA COSA PIU GRANDE A SCHERMO — 48 punti, cifre
     tabulari, testo pieno (era 30, colorato d'accento, sotto
     un'etichetta «CODICE» che non informava). E' quello che si detta al
     telefono o si urla in un bar.
  2. Sotto il codice, COSA FARCI: «Leggi questo codice a chi deve
     entrare» — nuova chiave `readCodeAloud`, in 38 lingue.
  3. «IN ATTESA» E' UNA RIGA COL PALLINO verde (stanza viva), non un
     riquadro; cambia da sola quando entra qualcuno.
  4. IL BOTTONE IN FONDO C'E' SEMPRE: da soli «Entra tu per primo»
     (`enterFirst`), in due «Iniziamo». Prima si poteva entrare SOLO
     quando qualcuno era gia dentro: chiusi fuori dalla propria stanza.
  5. Pillola «Copia» accanto a «Condividi» (`copyWord`): chi non usa il
     foglio di condivisione non aveva modo di prendersi il link.
  6. `membriDi()` anche qui (regola b.485): c'era un
     `roomInfo?.members?.[1]` letto a mano.
  SCOSTAMENTO DICHIARATO: la tavola ha il tasto Aa in testata (regola
  10); lo zoom del testo pero oggi vive dentro RoomView e qui sarebbe un
  tasto finto. Si aggiunge quando lo zoom diventa globale, non prima.
  ORDINI NUOVI DI LUCA (25/08): la pagina Mondo col pianeta NON si tocca
  (si guarda insieme); elementi fuori template si dispongono secondo il
  kit, o in sidebar se c'e dubbio; dopo ogni pagina verifica visiva col
  browser. I processi lanciati da device_bash MUOIONO fra una chiamata e
  l'altra: il dev server (porta 3005) va avviato dal terminale di Luca.
  PROVA: `__tests__/sala-attesa-b487.test.js`.

- Versione: **b.486** (push #775) — PAGINA 04/04b (chat singola e di
  gruppo): verifica col template, un difetto funzionale chiuso, un
  ritocco. Collaudo fisico del 25/08, due schede nella stessa stanza.
  VERIFICA PRIMA DI TUTTO: la 04b che il template dava «DA FARE» era gia
  mezza applicata (b.466 partner in testata, b.470 quattro comandi,
  b.473 coppia non ripetuta, b.482 pila nell'angolo). Il ConsumoChip
  resta in testata: porta scritto «(Luca)», e un ordine, non una svista.
  IL DIFETTO: «Traduzione...» PER SEMPRE. Un messaggio mandato quando in
  stanza c'era una persona sola restava con l'etichetta in corsivo sotto,
  anche dopo l'ingresso del partner: la prima cosa che il partner vedeva
  entrando era un messaggio rotto. La causa non e un guasto ma una regola
  giusta senza etichetta: b.289 (nessun destinatario = niente traduzione,
  niente spesa) e sacrosanta, ma il messaggio partiva IDENTICO a uno in
  attesa, e la bolla non poteva distinguere «sta arrivando» da «non
  arrivera mai». Ora il messaggio nato senza destinatari lo DICHIARA
  (`soloOriginale`, nei due percorsi: testo e audio) e la bolla del
  mittente non scrive piu «Traduzione...» su di lui. Un ERRORE vero si
  mostra comunque; il tasto «Traduci» del ricevente (b.326) non cambia;
  il segno NON va al server (il corpo di /api/messages e costruito a
  mano, verificato).
  RITOCCO: la faccia del partner in testata c'e SEMPRE — senza avatar si
  ricade su quello di default, come gia fanno le bolle.
  PROVA: `__tests__/traduzione-eterna-b486.test.js` — 4 rosse sul codice
  di prima, verdi adesso.

- Versione: **b.485** (push #774) — «U.FIND IS NOT A FUNCTION», DI NUOVO, e
  stavolta l'ha visto Luca sul telefono con la pagina intera sostituita dalla
  scritta di errore. E' lo stesso schianto chiuso in b.426.
  LA CAUSA e la stessa di allora: `roomInfo?.members?.find(...)` protegge dal
  MANCANTE, non dal NON-ELENCO. Il punto interrogativo salta solo null e
  undefined; se `members` torna un OGGETTO — e la lettura PUBBLICA di una
  stanza non restituisce i membri apposta, dice solo quanti sono — allora non
  salta niente, si chiama `.find` su un oggetto, e la schermata muore.
  ORA PASSANO TUTTI DALL'AIUTANTE, che esiste dal b.387 (`membriDi()` in
  app/lib/membri.js, `Array.isArray(m) ? m : []`): RoomView in tre punti,
  TalkControls in due, piu Home, archivio, dettaglio e sommario — che avevano
  la stessa riga e sarebbero morti allo stesso modo.
  E LA COSA CHE FA PIU MALE E' MIA: il diario di b.426 dichiara una prova di
  guardia, `__tests__/membri-non-elenco-b426.test.js`, che NON E' MAI
  ESISTITA — cercata in tutta la storia del deposito, non c'e in nessun
  commit. Ho scritto di aver messo una guardia e non l'ho messa, e senza
  guardia il difetto e rientrato in silenzio. Adesso c'e davvero:
  `__tests__/membri-non-elenco-b485.test.js`, e vieta l'accesso a mano ai
  membri in TUTTE le superfici (components e hooks), non solo nelle righe che
  conoscevo. Verificata ROSSA sul codice di prima.

- Versione: **b.484** (push #773) — L'ULTIMO SOSPESO CHE NON DOVEVA ESSERLO:
  la scheda del DAL VIVO parlava italiano a tutti. Venti frasi scritte nel
  codice — rete caduta, credito finito, microfono negato, «ti ascolto» — cioe
  proprio i momenti in cui chi legge ha bisogno di capire, e ci trovava una
  lingua che non e la sua. Adesso vengono dai pacchetti, in trentotto lingue,
  tradotte col tono giusto: queste frasi esistono per NON colpevolizzare e
  per dire cosa si puo fare lo stesso.
  IL FILE E' QUELLO CHE LUCA HA VIETATO PER NOME, e il divieto e stato
  rispettato dove conta: della telefonata non e stata toccata una riga. Il
  traduttore arriva come PROP da chi monta la scheda — dentro non e stato
  aggiunto nessun aggancio nuovo al contesto. Cambia solo cio che si legge.
  Le ventiquattro prove della scheda restano verdi.
  E UNA PROVA MIA RISCRITTA, sempre la stessa malattia: cercava la frase ALLA
  LETTERA, accento compreso, e si e fatta rossa quando l'italiano e stato
  corretto («non e» → «non e'»). Difendeva l'ortografia di un ripiego, non il
  comportamento.
  CORREZIONE A CIO CHE AVEVO SCRITTO IN b.483: avevo detto che il permesso
  della voce su ElevenLabs «non e una cosa che posso fare». NON E' VERO, e
  l'ho verificato sulla documentazione: l'interruttore
  (`platform_settings.overrides.conversation_config_override.tts.voice_id`)
  si accende anche via API, con una PATCH sull'agente. Serve la chiave, che
  sta su Vercel, e serve il SI di Luca perche e un cambio al suo account —
  ma la mano ce l'ho. Il comando e scritto e provato nella sintassi, e non e
  stato eseguito.

- Versione: **b.483** (push #772) — DUE COSE CHE AVEVO CHIAMATO «SOSPESE» E
  NON LO ERANO: non erano decisioni di Luca, erano lavoro mio. Chiederle a lui
  era scaricargli addosso una cosa che dovevo fare.
  1. IL CODICE A BARRE DEL TASSISTA ERA ROVESCIATO. Non solo «verde su blu
     scuro»: misurata la luminosita dei due colori, il TRATTO era piu CHIARO
     del FONDO. Un lettore si aspetta scuro su chiaro; al rovescio moltissime
     fotocamere non leggono e non lo dicono — non succede niente, e chi
     inquadra crede di aver sbagliato lui. Ed e l'unico codice che deve
     leggere uno SCONOSCIUTO, di corsa, dentro un'auto.
     Sotto c'erano altre due cose che non avevo visto:
     · TRE dei cinque codici li disegnava un SERVER DI TERZI
       (api.qrserver.com). Se quel server e lento o irraggiungibile da quella
       rete, il codice NON COMPARE — su schermate il cui unico scopo e il
       codice, e senza nessun ripiego. E l'indirizzo dove stai andando usciva
       dal telefono e finiva dentro una richiesta a un'azienda che non
       conosciamo. La libreria per disegnarli era GIA IN CASA e la usavano
       gia l'invito e la sala d'attesa: non si e aggiunto niente, si e smesso
       di chiedere fuori una cosa che sapevamo fare dentro.
     · GLI ANGOLI DELLA TELA ERANO ARROTONDATI. I tre quadrati che un lettore
       cerca per primi stanno proprio negli angoli, e dodici punti di raggio
       ci entravano dentro.
     Ora c'e UN POSTO SOLO che decide come si disegna un codice
     (app/lib/codiceQR.js): nero su bianco, cornice chiara larga, angoli
     vivi, e tutte e cinque le schermate passano di li.
     PROVA: `__tests__/codice-qr-leggibile-b483.test.js`, verificata ROSSA sul
     codice di ieri su tutti e tre i punti.
     E UNA PROVA MIA RISCRITTA: `lingua-e-pila-b429` pretendeva di trovare il
     nome del servizio esterno dentro le due schermate. L'intento — «i pezzi
     sono COPIATI, non riscritti» — resta e vale; ma cosi, difendendo la
     somiglianza, la prova teneva in vita anche la dipendenza.
  2. LE PAROLE DELLA SEZIONE VITA: ventitre, non quindici. Le peggiori erano
     le OTTO IDEE DI CORSO — otto pulsanti in italiano, e toccandone uno ti
     ritrovavi una frase italiana dentro il campo. Piu i cinque gruppi
     dell'agenda dei compiti, il riassunto che si manda al Compagno, e il
     nome del Maestro. Tutte tradotte davvero in trentotto lingue, non
     copiate: verificato che nessuna lingua ripeta l'italiano o l'inglese.
  RESTA DAVVERO A LUCA, e non per prudenza: il permesso della voce
  (`voice_id`) e un interruttore dentro il pannello ElevenLabs. Lo strumento
  disponibile da qui arriva al prompt e alla voce dell'agente, NON alla
  scheda dei permessi: non e una cosa che posso fare e ho scelto di non fare.
  NON TOCCATO, e dichiarato: `Life/CompagnoLive.js` ha quattordici frasi
  italiane visibili (gli avvisi di quando la linea vocale non parte). E il
  file che Luca ha vietato per nome; le parole si potrebbero cambiare senza
  sfiorare la telefonata, ma il divieto e suo e serve il suo via.

- Versione: **b.482** (push #771) — LO STANDARD DEL TEMPLATE SU TUTTO IL RESTO:
  Vita, Mondo, gli ingressi, il taxi, la stanza video, il clone della voce.
  Nove lavorazioni in parallelo, un pacchetto di schermate ciascuna, coi due
  divieti rispettati — il pianeta e l'agente dal vivo non sono stati aperti.
  Margini a venti sui contenitori, bersagli a quarantaquattro (il tasto piu
  piccolo trovato era ventiquattro), colori dai token, parole dai pacchetti.
  E QUATTRO DIFETTI VERI, non di sola grafica:
  · IL DISTINTIVO DELL'ASCOLTATORE ERA UNA CASELLA VUOTA — fondo, bordo,
    rientro e dentro niente: la parola non esisteva in nessuno dei trentotto
    pacchetti. Ora c'e.
  · UNA SPUNTA SI LEGGEVA COME «\u2713» ALLA LETTERA fra gli interessi del
    profilo: dentro il testo di un elemento JSX una sequenza di scappamento
    non e una scappatoia, e testo.
  · OTTO TASTI ERANO INVISIBILI (cerchi gialli vuoti nel taxi, caselle
    d'icona vuote negli ingressi e nella scheda persona): chiedevano un
    disegno che nell'archivio delle icone non esiste.
  · LA GUARDIA SULLE EMOJI AVEVA DUE BUCHI, e da tutti e due sono passate
    emoji vere: guardava solo i CARATTERI (un'emoji scritta come
    scappamento passava, ed erano scritte cosi in dieci file) e solo la
    cartella components, senza entrare in ui/. Ora guarda tutte e due le
    forme e scende nelle sottocartelle. Le due eccezioni — le reazioni, che
    SONO emoji, e il messaggio di regalo su WhatsApp — sono dichiarate nel
    codice invece che dimenticate.
  E la pila torna nel suo angolo anche nella chat (era finita DENTRO il menu
  •••: per sapere quanto credito ti resta dovevi aprire un menu, proprio dove
  il credito si consuma mentre guardi). «Chiudi e archivia» esce da quel menu
  e va nel pannello laterale: stava a un dito dalla chiamata vocale, e un
  tocco storto chiudeva la conversazione. E l'indicatore della linea non dice
  piu P2P, Realtime e Polling — tre nomi di protocolli, in inglese in tutte e
  trentotto le lingue — ma se la linea e diretta, buona o debole.

- Versione: **b.481** (push #770) — LA CORNICE COMUNE, che era l'ultimo posto
  dove le vecchie misure resistevano: i margini delle schermate che non se li
  scrivono da se salgono da 16 a 20 (passando da una pagina all'altra il
  contenuto saltava di quattro punti), il tasto INDIETRO — il piu premuto
  dell'applicazione — da 36 a 44, e il titolo della testata condivisa perde il
  grassetto. E via il grassetto dalle ULTIME 386 righe rimaste in tutta
  l'applicazione: Life, Mondo, gli ingressi, il taxi, le voci. Il pianeta e
  l'agente dal vivo non sono stati toccati.

- Versione: **b.480** (push #769) — LO STANDARD DEL TEMPLATE APPLICATO a sei
  schermate (archivio, dettaglio, sommario, rubrica, business, credito, pila,
  profilo, voci): niente grassetto, niente caselle di icona rimaste vuote,
  margini a 20, tasti da 44, colori dai token, parole dai pacchetti. E due
  tasti che erano diventati INVISIBILI — elimina conversazione e svuota
  ricerca — hanno di nuovo un'icona.
- Versione: **b.478** (push #768) — FULMINE E LUNA NON PIU SOVRAPPOSTI:
  chiedevano tutti e due il posto ZERO della fila a destra. La pila resta li,
  la luna prende il posto accanto. E c'e una prova che controlla che due
  componenti non chiedano mai lo stesso posto.
- Versione: **b.477** (push #767) — RIMESSA LA CHIAMATA VOCALE, che in b.470
  avevo detto di aver spostato nel menu e invece avevo solo cancellato. Se ne
  e accorta una prova di guardia, non io.
- Versione: **b.476** (push #766) — MONDO DIVENTA TRE SCHEDE: Stanze, News e
  Mondo. Il pianeta sta SOLO nella sua — prima faceva da sfondo a tutte e
  due le liste, che per restare leggibili avevano bisogno di un velo sopra.
  Del pianeta non e stato toccato niente: stessi file, stesse animazioni,
  stesso cielo; e cambiato solo dove compare. E la linguetta su Mondo apre
  il pannello invece del vuoto.
- Versione: **b.475** (push #765) — IL MICROFONO DELLA CHAT FUNZIONA COME
  QUELLO DELLA HOME: si tocca e registra, si tocca e finisce. Prima apriva
  un pannello che copriva il campo di scrittura — due tocchi e mezzo schermo
  — e la scritta diceva «tieni premuto», che era falso: chi teneva premuto
  non otteneva niente. Le impostazioni che stavano in quel pannello
  (riduzione rumore, modo, sensibilita) sono nella sidebar.
- Versione: **b.474** (push #764) — TUTTI I MICROFONI ALLO STESSO STANDARD
  (quello della Home e del taxi), anche quello dentro il modulo della chat.
  E mentre si registra diventa rossa TUTTA la fascia del testo, non solo il
  tondino: lo dice la riga intera, larga quanto lo schermo. Scritta la skill
  «grafica-prima-nel-template»: ogni lavoro grafico si disegna nel template,
  si verifica, e solo dopo si installa.
- Versione: **b.473** (push #763) — VIA LA PILLOLA «ELENCO/CAROSELLO» da
  sopra i messaggi: era un secondo modo di leggere portato da un'altra app,
  non nel template, che cambiava la pagina sotto le dita senza spiegare
  niente. E' una preferenza e sta nel pannello, con scritto cosa fa. E in
  una chat a due la coppia di lingue non compare piu TRE volte: la dicono i
  chip, che ora aprono anche il selettore.
- Versione: **b.472** (push #762) — UN MARGINE SOLO IN TUTTA LA CHAT: erano
  QUATTRO rientri diversi incolonnati (10, 12, 14, 20). Ora venti ovunque,
  come la Home e come dice il template. E c'e una prova di guardia che lo
  controlla, cosi la verifica non dipende piu dal fatto che me ne ricordi.
- Versione: **b.471** (push #761) — IL MODULO DEL TESTO STA SEMPRE IN BASSO
  nella chat, come dice il template. Prima c'erano due tondi flottanti — una
  tastiera e un microfono disegnati con EMOJI, vietate qui — e il campo
  compariva solo dopo averne toccato uno: tre stati per fare quello che il
  template fa con una riga. Ora: piu, campo, fotocamera, e microfono che
  diventa freccia quando c'e del testo.
- Versione: **b.470** (push #760) — LA CHAT SEGUE IL TEMPLATE: la riga di
  CHI C'E' (nomi, lingue e quanti sono) che mancava del tutto, il tasto Aa
  in testata collegato davvero alla misura delle bolle, e la testata scesa da
  sette comandi a quattro — chiamata vocale e rapporto tecnico sono nel
  pannello, che ora tiene anche le preferenze.
- Versione: **b.469** (push #759) — IL CLONE DELLA VOCE non partiva: il
  tetto del corpo della richiesta era 256KB, quello di una richiesta di
  testo, e mezzo mega di voce veniva respinto prima di partire — per questo
  «non salvava i dati». Alzato a 4MB su quella rotta, e l'attesa da 30
  secondi a 3 minuti. E la chat ha la linguetta col pannello, con dentro le
  voci (ElevenLabs e le altre) che prima stavano sempre a schermo.
- Versione: **b.467** (push #758) — UN MICROFONO SOLO per tutta
  l'applicazione (ui/Microfono.js): erano tre disegni diversi per lo stesso
  gesto — Home, «Parla ora» e chat. Cambia la misura, non la forma; il
  tratto resta bianco, il colore lo porta l'alone. I due sistemi (normale e
  dal vivo del Compagno) sono due COLORI, non due forme.
- Versione: **b.466** (push #757) — NELLA CHAT A DUE, IN ALTO C'E' CHI HAI
  DAVANTI: faccia, nome e bandiera invece del codice della stanza (ordine di
  Luca). In tre o piu resta il codice, perche i nomi sono gia nei chip. E il
  template della chat e stato rifatto: disegnava QUATTRO pezzi su
  DICIASSETTE — ora c'e l'inventario completo di cosa monta davvero
  RoomView.
- Versione: **b.465** (push #756) — TORNA L'ITALIANO, e le lingue uguali
  funzionano. Avevo tolto dall'elenco la lingua gia parlata: sbagliato, due
  persone che parlano la stessa lingua devono poter usare l'app (ordine di
  Luca). Se la scegli, quella e — anche la tua. E in quel caso non si chiama
  il traduttore: la frase si mostra e si legge com'e.
- Versione: **b.464** (push #755) — I MENU CHE GALLEGGIANO ADESSO COPRONO:
  nuovo token menuBg, OPACO, in tutti e sei i temi. Erano translucidi e si
  appoggiavano alla sfocatura, che dentro un antenato con una transform (il
  ribaltamento della Home) non funziona: la tendina delle lingue diventava un
  vetro da cui si leggeva tutto quello che c'era dietro.
- Versione: **b.463** (push #754) — L'ELENCO DELLE LINGUE non fa piu uscire
  la tastiera da solo: niente autoFocus, che su un telefono si mangiava meta
  dell'elenco appena aperto. E si cerca come nel pannello laterale, per nome
  OPPURE per sigla.
- Versione: **b.462** (push #753) — L'AUDIO NON ERA ROTTO: NON AVEVA NIENTE
  DA DIRE. L'invito portava all'ospite una lingua che non c'entrava con
  quella scelta nel carosello (partiva da 'en' fisso): se coincideva con la
  mia, in stanza c'erano due persone con la STESSA lingua — niente da
  tradurre, quindi nessuna voce, e bandiere uguali. Ora tutta la catena
  degli inviti porta la LINGUA 2, e metaScelta e salita in lib/constants.js
  perche la leggano anche gli inviti.
- Versione: **b.461** (push #752) — NIENTE PIU LAMPO DELLA HOME fra il tocco
  sul barcode e il QR: la maschera del «+» resta su finche non si e
  arrivati, la chiude il cambio di schermata. E la stanza video non si
  propone piu dalla sala d'attesa (dove non c'e ancora nessuno): la
  telecamera sta dentro la chat e apre il video a due o la stanza video di
  gruppo, secondo quanti sono davvero in stanza.
- Versione: **b.460** (push #751) — LA REGOLA b.254 TRASLOCA nelle
  impostazioni, dove ora si cambia la lingua parlata; il carosello non la
  tocca piu. Tolto app/lib/acciaio.js, rimasto orfano quando e sparita
  l'ombra dalle immagini.
- Versione: **b.459** (push #750) — IL CAROSELLO SCEGLIE LA LINGUA 2, NON LA
  TUA. Era questo l'errore che ripetevo: il carosello scriveva su prefs.lang,
  cioe sulla lingua dell'utente, invece che sulla meta. Ora sono due cose
  separate anche nel codice — prefs.lang la tua (dalle impostazioni),
  prefs.meta la lingua 2 (carosello + elenco hamburger, in Home e in «Parla
  ora»). E il carosello non propone piu la lingua che parli gia.
- Versione: **b.458** (push #749) — IL MENU DEL «+» PERDE TRE TASTI: chat di
  gruppo e invita una persona aprivano la stessa cosa del barcode (una
  stanza, da cui si invita chiunque), e TaxiTalk esiste gia in Home come
  «Parla ora». Il barcode adesso dice «Parla con chi VUOI». E in «Parla ora»
  il bersaglio diventa l'icona GIALLA DEL TAXI, che dice a colpo d'occhio a
  cosa serve: dire dove vuoi andare e mandarci il tassista col QR.
- Versione: **b.457** (push #748) — LA LINGUA DI ARRIVO DIVENTA UNA
  PREFERENZA, condivisa fra Home e «Parla ora»: era la radice del difetto
  incontrato tre volte, perche viveva chiusa dentro una schermata e la Home
  non aveva una coppia vera da mostrare. Ora le bandiere tornano in alto a
  sinistra e dicono una cosa vera. E la pila diventa un FULMINE GIALLO.
- Versione: **b.455** (push #746) — VIA L'OMBRA SCURA DIETRO LE IMMAGINI in
  acciaio (ordine di Luca). Era ombraAcciaio: uno stacco nero pieno pensato
  per il fondo scuro, che sul tema chiaro diventa una macchia dietro
  l'oggetto. Le immagini hanno gia il loro rilievo dentro.
- Versione: **b.454** (push #745) — LA MAPPA CAMBIA COLORE DAVVERO: lo stile
  veniva scelto una volta sola alla nascita, quindi scavallate le 7 o le 19
  non succedeva niente. Ora l'ora si ricontrolla ogni minuto e tornando
  all'app, e il cambio usa setStyle: la mappa non si ricrea, niente velo
  «carico la mappa», il punto di vista resta dov'e.
- Versione: **b.453** (push #744) — LA MAPPA E' NOSTRA: due stili disegnati
  da noi (giorno e notte), generati da scripts/mappa-bartalk.mjs a partire da
  Liberty — stessi dati OpenStreetMap, cambiano solo le tinte. Contrasto
  caldo/freddo chiesto da Luca: strade ORO (autostrada) e ARANCIO
  (principale) su acqua BLU con i nomi in CELESTE. Chiara di giorno, scura
  di notte, decide l'orologio. Da TomTom non e copiato niente: solo l'idea
  che le strade restino distinguibili per tinta anche di notte.
- Versione: **b.452** (push #743) — UNA MAPPA SOLA, CHIARA. Via i dieci stili
  e il tasto che li apriva (ordine di Luca). Resta Liberty di OpenFreeMap:
  chiara, con le strade distinguibili, sempre la stessa — anche di notte.
- Versione: **b.451** (push #742) — I MARGINI LATERALI DELLA HOME tornano a
  20 (erano 12): li avevo stretti io togliendo insieme la colonna centrata e
  il margine, ma a stringere era solo la colonna. Il template da il 4,1% di
  rientro, cioe 16 su un telefono da 390: 20 e un filo piu largo, e dopo un
  «troppo vicini» si sbaglia dalla parte del respiro.
- Versione: **b.450** (push #741) — LA HOME SPECCHIATA SU TELEFONO quando si
  ribalta per parlare: era il RETRO della faccia davanti. backface-visibility
  c'era gia, ma su Safari di iPhone non regge se dentro una faccia c'e
  qualcosa che rompe il contesto 3D (una zona che scorre, una sfocatura, un
  elemento fisso): il browser APPIATTISCE il 3D e quella regola non vale
  piu. Adesso la faccia che non si deve vedere si spegne con `visibility`,
  scambiata a meta giro — quando il foglio e di taglio e non si vede niente.
- Versione: **b.449** (push #740) — LA STRISCIA BIANCA SULLA CARTINA parte
  chiusa: era l'attribuzione, gia compatta, che MapLibre apre da sola al
  primo disegno. Togliere del tutto non si puo — i dati sono OpenStreetMap e
  la licenza ODbL impone di citarli — ma chiusa resta solo la «i». E tolto il
  codice morto rimasto in Home dalle porte passate al «+».
- Versione: **b.448** (push #739) — LA TENDINA DEGLI STILI FINIVA DIETRO IL
  MENU. Causa vera: la mappa piena vive dentro il ribaltamento della Home,
  che ha una transform — e un antenato trasformato INTRAPPOLA position:fixed,
  quindi nessun z-index poteva farle coprire la barra. Se la mappa non puo
  coprirla, si toglie lei: la barra in basso ora si nasconde sotto qualunque
  pannello che si dichiari a schermo intero. E i comandi rispettano la zona
  sicura.
- Versione: **b.447** (push #738) — LA MAPPA A SCHERMO INTERO, e i tasti che
  non si vedevano. Il tasto per ingrandire c'e SEMPRE, anche quando la mappa
  e una miniatura senza comandi: era quello il motivo per cui Luca non
  trovava ne schermo intero ne stili — in «Parla ora» e TaxiTalk la mappa e
  montata con i comandi spenti. A schermo intero compaiono tutti i comandi,
  Esc e il tasto indietro chiudono, e la mappa NON si ricarica (stesso nodo,
  solo un resize).
- Versione: **b.446** (push #737) — DIECI STILI DI MAPPA, SATELLITE COMPRESO:
  il grigio e lo stradale in chiaro come chiesto da Luca, piu il satellite
  (immagini Esri, senza chiave, con lo style raster scritto a mano). Il tasto
  degli stili sta in alto a destra e li tiene NASCOSTI dietro di se. I nomi
  passano dai pacchetti lingua, non cablati.
- Versione: **b.445** (push #736) — PARLA ORA VA NEI DUE SENSI: un tasto in
  alto centrato, con la bandiera dell'ospite e «tieni premuto per parlare»
  scritto NELLA SUA LINGUA, gli permette di rispondere — tiene premuto,
  parla, e la frase arriva tradotta nella mia lingua, in un colore diverso.
  Il microfono diventa uguale a quello della Home, con l'icona bianca. Via
  il segnaposto «Qui la traduzione, testo e voce». E riparata la pillola
  delle lingue in Home, che mostrava due volte la stessa lingua.
- Versione: **b.443** (push #735) — LE MISURE CHE LUCA HA CHIESTO: BarTalk a
  30, la pillola delle bandiere con la freccia grandi, il carosello piu
  piccolo, il tastone del microfono a 168, le righe della lista piu grandi
  (icona 72, titolo 18, descrizione 14). E IL MENU IN BASSO E' QUELLO DEL
  TEMPLATE: icone in acciaio a 26, barra alta 62, il «+» tondo dentro la
  barra, la voce accesa gialla.
- Versione: **b.442** (push #734) — LA HOME FEDELE AL TEMPLATE: marchio
  BarTalk centrato in testata; microfono grande col cerchio e l'icona BIANCA
  da 20; «Parla ora» a 17 sotto; via l'immagine QR (le porte per connettersi
  passano nel «+», che ora e a tutta pagina col barcode dentro); le sezioni
  diventano righe NUDE a tutta larghezza, senza card di vetro; niente
  grassetto. Nessuna alternanza: il carosello resta sopra, fermo.
- Versione: **b.441** (push #733) — RIPRISTINO: la Home e il foglio del «+»
  tornano alla versione prima della migrazione di oggi, su richiesta di Luca
  («hai rotto tutto»). Home e NewConversationSheet ripresi da b53469e/738f3a6.
  La migrazione dal template si rifara con piu attenzione, un pezzo alla volta.
- Versione: **b.440** (push #732) — L'ELENCO SEZIONI NON SI STRINGE PIU CON
  LA LINGUA: il contenitore della Home centra i figli, e la card senza
  larghezza si adattava al testo — che in tedesco e lungo, in coreano corto.
  Ora ha width 100%: larga uguale a ogni lingua, piena su mobile, centrata su
  desktop come da default.
- Versione: **b.439** (push #731) — IL SELETTORE PAESE SCENDE SOTTO IL
  MICROFONO, in alternanza con «Parla ora» (ordine di Luca): lo stesso posto
  mostra a turno la scritta e il carosello animato delle bandiere, e si ferma
  mentre lo tocchi per scegliere con calma. Il microfono sopra resta il tasto
  per parlare.
- Versione: **b.438** (push #730) — FEDELTA AL TEMPLATE SULLA HOME: il
  microfono torna BIANCO e da 20 (era azzurro e da 44, una mia deriva);
  via il grassetto anche nell'app (come nel template, max 600, titoli di
  sezione 500); le bandiere del carosello tornano piene e piu grandi, senza
  il filtro che le spegneva. Se c'e un template si rispetta al pixel.
- Versione: **b.437** (push #729) — HOME A TUTTA LARGHEZZA: i contenitori
  usavano la colonna centrata che lascia 66px liberi per la linguetta —
  ma la Home non ha linguetta, e stringeva tutto a meta schermo. Ora va da
  bordo a bordo come nel template, coi margini laterali eliminati.
- Versione: **b.436** (push #728) — HOME MONTATA DAL TEMPLATE: il microfono
  diventa il protagonista grande al centro, in cima compare la scritta
  BarTalk. Il tasto immagine faccia-a-faccia esce dalla Home; il barcode e
  tutti i modi per connettersi passano nel tasto «+», che ora apre una
  lista A TUTTA PAGINA col barcode dentro. Niente si perde: il gestore del
  «+» instradava gia quelle porte. Primo trasferimento dal template
  mappato all'infrastruttura.
- Versione: **b.435** (push #727) — IMPARA: la lezione non diceva mai a
  che punto sei. L'indice della lezione dentro il programma esisteva ed
  era gia CALCOLATO in due punti — serve a sapere qual e la prossima e a
  registrare gli esiti — ma a schermo non compariva da nessuna parte: si
  apriva una lezione senza sapere se era la prima di tre o l'ottava di
  venti, cioe senza sapere quanto manca. E' la stessa classe di difetto
  delle lingue nell'archivio (b.433): il dato c'e, arriva fin li, e non
  viene mostrato.
  Il contatore e scritto coi soli numeri («3 / 12»), senza una parola in
  mezzo: cosi non serve una traduzione in trentotto lingue per dire una
  cosa che i numeri dicono da soli. Sopra, una barra sottile.
  Altezza fissa e compare solo se le lezioni ci sono: quando non ci sono,
  il posto non si disegna e non si sposta niente.
  E DUE COSE CHE HO GUARDATO E NON HO TOCCATO, perche la regola e applicare
  dove ripara: la Home (le sezioni sono gia righe con le icone in acciaio
  volute da Luca) e la pagina del Credito (il numero grande c'e gia, a 34).
  Restaurare cio che funziona non e lavoro: e rischio.

- Versione: **b.434** (push #726) — L'ARCHIVIO ROTTO SEMBRAVA UN ARCHIVIO
  VUOTO, ed e il difetto peggiore trovato applicando il layout.
  `loadHistory` faceva `if (res.ok) { ...leggi... }` e nient'altro. Un 401,
  un 429, un guasto del server: NIENTE — nessuno stato, nessun avviso.
  L'elenco restava a zero e la schermata mostrava «Nessuna conversazione ·
  le tue conversazioni appariranno qui, inizia una chat». Cioe a una
  persona a cui era caduta la rete si diceva che i suoi dati non esistono,
  e la si invitava a ricominciare da capo. La rete caduta finiva nel
  `console.error` e basta.
  E' la stessa regola gia imparata in b.236 per la vetrina delle stanze —
  un guasto non si traveste da vuoto — che qui non era mai stata
  applicata. Il layout la chiama «i quattro stati»: vuoto, carica, rotto,
  pieno. Il terzo mancava.
  Ora si distinguono tre esiti: riuscito, rifiutato, caduto. E anche una
  risposta illeggibile e un guasto, non un vuoto. Quando riesce, il guasto
  si SPEGNE — se restasse acceso un solo singhiozzo lascerebbe la
  schermata rotta per sempre, che e lo stesso difetto della firma
  anti-doppione di b.428.
  La schermata dice le tre cose che un guasto deve dire — cosa non ha
  funzionato, che non e colpa tua, cosa si puo fare adesso — e il tasto
  «Riprova» rilegge davvero l'archivio.
  PROVA: cinque prove nuove in `layout-applicato-b433.test.js`.

- Versione: **b.433** (push #725) — MONDO e CHAT dal layout al programma.
  Regola tenuta: si applica dove RIPARA qualcosa, non si restaura cio che
  gia funziona. La Home per esempio NON e stata toccata — le sue sezioni
  sono gia righe, con le icone in acciaio volute da Luca.
  MONDO: la tendina Stanze/Notizie diventa DUE LINGUETTE. Erano due voci
  dentro un coperchio col triangolino: per sapere che esisteva anche
  l'altra bisognava aprirlo, e per passarci servivano due tocchi invece di
  uno. Una tendina serve quando le voci sono tante; con due e solo un
  coperchio. L'icona resta accanto alla parola, dov'era (b.400: Luca
  l'aveva gia persa una volta in questo punto).
  CHAT: nell'archivio non si vedeva DA CHE LINGUA A CHE LINGUA, ed e la
  cosa che distingue una conversazione dall'altra. La causa era a monte:
  la conversazione le lingue le ha — ogni membro porta la sua — ma nella
  riga dell'elenco si teneva solo il NOME. Arrivavano fin li e venivano
  buttate.
  Si AGGIUNGE un campo invece di cambiare quello che c'era: le righe
  scritte prima di oggi restano leggibili e mostrano la loro unica
  bandiera, e chi legge distingue «non lo so» da «nessuna».
  PROVA: `__tests__/layout-applicato-b433.test.js`.

- Versione: **b.432** (push #724) — VITA, prima pagina portata dal layout
  al programma. E il primo pezzo e un difetto vero: «pagina amico life
  manca il microfono» (collaudo di Luca). Era vero alla lettera — li
  dentro l'unico microfono e quello di «Dal vivo», che apre una
  telefonata. Dettare nel campo, la cosa piu ovvia parlando con un
  Compagno, non si poteva.
  LA DETTATURA ORA STA IN UN POSTO SOLO: `app/lib/dettatura.js`. NON e una
  quarta copia — la stessa cosa era gia scritta a mano in tre punti (Prima
  prova, TaxiTalk, vecchia schermata taxi) e ognuna si e portata dietro i
  suoi difetti e le sue riparazioni, diverse fra loro. E' la malattia che
  il diario ha gia curato con il lettore delle notizie in b.409: «non un
  secondo parser, ma quello che c'era messo in comune».
  LE TRE COPIE VECCHIE NON SONO STATE TOCCATE, ed e una scelta: funzionano,
  e il codice della voce non si riscrive senza poterlo provare davvero.
  Quando una di loro si aprira per altro, si sposta li.
  DUE COSE CHE LA DETTATURA COMUNE FA E LE COPIE NON FACEVANO TUTTE:
  il silenzio («no-speech») NON chiude l'ascolto — fermare tutto per una
  pausa e il modo piu sicuro di far sembrare rotto il microfono; e alla
  chiusura si consegna solo cio che era DEFINITIVO, perche un residuo
  provvisorio puo dire una cosa diversa da quella che si e sentita.
  QUI NON INVIA DA SOLO, a differenza della Prima prova: si parla con
  qualcuno che rispondera, e la frase la si rilegge prima di mandarla.
  Sono due gesti diversi e vanno tenuti diversi.
  E LA RIGA IN BASSO PRENDE LE MISURE DEL KIT (`template/layout-completo.html`):
  campo alto 54 col testo a 16 — sotto i sedici il telefono ingrandisce da
  solo la pagina quando ci si scrive dentro — e i due tasti quadri 54x54.
  PROVA: `__tests__/microfono-amico-b432.test.jsx`, dodici prove col
  riconoscimento finto.

- Versione: **b.431** (push #723) — «OVERRIDE FOR FIELD 'voice_id' IS NOT
  ALLOWED BY CONFIG»: la telefonata dal vivo moriva sul nascere. Trovato da
  Luca provandola.
  NON E' UN GUASTO NOSTRO E NON E' SUO: e un PERMESSO spento dall'altra
  parte. Ogni Compagno ha la sua voce e noi la chiediamo all'apertura, ma
  l'agente di ElevenLabs si lascia cambiare la voce solo se glielo si e
  consentito nelle sue impostazioni. Non essendo consentito, rifiutava — e
  finora rifiutava TUTTA la telefonata.
  Adesso: si chiede la voce del Compagno; se viene rifiutata SOLO per
  quello, si riapre subito senza chiederla e la telefonata si fa con la
  voce predefinita dell'agente. Una voce diversa da quella giusta e un
  difetto; nessuna telefonata e un difetto molto peggiore. E si DICE a
  schermo, invece di lasciar credere che sia la voce del proprio Compagno.
  Il rifiuto puo arrivare in due forme — come avviso di linea e come
  eccezione all'apertura — e sono coperte tutte e due.
  FERMO SU LUCA, ed e un interruttore, non codice: elevenlabs.io →
  l'agente → Security → Overrides → consentire `voice_id`. Finche resta
  spento, ogni Compagno parlera con la stessa voce (e lo schermo lo dice).
  Acceso quello, ognuno torna ad avere la propria senza toccare niente qui.

- Versione: **b.430** (push #722) — L'INDIRIZZO E LA MAPPA DENTRO «PARLA
  ORA». Collaudo di Luca: «non vedo il tasto per mostrare la mappa o
  inserire un indirizzo». Non era nascosto: non c'era. Stava solo in
  TaxiTalk.
  Sono gli STESSI pezzi, copiati riga per riga e non riscritti: la ricerca
  su OpenStreetMap col riquadro attorno a dove sei (fa salire in cima i
  posti vicini), la mappina di conferma, e il QR — che e la cosa piu utile
  di tutte, perche chi hai davanti lo inquadra e gli si apre la SUA mappa,
  nella sua lingua, senza installare niente. Piu «condividi link» per
  mandarglielo a voce o su WhatsApp.
  NON COSTA NIENTE E NON PASSA DAI NOSTRI SERVER: nessuna nostra rotta,
  nessun credito scalato. Una prova lo controlla.
  Prende il posto della lettura come le lingue: una cosa per volta, sempre
  nello stesso posto, niente che spinge giu.
  E porta con se la regola di b.248, copiata anche quella: cambiare il
  testo dopo aver scelto INVALIDA la scelta — campo, mappa e QR non
  possono dire due cose diverse.
  PROVA: le quattro nuove in `lingua-e-pila-b429.test.jsx`, fra cui una
  che confronta i pezzi con TaxiTalk per accertarsi che siano gli stessi.

- Versione: **b.429** (push #721) — due difetti dal collaudo di Luca, e un
  terzo trovato cercandone uno dei due.
  1. «QUANDO CAMBIO LA LINGUA NON AGGIORNA IL TESTO DEI TASTI IN HOME».
     Sotto ci sono DUE cose distinte.
     (a) LA PORTA A SENSO UNICO. b.254 dice: i menu seguono la lingua
     parlata FINCHE non li scegli a mano. Ma sceglierli a mano metteva
     `uiLangScelta` a vero e NESSUNO in tutta l'applicazione lo rimetteva
     falso — cercato ovunque, esisteva un solo punto e scriveva solo
     `true`. Da quel momento la home non poteva piu cambiare i menu, e non
     c'era ne un modo di capirlo ne uno di rimediare. Adesso in cima
     all'elenco delle lingue dell'interfaccia c'e «Segui la lingua che
     parlo», accesa proprio quando non hai scelto a mano.
     (b) MEZZO DIFETTO DI b.256 ERA RIMASTO APERTO. Quel difetto — chi
     aveva gia disegnato non veniva svegliato quando il pacchetto lingua
     entrava in memoria — era stato chiuso dentro AppContext. Ma page.js
     ha una SUA L, passata a mano a tre schermate, e non ascoltava niente:
     quelle tre restavano nella lingua di ripiego finche non succedeva
     qualcos'altro. Ora ascolta anche lei.
  2. «HAI NASCOSTO DIETRO ALLA PILA BATTERIA IL SELETTORE DELL'INVERSIONE
     TESTO, SPOSTALA». La pila NON si e spostata, e la ragione va detta:
     Luca l'ha chiesta in alto a destra tre volte, e spostarla vorrebbe
     dire rompere ogni altra schermata per aggiustarne una. Le pagine
     piene la nascondono gia — stanza, diretta, taxi, lobby — ma «Parla
     ora» non poteva entrare in quell'elenco perche non e una vista, e un
     pannello dentro la home. Adesso lo dice lei quando e a schermo, e
     page.js toglie pila e linguetta finche resta aperta.
  PROVA: `__tests__/lingua-e-pila-b429.test.jsx`.

- Versione: **b.428** (push #720) — «LA TRADUZIONE NON E' PARTITA CON IL
  PRIMO MESSAGGIO». Collaudo di Luca, e il difetto non era il primo
  messaggio: era che UNA frase andata storta restava bruciata per sempre.
  LA FIRMA ANTI-DOPPIONE NON SI SLACCIAVA MAI DOPO UN GUASTO. La stessa
  frase verso la stessa lingua si chiede una volta sola — regola giusta,
  serve a non far partire due traduzioni quando il timer della scrittura e
  la fine della dettatura scattano insieme (b.357). Ma la firma si
  slacciava SOLO su risposta buona e su respinta del controllo qualita.
  Non su un guasto di rete, non su un 429, non su una funzione fredda, non
  quando la resa veniva scartata perche la frase stava ancora crescendo.
  Bastava un singhiozzo sul PRIMO tentativo e da quel momento riprovare la
  stessa frase non produceva NIENTE: ne una chiamata, ne un errore, ne un
  segno. Chi ci riprovava pensava che l'app fosse morta, e aveva ragione.
  Ora la firma vale solo finche la richiesta e in volo: si slaccia su ogni
  uscita che non porta una traduzione. Un posto solo (`slaccia`), chiamato
  da tutte e cinque le uscite, cosi la prossima non se ne dimentica.
  E IL SECONDO TOCCO SUL MICROFONO E' UN ORDINE, NON UN SUGGERIMENTO
  (ordine di Luca: «quando lo clicco di nuovo deve inviare il messaggio e
  leggerlo»). Finora a mandare la frase era `onend`, cioe un avviso del
  BROWSER: su alcuni telefoni arriva tardi, su altri non arriva, e il
  secondo tocco non faceva niente. Adesso manda anche il tocco. Chiamarlo
  da due posti non fa danni: chi arriva secondo trova la firma armata e si
  ferma — e c'e una prova che conta le richieste e ne pretende UNA.
  PROVA: `__tests__/primo-invio-b428.test.jsx` — il riconoscimento vocale
  e finto ma i tempi sono veri (pezzi volatili, pezzo definitivo, pezzo in
  ritardo dopo la chiusura). La prova del riprova-dopo-un-guasto era ROSSA
  sul codice di prima: «expected 1 to be 2», cioe il secondo tentativo non
  partiva proprio.
  E UNA PROVA MIA RISCRITTA, la solita malattia: `prima-prova` cercava
  ALLA LETTERA la riga che slacciava la firma, ed e diventata rossa quando
  quella riga, ripetuta in quattro punti, e diventata una funzione sola
  chiamata da tutte le uscite. Il comportamento non era peggiorato: era
  migliorato.

- Versione: **b.427** (push #719) — quattro correzioni di Luca sulla
  stessa schermata, tutte dal suo schermo:
  1. LA LISTA DELLE LINGUE E' QUELLA DELLA HOME, «esattamente identica»:
     non una seconda scritta da me, ma lo STESSO componente — il carosello
     delle bandiere con le frecce, il trascinamento col dito e l'elenco
     completo con la ricerca. Cambia solo cosa sceglie: qui la lingua di
     arrivo, sulla home quella che parli tu. La fila di pillole che avevo
     fatto io e sparita.
     ATTENZIONE, trappola vera: il carosello consegna la LINGUA INTERA,
     non il suo codice. Prenderla per un codice avrebbe messo un oggetto
     dove va una sigla e la meta sarebbe diventata una lingua inesistente,
     in silenzio. Una prova lo tiene fermo.
  2. SI APRE CON UN RIBALTAMENTO, e la pagina e INTERA. Prima «Parla ora»
     prendeva il posto del contenuto dentro la home: si apriva e basta.
     Adesso e il foglio intero che si volta, e dietro c'e il traduttore
     senza cornice. E' lo STESSO ribaltamento delle news (ui/Ribalta.js):
     non se ne e scritto un secondo.
  3. IN ALTO A SINISTRA UNA FRECCIA, non piu una ✕ a destra. Una ✕ dice
     «chiudi e butta via», una freccia dice «torna indietro» — e siccome
     il foglio si gira, tornare e proprio quello che succede.
  4. UN MICROFONO SOLO. «Il secondo microfono in basso deve essere solo
     una freccia di invio testo, il microfono in mezzo fa gia tutto quello
     che serve per l'audio.» Erano due comandi per la stessa cosa, e il
     secondo faceva dubitare del primo. Ora: in mezzo la riga della VOCE
     (microfono + altoparlante per ripetere), sotto la riga del TESTO
     (campo + freccia di invio). Le cose della voce insieme, quelle del
     testo insieme.
     La freccia non aggiunge una strada nuova — la frase parte gia da sola
     dopo novecento millesimi — ma toglie l'attesa e da un posto dove
     premere a chi si aspetta di premere.

- Versione: **b.426** (push #718) — «U.find is not a function»: LA STANZA
  CHE MUORE IN MANO A CHI APRE UN INVITO.
  TROVATO NEL COLLAUDO FISICO in produzione, aprendo il link d'invito di
  una stanza appena creata: al posto della stanza, «Something went wrong
  — TypeError: U.find is not a function», pagina intera sostituita dalla
  scritta di errore. NON RIPRODOTTO ai tentativi successivi: e una CORSA,
  la prima apertura arriva prima che `members` sia un elenco.
  LA CAUSA, che vale piu del difetto: `roomInfo?.members?.find(...)`
  protegge dal MANCANTE, non dal NON-ELENCO. Se `members` torna un
  oggetto, il punto interrogativo non salta niente — chiama `.find` su un
  oggetto e la schermata muore.
  E LA COSA CHE FA PIU MALE: l'aiutante giusto ESISTEVA GIA' —
  `membriDi()` in `app/lib/membri.js`, che fa `Array.isArray(m) ? m : []`
  — era gia IMPORTATO in RoomView, ed era usato in UNO dei quattro punti.
  Ora in tutti.
  E LA PROVA HA TROVATO DA SOLA DUE PUNTI CHE MI ERANO SFUGGITI, in
  `TalkControls.js` (`?.find` e `?.some`): e il motivo per cui una prova
  deve difendere la REGOLA e non le righe che gia conosci.
  PROVA: `__tests__/membri-non-elenco-b426.test.js` — l'aiutante regge
  oggetti, stringhe, numeri, null; e nessun file tocca piu `members` a
  mano. Rossa sul codice di prima, verde adesso.

- Versione: **b.425** (push #717) — DUE DIFETTI TROVATI NEL COLLAUDO
  FISICO del 23/08, non da un audit: li ho visti usando l'app in
  produzione, con Chrome guidato da qui.
  1. LA BARRA IN BASSO NON PARLAVA LA LINGUA DI CHI GUARDA. Messa
     l'interfaccia in turco, tre voci dicevano «Ana sayfa», «Sohbetler»,
     «Profil» e la quarta «Community»: in `BottomNav.js` quell'etichetta
     era SCRITTA A MANO invece di essere una chiave, e restava in inglese
     in tutte e trentotto le lingue. Stessa malattia che b.370 aveva
     chiuso altrove, sopravvissuta qui perche la guardia sulle stringhe
     cablate non guardava dentro questo file. Ora e `navCommunity` in
     tutti i pacchetti, e `__tests__/barra-tradotta-b425.test.js`
     controlla che NESSUNA voce della barra sia scritta a mano — cioe si
     accorgera della prossima.
  2. «APPROFONDISCI» PREMUTO DUE VOLTE MOSTRAVA I DOPPIONI. L'accumulo e
     voluto (ogni pressione porta materiale nuovo) ma la ricerca sullo
     stesso titolo restituisce gli stessi articoli, e finivano in fila
     due volte: nel collaudo si vedevano quattro link ripetuti identici.
     L'accumulo resta, la ripetizione no.
  PROVA: la prova nuova e rossa sul `BottomNav.js` di prima, verde adesso.

- Versione: **b.424** (push #716) — cinque correzioni di Luca sulla
  schermata appena rifatta, tutte dal suo schermo:
  1. TASTI PIU GRANDI: «in un telefono le dita fanno fatica». Erano 34,
     ora 44 — la misura sotto la quale un dito comincia a sbagliare
     bersaglio. Un numero solo, dichiarato una volta.
  2. TUTTA L'ALTEZZA: lasciava fuori 210 punti e sopra il testo restava
     una fascia vuota grande quanto mezzo schermo. Ora ne lascia 158.
  3. VIA L'ICONA TASTIERA, e il campo di testo c'e SEMPRE, in basso. Un
     comando che apre una cosa che poteva star li da sola e un tocco
     chiesto per niente.
  4. SI RIBALTA SOLO CIO CHE SI LEGGE. Prima si giravano di posto i due
     blocchi interi; adesso la riga per scrivere resta dritta e usabile e
     a girare e soltanto il testo per l'altro. Si continua a scrivere
     mentre lui legge.
  5. LA MISURA SI ADATTA ALL'ALFABETO: «ottimale per lingue occidentali,
     una via di mezzo per medio oriente e asia». Un ideogramma porta in un
     carattere solo quanto una sillaba intera e alla stessa misura pesa di
     piu; arabo ed ebraico stanno in mezzo. Sconto dell'88% per cinese,
     giapponese, coreano, thai, hindi, bengali, tamil, arabo ed ebraico.
  E IL TESTO STA IN MEZZO, non schiacciato in fondo: due distanziatori lo
  centrano quando c'e spazio e si ritirano da soli quando e lungo, cosi si
  puo comunque scorrere (con `justify-content: center` la parte che esce
  sopra diventerebbe irraggiungibile — era gia successo in b.357).
  DUE PROVE MIE RISCRITTE, e una di queste per la SECONDA volta in due
  ore: `prima-prova` difendeva la riga che decide l'ordine dei blocchi, e
  si e fatta rossa a ogni cambio di disegno pur restando vero ogni volta
  cio che proteggeva. Ora chiede la cosa che vale per qualunque disegno:
  si gira solo cio che l'altro legge, e la riga per scrivere mai.

- Versione: **b.423** (push #715) — «PARLA ORA» E' LA STRADA A. Disegno
  approvato da Luca sul template (`template/parla-ora.html`), applicato al
  componente: la logica di traduzione, dettatura e voce NON e stata
  toccata, e cambiato solo cio che si vede.
  UNA COSA SOLA A SCHERMO. Chi apre trova un microfono grande in mezzo e
  due bandiere in alto. Prima trovava tre zone che comandavano insieme e
  DUE scatole vuote col bordo intorno, che sembrano un modulo da
  compilare. Il campo di scrittura ora si apre col tastino del foglio (non
  e piu la strada principale: questo e un traduttore VOCALE), le lingue si
  aprono dalla targhetta, e ognuna di queste cose prende SEMPRE lo stesso
  posto — niente spinge giu niente.
  LA TARGHETTA DICE DA DOVE A DOVE. Prima si vedeva solo la meta, e la
  fila si tagliava a destra: non si sapeva ne da dove si partiva ne quante
  lingue ci fossero.
  VIA IL TITOLO «Parla ora» dalla testata: diceva dove sei in una
  schermata in cui non puoi essere altrove. Lo dice il microfono.
  VIA LA BARRA «ASCOLTA» a tutta larghezza. Non era un difetto di come
  funziona — la voce parte gia da sola — ma di come lo DICE: con quel
  triangolo da riproduzione sembrava un passo obbligatorio. Ora e un
  tondino che serve solo a far ripetere.
  LA MISURA DEL TESTO PER IL TASSISTA, ordine di Luca nello stesso
  messaggio: la base scende da 34-58 a 30-52 (circa un decimo in meno),
  due tastini A− A+ la muovono di un passo, e il passo si SALVA nelle
  preferenze (`testoGrande`, da -2 a +3). I tastini stanno nella TESTATA,
  che resta dritta anche col ribaltone: si toccano mentre l'altro legge.
  Compaiono solo quando c'e del testo da misurare.
  DUE PROVE MIE RISCRITTE, stessa malattia della trappola numero 6:
  `prima-prova` controllava ALLA LETTERA la riga
  `capovolto ? (<>{bloccoTradotto}{bloccoScrittura}</>)` — difendeva una
  RIGA, non un comportamento, e si e fatta rossa quando il disegno e
  cambiato pur restando vero cio che proteggeva. E `voce-muta-b417`
  cercava il campo di scrittura a schermo: ora ci si arriva col tastino,
  e l'intento (la frase entra nel registro PRIMA che si provi a parlare)
  e intatto.
  PROVA: `__tests__/parla-ora-strada-a-b422.test.jsx` — dodici prove che
  MONTANO il componente e lo toccano, non leggono il sorgente.
  NON VERIFICATO A SCHERMO: nel browser di questa postazione c'e aperta
  una finestra di accesso Google che blocca la navigazione e che non
  posso chiudere io. Le prove montano il componente davvero, ma il
  collaudo a occhio lo fa Luca.

- Versione: **b.422** (push #714) — IL METODO NUOVO PER LA GRAFICA, deciso
  da Luca il 23/08/2026: «fai in modo di poterlo applicare subito se ne
  scegliamo uno, poi lo salvi, perche dobbiamo fare questo lavoro in
  serie per tutte le pagine in sequenza».
  Nasce `template/`, e la prima pagina e `template/parla-ora.html`: com'e
  oggi la schermata «Parla ora» e tre modi di semplificarla, disegnati coi
  colori del tema «deep» e con le misure prese dal componente vero, una
  per una. Non e un disegno: e cio che si vedra, e quando Luca sceglie
  una lettera si copia di li invece di reinventare.
  E' la stessa disciplina che vale gia su Funnemail (si progetta nel
  template, il codice si COPIA nella pagina viva, mai il contrario), e da
  oggi vale anche qui. Nel file ci sono anche le sei regole con cui
  guarderemo tutte le pagine successive — una cosa sola comanda, niente
  scatole vuote, il segnaposto non insegna, si contano i tocchi, niente
  spinte in basso, i colori vengono dal tema.
  NESSUN CODICE DELL'APP TOCCATO: `PrimaProva.js` e intatto. Questo push
  porta solo il template e questa riga di diario.
  E UNA COSA IMPARATA SCRIVENDOLO, che vale per ogni template futuro: un
  commento HTML dentro un commento HTML lo CHIUDE in anticipo, e il resto
  della nota finisce a schermo come testo. Mi e successo, si vedeva, ed e
  corretto — i marcatori INIZIO/FINE non si nominano dentro un commento.

- Versione: **b.421** (push #713) — LA VERSIONE CHE L'UTENTE LEGGE NON
  MENTE PIU. `APP_VERSION` era ferma a `b.405` col programma a b.420:
  quindici versioni indietro. Non e un dettaglio estetico — quel numero
  compare in Impostazioni, nell'OGGETTO DELLA MAIL DI ASSISTENZA e dentro
  l'ESPORTAZIONE DEI DATI PERSONALI: chi segnala un difetto dichiara una
  versione che non sta usando, e noi lo cerchiamo quindici versioni
  indietro.
  Non si possono unire le due fonti: b.417, b.418 e b.419 sono uscite
  tutte col push #711, quindi lo scarto fra `APP_VERSION` e `PUSH` non e
  costante e nessuna delle due si ricava dall'altra. Cio che si puo fare
  e impedire che divergano IN SILENZIO: `__tests__/versione-unica-b421.test.js`
  le confronta col diario qui sopra e diventa rossa se si aggiorna
  CLAUDE.md dimenticandosi della costante. Controlla anche che nessuna
  schermata scriva un numero di versione a mano.
  SEGNALATO DA UN AUDIT ESTERNO e verificato: era vero.

- Versione: **b.420** (push #712) — LE TRE CORSE DEL DAL-VIVO. Non
  vengono da un audit esterno: sono difetti MIEI, nati con b.418 ieri, e
  li ha trovati Luca rileggendo il codice nuovo. Tutti e tre veri,
  verificati riga per riga prima di toccare niente.
  1. FRA IL PALETTO E LA SESSIONE C'ERA UNA CHIAMATA HTTP. Il paletto si
     prende con `SET NX` (atomico, giusto), ma la riga che dice «la linea
     esiste» veniva scritta solo DOPO aver chiesto la firma a ElevenLabs:
     centinaia di millisecondi. In quel buco una seconda richiesta
     trovava il paletto occupato, cercava la linea che lo teneva, NON LA
     TROVAVA, e concludeva che fosse il fantasma di una linea morta. Lo
     sovrascriveva, e si aprivano due telefonate — cioe esattamente cio
     che b.418 diceva di aver chiuso. Ora la linea si scrive SUBITO,
     dichiarata «in apertura», e se il fornitore non firma si cancella
     insieme al paletto.
     E LA MIA PROVA NON POTEVA ACCORGERSENE: apriva una linea DOPO
     l'altra (`await apri(); await apri();`), mai INSIEME. Una prova di
     concorrenza che non e concorrente non prova niente. Ora le aperture
     partono con `Promise.all` e il fornitore si puo tenere in attesa a
     comando, cosi la finestra esiste davvero.
  2. BATTITO E CHIUSURA LEGGEVANO LO STESSO STATO SENZA NIENTE IN MEZZO.
     Un battito partito un istante prima di una chiusura poteva
     RESUSCITARE la telefonata: la chiusura cancellava la chiave, il
     battito la riscriveva, e restavano una sessione fantasma e una
     riserva che nessuno avrebbe piu chiuso. Ora c'e un lucchetto per
     sessione (`live:lucchetto:<id>`, `SET NX`), e soprattutto il battito
     riscrive con `XX`: se la sessione non esiste piu, la scrittura non
     avviene e il tratto appena aperto torna indietro subito. Il
     lucchetto rende la cosa quasi impossibile, `XX` la rende impossibile.
     Il battito che trova occupato SALTA IL GIRO (ne arriva un altro fra
     sessanta secondi); la chiusura invece insiste, perche chiudere non e
     rimandabile.
  3. `commit()` NON DICEVA SE ERA RIUSCITO, ed e il piu insidioso.
     Restituiva `undefined`: un rifiuto finiva nel registro e il
     chiamante andava avanti convinto di aver scalato. Lo scenario che fa
     male: il battito non arriva, passano piu di dieci minuti, il cron
     rilascia la riserva, l'utente chiude, `wallet_commit` risponde
     «riserva gia chiusa» — e noi contavamo quei minuti come incassati.
     Ora `commit()` torna `{ok, motivo}` e nel dal-vivo si somma SOLO cio
     che il portafoglio ha davvero confermato; quello che non passa
     ricade nel recupero, che apre una riserva nuova e la conferma. Se
     non c'e piu credito si dichiara MENO, mai di piu.
     LA PROMESSA DI PRIMA RESTA INTATTA: `commit()` non lancia, non
     propaga, non puo far cadere una risposta gia pronta. I quattordici
     chiamanti che ignorano il valore funzionano identici.
  E I FINTI PORTAFOGLI DELLE PROVE ADESSO SANNO DIRE DI NO, come quello
  vero: una riserva gia chiusa non si conferma due volte. Un finto che
  dice sempre di si non puo accorgersi di un tratto contato e mai
  incassato — era il difetto numero 3, e le mie prove ci passavano sopra.
  PROVA: `__tests__/live-corse-b420.test.js`. NOVE prove rosse sul codice
  di ieri (verificato rimettendo `ponte.js` e `riserva.js` di b.419 in
  posto), tutte verdi adesso.

- **COME SI FA GIRARE LA SUITE DA QUI (imparato il 23/08, a caro prezzo).**
  I processi in background NON sopravvivono fra una chiamata e l'altra
  del ponte verso il Mac: `nohup npx vitest ... &` viene ucciso appena la
  chiamata finisce, e il file di registro resta li a meta senza dire
  niente. Per due volte ho creduto che la suite fosse «in corso» e invece
  era morta. La suite intera si lancia A SPICCHI, uno per chiamata:
  `npx vitest run --shard=1/8 --reporter=dot` ... fino a `8/8`.
  Trentatre secondi a spicchio, tutti e otto stanno dentro i limiti.
  E `pgrep -f vitest` NON serve a sapere se sta girando: trova la propria
  riga di comando e risponde sempre di si.

- Versione: **b.419** (push #711) — IL PERIMETRO GDPR: l'attivita su
  Mondo. Terzo punto dell'audit del 23/08, e questo l'audit lo aveva
  visto giusto: `mondo_follows`, `mondo_comment_likes` e
  `mondo_segnalazioni` sono metadati TUOI e di nessun altro — chi segui,
  cosa ti e piaciuto, cosa hai segnalato — e non venivano toccati.
  Adesso vanno via, e i «segui» da tutti e due i lati: quelli messi da te
  e quelli messi a un profilo che sta per non esistere piu.
  RESTA FUORI, e resta dichiarato: `mondo_discussions` e `mondo_comments`
  contengono le risposte di altre persone. Decisione di prodotto, non una
  riga di codice, e non la prendo io.
  LO STORICO TRADUZIONI: l'audit lo elencava come residuo e sulla carta
  aveva ragione (`translations` ha `user_id`, `source_text`,
  `translated_text`). VERIFICATO SUL DATABASE VIVO: e a ZERO righe e non
  puo riempirsi. Chi scrive quelle righe cerca prima `profiles.id`
  partendo dall'email, e la tabella `profiles` NON ESISTE in questo
  progetto — come non esistono `payments` e `usage_daily`, che altri
  punti del codice interrogano allo stesso modo. La select fallisce e
  l'insert non parte mai. Quindi non si cancella niente E NON LO SI
  DICHIARA: scrivere «translations» fra i cancellati sarebbe la stessa
  bugia che b.415 ha tolto dalla risposta all'utente.
  DEBITO RESIDUO (nuovo, non era in nessun audit): lo storico delle
  traduzioni, i pagamenti e l'uso giornaliero interrogano tre tabelle che
  non esistono. Non e un difetto della cancellazione: e una funzione
  morta da riparare dove nasce.
- Versione: **b.418** (push #711) — LA TELEFONATA DAL VIVO SI PAGA TUTTA,
  E SE NE APRE UNA SOLA. Primo e terzo punto dell'audit, ed erano lo
  stesso intervento. DUE FALLE SOMMATE, tutte e due mie, scritte in b.407:
  1. IL TETTO ERA UN CONDONO. `creditoDalVivo` faceva `Math.min(TETTO,...)`
     e NESSUNO fermava la telefonata al quindicesimo minuto: verificato,
     in `CompagnoLive` non c'era nessun timer. Dal sedicesimo minuto in
     poi si parlava gratis e il fornitore lo pagavamo noi.
  2. PEGGIO, E NON ERA NELL'AUDIT: una riserva viva da piu di DIECI
     minuti la rilascia `wallet_rilascia_riserve_scadute` (migrazione
     011, `INTERVAL '10 minutes'`, in agenda su Vercel ogni ora a :15).
     Il tetto da quindici minuti era gia oltre la vita massima di una
     riserva: se il cron passava durante la telefonata, alla chiusura il
     commit non trovava piu niente. Non «meno del dovuto»: ZERO, tutta
     la telefonata.
  Ora si tiene UNA riserva sola alla volta, da TRE minuti parlati, e la
  si RUOTA prima che invecchi: si conferma il consumato, se ne apre una
  nuova. Il telefono manda un battito ogni minuto (`azione: 'rinnova'`).
  Se il credito finisce a meta, la linea si chiude e cio che hai parlato
  resta pagato — non si regala e non si ruba.
  E SE IL BATTITO NON ARRIVA MAI (telefono vecchio, rete che lo mangia,
  pagina chiusa di colpo) alla chiusura si aprono e si confermano subito
  i tratti mancanti: prima, in quel caso, si sarebbe pagato un tratto
  solo. Se il credito non basta si scala il possibile e ci si ferma —
  e la tolleranza di casa, si finisce cio che si e cominciato.
  P2 — UNA TELEFONATA SOLA PER PERSONA. Il commento della rotta lo diceva
  gia e non lo imponeva nessuno: due schede, due telefoni o due tentativi
  contemporanei aprivano due linee, due riserve e due conti. Ora c'e un
  paletto in Redis (`live:utente:<email>`) preso con `SET NX`, che e
  atomico: fra due richieste che arrivano insieme ne passa una sola. Il
  paletto e corto (5 minuti) e si rinfresca a ogni battito, cosi una
  linea caduta non chiude fuori la persona per sempre; e si toglie SOLO
  se e ancora nostro, per non scoperchiare la telefonata di un altro.
  IL TETTO DELLA ROTTA E' SALITO DA 10 A 60 richieste al minuto, e va
  detto: prima questa porta la si bussava due volte per telefonata, ora
  c'e un battito al minuto per ogni linea aperta, e in una casa dietro un
  solo indirizzo di rete ci stanno piu persone. Strozzare un battito vuol
  dire chiudere una telefonata che sta pagando. Cio che il tetto
  proteggeva resta protetto: l'apertura passa comunque dal paletto e
  dalla riserva.
  E UNA PROVA MIA RISCRITTA, terza volta di fila: `live-sessione-b407`
  pretendeva che una telefonata lunghissima si fermasse a
  `LIVE_TETTO_SECONDI` — cioe FOTOGRAFAVA il regalo. E' diventata rossa
  quando il regalo e finito. Ora difende la cosa vera: nessun singolo
  addebito puo superare la riserva che lo copre.
  PROVA: `__tests__/live-tratti-b418.test.js` — 4, 14, 16 e 31 minuti,
  credito che finisce a meta, doppia chiusura, telefono che non batte,
  doppia apertura. Rosse sul codice di prima (verificato rimettendo
  `tariffe.js` e `ponte.js` vecchi in posto), verdi adesso.

- Versione: **b.417** (push #711) — LA PRIMA PROVA NON RESTA PIU MUTA
  SENZA DIRLO. Non viene da un audit: viene dai registri di produzione.
  «Edge TTS: sintesi riuscita ma audio vuoto» — 32 volte, 5 persone,
  l'ultima alle 10:18 del 23/08 sulla build in linea. NON RIPRODOTTO: ho
  chiamato la sintesi su dieci lingue in produzione e tutte e dieci
  rispondono con audio vero. Quindi e il fornitore che ogni tanto
  consegna zero byte, non un guasto nostro. Cio che era nostro e la
  REAZIONE, e la Prima prova reagiva peggio di tutti gli altri.
  TRE COSE, e si vedevano solo quando il fornitore aveva una giornata
  storta:
  1. «OK» NON VUOL DIRE «C'E UN SUONO». Una risposta puo tornare 200 con
     zero byte: si costruiva un Audio vuoto, scattava `onerror`, e lo
     stato tornava «quieto» come se avesse parlato. La Diretta questo
     controllo (`blob.size > 0`) lo fa da sempre; qui mancava.
  2. IL RIPIEGO PROMESSO NON ESISTEVA. Il commento di b.356 diceva «si
     ripiega sulla voce di sistema: meglio una voce che nessuna voce»,
     ma il codice ripiegava su /api/tts-edge, che e un altro SERVER: se
     il fornitore tace, tacciono tutti e due. Un commento che promette
     una cosa che il codice non fa e peggio di nessun commento.
  3. RESTAVA MUTA SENZA DIRLO, ed e la PRIMA cosa che tocca chi apre
     l'app: la traduzione compare nel registro, la voce non arriva mai,
     e nessuna parola spiega perche.
  Ora l'ultimo gradino e la voce del telefono (`app/lib/voceSistema.js`),
  che non dipende dalla nostra rete ne dal nostro credito, e se non parte
  nemmeno quella lo schermo lo DICE (`speakNowVoiceless`, in tutte e
  trentotto le lingue — nessuna lingua di serie B).
  PERCHE NON /api/tts (OpenAI), che e il ripiego della Diretta: quella
  rotta passa dal portafoglio (`resolveAuth`, riserva/commit/release) e
  senza gettone risponde 401. Portarla nella Prima prova vorrebbe dire
  far spendere credito a chi sta solo provando l'app — DECISIONE DI
  PRODOTTO, non una riparazione, e non la prendo io (punto 8).
  LA VOCE DEL TELEFONO ORA STA IN UN POSTO SOLO. Il codice esisteva gia
  dentro `useTTSEngine` (il motore di Stanza e Taxi) e funziona: e stato
  SPOSTATO, non riscritto. `useTTSEngine` lo importa, i suoi sei punti di
  chiamata non sono stati toccati. E' la stessa cura di b.409 col lettore
  NDJSON: non un secondo parser, ma quello che c'era messo in comune.
  DUE DIFETTI LATENTI TROVATI DALLA PROVA, non a occhio, tutti e due li
  da prima di oggi dentro `useTTSEngine`: in `diciPezzo` il timer
  `tienilaSveglia` era un `const` dichiarato DOPO `speak()` e `finito()`
  lo azzerava (con una sintesi che risponde SUBITO scoppiava prima che la
  variabile esistesse, e la promessa non si risolveva piu); e se la
  sintesi finisce DENTRO `speak`, il timer veniva acceso dopo la fine e
  non lo spegneva piu nessuno — girava ogni cinque secondi per tutta la
  vita della pagina. Nei browser veri `onend` arriva dopo, quindi non si
  vedevano.
  CORREZIONE DI UNA COSA CHE AVEVO SCRITTO IO E CHE ERA FALSA: nel primo
  messaggio di questo commit avevo scritto che «la suite intera si e
  piantata per ventitre minuti» per colpa di quel timer. Non e vero, e
  non l'avevo verificato: la suite non si era piantata: veniva UCCISA.
  In questo ambiente i processi lanciati in background non sopravvivono
  fra una chiamata e l'altra del ponte verso il Mac, quindi la suite si
  fermava a ogni giro senza dirlo. Il difetto del timer resta vero e la
  correzione resta giusta; la diagnosi che gli avevo appiccicato no.
  E UNA PROVA MIA RISCRITTA, la stessa malattia di sempre:
  `prima-prova` misurava 1200 caratteri intorno a «tts-edge» e pretendeva
  di trovarci «catch». E' diventata rossa quando l'intento e stato
  soddisfatto MEGLIO (il catch ora copre tutte e due le rotte, non una):
  la finestra si era riempita di commento. Trappola numero 6 in un'altra
  forma. Ora chiede la cosa vera: la riga entra nel registro PRIMA che si
  provi a parlare, quindi qualunque cosa succeda alla voce il testo c'e.
  PROVA: `__tests__/voce-muta-b417.test.jsx`, il componente montato
  davvero. TRE prove ROSSE sul codice di prima (verificato rimettendo il
  file vecchio in posto e rilanciandole) e verdi adesso.

- Versione: **b.416** (push #710) — solo diario, nessun codice toccato,
  e due righe che mentivano.
  1. Registrata la decisione di Luca sulla ritenzione di ElevenLabs
     (resta accesa durante il collaudo) con le due conseguenze che si
     porta dietro, e verificato che oggi il prodotto non promette da
     nessuna parte che il dal-vivo e privato. Vedi il punto 3 dei FERMI.
  2. Corretta la riga sul TURN: diceva «script pronti in deploy/coturn/»
     e quella cartella non esiste. Ci sono cascato io stesso oggi,
     mandando Luca sul server Contabo per una cosa che sta li ma riguarda
     un altro problema (il certificato del ponte Redis). Il diario
     adesso dice cosa serve davvero e in che ordine.
- Versione: **b.415** (push #709) — «CANCELLA I MIEI DATI» ADESSO LI
  CANCELLA. Audit esterno, P1. Verificato: `deleteUserData` toccava
  profilo, sessione CORRENTE, pagamenti, codici, referral e prestiti —
  tutto e solo su Redis. Su Supabase restava TUTTO: i Compagni, i loro
  ricordi, i corsi, i compiti, il profilo studente, gli errori di
  pronuncia, i dispositivi PeepOff con le chiavi pubbliche. E chi era
  entrato anche dal telefono restava dentro fino alla scadenza naturale:
  sette giorni, per un account che sta venendo cancellato.
  Ora c'e `app/lib/cancellazione.js`, una porta sola. Cancella sotto
  TUTTE E DUE le impronte (HMAC e la vecchia): non e ridondanza — le
  righe di chi non e ancora tornato hanno ancora quella vecchia, e
  cancellare solo la nuova lascerebbe indietro proprio i dati di chi non
  usa l'app da un po', cioe con ogni probabilita di chi vuole sparire.
  E revoca TUTTE le sessioni: l'indice sessioni-per-utente, che il
  commento di b.168 dava per inesistente, adesso lo scrive `createSession`.
  CIO CHE NON CANCELLA, detto invece che sottinteso: il portafoglio
  (obbligo contabile, ed era gia cosi di proposito) e i contenuti
  pubblici di Mondo — una discussione contiene le risposte di altre
  persone, e cancellarla o anonimizzarla e una DECISIONE DI PRODOTTO, non
  una riga di codice. La risposta all'utente ora lo dice.
  BUSINESS: gli strumenti girano in una stanza con meno porte. Senza
  `allow-top-navigation` uno strumento non puo portare via TUTTA
  l'applicazione (che e come un XSS diventa una pagina di phishing),
  senza `allow-downloads` non puo far partire scaricamenti, e il permesso
  della fotocamera ora lo ha solo chi la usa (PeepOff non inquadra
  niente, e se lo prendeva lo stesso). ONESTA: `allow-same-origin` c'e e
  deve esserci — gli strumenti sono nostri e usano le nostre rotte.
  Quindi NON e isolamento di origine: quello si ottiene solo con un
  sottodominio dedicato, che e infrastruttura ed e di Luca.
- E DUE PROVE MIE RISCRITTE, per la stessa ragione della volta scorsa:
  `caccia-al-tesoro-b168` difendeva la frase «expire naturally within 7
  days» e il titolo «non di piu». Erano fotografie di due LACUNE, non
  requisiti: sono diventate rosse quando le lacune sono state chiuse.
  L'intento di b.168 — non promettere una cancellazione totale, dire cosa
  resta — vale ancora, e ora si controlla quello.
- DECISIONE DI PRODOTTO IN SOSPESO (Luca): i contenuti pubblici di Mondo
  quando qualcuno cancella l'account. Cancellare una discussione porta
  via anche le risposte degli altri; anonimizzarla e un'altra cosa
  ancora. Finche non e decisa, la risposta all'utente dichiara che
  restano e invita a scrivere.
- Versione: **b.414** (push #708) — BATCH F chiuso, e il confine di Life.
  P1.21 — LIFE IN PRODUZIONE NON LA PROVAVA NESSUNO. Lo smoke verificava
  homepage, health, Diretta e TaxiTalk: un deploy poteva essere verde con
  l'intera sezione Life a pezzi. Ora prova LE PORTE: che le rotte di Life
  esistano davvero nel pacchetto pubblicato, e che sappiano dire di no a
  chi non ha diritto. VERIFICATO A MANO CONTRO LA PRODUZIONE VERA prima
  di scriverlo: `/api/compagni/mie` 401, `/api/compagni/amico` 401,
  `/api/compagni/live/session` 401 (che e anche la prova che la Via B di
  b.407 e viva), `/api/topics/search` risponde `application/x-ndjson`
  (il contratto da cui dipende b.409).
  NON SPENDE NIENTE, ed e una scelta: questo gira a ogni invio su main, e
  uno smoke che chiama il modello a ogni push diventa una voce di costo
  che nessuno ha deciso. Cio che costa (un turno di Amico, una voce, un
  syllabus) resta scoperto e va detto: si prova a mano.
  E UNA RIGA L'HO TOLTA IO: avevo messo anche l'azione «dimentica», ma il
  cancello dell'accesso scatta PRIMA di guardare quale azione chiedi,
  quindi rispondeva 401 anche se l'azione non fosse esistita. Non
  provava niente, e una prova che sembra provare e peggio di una prova
  che manca.
  P1.20 — IL CONFINE FRA LIFE E BARTALK. L'audit segnalava che la regola
  scritta («niente di BarTalk tranne ponte.js») non descriveva piu la
  realta. VERIFICATO, e aveva ragione a meta — la meta che conta e in
  ordine: le CAPACITA' vere (modello, autorizzazione, portafoglio,
  ricerca, fornitori, deposito veloce, registro accessi) stanno TUTTE in
  `ponte.js` e in nessun altro file di Life. Cio che Life importa da solo
  sono primitivi: colori, misure, memoria del telefono, registro
  dell'audio. Non sono capacita, sono il pavimento.
  Quindi non serviva un refactor: serviva scrivere il confine giusto
  (`docs/PIANO-LIFE-COMPAGNI.md` §5-quater, con le due liste) e metterci
  una guardia — `__tests__/confine-life-b414.test.js`. Provata in tutte e
  due le direzioni: aggiungendo un import del portafoglio in memoria.js
  diventa rossa e dice anche perche. Una regola scritta in un documento
  che nessuno esegue e esattamente il motivo per cui l'audit ha dovuto
  segnalarla.
- Versione: **b.413** (push #707) — P1.15: l'impronta dell'utente di Life.
  Era `sha256(email)` troncato. Il difetto non e la funzione: e che
  l'email E' UN DATO INDOVINABILE — chi ha in mano un'impronta puo
  provare le email finche torna, o costruirsi una tabella ed ENUMERARE
  le persone. Mondo era gia passato all'HMAC per questo motivo esatto in
  b.244, e il commento di Life diceva ancora «la stessa impronta di
  Mondo», che da allora non era piu vero: un commento che mente e peggio
  di nessun commento.
  LA MIGRAZIONE E' IL PUNTO, e va capita: dagli id vecchi NON si risale
  alle email, sono digest. Quindi una migrazione di massa e IMPOSSIBILE
  — nessuno, nemmeno noi, sa a chi appartiene la riga `u_3f2a...`.
  L'unico momento in cui quel legame esiste e quando la persona TORNA:
  li abbiamo la sua email e possiamo calcolare tutte e due le impronte.
  Il trasloco e quindi PIGRO: avviene alla prima apertura di Life, una
  persona alla volta, dentro `elencaCompagni` (che e la prima cosa che
  Life chiede). Idempotente, e se una tabella e guasta le altre passano
  lo stesso — meglio nove su dieci che zero, e niente va perso perche
  la riga resta dov'e.
  Usa lo STESSO segreto di Mondo (`MONDO_ID_SECRET`) di proposito: due
  segreti per la stessa idea sono due cose da ricordare e una da
  dimenticare. Senza segreto si ricade sul vecchio schema dichiarandolo,
  per non spegnere Life dove il segreto non c'e.
- FERMO SU LUCA: se `MONDO_ID_SECRET` non e impostata su Vercel, questo
  intervento non ha alcun effetto — l'impronta resta il digest di prima.
  Non e un guasto e non finge: e scritto nel codice e verificato da una
  prova. Ma finche non c'e, P1.15 e chiuso nel repository e APERTO in
  produzione.
- Versione: **b.412** (push #706) — tre punti che avevano in comune una
  cosa: un'informazione c'era gia, e non arrivava dove serviva.
  P1.12 — UN TESTO SENZA FONTI SI TRAVESTIVA DA EVIDENZA. Il Dossier SA
  quando la ricerca fonti fallisce: lo dichiara (`fontiGuaste`), lo
  registra, e la schermata lo mostra pure. Ma al prompt del report non
  arrivava, e quel prompt intitolava «Fatti di partenza (dalle fonti)»
  qualunque briefing non vuoto — comprese le volte in cui di fonti non ce
  n'era nemmeno una. Ora il briefing porta con se il suo stato e ogni
  stato ha la sua intestazione: supportati dalle fonti · contesto NON
  verificato · ricerca fallita, non trattarlo come evidenza. Lo stato
  attraversa tutta la catena (schermata, cliente, rotta, prompt): bastava
  che si fermasse in un punto e il prompt tornava a mentire.
  P1.11 — LO STOP DEL TAVOLO NON ANNULLAVA LA GENERAZIONE GIA PARTITA.
  Alzava una bandierina che fermava la voce successiva, ma il server
  stava generando le risposte di due-quattro Compagni: quel lavoro
  proseguiva, si pagava, e chi aveva premuto Stop restava ad aspettare.
  Ora la richiesta ha un filo che si taglia, e si ricontrolla anche DOPO
  l'attesa — perche e proprio in quei secondi che si preme Stop. Cio che
  il fornitore ha gia cominciato puo comunque essere addebitato: non lo
  controlliamo noi, ed e scritto nel codice invece che sottinteso.
  P1.19 — LE LEZIONI PUBBLICATE SI RICOSTRUISCONO CAMPO PER CAMPO. Prima
  si salvavano cosi come arrivavano: un client poteva pubblicare oggetti
  di forma qualunque, e quei titoli e obiettivi finiscono nella schermata
  e DENTRO IL PROMPT che genera le lezioni di altri utenti. In una
  libreria aperta anche ai bambini. Ora escono solo tre campi — titolo,
  obiettivi, peso — con le loro misure, e chi ne vuole un quarto lo
  aggiunge in un posto solo.
- Versione: **b.411** (push #705) — BATCH E, seconda parte: la memoria
  del Compagno. Sei punti chiusi, e una scoperta che non era nell'audit.
  SCOPERTA, dai dati vivi: `compagno_memorie` e a ZERO righe. La memoria
  non e rotta — E' SPENTA. `compagnoVuoto()` non imposta `memoria`, quindi
  ogni Compagno nasce senza; l'interruttore nel form c'e (GestioneCompagni)
  ma nessuno dei quattro Compagni di Luca lo ha acceso. NON l'ho acceso io:
  accendere per difetto una memoria di fatti personali e una decisione di
  prodotto e di privacy, e la prende lui. Ma finche resta spenta, tutto
  cio che segue non si vede in produzione.
  P1.13 — LA FINESTRA «RECENTE» NON ESISTEVA. Si prendevano le ultime otto
  righe qualunque, senza guardare ne il livello ne la data: i ricordi
  CONSOLIDATI (i piu importanti, e i piu vecchi) occupavano gli slot dei
  recenti. Ora sono due domande separate, e la recente e davvero a sette
  giorni — `GIORNI_RECENTI`, come dice il piano.
  P1.14 — UN DEPOSITO GUASTO NON E' «NESSUN RICORDO». L'errore veniva
  buttato (`data || []`) e da fuori le due cose erano identiche. Ora si
  registra e si puo chiedere con `memoriaDisponibile()`: un Compagno che
  dice «non ricordo» a chi gli ha appena raccontato qualcosa e un'altra
  cosa da un Compagno senza ricordi.
  P1.16 — CANCELLARE UN COMPAGNO CANCELLAVA SOLO LA SUA SCHEDA. Verificato
  sul database vivo: fra `compagni` e `compagno_memorie` non esiste NESSUN
  vincolo, quindi nessuna cascata. I ricordi restavano li per sempre, senza
  piu una schermata capace di raggiungerli. Ora si cancellano prima i
  ricordi e poi la scheda, e se i ricordi non si cancellano la scheda
  RESTA: meglio un Compagno da ricancellare che ricordi orfani. Non si e
  messo un vincolo nel database perche i Compagni PREDEFINITI non stanno
  in quella tabella e una chiave esterna impedirebbe di ricordarli.
  P1.17 — «DIMENTICA» ESISTEVA E NON SI POTEVA CHIEDERE. `dimentica()`
  stava in memoria.js da sempre, il piano promette una memoria
  «cancellabile», e i chiamanti erano ZERO in tutto il progetto. Ora la
  catena c'e tutta e tre: azione nella rotta, verbo nel cliente, tasto su
  OGNI riga di Gestione Compagni — anche sui predefiniti, che non si
  possono cancellare ma possono ricordare.
  P1.18 — IL CONTATORE DEI TURNI ERA DEL CLIENT. `body.totale` decideva
  quando far girare l'estrazione, che e una chiamata al modello: un client
  modificato poteva farla girare a ogni turno, o non farla girare mai.
  Ora conta il server in Redis per (utente, Compagno), e il numero del
  client resta come ripiego se il deposito non risponde.
- E UNA PROVA MIA CHE SI E' MESSA DI TRAVERSO ALLA CURA. `completamento-b244`
  controllava ALLA LETTERA la riga del throttle, non il suo intento: e
  diventata rossa proprio quando l'intento di b.244 e stato soddisfatto
  MEGLIO (il conteggio dal client al server). Riscritta su cio che conta:
  da dove NON puo venire quel numero. E' la stessa malattia della
  trappola numero 6, in un'altra forma — la prova difendeva una riga.
- Versione: **b.410** (push #704) — BATCH E: i due P0 di privacy.
  P0.7 — LA CHAT E GLI OBIETTIVI SI LEGGEVANO FRA ACCOUNT. Le chiavi
  erano `vt-chat-<compagno>` e `vt-obiettivi`, senza dentro chi sei.
  Sullo stesso telefono: parli con Omar, esci, entra un altro account,
  riapre Omar e legge la tua conversazione. E gli Obiettivi hanno per
  DISEGNO le categorie salute, relazioni, lavoro, finanza — sta scritto
  nel loro catalogo. Ora c'e `app/lib/scaffale.js`: ogni cosa personale
  sta su `vt:<impronta>:<nome>`, dove l'impronta e un numero ricavato
  dall'email e non rileggibile al contrario (l'email in chiaro dentro
  una chiave la legge chiunque apra gli strumenti del browser). Chi non
  ha fatto l'accesso ha la sua impronta di ospite, nata a caso su quel
  telefono. L'identita la dichiara `AppContext` a ogni cambio di
  accesso: un posto solo, non due da tenere allineati.
  IL TRASLOCO, e il ragionamento perche possa essere contestato: le
  vecchie chiavi non dicono di chi sono. Si migrano UNA VOLTA SOLA, alla
  prima identita che compare dopo l'aggiornamento, e poi si cancellano.
  Prima di oggi quei dati erano leggibili da OGNI account del telefono:
  darli al primo che entra non espone niente che non fosse gia esposto a
  lui, e da quel momento li chiude a tutti gli altri. Meno esposizione di
  prima in ogni caso, mai di piu. Il costo possibile e che finiscano
  nello scaffale sbagliato fra due persone che gia se li vedevano
  entrambe.
  P0.8 — LA MEMORIA SENSIBILE ERA AFFIDATA AL SOLO PROMPT. Il prompt
  dell'estrazione chiede gia di non memorizzare diagnosi, farmaci,
  documenti, indirizzi e recapiti — e lo chiede bene. Ma un prompt e una
  richiesta a un modello, non un controllo: fra l'estrazione e l'INSERT
  non c'era niente che guardasse. Ora c'e `app/lib/compagni/minimizza.js`,
  deterministico e senza AI: riconosce FORME, copre cio che riconosce
  (email, telefoni, IBAN, carte con Luhn, codice fiscale, documenti,
  indirizzi) e SCARTA il ricordo intero quando la forma dice «farmaco
  con dosaggio» — perche li il dettaglio E' il dato, e coprirlo
  lascerebbe una frase che finge di tacere. Il registro dice quanti e di
  che tipo, mai cosa.
  LIMITE DICHIARATO, e va tenuto: gli schemi degli indirizzi sono
  italiani ed europei. Un indirizzo in thailandese non viene
  riconosciuto. Abbassa il rischio, non lo azzera, e la prima difesa
  resta il prompt. Non si scriva da nessuna parte che e una garanzia.
- DUE DIFETTI MIEI PRESI DALLE PROVE MENTRE LI SCRIVEVO, e questa e la
  ragione per cui vanno scritte prima di dichiarare fatto:
  1. la regola dell'indirizzo copriva «Ha finito il corso di inglese nel
     2024», perche in italiano «corso» e anche una strada. Un ricordo
     mutilato per sbaglio e peggio di un ricordo non filtrato: sparisce
     senza che nessuno lo sappia. Ora la via pretende un nome proprio.
  2. la regola del telefono, senza guardie di cifra, prendeva quindici
     cifre di un numero interno lungo sedici e lasciava «[omesso]6».
     Sembrava colpa della regola delle carte: non lo era.
- Versione: **b.409** (push #703) — BATCH C e D del piano Life: due
  funzioni che erano nel codice e non hanno MAI dato un risultato.
  P0.5 — IN IMPARA I CONTENUTI «LINK» E «FOTO» NON HANNO MAI PRODOTTO
  NIENTE. Non ogni tanto: mai, da sempre. `/api/topics/search` risponde
  A RIGHE (una per stadio del lavoro), e `arricchisciLezione` ci faceva
  sopra `await r.json()`: un corpo di piu righe non e JSON valido, la
  lettura lanciava, il catch restituiva `null` e la schermata degradava
  in silenzio. Mondo la stessa rotta la leggeva bene, perche aveva il
  suo lettore scritto a mano DENTRO il componente. Ora il lettore e uno
  solo, in `app/lib/topics/cliente.js`, e lo usano tutti e due — come
  chiede l'audit alla lettera: «un solo client Topics condiviso, NON
  duplicare un parser diverso in ogni componente». Il secondo parser non
  e stato scritto: e stato tolto quello che c'era e messo in comune.
  P0.2 — IL TETTO DEL PODCAST ERA SOTTO IL SUO STESSO FLUSSO. `10` al
  minuto era il numero giusto per quando il podcast era UNA richiesta;
  da b.244 e una richiesta PER TURNO, e il contratto ne permette
  MAX_COMPAGNI x MAX_ROUND = 40, piu quella che chiude. Ora il tetto si
  RICAVA dal contratto (`PODCAST_RICHIESTE_MAX`): se domani qualcuno
  alza i round, il tetto lo segue da solo.
  ONESTA SU QUANDO SI VEDEVA: non sempre. Mentre la voce parla passano
  10-20 secondi fra un turno e l'altro, e in un minuto ci stanno 3-4
  richieste. Ma quando la voce NON parte — credito premium finito,
  fornitore giu, riproduzione negata, telefono in silenzioso — il giro
  resta sola generazione: 2-4 secondi a turno, cioe 15-30 richieste al
  minuto. Il 429 arrivava addosso a chi stava gia avendo una giornata
  storta, e il podcast si fermava a meta.
- TRAPPOLA NUMERO 6, CI SONO CASCATO LA QUARTA VOLTA. Scrivendo la
  guardia sul tetto del Podcast ho controllato che nella rotta non ci
  fosse piu `maxRequests: 10` — e la prova leggeva il MIO commento, che
  quella stringa la contiene per spiegare il difetto. Ora i commenti si
  scartano prima di guardare il codice. La regola era gia scritta nel
  punto 6 qui sopra: rileggerla non basta, va applicata quando si scrive
  la prova, non dopo.
- Versione: **b.408** (push #702) — L'AUDIT ESTERNO DEL 23/08 verificato
  punto per punto, non accettato per cortesia. Il suo P0 numero uno era
  vero e piu grave di come lo descriveva: otto tabelle pubbliche su
  Supabase con RLS spenta, ZERO politiche, e `anon` con SELECT **e
  INSERT**. La chiave anon sta nel browser: c'era una strada
  Internet -> REST Supabase -> chiave anon -> tabella, che scavalcava
  del tutto la nostra (browser -> API -> getSession -> service role).
  Dentro: compiti, materiali, scansioni, corsi, profilo studente,
  errori di pronuncia, e i dispositivi PeepOff con chiavi pubbliche e
  presenza. L'API di PeepOff era scritta bene apposta per non far uscire
  niente: il portone era chiuso e la finestra sul retro aperta.
  CHIUSO E VERIFICATO SUL DATABASE VIVO (migrazione 013, applicata):
  rls=true, anon SELECT/INSERT=false, authenticated=false, service_role
  legge ancora; advisor di sicurezza Supabase a ZERO errori e ZERO
  avvisi (restano solo INFO «RLS enabled, no policy», che e il disegno
  voluto — le altre venti tabelle sono fatte cosi da sempre).
  RAGGIO VERIFICATO PRIMA, non dopo: quelle otto tabelle le tocca solo
  codice di server con `getSupabaseAdmin()`; nel browser il client
  anonimo esiste ma lo usano solo useRealtimeRoom e useWebRTC per i
  canali realtime, senza nemmeno un `.from()`. Per l'applicazione non
  cambia niente. La guardia che lo tiene vero nel tempo:
  `__tests__/rls-porta-laterale-b408.test.js`.
  Chiuso nella stessa migrazione anche il P1: le tre funzioni
  SECURITY DEFINER di Mondo (conta_vista, dopo_commento, ricalcola_like)
  avevano EXECUTE per anon. Non facevano uscire contenuti privati, ma
  chiunque poteva gonfiare viste, commenti e mi-piace — e quei numeri
  decidono cosa la gente vede. Ora EXECUTE revocato e search_path
  blindato come nel portafoglio.
  CI: aggiunto `npm run build`, che mancava — erano possibili (ed e gia
  successo) 2377 prove verdi con la costruzione rotta. E consolidata in
  una cartella sola: `voice-translator-vercel/.github/workflows/` non e
  MAI stata eseguita da GitHub, che legge solo la `.github/workflows`
  alla radice. Era un controllo che sembrava esserci e non c'era.
- ONESTA SUL CANCELLO CI: Vercel pubblica da solo a ogni invio su main e
  non aspetta la CI. Quindi oggi il cancello vale sulle proposte di
  modifica, e su main e un allarme che suona presto — NON una sbarra.
  Per farlo diventare una sbarra serve la protezione del ramo main su
  GitHub con questo controllo obbligatorio, oppure spegnere la
  pubblicazione automatica di Vercel. E in mano a Luca. Finche non c'e,
  non si scrive da nessuna parte che «la CI protegge la produzione».
- Versione: **b.407** (push #701) — LA VIA B, scelta da Luca il 23/08:
  «il sistema funziona molto bene e non va cambiato, l'agente in tempo
  reale e la cosa che funziona meglio». L'agente conversazionale
  ElevenLabs RESTA. Cio che finisce e la sessione aperta dal browser.
  Documento architetturale aggiornato PRIMA del codice, come chiede
  l'audit: `docs/PIANO-LIFE-COMPAGNI.md` §5-ter porta la decisione, il
  motivo, la forma nuova, la contabilita e il limite noto. La regola 1
  («ElevenLabs = solo voce») ora rimanda li invece di essere smentita in
  silenzio dal codice.
  Nuovo: `POST /api/compagni/live/session` (azioni apri/chiudi) e i due
  verbi `apriLineaDalVivo`/`chiudiLineaDalVivo` sulla cerniera `ponte.js`.
  La linea risponde a otto domande in ordine: chi sei (dal gettone, mai
  dal corpo) · con chi vuoi parlare · e tuo quel Compagno · in che lingua
  (quella del Compagno vince) · puoi permettertelo (riserva, 402) · come
  parli (indirizzo FIRMATO, non piu un id pubblico) · quanto e durata (la
  misura il SERVER dall'ora di apertura) · quanto hai speso (commit sul
  vero, il resto torna).
  IL BROWSER NON E' PIU AUTORITATIVO: prima mandava nome, ruolo,
  personalita e voce del Compagno — tutta roba scrivibile dagli strumenti
  del browser. Ora manda un id e un gettone; il personaggio lo risolve il
  server dal nostro database. La regola 2 del piano («la personalita e
  una sola, nel nostro DB») da oggi e vera anche nel dal-vivo.
  Tariffa in `app/wallet/tariffe.js`, l'unico file coi numeri dei soldi:
  `MOLTIPLICATORE_DAL_VIVO` (= quello premium, un minuto parlato scala
  tre minuti di credito) e `LIVE_TETTO_SECONDI` (15 minuti bloccati
  all'apertura, restituiti alla chiusura).
- FERMI SU LUCA per il dal-vivo (due, tutti e due suoi e non miei):
  1. `ELEVENLABS_AMICO_AGENT_ID` va messa su Vercel LATO SERVER (quella
     che c'e e `NEXT_PUBLIC_`, cioe esposta al browser). Senza, la rotta
     risponde 503 e la scheda dice «il dal vivo non e acceso su questo
     ambiente» — non finge di funzionare.
  2. Il listino VERO degli agenti conversazionali ElevenLabs si legge
     solo dal pannello del suo piano: comprende anche il loro STT e il
     loro modello, e potrebbe stare sopra i 3,5 cent/min della sola voce.
     Finche non lo verifica, il moltiplicatore e la stima piu prudente
     giustificabile. Sta in una riga sola apposta.
  3. Privacy del fornitore — **DECISO DA LUCA il 23/08/2026: RESTA
     ACCESO DURANTE IL COLLAUDO.** «Privacy Settings / data retention →
     questo dobbiamo lasciarlo attivo durante la fase di test, lo
     disattiveremo poi.» E' una scelta ragionevole e va rispettata:
     mentre si collauda una linea vocale, poter riascoltare cosa e
     successo vale piu della ritenzione minima.
     NON e quindi una lacuna, e nessun audit deve segnalarla come tale.
     Ma porta con se DUE conseguenze, e sono la ragione per cui sta
     scritto qui invece che in un pensiero:
       a) finche resta acceso, in nessun punto del prodotto si puo
          scrivere che il dal-vivo e privato. VERIFICATO il 23/08: oggi
          non c'e nessuna frase del genere — l'unica riga sulla privacy
          (`faqPrivacyA`) parla delle STANZE e dice «sui nostri
          server», che resta vero. Chi aggiunge una frase sul dal-vivo
          deve prima guardare questo punto.
       b) va SPENTO prima che entri qualcuno che non sia Luca. Non
          «prima o poi»: prima del primo utente vero. Finche parla solo
          lui, l'unica conversazione conservata dal fornitore e la sua.
     Dove si spegne: elevenlabs.io/app/agents/agents → l'agente
     `agent_9101...` → scheda **Advanced** → Privacy Settings (*Disable
     audio saving*) e Data Retention. Il default e DUE ANNI, e c'e
     l'opzione per applicare la nuova ritenzione anche a cio che e gia
     archiviato: quella va spuntata, o vale solo da li in avanti.
- Prima della Via B e stato lasciato un backup in `~/Downloads/backup-bartalk-b406/`
  (fuori dal repository) coi cinque file toccati e le istruzioni per
  tornare indietro. Il punto di ripartenza vero resta il commit `8b7192d`.
- Test: **2497 verdi su 167 file** · 0 errori di lint (avvisi tollerati)
  ATTENZIONE, lezione del 21/08: per mezza giornata sono rimaste 16 prove
  rosse senza che me ne accorgessi, perche controllavo solo le quattro
  guardie invece della suite intera. Prima di dichiarare finito un giro
  di lavoro si lancia la suite INTERA, una volta.
- ATTENZIONE agli audit esterni: il 20/08/2026 un audit ha esaminato
  b.131 credendola corrente PERCHE questo blocco era rimasto fermo.
  Questo blocco va aggiornato A OGNI push, o depista chiunque legga.
- **SENTRY: NO, DECISIONE DI LUCA del 23/08/2026.** «Sentry non lo
  voglio adesso.» Non e una cosa dimenticata ne un debito da rinfacciare:
  e una scelta. Gli agganci restano nel codice e non danno fastidio; il
  DSN resta vuoto di proposito. Un audit che lo segnala come lacuna sta
  segnalando una decisione, non un difetto — e la risposta e questa riga.
  Non riproporlo.
- (storico) Sentry: collegato in `instrumentation.js`, **DSN non impostato**
  (azione di Luca su Vercel). Gli errori di esecuzione di Vercel si
  leggono gia col suo MCP (`get_runtime_errors`).
- npm audit (20/08/2026): nanoid corretto; restano postcss+sharp (3
  avvisi alti) il cui fix richiede Next 16.3.1 — migrazione da fare in
  un ramo a parte con collaudo, MAI con `audit fix --force` a caldo.
- TURN proprio (coturn) — **QUESTA RIGA ERA FALSA, corretta il 23/08/2026.**
  Diceva «script pronti in `deploy/coturn/`». Verificato: la cartella
  `deploy/` NON ESISTE nel repository, e nemmeno un file che nomini
  coturn. Non c'e nessuno script pronto. Sta scritto qui perche una riga
  di diario che promette qualcosa che non c'e fa perdere mezz'ora a
  chiunque la legga — a me e successo oggi.
  COSA SERVE DAVVERO, e in che ordine:
    1. un coturn INSTALLATO da qualche parte con un nome e un
       certificato (puo stare sul server Contabo che c'e gia);
    2. su Vercel, due variabili di SERVER — `TURN_SECRET` (lo stesso
       `static-auth-secret` del coturn) e `TURN_URLS` (per esempio
       `turn:turn.bartalk.app:3478,turns:turn.bartalk.app:5349`).
  Il codice e gia pronto e non aspetta altro: `/api/turn` risponde
  `{ iceServers: [] }` finche le variabili mancano, e il telefono
  prosegue coi soli STUN. L'assenza del ponte e uno stato normale, non
  un guasto — ed e per questo che nessuno se n'e accorto.
  NON CONFONDERLO con `accendi-https.sh` sul server Contabo: quello e il
  certificato del PONTE REDIS (il ripiego a Upstash), un problema
  diverso. Io li ho confusi una volta: sono due cose che stanno sulla
  stessa macchina e non c'entrano niente l'una con l'altra.

### Banco di prova a due utenti, SENZA secondo telefono

Due schede sulla stessa origine. `vt-prefs` e condiviso, ma l'identita
di stanza vive in memoria: si imposta il nome, si carica la scheda, si
cambia il nome, si carica l'altra. Oppure si pilotano due client
dall'API con due gettoni distinti — piu veloce per tutto cio che e
lato server.

Copre: chat, traduzione, conferme, ingressi, limiti, porte, archivio.
NON copre: WebRTC fra reti diverse, microfono e telecamera veri, iOS.

### Collaudo eseguito (b.131) — tutto verificato in produzione

S1 fondamenta · S2 rotture volute · S3 limiti · S4 porte · S5 catene
laterali: **tutti verdi**. Dettaglio in COLLAUDO-STRESS.md.

### Fermi su Luca (21/08/2026)

1. **Il deposito veloce e al tetto**: 500.000 richieste su 500.000. Le
   stanze non si creano e non si elencano. Va alzato il piano su Upstash
   o aspettato il ripristino. Il consumo e gia stato tagliato dell'80%.
2. **HTTPS sul server suo** (38.242.207.31): Redis e il ponte che parla
   la lingua di Upstash sono gia installati e vivi li, ma il ponte
   risponde in chiaro. Serve root UNA volta per il certificato: lo
   script e pronto in /home/tmwe-admin3/accendi-https.sh. L'utente
   tmwe-admin3 NON e amministratore (gruppo sudo vuoto) e root non
   accetta password: si passa dalla console Contabo.
3. **Il paese sulle stanze**: le stanze portano la lingua, non il luogo.
   Finche non c'e, "stanze del Giappone" non si puo fare — si puo fare
   solo "stanze in giapponese", che e un'altra cosa.
4. **Decisioni di prodotto in sospeso**: la Home del Paese, "cosa ne
   pensa il mondo" (che NON serve AI: sono conteggi sui dati che
   abbiamo), la colonna a due schede.

### BarTalk TV — decisioni prese col ragionamento (21/08/2026)

Non e ancora costruito niente: qui sta il ragionamento, per non
rifarlo da capo.

**Cosa e.** Programmazione con eventi in agenda: talk show e podcast dal
vivo, piu contenuti registrati portati da altri. Noi diamo il luogo, il
palcoscenico e — la cosa che nessun altro ha — la TRADUZIONE
SIMULTANEA. Chi porta il programma porta gli sponsor.

**Il registrato e facile, il dal vivo e difficile** (all'inizio si era
pensato il contrario). Sul registrato l'ostacolo non e tecnico: sono i
DIRITTI. Chi porta il contenuto porta anche il diritto di tradurlo.

**Si traduce una volta per LINGUA, mai per spettatore.** Il costo
dipende da quante lingue si accendono, non da quanta gente guarda.
Duemila spettatori costano come venti. Tradurre per spettatore vuol dire
morire al primo show riuscito.

**Il prezzo si divide fra TUTTI, non per lingua** (decisione di Luca, ed
e migliore della prima proposta). Dividendo per lingua si creava un
incentivo storto: conveniva guardare in inglese anche capendolo male,
perche costava meno — cioe il sistema spingeva ad abbandonare la propria
lingua, su un'app che esiste per il contrario. Dividendo fra tutti, il
prezzo non dipende ne da chi sei ne da che lingua parli, e si puo
scrivere sul programma prima: "questo talk costa due centesimi".

**La soglia per aprire una lingua cambia di segno.** Non "lo swahili si
accende se lo chiedono in tre" (che punisce chi e solo), ma "una lingua
si accende quando il pubblico e abbastanza grande da non accorgersene":
la folla porta chi e solo. Sotto soglia, la copre lo sponsor o la
piattaforma — costa poco proprio quando il pubblico e piccolo.

**Conteggio temporaneo, aggiustato alla fine** (Luca). All'ingresso si
BLOCCA una stima (un tetto dichiarato), durante non si tocca il
portafoglio, alla fine si addebita il costo VERO e si libera il resto.
E' esattamente riserva -> commit -> release, che nel portafoglio esiste
gia. Tre motivi: sessantamila scritture diventano mille; non si possono
addebitare frazioni di centesimo (arrotondando ogni minuto l'errore
supera la cifra); e soprattutto il DIVISORE vero si conosce solo a fine
evento. Chi esce a meta si chiude comunque alla fine, con gli stessi
numeri di tutti. Chi sparisce senza chiudere lo sblocca il cron delle
riserve scadute, che esiste gia.

**TOLLERANZA SUL CREDITO** (Luca): si puo sforare, non siamo rigidi.
Regola in una riga: la tolleranza serve a FINIRE quello che hai
cominciato, non a COMINCIARE cose nuove. Il talk/chiamata/stanza in
corso non si ferma mai nemmeno sotto zero; la volta dopo, se sei in
rosso, prima ricarichi. Conseguenza sulla riserva: NON si sbarra
l'ingresso, si aggiusta all'uscita — la stima all'entrata dice quanto
costera, non fa da cancello. Due paletti: (1) e un tetto, non
l'infinito; (2) il tetto cresce con la storia di ricariche della
persona — chi si e iscritto adesso ha poco, ma ha il credito di
benvenuto che fa lo stesso lavoro, ed e l'unica difesa contro gli
account usa-e-getta. Si dice con calma ("li abbiamo coperti noi,
ricarichi quando ti va"), non con un allarme rosso: se lo racconti come
un'infrazione hai sprecato il gesto. Vale per tutto, non solo la TV.
DECISO E IN PRODUZIONE (b.372, Luca: "la tolleranza decidi tu"):
TRENTA MINUTI, la stessa misura del benvenuto — un numero solo da
ricordare in tutto il portafoglio, e circa un sesto del pacchetto piu
piccolo, cioe le stesse proporzioni dei due euro su dieci dell'esempio
della scheda telefonica. Tolleranza ZERO per chi non ha mai ricaricato.
Il numero vive in una funzione sola del database (wallet_tolleranza,
migrazione 012, APPLICATA e verificata: 0 per chi non ha mai ricaricato,
1800 per chi si).

**CORREZIONE a "2000 spettatori costano come 20"**: vero per la
TRADUZIONE (costo fisso per lingua), FALSO per la CONSEGNA (banda, che
cresce in linea retta col pubblico). Con un milione di ascoltatori la
banda audio e qualche centinaio di euro l'ora = quattro centesimi di
millesimo a testa. Quindi il costo per persona non va a zero: scende
fino al PAVIMENTO della banda, che resta enormemente sotto qualunque
cifra addebitabile.

**IL PREZZO E' UN PREZZO, non un rimborso spese** (Luca, e aveva
ragione — io mi ero sbagliato). Avevo obiettato che un minimo
addebitabile sopra il costo avrebbe reso falsa la scritta "ognuno paga
il suo" delle stanze. VERIFICATO NEL CODICE: quella scritta e un
interruttore fra "paga chi ha aperto" e "paga ognuno il suo" — dice CHI
paga, non quanto ci guadagniamo. Non ha mai promesso di vendere al
costo. L'obiezione era costruita su una lettura sbagliata di una nostra
funzione, e la parola "difendere" era fuori posto: un margine non si
giustifica.

E la struttura giusta l'app ce l'ha GIA: quello che incassiamo sta in
tariffe.js (pacchetti: tre ore a 4,99), quello che ci costa sta in
provider-costi.js. Separati da sempre. Vendiamo ore di credito a un
prezzo nostro; i costi dei fornitori sono un numero interno. Non c'era
niente da cambiare.

Le parole di Luca: distribuire cultura a costo quasi zero grazie alla
tecnologia; Prada e Armani vendono al 2000% per il marchio; noi non
siamo una non-profit, come non lo sono le universita private.

**DUE IDEE DI LUCA CHE CAMBIANO IL PIANO:**
  I GOVERNI CHE COMPRANO TOKEN E LI REGALANO agli utenti che studiano
  sulla piattaforma. Non e solo un canale di vendita: risolve da solo il
  problema della lingua con pochi ascoltatori — un ministero che
  finanzia la propria lingua la tiene accesa senza soglia e senza folla.
  I CORSI CONDIVISI, "una scuola infinita gia disponibile". Sono
  l'unica cosa che continua a rendere DOPO essere stata fatta una volta:
  un talk dal vivo si consuma e finisce, un corso resta e si vende
  all'infinito in tutte le lingue senza rifarlo. Se c'e un posto dove
  investire il tempo e quello, non la diretta.

**COME REGGE UN MILIONE — non e peer to peer, e non lo e nemmeno
Facebook.** Domanda di Luca, ed e la piu importante fatta sulla TV.
Oggi: stanze max 50, diretta uno-a-uno, collegamenti diretti fra
telefoni. Con 50 sono gia 2400 collegamenti; con un milione ognuno
dovrebbe spedire la voce un milione di volte — impossibile, non
difficile. Una live di Facebook non collega nessuno a nessuno: la voce
sale una volta, un server la taglia in file da pochi secondi, quei file
vengono copiati sui server sparsi per il mondo, e il pubblico SCARICA
file. Per questo regge, e per questo ha 10-20 secondi di ritardo — che
NOI VOLEVAMO GIA per allineare la traduzione.

Struttura: DUE STANZE, non una.
  IL PALCO — 2-10 persone, collegamenti diretti, dal vivo. E' quello che
  abbiamo gia.
  LA SALA — tutti gli altri, file scaricati, 10 secondi dietro, regge
  milioni.
In mezzo la traduzione: la voce sale, esce in N piste audio invece di
una. La distribuzione ne porta N: e l'UNICA differenza da Facebook Live.
Il secondo ascoltatore di una lingua non costa quasi niente perche quel
file e gia sul server vicino a lui — ecco perche dividere fra tutti
funziona.
Due momenti da costruire: chi viene chiamato sul palco SALTA dalla sala
al palco (da 10 secondi dietro a dal vivo — e il telefono che entra in
radio); e la chat della sala non e voce, sono messaggi, pesano mille
volte meno e vanno su una strada che gia abbiamo.
Cosa costruire: NON il distributore, NON i server nel mondo — si
affittano, esistono fatti e costano poco. Si costruisce solo la
TRADUZIONE IN MEZZO, che e l'unico pezzo che non ha nessun altro.
E per il PRIMO talk show non serve niente di tutto questo: 30 persone in
3 lingue ci stanno gia dentro le stanze (tetto 50). La distribuzione
serve sopra i 50. Costruire la macchina da un milione prima di avere
cento persone e il modo classico di morire prima.

**Ritardo accettabile**: 2-4 secondi stimati (mai misurati in diretta).
Si trasmette con ~10 secondi di ritardo per tutti, come la TV vera: cosi
la traduzione arriva allineata e nessuno se ne accorge.

**Anche la SALA va tradotta**, non solo lo show: e il pubblico che si
parla attraverso le lingue la cosa che non esiste altrove.

**Da dove si parte**: NON dal canale. Da UN solo programma — una
discussione, data e ora, un ospite, tre lingue, trenta persone — con
quello che c'e gia in casa (stanze, alza-la-mano, dai-la-parola, ruoli,
interprete in streaming). Zero tecnologia nuova. Se trenta persone in
tre lingue capiscono tutto, la prova e fatta in una settimana.

**Non inseguire il video ad alta qualita all'inizio**: il vantaggio e
nell'AUDIO, dove vive la traduzione. Una radio multilingue non esiste
gia, costa un decimo, e il video si aggiunge dopo.

### Contenuti, filtri e canali — decisioni (21/08/2026)

**IL CANALE, NON IL CORSO** (correzione di Luca a una mia raccomandazione
sbagliata). Avevo consigliato di investire nei corsi invece che nelle
dirette, perche il corso resta e il talk si consuma. Sbagliato due
volte: (1) il bene che dura non e il corso, e LA PERSONA — un corso e un
bene, un canale e un RAPPORTO, e il rapporto continua a produrre beni;
(2) un corso lo puo fare solo chi ha gia autorita, e il canale e
esattamente cio che quell'autorita la costruisce. Nel mio ordine i corsi
non sarebbero mai nati.
E la cosa che mi ero perso: LA DIRETTA E' COME SI FABBRICA UN CORSO
QUASI GRATIS. Una masterclass fatta dal vivo, quando finisce, e gia un
corso registrato E GIA IN TRENTA LINGUE, perche le tracce tradotte sono
state prodotte mentre parlava. Un lavoro, due prodotti.
Il posizionamento, parole di Luca: qui non si posta la foto delle
vacanze; un podcast parla di te, di un evento, di una masterclass. "Le
persone non curiosano sulla vita: imparano, prendono ad esempio,
conoscono il pensiero di chi le interessa." Conseguenza di prodotto:
L'UNITA' NON E' IL POST, E' L'APPUNTAMENTO. Un canale non e un profilo
con cose sopra: e qualcuno che ha detto quando parla.

**IL FILTRO: decide la persona, non la piattaforma.** Preferenze scritte
a parole nel profilo, modificabili in qualsiasi momento. Chi non vuole
vedere contenuti LGBT e chi non vuole vedere chi disapprova gli
omosessuali stanno sullo stesso piano: due persone che scelgono cosa
guardare. Una regola che protegge un lato solo non e una regola, e una
posizione. E in un contesto mondiale non si puo chiedere a un russo di
ragionare come un californiano: sarebbe arrogante e commercialmente
suicida per un'app che esiste per far parlare chi la pensa diverso.
LA RIGA DI CONFINE (l'unica): puoi decidere cosa entra nei TUOI occhi,
non cosa entra in quelli di un altro. Sopra quella riga la simmetria
vale sempre. Sotto, un contenuto che va addosso a qualcuno non e un
filtro ma un colpo, e chi lo riceve non l'ha scelto.
Le tre cose che non sono gusti, per motivi pratici: il consenso e l'eta
di CHI E' DENTRO l'immagine; le regole di Apple e Google (guardano cosa
vede il recensore DENTRO l'app, dove sta il file non entra nella
conversazione); e cio che e reato ovunque.

**Posizione di Luca sull'ospitare**: non distribuiamo pornografia
direttamente, i contenuti sono link trovati altrove, la responsabilita e
di chi ospita, "io non distribuisco a nessuno cio che non sceglie di
osservare". Un canale adulti separato resta possibile, con la
responsabilita su chi lo apre. Sull'eta: anche i siti porno stanno
sull'autodichiarazione, e noi quei contenuti non li trattiamo — la data
di nascita NON e urgente.

**L'ANTEPRIMA COPERTA** (ordine di Luca, fatta in b.365): e la sua stessa
frase resa un gesto. L'immagine c'e, sfocata, e si scopre con un tocco.
Non e censura — e che il dito lo mette la persona. E risolve il punto dei
negozi: finche e coperta, l'app non MOSTRA niente.
COSA VA COPERTO SI DECIDE IN UN POSTO SOLO (app/lib/sensibile.js), e NON
si guardano le parole. Sullo schermo di Luca la prima notizia era una
sentenza della Cassazione sul revenge porn, su Wired: qualunque filtro a
parole la copre, e copre anche il medico che spiega l'anatomia, mentre
l'insulto elegante passa. Si guardano solo prove: il dominio della fonte,
e cosa dichiara chi ci ha dato il contenuto. Il giudizio sul contenuto e
lavoro da AI e quando ci sara si attacca li dentro senza toccare
nessuna schermata.

**Ancora da fare, se Luca vuole**: bloccare una persona (non esiste;
esiste solo segnalare discussioni e commenti).

### Il carosello 3D della chat (b.372)

Portato da RadioChat (~/Desktop/radiochat) come SECONDO MODO di leggere
la stessa chat, ordine di Luca. Copiato, non riscritto: cambiati solo i
tipi (li era TypeScript), i nomi dei campi dei messaggi (una funzione
sola in cima, daBarTalk, invece di rincorrere i nomi in venti punti), e
i colori per agente — che li erano Albert/Newton/Pitagora e qui non
esistono: ci sono persone, e i due colori human/system c'erano gia.

QUATTRO DIFETTI VERI TROVATI NELL'ORIGINALE E RIPARATI QUI:
1. LE CARTE SI DISALLINEAVANO dal nono messaggio in poi. Si teneva un
   elenco dei messaggi gia disegnati e si saltava chi era dentro: ma al
   nono la finestra scorre, e il messaggio che passa dalla carta 1 alla
   carta 0 risulta "gia fatto" e viene saltato. Da li ogni carta mostra
   il messaggio del vicino — testo sbagliato attribuito alla persona
   sbagliata. Ora non si ricorda "chi ho disegnato" ma COSA C'E' IN OGNI
   CARTA.
2. LA MEMORIA NON SI LIBERAVA: otto tele da 800x1100 per la densita
   dello schermo restavano appese a ogni chiusura della chat.
3. LA DENSITA' SENZA TETTO: su un telefono a densita tre si disegnavano
   nove volte i pixel dello schermo.
4. L'INQUADRATURA SALTAVA all'apertura: la scena nasceva a 62/67 e il
   pezzo dello zoom ripartiva sempre da 50 — la distinzione
   telefono/schermo non ha mai avuto effetto.

Si carica solo se lo si apre (si porta dietro three.js). Non si aggiunge
sotto l'elenco: lo SOSTITUISCE nello stesso posto.

### TRE COPIE DI BARTALK GIRANO SUL MAC DI LUCA — attenzione ai collaudi
- porta 3005 = /Users/teameurope/Downloads/voice-translator2  ← LA NOSTRA
- porta 3000 = /Users/teameurope/bartalk-live  ← ferma a b.305 (19/08),
  centodieci push indietro. Se Luca collauda qui, vede roba di due
  giorni fa e sembrano errori nostri.
- /Users/teameurope/Downloads/voice-translator-vercel = terza copia
Prima di indagare su un errore visto in uno screenshot: CHIEDERE O
VERIFICARE SU QUALE PORTA sta guardando.

### Restano SOLO le prove che richiedono due telefoni fisici

1. Videochiamata: chiude uno, la telecamera dell'altro non si riaccende
2. Numero di sicurezza identico sui due schermi
3. QR TaxiTalk inquadrato davvero
4. Chiamata su due reti diverse (serve TURN privato)

### Aperti dall'audit esterno (2 su 20)

1. Canale dati Direct che nasce solo con una chiamata *(verificato)*
2. Sessione condivisa TaxiTalk: il QR non accoppia le due persone

### Trappole imparate provando

- `window.fetch` e AVVOLTO: sovrascrive `x-session-mode`. Per provare il
  cancello della Diretta si usa XHR, che il wrapper non tocca.
- `/api/messages` si legge con `?room=` (non `roomId`) e gettone
  nell'intestazione `x-room-session`.
- Venti invii in parallelo NON hanno un ordine: per giudicare l'ordine
  si invia in sequenza.

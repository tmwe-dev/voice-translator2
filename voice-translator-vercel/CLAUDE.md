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

- Versione: **b.383** (push #672) — dopo l'audit totale (69 reperti, tutti
  chiusi tranne l'OCR dei Compiti, parcheggiato di proposito) e arrivata
  una lunga giornata di collaudo dal vivo con Luca su Mondo e sulla home.
  Fatto: il pianeta liberato dagli attrezzi che lo coprivano (ricerca e
  filtri sono in un pannello laterale che si apre da una linguetta sul
  bordo), le schede di News e Stanze riscritte con la STESSA grammatica
  (da dove · di cosa · quando · chi · cos'e · quanta vita), il selettore
  argomenti costruito sui dati veri, un righello unico per tutto cio che
  galleggia, il canale fra app e pianeta (scegliendo un paese parte lo
  zoom che il globo sa gia fare), le linee fisse e i pianeti decorativi
  spenti, l'acciaio tolto dal menu in basso a favore di icone sottili.
  E il consumo del deposito veloce tagliato dell'80% sul percorso piu
  battuto: si chiedevano venti volte al minuto notizie che arrivavano
  gia da sole.
- Test: **2206 verdi su 149 file** · 0 errori di lint (avvisi tollerati)
  ATTENZIONE, lezione del 21/08: per mezza giornata sono rimaste 16 prove
  rosse senza che me ne accorgessi, perche controllavo solo le quattro
  guardie invece della suite intera. Prima di dichiarare finito un giro
  di lavoro si lancia la suite INTERA, una volta.
- ATTENZIONE agli audit esterni: il 20/08/2026 un audit ha esaminato
  b.131 credendola corrente PERCHE questo blocco era rimasto fermo.
  Questo blocco va aggiornato A OGNI push, o depista chiunque legga.
- Sentry: collegato in `instrumentation.js`, **DSN non impostato**
  (azione di Luca su Vercel). Gli errori di esecuzione di Vercel si
  leggono gia col suo MCP (`get_runtime_errors`).
- npm audit (20/08/2026): nanoid corretto; restano postcss+sharp (3
  avvisi alti) il cui fix richiede Next 16.3.1 — migrazione da fare in
  un ramo a parte con collaudo, MAI con `audit fix --force` a caldo.
- TURN proprio (coturn): script pronti in `deploy/coturn/`, manca il
  deploy fisico + variabili su Vercel (azione di Luca).

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

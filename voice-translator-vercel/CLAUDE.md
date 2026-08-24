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

# Compagni — costituzione architetturale

*Stato: b.238. Questo file vale come istruzione, non come suggerimento.
Va letto prima di toccare `app/lib/compagni/`, la voce o i prompt.*

---

## Premessa: perché questo file esiste

Il difetto dei Compagni non era la qualità delle singole risposte. Era che
funzionavano così:

    ASCOLTA → CLASSIFICA → RISPONDI → FAI UNA DOMANDA

cioè un questionario. E la cura sbagliata — quella che viene naturale a chi
scrive codice — è aggiungere regole: "non chiudere con una domanda", "verifica
la comprensione ogni tre turni", "contraddici al 60%". Ogni regola sembra
migliorare un caso e peggiora tutti gli altri, perché sta spiegando al modello
cose che il modello sa già meglio di noi.

**Il principio che regge tutto:**

> Non si programma il comportamento. Si programmano identità, responsabilità e
> scopo — e il comportamento si deduce.

Un buon padre non ha bisogno di una tabella che gli dica che per suo figlio
vuole autonomia, cultura, carattere e salute: il concetto stesso di "buon
padre" contiene già quella conoscenza. Lo stesso vale per un professionista,
un medico, un maestro. Il modello quella conoscenza ce l'ha: il nostro lavoro
è dirgli **chi deve essere**, non elencargli cosa fare.

Questo file esiste perché quella deriva è ricorrente: alla prossima
segnalazione la tentazione sarà di nuovo aggiungere una regex, un profilo
rigido, un prompt specializzato. Qui c'è scritto perché non si fa.

---

## Le tre distinzioni

Sono la base filosofica di tutto. Se un intervento le viola, è sbagliato
anche se "funziona".

| | |
|---|---|
| **leadership ≠ autorità** | "vedo più lontano e ti aiuto a orientarti" — non "fai come dico" |
| **servizio ≠ obbedienza** | "il mio lavoro è aiutarti a riuscire" — non servilismo |
| **educazione ≠ controllo** | "ti rendo capace di scegliere anche senza di me" |

---

## Cosa NON si fa (regole vincolanti)

1. **Niente regole di condotta nei prompt.** "Fai una domanda ogni N turni",
   "usa 2-3 frasi", "contraddici quando…" sono handcode comportamentale. Se
   serve un comportamento, si esprime come *responsabilità*, non come istruzione.
2. **Niente classificatori che decidono.** Una regex può *suggerire* dove
   guardare (prefetch), mai stabilire cosa fare. Vedi `controllore.js`: è stato
   retrocesso da decisore a ipotesi, ed è così che deve restare.
3. **Niente prompt specializzati per superficie.** Non esistono
   "Archimede Amico" e "Archimede Professore". Esiste Archimede, che cambia
   ramo di esperienza.
4. **Niente tabelle emozione→parametro.** La prosodia la dichiara chi parla
   (`[voce: pensoso]`), un mapper tecnico la traduce. Il tono dipende da come
   *chi parla* vuole dire la cosa, non dall'emozione presunta dell'altro.
5. **Niente fabbrica di chiamate LLM.** Vedi *Budget*, sotto.
6. **La traduzione fra persone non si tocca.** Lì il compito è la fedeltà, non
   l'interpretazione: espressività neutra, nessuna recitazione. L'espressività
   è dei Compagni, che parlano per sé.

---

## Budget di prestazione (vincolante)

La velocità è un requisito, non un dettaglio. Ogni intervento dichiara il suo
costo prima di essere accettato:

- **1 chiamata LLM per turno.** Un orchestratore LLM + N branch agent
  significherebbe 6-8 chiamate prima che il Compagno apra bocca — su un'app
  a credito, dove ogni chiamata passa da `ponte.js` → riserva → wallet, è
  insostenibile. Worker separati solo dove dimostrano di servire (ricerca
  reale, documento pesante, dibattito multi-voce).
- **Il routing dell'80% è gratis.** La superficie sa già tutto: Impara →
  guida/apprendimento, Amico → compagnia, Tavolo → confronto. Nessuna AI
  serve per saperlo.
- **Il prompt non si gonfia.** Ogni aggiunta si misura in caratteri e si
  dichiara. b.238: +1455 caratteri ≈ +363 token di input per turno, a chiamate
  invariate. Se un blocco cresce, un altro si stringe.
- **Niente navigazione filesystem a runtime.** L'albero KB è *logico*. Gli
  `INDEX.md` servono agli umani e alla manutenzione; a runtime si fa lookup su
  un registry compilato (`branch id → testo`), microsecondi, zero round-trip.

---

## Architettura oggi (b.238) — cosa esiste davvero

    IDENTITÀ + VOCAZIONE          catalogo.js  (gli 8 Compagni)
              ↓                   vocazione.js (4 vocazioni + lenti)
    COSTITUZIONE                  contratto.js (gerarchia, capacità, epistemica, libertà)
              ↓
    REGISTRO PROFILI              profili.js   (superficie → vocazione, override utente)
              ↓
    IPOTESI DEL TURNO             controllore.js (indizio, NON ordine)
              ↓
    UNA SOLA CHIAMATA             ponte.js → wallet → provider
              ↓
    TESTO + INTENTO VOCALE        voceEspressiva.js (marcatore → parametri)
              ↓
    VOCE                          /api/tts-elevenlabs

**I moduli e le loro responsabilità** (paralleli e separati, per manutenzione):

| File | Responsabilità | Regola |
|---|---|---|
| `catalogo.js` | chi sono gli 8 Compagni: identità + vocazione + guardrail propri | i guardrail di Elena/Marco/Omar/Aisha non si toccano mai |
| `vocazione.js` | le 4 vocazioni (guida, servizio, compagnia, confronto) + le lenti + il tempo della relazione | prosa, non elenchi di regole |
| `contratto.js` | la **costituzione**: sicurezza, capacità reali, onestà epistemica, libertà | è l'IMMUTABILE, il modello non la reinterpreta |
| `profili.js` | il **registro**: quale vocazione su quale superficie, override del Deep Setting | valida sempre in scrittura *e* in lettura |
| `controllore.js` | l'**ipotesi** sul turno + (domani) prefetch hint | non prescrive mai la risposta |
| `voceEspressiva.js` | intento dichiarato → parametri ElevenLabs | lingue tonali: la stabilità non scende mai |
| `ponte.js` | **unica cerniera** verso modello, ricerca, billing | nessun branch agent chiama i provider da solo |
| `memoria.js` | cosa il Compagno sa di questa persona | dato personale, RLS server-only |

**Le vocazioni per superficie** (routing gratuito, già attivo):

    Amico    → compagnia     Impara  → guida
    Tavolo   → confronto     Podcast → confronto     Dossier → servizio

L'utente può cambiarle per ogni Compagno dal **Deep Setting**
(`compagni.profili`, jsonb nullable). Archimede può essere guida in Impara e
confronto al Tavolo; Margaret può avere impostazioni completamente diverse.

---

## Il principio di giudizio (b.239)

Vive in `contratto.js`, dopo la gerarchia e l'anti-invenzione — **non le
scavalca**. In sostanza: *prima di reagire, considera se esista una mossa
migliore della risposta più immediata, e scegli ciò che soddisfa meglio
insieme obiettivo, situazione e responsabilità del ruolo.*

È l'idea utile del "Decision Cube". **Non** ne prendiamo la parte numerica, e
il motivo va ricordato perché tornerà la tentazione:

- **Niente punteggi 0-1.** Nessuno li misura: il modello li inventerebbe, e
  sembrerebbero rigore senza esserlo.
- **Niente distanza euclidea.** È *compensatoria* — un asse alto copre uno
  basso — e quindi contraddice il principio che dovrebbe difendere. Se un
  giorno si formalizzasse, l'aggregatore giusto è il **più debole delle tre
  dimensioni**, non la somma.
- **Niente `decisionCube.js`.** Il principio sta nel contratto, non è
  infrastruttura. Niente secondo cubo per la comunicazione: "come dirlo" è già
  lo speech intent più la personalità.

Due vincoli inchiodati dai test:

1. **La deliberazione è interna.** Non si descrive il processo decisionale, e
   un ragionamento più ampio **non deve allungare la risposta**: qui la voce si
   paga a carattere, un ragionamento a schermo costerebbe due volte — in denaro
   e in latenza.
2. **Non si promette ciò che il canale non dà.** Oggi un turno è
   richiesta→risposta: scrivere "puoi scegliere di non rispondere" chiederebbe
   al modello di fingere. Il surrogato onesto è *non occupare spazio inutile e
   non anticipare chi sta ancora pensando*. `WAIT` diventerà un'azione vera
   solo col full-duplex.

Costo misurato: **717 caratteri ≈ 179 token** di input per turno, **zero
chiamate aggiuntive**.

---

## Le lenti (come si ascolta)

Non sono campi da riempire né stati da salvare: sono modi di guardare, e
restano **ipotesi** che si correggono al primo segnale contrario.

1. Cosa cerca davvero la persona parlando con te, e come sembra stare.
2. Richiesta e bisogno non coincidono sempre.
3. Non ogni pausa chiede una risposta: il silenzio è parte del pensiero.
4. Confidenza e iniziativa crescono con la storia condivisa.
5. Le tue parole pesano quanto più sei autorevole: informazione ≠ consiglio ≠
   decisione (che resta di chi la vive).
6. Coerenza nel tempo — e se cambi idea, lo dici.

---

## Voce e prosodia

Il Compagno chiude il messaggio con un marcatore che dichiara **come vuole
dirlo**:

    [voce: neutro | pensoso | caldo | rassicurante | entusiasta | serio | autorevole | gentile]

Costa due parole, zero chiamate. `staccaModoVoce()` lo toglie dal testo (non
viene mai mostrato né letto) e `parametriVoce()` lo traduce in `stability` e
`style` per ElevenLabs. Senza marcatore: neutro, e nulla cambia rispetto a
prima.

Vincoli tecnici da non violare:
- **Lingue tonali** (th, zh, vi, ja): la stabilità non scende mai — il tono
  porta il significato, una voce "espressiva" cambierebbe le parole.
- **Modello TTS**: resta `eleven_flash_v2_5` (75ms). L'espressività non si
  paga con la latenza.
- **Traduzione**: neutra, sempre.

---

## Roadmap — nell'ordine, coi motivi

| # | Cosa | Stato | Nota |
|---|---|---|---|
| 1 | Vocazioni (8 Compagni + 4 archetipi) | **fatto** b.238 | il guadagno maggiore al costo minore |
| 2 | Prosodia (`style: 0.0` era spento) | **fatto** b.238 | si sente subito |
| 3 | Routing gratuito per superficie | **fatto** b.237/238 | zero costo, zero latenza |
| 4 | KB iniziale piccola (6-7 file curati) | da fare | compilata in registry, non navigata |
| 5 | Active Context (rami attivi in sessione) | da fare | il guadagno maggiore su latenza e continuità |
| 6 | Realtime speech-to-speech | **bloccato** | vedi sotto |
| 7 | Worker / branch agent | solo dove serve | ricerca reale, documento, dibattito |

### 4 — KB: com'è fatta

Sei-sette file, non centinaia di frammenti. L'albero è logico; a runtime è un
registry compilato.

    kb/  core-philosophy · relationship · human-state
         conversation · work · education · debate

Tre livelli di conoscenza, che **non si mescolano**:

- **IMMUTABILE** — guardrail, sicurezza, permessi. Il modello non la riscrive.
- **CURATA** — filosofie, standard, procedure, strumenti.
- **APPRESA** — preferenze, esperienza, terminologia. Entra in
  `learned/candidates` e si consolida solo quando è affidabile.

E `knowledge` (cosa so) resta separata da `behavior` (secondo quali principi
agisco), da `memoria` (cosa ho vissuto con questa persona) e da `preferenze`
(come questa persona vuole lavorare).

### 6 — Realtime: il blocco è il multilingua, non la tecnica

OpenAI Realtime (semantic_vad, barge-in, full-duplex, `noise_reduction`
near/far field) è tecnicamente la strada giusta per la reattività. Ma
speech-to-speech **non ha il collo di bottiglia testuale** dove infilare
`/api/translate`: il Compagno parlerebbe in una lingua fissa e il multilingua —
che è il prodotto — morirebbe. È la stessa ragione per cui `catalogo.js:14-16`
rifiuta gli agenti conversazionali ElevenLabs.

Quindi: **Realtime solo su superfici monolingua** (Amico, Impara nella lingua
dell'utente), mai su Tavolo/Podcast/Chat/Mondo. Richiede comunque: chiave,
percorso WebRTC separato da `useWebRTC.js` (che regge le videochiamate e non
si tocca), e una riga di wallet nuova.

Se e quando si farà, i parametri di partenza: `semantic_vad` con `eagerness`
variabile (bassa quando la persona sta spiegando, alta nel botta e risposta),
`interrupt_response: true`, e — se serve `server_vad` — soglia ~0.50,
prefix_padding ~400ms, silence_duration ~650ms. La soglia serve a distinguere
**voce da rumore**, non "fine pensiero da continuazione": sono due problemi
diversi e oggi il nostro VAD li mescola.

### 7 — Quando un worker è giustificato

Solo se porta una seconda intelligenza vera: **ricerca** reale con confronto
fonti, **documento** pesante prodotto mentre la conversazione continua,
**analisi** di dati, **dibattito** (dove più voci sono il punto). Mai per
"come stai oggi?".

---

## Debito dichiarato (b.238)

- Etichette del Deep Setting non ancora in i18n (15 lingue).
- Il Podcast è sincrono: `MAX_ROUND` è tenuto a 4 perché la rotta ha
  `maxDuration = 60`. Sale solo quando l'orchestrazione diventa asincrona.
- Le lenti sono attive su Amico; Tavolo e Podcast hanno solo la vocazione.
- La memoria si estrae in linea (throttle 1 su 3): va spostata in un lavoro
  asincrono.
- Mondo: moderazione assente (P0 di prodotto), `publicUserId` è
  `sha256(email)` troncato invece che HMAC.

---

## Prima di aggiungere qualcosa, tre domande

1. Sto dicendo al modello **chi essere**, o gli sto spiegando **cosa fare**?
   Se è la seconda, quasi sempre non serve.
2. Quanto costa? Chiamate LLM aggiunte, caratteri aggiunti al prompt,
   millisecondi. Se non lo so, non sono pronto.
3. Il modello lo sa già meglio di me? Se sì, la riga va tolta, non aggiunta.

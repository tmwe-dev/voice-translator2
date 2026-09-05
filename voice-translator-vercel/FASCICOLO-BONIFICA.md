# Fascicolo di bonifica — BarTalk

> Fase 7 del Protocollo Bonifica v1.0. Le otto voci sono obbligatorie, e
> l'ottava — il debito residuo — è quella che rende il resto credibile.
>
> Aperto il 4 settembre 2026, da b.619 (45a10d6) a b.628.
> **Stato: NON CHIUSA.** Vedi §9.

BarTalk incassa denaro di altri (wallet, ricariche Stripe, crediti a
tempo). Il rigore che si applica è quindi quello della prima colonna del
Protocollo — «sistema che muove denaro» — e con quel metro si misura
anche ciò che manca.

---

## 1. Che cosa è stato tolto

Una sola asportazione, in una registrazione di sole sottrazioni.

| Cosa | Dove | Dimensione |
|---|---|---|
| `addebitaVoce`, `addebitaVocePremium`, `addebitaTesto`, `addebitaAzioneChat`, `creditoInsufficientePerClonazione`, `addebitaClonazione` | `app/wallet/addebita.js` | 40 righe |
| 4 import rimasti orfani (`costoConversazione`, `costoAzioneChat`, `costoProviderCent`, `COSTO_CLONAZIONE_SECONDI`) | `app/wallet/addebita.js` | 4 righe |

Registrazione: **b.627** (`4e91570`). Nessun'altra riga di prodotto è
stata rimossa in tutto il ciclo.

## 2. Perché — il verdetto delle tre lenti

Per le sei funzioni di §1:

| Lente | Esito |
|---|---|
| 1 — raggiungibilità | **morte**: in tutto `app/` i loro nomi comparivano solo dentro i commenti che spiegano perché non si usano più (`tts/route.js`, `voice-clone/route.js`) |
| 2 — traffico reale | non applicabile: senza chiamanti non possono girare |
| 3 — intento storico | **superato e scritto**: sostituite dal giro riserva → commit/release in b.161, b.161-bis, b.164, perché l'addebito dopo il fornitore lasciava aperta una finestra di corsa |

Tutte e tre dicono «morto»: la regola d'oro dell'incrocio è rispettata.

Classificazione (Fase 3): **duplicato** — due modi di far pagare la
stessa cosa, uno vivo e uno morto ma ancora importabile. Su un sistema
che tocca il denaro il Protocollo lo chiama per nome: *due formule per lo
stesso importo è un incidente in attesa*.

## 3. Con quale prova

**L'esecuzione a specchio è stata eseguita** (b.630). Metodo: caricate in
parallelo le due versioni — b.619 prima della bonifica e b.629 dopo — e
confrontate le uscite su **115 casi** presi dalla realtà del prodotto:
lunghezze di testo da 0 a 12.000 caratteri, durate audio da 0 a un'ora,
tutte le costanti di tariffa, e 17 domini di fonti.

| Esito | |
|---|---|
| Casi confrontati | 115 |
| Differenze totali | **4** |
| Differenze sui **numeri del denaro** | **0** |

Le quattro differenze sono tutte volute e spiegate, e sono la stessa
cosa: `paeseDaDominio` per `msn.com`, `www.msn.com`, `it.msn.com` e
`yahoo.com` restituiva `"US"` e ora restituisce `null` — è il fix della
bandiera sbagliata (b.623). Nessun preventivo, nessun costo, nessuna
tariffa è cambiata di un centesimo.

Le altre due prove della Fase 6:

- **La prova che le prove servono** — eseguita su ogni correzione del
  ciclo, non a campione: ogni fix è stato guastato di proposito e la sua
  prova è diventata rossa, poi verde ripristinando. Nove volte su nove.
- **Le quattro prove storiche che si sono accorte della rimozione.** È il
  segnale che quel codice *era* coperto. Difendevano proprietà vere sul
  denaro (pre-controllo della clonazione fail-closed; chat-action che fa
  pagare a costo fisso; preventivo e addebito che non divergono su testo
  e voce premium). Verificato una per una che ogni proprietà è ancora
  garantita — e in modo più stretto, perché oggi la riserva si prende
  prima del fornitore e col preventivo stesso come importo. Le prove sono
  state riportate sul sistema vivo, e ognuna riverificata guastando la
  proprietà: tutte e quattro tornano rosse.

Rete di prove alla consegna: **318 file, 3812 prove, 0 fallimenti**;
eslint 0 errori. Fotografia di partenza (b.619): 311 file, 3782 prove.

## 4. Che cosa NON è stato toccato, e perché

La parte che i revisori leggono per prima.

| Voce | Verdetto | Motivo |
|---|---|---|
| Costanti di listino (`PREZZO_VENDITA_CENT_MIN`, `COSTO_PROVIDER_CENT_MIN`, `COSTO_AVATAR_CENT`, `CAMBIO_EUR_USD`) | **Obbligatorio invisibile** | knip le dà per morte, ma hanno la ragione scritta accanto: «serve per calcolare margine e ore incluse». Sono i numeri del prodotto tenuti in un posto solo |
| 84 «file non usati» segnalati da knip | **Falsi positivi** | bug dello strumento già documentato in b.595. Fra loro `CreateRoomSheet`, `LifeView`, `BusinessView` — aperti a mano in produzione lo stesso giorno |
| `LIVE_TETTO_MINUTI` / `LIVE_TETTO_SECONDI` | **Alias voluti** | motivo scritto in `tariffe.js`; `LIVE_TETTO_SECONDI` è usato dalle prove |
| `/api/stripe` (410) e `/api/stripe/webhook` | **Quarantena già decisa** | disattivata dalla b.158 con motivo nel file; il webhook è dichiarato «gemello legacy» dal suo stesso commento. Confermato sui dati: un solo acquisto Stripe nel `credit_ledger` (03/08) |
| `wallet_riparazione_b614` (255 righe) | **Obbligatorio invisibile** | backup di rollback della riparazione b.614, citato in CLAUDE.md e coperto da una prova |
| Schede «Scan» e «Setup» in inglese | **Altro perimetro** | stanno nell'app sorella BizCard (`public/scanner/`), non in BarTalk |

## 5. Che cosa resta in quarantena, e fino a quando

**Scadenza unica: 3 dicembre 2026.** Criterio scritto adesso, da
applicare senza rinegoziarlo.

| In osservazione | Registro | Criterio di uscita |
|---|---|---|
| 9 tabelle Supabase a 0 righe (`mondo_comment_translations`, `mondo_title_translations`, `mondo_follows`, `compagno_memorie`, `corsi_pubblici`, `voci_lingue`, `profilo_studente`, `compiti_scansioni`, `peepoff_segnali`) | conteggio righe | se ancora a 0 il 03/12 → da «raggiungibili ma non abitate» a decisione: finirle o toglierle |
| 84 rotte API (83 contate da `withApiGuard`) | tabella `rotte_visite`, dal 04/09 | rotta a 0 visite il 03/12 → «non abitata», e solo allora si decide |

Fuori conteggio, dichiarate: `/api/mondo/live/ingest` e `/api/og` non
passano dalla guardia. Sono due, si sa che lavorano, si guardano a mano.

## 6. Come si torna indietro

| Cosa | Procedura | Tempo |
|---|---|---|
| Qualunque versione da b.620 a b.628 | rollback Vercel per repuntamento del dominio (nessuna ricostruzione) | dichiarato istantaneo da Vercel, **mai eseguito davvero** — vedi §9 |
| Registro delle visite (b.628) | `DROP TABLE rotte_visite;` + `DROP FUNCTION segna_visita_rotta;` + via la riga in `apiGuard.js` | additivo: non contiene dati di prodotto, si perde l'osservazione |
| Le 40 righe tolte in b.627 | `git revert 4e91570` | la registrazione è di sole sottrazioni, reversibile da sola |

## 7. La soglia di allarme

Decisa adesso, non in corsa. Si torna indietro **senza discutere** se,
nei sette giorni dopo una consegna:

- compare un solo errore su una rotta del **wallet** che prima non c'era;
- oppure `credit_ledger` registra un movimento che non corrisponde a una
  riserva (addebito senza riserva, o riserva senza esito);
- oppure il fail rate complessivo delle rotte API supera il **5%** su 24
  ore.

Fotografia di riferimento (Fase 0, 04/09): nessun errore di codice attivo
negli ultimi due giorni; `/api/transcribe` 132 «400 audio corrotto» in 7
giorni; Circuit OPEN Redis sporadici.

## 7-bis. La revisione indipendente (Fase 5, ultimo punto)

**Eseguita** in b.630. Il diff dei file di prodotto (1013 righe, da b.619
a b.629) è stato letto da un revisore che non lo aveva scritto, senza
dargli le conclusioni di chi aveva lavorato. Verdetto: *approvo con
riserve*. Ha trovato cinque cose che il primo giro non aveva visto, e
questo è il motivo per cui il Protocollo la pretende.

**Corrette subito, in b.630:**

1. **Buco di sicurezza introdotto in b.628.** `segna_visita_rotta` è
   `SECURITY DEFINER` — scavalca la RLS per costruzione — e in PostgreSQL
   l'EXECUTE su una funzione nuova è concesso a PUBLIC per default. In
   questo stesso repository la convenzione esiste già (migrazioni 003,
   008, 013): ogni funzione così va revocata. Non era stato fatto:
   chiunque, con la chiave pubblica che sta nel bundle del browser,
   poteva scrivere righe a piacere nel registro — cioè **avvelenare la
   misura con cui il 3 dicembre si deciderà cosa togliere**. Chiuso con
   `REVOKE EXECUTE ... FROM public, anon, authenticated` e `REVOKE ALL`
   sulla tabella. **Verificato dall'esterno con la chiave pubblica vera:
   401 `permission denied` sia in scrittura sia in lettura**, e il
   servizio continua a scrivere.
2. **Il registro non contava 8 rotte, non 1.** Il numero «83 su 84» era
   sbagliato: veniva da `scripts/inventario-api.mjs`, che conta le rotte
   non-410, non quelle che passano dalla guardia. Quelle vere sono **76**.
   Fra le otto scoperte c'era **`/api/wallet/webhook`, la rotta che
   incassa i pagamenti Stripe**: al 3 dicembre il criterio avrebbe letto
   zero visite proprio lì. Aggiunto il registro a mano alle sei rotte vive
   fuori dalla guardia (i due webhook, snapshot, registro, live, ingest).
3. **La sentinella della versione avrebbe dato un falso allarme.** La
   correzione di b.623 era a metà: la lettura del push era diventata
   facoltativa, ma il confronto no. Alla prima versione senza `(push
   #NNN)` — cioè il caso che aveva motivato la correzione — sarebbe
   diventata rossa per niente. Un falso allarme in una sentinella è
   peggio di nessuna sentinella: la si impara a ignorare.

**Dichiarate, non corrette — vedi §8:** l'affermazione «un solo modo di
far pagare» non era vera, e `costoConversazione` è rimasta orfana.

## 7-ter. I tre difetti sul denaro, e come sono stati chiusi

Il revisore indipendente (§7-bis) aveva lasciato tre cose sui soldi
dichiarate ma non corrette. L'ordine è stato: *correggi gli errori*. Tre
difetti, tre registrazioni separate — mai una sola, mai mescolate ad
altro (Protocollo, regole 3 e 4).

| | Difetto | Chi lo pagava | Chiuso in |
|---|---|---|---|
| 1 | `/api/topics/riassunto` addebitava DOPO il fornitore: finestra di corsa, due richieste concorrenti chiamavano entrambe OpenAI e una sola pagava | la piattaforma | **b.631** |
| 2 | La riserva di 5+5 centesimi sui tetti giornalieri non veniva mai restituita sulle uscite anticipate, e **mai** in `ponte.js` | l'utente, in *permesso di spendere*: 100 rifiuti = un giorno chiuso fuori | **b.632** |
| 3 | Due frasi identiche in un minuto condividevano una sola ricevuta: la seconda voce pagava anche il testo. E con Redis giù, ogni voce pagava due volte | l'utente, in denaro | **b.633** |

**Come sono state verificate.** Ognuna con la sua prova del contrario
(Protocollo, Fase 6, prova 2 — si guasta apposta il codice corretto e si
controlla che qualcosa diventi rosso): b.631 spostando la riserva dopo
la chiamata al fornitore (2 rosse), b.632 annullando lo storno e
togliendo un `finally` (3 rosse), b.633 rimettendo `SET`/`DEL` al posto
di `INCR`/`DECR` (2 rosse).

**Cinque prove storiche si sono accorte del cambiamento, e nessuna è
stata indebolita**: `wallet-sicurezza-b159` (riportata dal gate del
saldo alla riserva vera, che è più stretta), tre finti di `apiAuth` nei
collaudi della linea dal vivo (da completare con la nuova esportazione),
`wallet-sicurezza-b161` (due finestre di prossimità allargate: fra le due
righe c'è ora la nota della seconda riserva), `chi-paga` (riportata da
`DEL` a `INCR`/`DECR`, difende la stessa proprietà). Una prova che si
accorge è una prova che funziona: è il motivo per cui si scrivono.

**Due costi dichiarati, non nascosti** — entrambi in §8, voci 5 e 6.

---

## 8. Il debito residuo

Quello che si è visto e deliberatamente non fatto.

0. ~~**`/api/topics/riassunto` usa ancora il vecchio schema di
   addebito.**~~ **CORRETTO in b.631.** Riserva → commit/release, come
   tutte le altre; l'affermazione «un solo modo di far pagare» adesso è
   vera. Il testo che segue resta come diagnosi, non come stato.

   **`/api/topics/riassunto` usava ancora il vecchio schema di addebito —
   e questo rendeva FALSA l'affermazione fatta in b.627.** Trovato dal
   revisore indipendente, verificato di persona: la rotta controlla il
   credito (righe 97-104), chiama OpenAI (112), e addebita **dopo** con
   `addebitaRiassunto` (148) **ignorandone l'esito**. È esattamente la
   finestra di corsa che b.161-bis dichiarava chiusa: due richieste
   concorrenti con un secondo di credito passano entrambe il controllo,
   chiamano entrambe il fornitore, e una sola paga. Lo stesso importo
   (`costoRiassunto()`) viene incassato in due modi diversi —
   riserva/commit in `/api/summary`, addebito-dopo qui. **Non corretto
   oggi di proposito**: è un cambio di comportamento sul denaro, e merita
   la sua registrazione, non la coda di un'altra. È il primo lavoro da
   fare.
0-bis. **`costoConversazione` è rimasta senza chiamanti** dopo la
   rimozione di b.627: la tengono in vita solo tre prove. È uno zombie e
   la cura sarebbe togliere l'export — ma è una formula di prezzo, e
   toglierla di corsa nella stessa registrazione che l'ha scoperta
   sarebbe la pulizia opportunistica che il Protocollo vieta. Marcata nel
   file, in quarantena fino al 3 dicembre.

1. **`/api/transcribe`** — 132 rifiuti «audio corrotto o non supportato»
   in 7 giorni, 3 utenti. La causa non è nota: la diagnosi che doveva
   dirla è stata riparata in b.626 (era un `warn`, e i `warn` su Vercel
   durano un giorno mentre il guasto torna ogni pochi). Il dato arriverà
   col prossimo caso.
2. **`/api/tts-edge`** — 503 con ripiego funzionante su `/api/tts`. Non
   si sa quante volte la pausa di 400 ms introdotta in b.598 salvi la
   sintesi: da b.626 il conto si fa.
3. **Traduzione vocale, videochiamata, ascolto voci, clonazione** — non
   collaudabili senza microfono e secondo partecipante. Restano da
   provare a mano.
4. **Rubrica BizCard** — schede in inglese in interfaccia italiana; altro
   repository, altro giro.
5. **I compagni non contano nel tetto giornaliero di piattaforma**
   (aperto da b.632). `app/lib/compagni/ponte.js` non ha **mai** chiamato
   `trackDailySpend`: le quattro porte (testo, visione, avatar, linea dal
   vivo) non hanno mai dichiarato la loro spesa. Fino a b.632 i 5
   centesimi della riserva restavano appesi e facevano da tetto *per
   sbaglio* — con un numero che non c'entrava col costo vero e che non si
   azzerava mai. Adesso si rendono, e i compagni sono invisibili a quel
   tetto. Il controllo vero sul denaro dell'utente resta il portafoglio
   (riserva/commit, che lì c'è ed è corretto); manca il tetto aggregato
   di piattaforma. Aggiungerlo è un intervento a sé: **b.632 restituisce,
   non cambia cosa si misura**.
6. **Con Redis giù, le traduzioni di solo testo non si addebitano**
   (aperto da b.633). È il prezzo scelto per non addebitare **due volte**
   chi ha parlato: «non lo so» non può più valere «non pagato». Vale solo
   per la durata del guasto e solo per chi paga con credito di
   piattaforma. La strada per non pagare nemmeno quel prezzo esiste: una
   ricevuta **firmata dal server** (HMAC, scadenza corta) restituita da
   `/api/transcribe` e riconsegnata a `/api/translate` — nessun Redis in
   mezzo, e il client continua a non avere voce in capitolo perché non
   può falsificare la firma. Cambia il contratto fra due rotte e il
   client: merita la sua registrazione.

---

## 9. Stato rispetto alle otto fasi — e perché la bonifica NON è chiusa

Il Protocollo si dichiara chiuso solo dopo «un ciclo completo
dell'attività senza scostamenti». Non ci siamo, e i buchi vanno detti
per nome.

| Fase | Stato | Cosa manca |
|---|---|---|
| 0 — Congelamento | **incompleta** | fotografia ✓, rete di prove verde ✓ — ma **non esiste un ambiente di prova**: si lavora sulla produzione. E **il ritorno non è mai stato eseguito**: risulta disponibile su Vercel, non provato né cronometrato. Il Protocollo: «un ritorno mai provato non esiste» |
| 1 — Inventario | **fatta** | sette categorie censite (b.620, b.621) |
| 2 — Tre lenti | **parziale** | lenti 1 e 3 fatte; la lente 2 ha cominciato a raccogliere solo il 04/09 |
| 3 — Classificazione | **fatta** sulle voci esaminate | |
| 4 — Quarantena | **avviata** | scade il 03/12 |
| 5 — Asportazione | **fatta** | una registrazione di sole sottrazioni, e il diff **è stato letto da un revisore indipendente** (§7-bis) |
| 6 — Prova del contrario | **quasi completa** | la prova che le prove vedono l'assenza ✓ (nove volte); **esecuzione a specchio ✓** (115 casi, 0 differenze sul denaro); **prova del ritorno: ancora NON FATTA** |
| 7 — Consegna | questo documento | |
| 8 — Sorveglianza | **non assegnata** | il Protocollo chiede «una persona con nome» |

**Delle tre lacune dichiarate il 4 settembre, due sono chiuse:**

- ~~Nessuna esecuzione a specchio~~ → **fatta**: 115 casi, 4 differenze
  tutte volute, **zero sui numeri del denaro** (§3).
- ~~Nessun secondo paio d'occhi~~ → **fatto**: revisione indipendente sul
  diff, che ha trovato un buco di sicurezza, un conteggio sbagliato di 8
  rotte e un falso allarme in arrivo (§7-bis).

**Restano aperte:**

1. **Il ritorno non è mai stato provato.** È la regola inviolabile n. 2 —
   «non si consegna quello che non si sa spegnere». Il rollback risulta
   disponibile su Vercel, ma disponibile non è provato: finché non lo si
   esegue e cronometra, è una speranza. Provarlo per davvero significa
   riportare la produzione alla versione precedente per il tempo della
   misura: è una decisione che spetta a Luca, non a chi ha fatto il
   lavoro.
2. **Non esiste un ambiente di prova.** Si è sempre lavorato sulla
   produzione. È la ragione per cui il punto 1 costa una decisione invece
   di essere un esercizio di routine.
3. **Nessuno sorveglia con nome e cognome** (Fase 8).

**Che cosa ha insegnato la revisione indipendente**: delle cinque cose
trovate, tre erano difetti che il primo giro non poteva vedere — e uno
era un buco di sicurezza aperto *dallo strumento stesso della bonifica*,
il registro nato per misurare. È la dimostrazione pratica della regola:
chi ha tolto è la persona meno adatta a controllare cosa ha tolto.

Finché il ritorno non è provato, il lavoro fatto è buono e ora anche
verificato da altri occhi, ma **non è una bonifica firmata**. È una
bonifica in corso, con la quarantena che conta e la data sul calendario.

> *Non si consegna un sistema perché funziona. Si consegna quando si sa
> che cosa contiene, perché ogni pezzo c'è, come dimostrarlo, e come
> tornare indietro.*

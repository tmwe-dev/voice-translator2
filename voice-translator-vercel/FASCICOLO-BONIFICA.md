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

**L'esecuzione a specchio non è stata fatta** (vedi §9, è la lacuna più
seria). Le altre due prove della Fase 6 sì:

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

## 8. Il debito residuo

Quello che si è visto e deliberatamente non fatto.

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
| 5 — Asportazione | **fatta una volta** | ma il diff **non è stato letto da qualcuno che non l'ha scritto**, e per un sistema che muove denaro il Protocollo chiede un secondo revisore indipendente |
| 6 — Prova del contrario | **parziale** | la prova che le prove vedono l'assenza ✓ (nove volte); **esecuzione a specchio: NON FATTA**; **prova del ritorno sulla versione finale: NON FATTA** |
| 7 — Consegna | questo documento | |
| 8 — Sorveglianza | **non assegnata** | il Protocollo chiede «una persona con nome» |

**Le tre lacune che contano**, in ordine:

1. **Il ritorno non è mai stato provato.** È la regola inviolabile n. 2 —
   «non si consegna quello che non si sa spegnere». Oggi è una speranza,
   non un piano.
2. **Nessuna esecuzione a specchio.** Su un sistema che muove denaro è
   obbligatoria a zero differenze. Le 3812 prove verdi non la
   sostituiscono: usano l'immaginazione di chi le ha scritte, non la
   realtà.
3. **Nessun secondo paio d'occhi.** Chi ha tolto è la persona meno adatta
   a controllare cosa ha tolto — e in questo ciclo chi ha tolto e chi ha
   verificato sono lo stesso.

Finché queste tre restano aperte, il lavoro fatto è buono ma **non è una
bonifica firmata**. È una bonifica in corso, con la quarantena che conta
e la data segnata sul calendario.

> *Non si consegna un sistema perché funziona. Si consegna quando si sa
> che cosa contiene, perché ogni pezzo c'è, come dimostrarlo, e come
> tornare indietro.*

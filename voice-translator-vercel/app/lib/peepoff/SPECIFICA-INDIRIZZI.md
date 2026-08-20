# PeepOff · Specifica degli Indirizzi — v1
### Il primo mattone del protocollo (b.349). Una pagina, definitiva.

1. **Canonicalizzazione email** — minuscolo, spazi tolti, UNA sola `@`;
   locale `[a-z0-9._+-]{1,64}`, dominio `[a-z0-9.-]{1,253}\.[a-z]{2,}`.
   Il dominio NON si riscrive (gmail.com resta gmail.com).
2. **Trasformazione** — l'unica `@` diventa `#`. Deterministica e reversibile:
   `luca@tmwe.it ⇄ luca#tmwe.it`. Nessun altro formato è valido.
3. **Claim dell'address** — un address si OTTIENE, mai si dichiara: lo assegna
   il servizio derivandolo dall'email di una sessione autenticata. Il client
   non può chiedere un address diverso dal proprio.
4. **Prova del controllo** — la prova è il login con email verificata
   (oggi: la verifica d'accesso BarTalk; domani qualunque ponte d'identità
   equivalente). Senza prova, niente claim.
5. **Identità permanente** — l'address è l'ALIAS di scoperta; l'identità è la
   coppia di chiavi del dispositivo, riassunta dall'IMPRONTA (SHA-256 della
   chiave di firma). I rapporti di fiducia si ancorano all'impronta, mai
   all'address. (v2: PID di account sopra i dispositivi, per il multi-device.)
6. **Cambio email** — nuova email verificata ⇒ nuovo alias sulla STESSA
   identità: le chiavi non cambiano, l'impronta resta, i contatti non vedono
   alcun allarme. L'alias vecchio si spegne (non risolve più).
7. **Revoca** — un dispositivo si revoca togliendone le chiavi dal registro:
   da quel momento non risolve e non riceve segnali. Le chiavi private,
   non estraibili, muoiono col dispositivo.
8. **Riassegnazione** — se un'email cambia proprietario, il nuovo può fare
   claim: l'address risolve a chiavi NUOVE con impronta NUOVA. Chi aveva
   rapporti col vecchio vede l'allarme "impronta cambiata": è il meccanismo
   che rende la riassegnazione visibile invece che silenziosa.
9. **Risolutore** — un'unica domanda ammessa: «questo address ESATTO esiste,
   e con quali chiavi pubbliche e presenza?». Risposta minima:
   ESISTE (+dispositivi: chiavi pubbliche, impronta, presente sì/no) o
   NON ESISTE. Nient'altro.
10. **Privacy del risolutore** — autenticato; tetto di frequenza severo;
    nessuna ricerca parziale, nessun completamento, nessun elenco, nessuno
    scarico di directory. La domanda "chi c'è su PeepOff?" non ha una via.
11. **URI** — il cancelletto negli URL è il fragment: MAI `…/luca#tmwe.it`
    nudo. Forme canoniche: `peepoff:luca#tmwe.it` (schema dedicato) e
    `https://…/a/luca%23tmwe.it` (percento-codificato). Per l'occhio umano
    resta sempre `luca#tmwe.it`.
12. **NON REGISTRATO** — il client può proporre UN invito alla email
    corrispondente (`#`→`@`), senza mai includere il contenuto del messaggio.
    Il messaggio resta cifrato nella coda del mittente finché il destinatario
    non esiste e non è presente.

**Il server conosce**: address, chiavi pubbliche, impronte, presenza, segnali
d'aggancio a vita breve. **Il server non conosce mai**: oggetto, corpo,
allegati, ricevute, rubrica, contenuti di qualunque natura.

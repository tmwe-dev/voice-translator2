// ═══════════════════════════════════════════════════════════════
// LA CODA DELLE VOCI — preparare avanti, parlare in ordine (b.111)
//
// ── COSA C'ERA PRIMA, DETTO CON PRECISIONE ──
//
// Nella stanza l'ordine era GIA garantito: processAudioQueue girava un
// ciclo solo, con un `await` per voce, e una voce cominciava a essere
// preparata solo quando la precedente aveva finito di suonare. Chi
// diceva che le voci potevano uscire scambiate guardava il rischio
// giusto nel posto sbagliato.
//
// Il difetto vero era un altro, e si sentiva: fra una frase e l'altra
// c'era ARIA MORTA. Il tempo di andare a prendere l'audio della frase
// successiva — mezzo secondo, a volte un secondo intero — passava in
// silenzio, perche non si cominciava nemmeno a cercarlo prima che la
// frase in corso fosse finita. In una conversazione a due lingue quel
// silenzio arriva a ogni battuta, e fa sembrare lento un programma che
// lento non e.
//
// E in SpeakerView (il telefono appoggiato sul tavolo fra due persone)
// l'ordine invece NON era garantito per niente: si chiamava playTTS
// senza aspettare e senza coda, quindi due frasi dette in fretta
// partivano insieme e si sovrapponevano.
//
// ── COSA FA QUESTA ──
//
// Separa PREPARARE da PARLARE.
//   · si prepara in anticipo, in parallelo — mentre la voce corrente
//     sta ancora parlando;
//   · si parla in ordine di arrivo, sempre, una alla volta.
//
// Ordine garantito e niente aria morta: sono due proprieta diverse e
// prima se ne aveva una sola.
//
// ── I LIMITI, MESSI APPOSTA ──
//
// ANTICIPO = 2: si preparano al massimo due voci avanti. Senza tetto,
// una raffica di messaggi lancerebbe venti richieste insieme — e
// ognuna costa, perche la voce si paga.
//
// Se una voce non si riesce a preparare, si SALTA e si va avanti. Una
// conversazione che si ferma perche una frase non si e caricata e
// peggio di una frase mancante.
// ═══════════════════════════════════════════════════════════════

const ANTICIPO = 2;

export function creaCodaAudio({ anticipo = ANTICIPO } = {}) {
  /** @type {Array<{chiave:string, prepara:Function, suona:Function, materiale:Promise|null}>} */
  let coda = [];
  let inCorso = false;
  let fermata = false;

  // Avvia la preparazione delle prime `anticipo` voci non ancora
  // avviate. Si chiama a ogni accodamento e dopo ogni voce suonata.
  function preparaAvanti() {
    let avviate = 0;
    for (const voce of coda) {
      if (avviate >= anticipo) break;
      if (!voce.materiale) {
        // Il `.catch` qui e obbligatorio: e una promessa che nessuno
        // sta ancora aspettando, e se fallisse farebbe rumore.
        voce.materiale = Promise.resolve()
          .then(() => voce.prepara())
          .catch((e) => ({ fallita: true, errore: e }));
      }
      avviate++;
    }
  }

  async function gira() {
    if (inCorso) return;
    inCorso = true;
    try {
      while (coda.length > 0 && !fermata) {
        const voce = coda[0];
        preparaAvanti();                 // le prossime si scaldano intanto
        const materiale = await voce.materiale;
        coda.shift();
        if (fermata) break;
        if (!materiale || materiale.fallita) continue;  // si salta, non ci si ferma
        try {
          await voce.suona(materiale);
        } catch {
          // Una voce che non suona non deve zittire quelle dopo.
        }
      }
    } finally {
      inCorso = false;
    }
  }

  return {
    /**
     * Mette una voce in coda.
     * @param chiave   identificativo (serve a non accodare due volte)
     * @param prepara  () => Promise<materiale>  — parte subito, in parallelo
     * @param suona    (materiale) => Promise    — parte quando e il suo turno
     */
    accoda(chiave, prepara, suona) {
      if (fermata) return false;
      if (chiave && coda.some((v) => v.chiave === chiave)) return false;
      coda.push({ chiave, prepara, suona, materiale: null });
      preparaAvanti();
      gira();
      return true;
    },

    /** Quante voci aspettano il proprio turno. */
    inCoda() {
      return coda.length;
    },

    /** Sta parlando? */
    attiva() {
      return inCorso;
    },

    /** Si esce dalla stanza: quello che non ha ancora parlato tace. */
    svuota() {
      coda = [];
    },

    /** Come svuota, ma taglia anche il giro in corso. */
    ferma() {
      fermata = true;
      coda = [];
    },

    /** Si ricomincia (nuova stanza, nuova conversazione). */
    riprendi() {
      fermata = false;
    },
  };
}

export const COSTANTI_CODA_AUDIO = { ANTICIPO };

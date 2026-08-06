// ═══════════════════════════════════════════════════════════════
// POSTA IN USCITA — i messaggi che non sono ancora partiti (b.111)
//
// IL GUASTO. In modalita Direct il messaggio viaggia SOLO sul canale
// diretto fra i due telefoni: niente server, niente Realtime, per
// scelta — e la promessa di riservatezza. Ma chi lo spediva faceva
// cosi:
//
//     try { sendDirectMessage({ type: 'chat-message', ... }); } catch {}
//
// e sendEncrypted, se il canale non era aperto, rispondeva `false`.
// Nessuno guardava quel `false`. Il messaggio compariva nella propria
// chat con la spunta di inviato, e non era partito. Non c'era una
// copia da nessuna parte: era perso e basta.
//
// Succedeva in due momenti molto comuni, non in casi limite:
//   · il primo secondo dopo essersi collegati, mentre le due chiavi si
//     stanno ancora scambiando (in Direct sendEncrypted SOLLEVA, e il
//     catch vuoto se lo mangiava);
//   · ogni volta che la rete cade un istante e il canale si richiude.
//
// LA CURA. Se non e partito, si tiene da parte e si riprova quando il
// canale torna aperto. Come una lettera che resta sullo scrittoio
// finche non passa il postino.
//
// Tre cose per non peggiorare le cose:
//   · un TETTO: cinquanta lettere. Oltre, si butta la piu vecchia —
//     una posta che cresce all'infinito e una perdita di memoria con
//     un altro nome.
//   · una SCADENZA: cinque minuti. Recapitare una frase di venti
//     minuti fa in mezzo a un altro discorso confonde e basta.
//   · nessun DOPPIONE: ogni lettera ha la sua chiave.
//
// Volutamente NON persiste su disco: in Direct non si scrive niente da
// nessuna parte, e questo vale anche per il telefono.
// ═══════════════════════════════════════════════════════════════

const TETTO = 50;
const SCADENZA_MS = 5 * 60 * 1000;

export function creaPostaInUscita({ tetto = TETTO, scadenzaMs = SCADENZA_MS } = {}) {
  /** @type {Array<{chiave: string, busta: any, quando: number}>} */
  let coda = [];

  const nonScadute = (ora) => coda.filter((l) => ora - l.quando < scadenzaMs);

  return {
    /**
     * Mette da parte una lettera non partita.
     * @param chiave identificativo unico (l'id del messaggio)
     */
    accoda(chiave, busta) {
      if (!chiave) return false;
      const ora = Date.now();
      coda = nonScadute(ora);
      if (coda.some((l) => l.chiave === chiave)) return false;
      coda.push({ chiave, busta, quando: ora });
      // La piu vecchia esce per prima: chi aspetta da di piu ha meno
      // probabilita di essere ancora utile a chi legge.
      while (coda.length > tetto) coda.shift();
      return true;
    },

    /**
     * Riprova a spedire tutto. `spedisci` deve restituire (o risolvere
     * a) qualcosa di vero se la lettera e partita davvero.
     * Quello che non parte resta in coda per il giro dopo.
     * @returns {Promise<{partite: number, rimaste: number}>}
     */
    async svuota(spedisci) {
      const ora = Date.now();
      const daFare = nonScadute(ora);
      coda = [];
      let partite = 0;
      const respinte = [];
      for (const lettera of daFare) {
        let riuscita = false;
        try {
          riuscita = (await spedisci(lettera.busta)) !== false;
        } catch {
          riuscita = false;
        }
        if (riuscita) partite++;
        else respinte.push(lettera);
      }
      // Chi non e partito torna in coda, con la sua ora originale: cosi
      // la scadenza conta da quando e stato scritto, non da adesso.
      coda = respinte.concat(coda).slice(-tetto);
      return { partite, rimaste: coda.length };
    },

    /** Quante lettere aspettano (le scadute non contano). */
    quante() {
      return nonScadute(Date.now()).length;
    },

    /** Le chiavi in attesa: servono alla chat per segnare "in attesa". */
    chiaviInAttesa() {
      return nonScadute(Date.now()).map((l) => l.chiave);
    },

    /** Si esce dalla stanza: la posta non segue in un'altra conversazione. */
    azzera() {
      coda = [];
    },
  };
}

export const COSTANTI_POSTA = { TETTO, SCADENZA_MS };

// ═══════════════════════════════════════════════════════════════
// LA MODALITA DIRETTA, FATTA RISPETTARE DAVVERO (b.111)
//
// ── COS'ERA, DETTO SENZA GIRI ──
//
// La modalita Diretta prometteva: nessun contenuto passa dai nostri
// server. Il meccanismo c'era, sulla carta, ed era anche ben fatto:
//
//   · dodici rotte chiamavano `assertCloudProcessingAllowed(req)`;
//   · quella funzione legge l'intestazione `x-session-mode`;
//   · se vale "direct", risponde 403 e non elabora niente.
//
// Manca un pezzo, e senza quel pezzo il resto non vale nulla:
//
//   NESSUNA RIGA DEL PROGRAMMA MANDAVA QUELL'INTESTAZIONE.
//
// Cercata in tutto il codice: zero occorrenze fuori da sessionGuard.js.
// La guardia non e mai scattata. Nemmeno una volta. Le dodici rotte
// erano protette da una condizione che non poteva diventare vera.
//
// C'era anche un elenco, `BLOCKED_IN_DIRECT`, con dentro le rotte da
// non chiamare mai in modalita Diretta. Nessun file lo importava.
//
// Conseguenza pratica: in modalita Diretta la voce registrata partiva
// lo stesso verso /api/transcribe, e il testo verso le rotte della
// sintesi vocale. Il testo scritto no — quello era davvero fermato,
// perche useTranslationAPI controlla la modalita per conto suo. Quindi
// la promessa era vera per la chat scritta e falsa per la voce, che e
// poi la ragione per cui esiste questo programma.
//
// ── PERCHE SI TOCCA `fetch` ──
//
// La strada pulita sarebbe un `chiamaApi()` da usare ovunque. Ma
// "ovunque" sono quaranta punti sparsi, e il difetto che stiamo
// curando e nato esattamente cosi: qualcuno doveva ricordarsi di fare
// una cosa in quaranta posti, e non se l'e ricordato.
//
// Una promessa sulla riservatezza non puo dipendere dalla memoria di
// chi scrive la prossima riga. Qui si mette un solo cancello, davanti
// a tutti: qualunque richiesta parta, da qualunque punto, passa di qua.
// Chi aggiungera una rotta domani sara protetto senza saperlo.
// ═══════════════════════════════════════════════════════════════

// b.139 — prima si importava l'elenco e si riscriveva qui il confronto
// (`p === r || p.startsWith(...)`), e la stessa riga non esisteva da
// nessun'altra parte: il server non poteva usarla nemmeno volendo.
// Ora la regola, l'elenco e la normalizzazione vengono da un posto solo.
import {
  rottaVietataInDiretta,
  normalizzaModalita,
  eModalitaDiretta,
} from './decisioni.js';

let modaleCorrente = 'translate';
let cancelloMontato = false;

/** La modalita in corso: la legge il cancello a ogni richiesta. */
export function modalitaCorrente() {
  return modaleCorrente;
}

/** Cambia modalita. Da chiamare quando si entra in una conversazione. */
export function impostaModalita(modo) {
  modaleCorrente = normalizzaModalita(modo);
  return modaleCorrente;
}

const eNostra = (url) => {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

const percorso = (url) => {
  try { return new URL(url, window.location.origin).pathname; } catch { return ''; }
};

export class RichiestaVietataInDiretta extends Error {
  constructor(rotta) {
    super(`Modalita Diretta: ${rotta} non puo essere chiamata.`);
    this.name = 'RichiestaVietataInDiretta';
    this.rotta = rotta;
  }
}

/**
 * Monta il cancello davanti a fetch. Si chiama una volta all'avvio.
 * Fa due cose, e la seconda non sostituisce la prima:
 *
 *  1. AGGIUNGE `x-session-mode` a ogni richiesta verso le NOSTRE rotte.
 *     Cosi la guardia sul server, che finora dormiva, si sveglia — ed e
 *     lei la difesa vera, perche il server non si fida del client.
 *
 *  2. NON FA NEMMENO PARTIRE le richieste vietate. Non e ridondanza
 *     inutile: in modalita Diretta il contenuto non deve nemmeno
 *     ATTRAVERSARE la rete verso di noi. Un 403 arriva dopo che il
 *     corpo della richiesta e gia stato spedito.
 */
export function montaCancelloDiretta() {
  if (cancelloMontato || typeof window === 'undefined' || !window.fetch) return false;
  cancelloMontato = true;

  const fetchOriginale = window.fetch.bind(window);

  window.fetch = function (risorsa, opzioni = {}) {
    const url = typeof risorsa === 'string' ? risorsa : risorsa?.url || '';
    if (!eNostra(url)) return fetchOriginale(risorsa, opzioni);

    const modo = modaleCorrente;
    if (eModalitaDiretta(modo)) {
      if (rottaVietataInDiretta(percorso(url))) {
        // Si risponde come avrebbe risposto il server, cosi chi chiama
        // non ha bisogno di sapere che il blocco e avvenuto prima.
        return Promise.resolve(new Response(
          JSON.stringify({ error: 'Modalita Diretta: elaborazione sul server non consentita', direct: true }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ));
      }
    }

    const intestazioni = new Headers(opzioni.headers || (typeof risorsa !== 'string' ? risorsa.headers : undefined) || {});
    intestazioni.set('x-session-mode', modo);
    return fetchOriginale(risorsa, { ...opzioni, headers: intestazioni });
  };

  return true;
}

/** Solo per i test: rimette fetch com'era. */
export function smontaCancello(fetchOriginale) {
  cancelloMontato = false;
  if (fetchOriginale) window.fetch = fetchOriginale;
}

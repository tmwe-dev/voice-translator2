// ═══════════════════════════════════════════════════════════════
// CHI FALLISCE UNA VOLTA RIPROVA (b.122)
//
// ── DA DOVE ARRIVA ──
//
// Luca lo ha detto meglio di qualunque audit: la videochiamata e la
// chat funzionano, sono "le altre cose" che non vanno alla perfezione.
// Cercando il perche, il caso esemplare stava in useElevenLabsSync:
//
//     useEffect(() => {
//       if (auth.canUseElevenLabs && auth.elevenLabsVoices.length === 0) {
//         fetch('/api/tts-elevenlabs?action=voices')
//           .then(...)
//           .catch(e => console.warn(...));
//       }
//     }, [auth.canUseElevenLabs]);
//
// Se quella fetch falliva una volta — un singhiozzo di rete, un 429 —
// l'elenco restava vuoto e l'effetto NON ripartiva piu, perche la sua
// unica dipendenza non cambiava. Per tutta la sessione: niente voci
// premium, nessun avviso, un `console.warn` che non legge nessuno.
//
// ── PERCHE COLPISCE SOLO LE COSE LATERALI ──
//
// Video e chat si usano di continuo: se si rompono lo sai in cinque
// secondi. Le voci premium le apri una volta ogni tanto — e quando non
// ci sono, sembra che "a volte non funzionino". Non e casuale: e un
// fallimento singolo che nessuno ha mai ritentato.
//
// Il difetto non e la fetch che fallisce. Le fetch falliscono, e
// normale. Il difetto e ARRENDERSI AL PRIMO NO e non dirlo a nessuno.
//
// ── LE TRE REGOLE ──
//
//  1. si riprova, con attese crescenti: un guasto passeggero si risolve
//     da solo, e martellare subito peggiora le cose (il 429 diventa un
//     429 piu lungo);
//  2. non si riprova all'infinito: dopo l'ultimo tentativo si SMETTE e
//     si dice che si e smesso;
//  3. i "no" definitivi non si ritentano: un 401 o un 403 non
//     cambieranno idea al terzo tentativo, e riprovare vuol dire solo
//     far aspettare l'utente per niente.
// ═══════════════════════════════════════════════════════════════

/** Un no definitivo: riprovare non cambierebbe la risposta. */
const DEFINITIVI = [400, 401, 403, 404, 422];

export function eDefinitivo(stato) {
  return DEFINITIVI.includes(stato);
}

/**
 * Riprova finche non riesce, o finche non e chiaro che non riuscira.
 *
 * @param tentativo funzione che fa il lavoro. Se solleva, si riprova.
 *        Puo sollevare un errore con `.stato` per dire "e definitivo".
 * @param opzioni.volte quanti tentativi in tutto (default 3)
 * @param opzioni.attesaMs attesa iniziale, poi raddoppia (default 800)
 * @param opzioni.suRinuncia chiamata UNA volta se si esaurisce tutto:
 *        e il punto in cui il silenzio diventa una parola.
 * @param opzioni.dormi iniettabile, cosi i test non aspettano davvero
 */
export async function conRiprova(tentativo, opzioni = {}) {
  const {
    volte = 3,
    attesaMs = 800,
    suRinuncia = null,
    dormi = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = opzioni;

  let ultimoErrore = null;

  for (let n = 1; n <= volte; n++) {
    try {
      return await tentativo(n);
    } catch (errore) {
      ultimoErrore = errore;

      // Un no definitivo interrompe subito: insistere e solo far
      // aspettare l'utente per una risposta che non cambia.
      if (errore && eDefinitivo(errore.stato)) break;

      // Dopo l'ultimo tentativo non si dorme: non c'e piu niente dopo.
      if (n < volte) await dormi(attesaMs * 2 ** (n - 1));
    }
  }

  if (suRinuncia) {
    try {
      suRinuncia(ultimoErrore);
    } catch (e) {
      // Se anche l'avviso fallisce non si trascina giu tutto il resto:
      // resterebbe comunque l'errore vero da restituire qui sotto.
      if (typeof console !== 'undefined') console.warn('[riprova] avviso fallito:', e?.message);
    }
  }
  throw ultimoErrore;
}

/**
 * Come sopra ma per una fetch: trasforma le risposte non-ok in errori
 * con `.stato`, cosi `conRiprova` sa distinguere "riprova" da "lascia
 * stare". Senza questo, un 403 verrebbe ritentato tre volte.
 */
export async function fetchConRiprova(url, init = {}, opzioni = {}) {
  return conRiprova(async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const e = new Error(`richiesta fallita: ${res.status}`);
      e.stato = res.status;
      throw e;
    }
    return res;
  }, opzioni);
}

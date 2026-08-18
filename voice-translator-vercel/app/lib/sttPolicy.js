// ═══════════════════════════════════════════════════════════════
// UNA SOLA DECISIONE SULLA DETTATURA (b.247)
//
// ── PERCHE ESISTE QUESTO FILE ──
//
// La domanda «quale motore di dettatura (voce→testo) puo essere usato»
// aveva DUE risposte scritte in due posti che non si parlavano, e le
// due risposte erano OPPOSTE:
//
//   · useDeepgramSTT.js forzava `deepgramAvailableRef.current = false`
//     (b.172, su richiesta esplicita dell'utente: «non voglio
//     Deepgram»), cosi il ramo Deepgram di useTranslation.js non
//     scattava mai e nessuna richiesta partiva verso il fornitore.
//   · useStreamingInterpreter.js, nello stesso pacchetto del browser,
//     chiamava lo stesso `/api/stt-token` e apriva lo stesso WebSocket
//     verso Deepgram, ignorando quella decisione.
//
// Il risultato non era «meta acceso»: era che leggendo un file solo si
// concludeva la cosa sbagliata. Chi avesse letto useDeepgramSTT.js
// avrebbe giurato che Deepgram fosse spento ovunque; chi avesse letto
// l'interprete avrebbe giurato il contrario. Nessuno dei due mentiva.
// E la stessa trappola gia costata tempo con `siConservanoIMessaggi`
// in decisioni.js: due copie che non sono «una giusta e una sbagliata»,
// sono solo diverse, e divergono in silenzio.
//
// Qui la risposta e UNA, ed e una funzione PURA: nessuna rete, nessuno
// stato, nessun hook. Cosi la puo importare qualunque file senza
// trascinarsi dietro nulla, e cambiare idea si fa in un punto solo.
//
// ── COSA DICE LA REGOLA, OGGI ──
//
// La decisione dipende dall'USO, non dal file che la chiede:
//
//   · TRADUZIONE (il microfono della schermata normale, useTranslation
//     → useDeepgramSTT): Deepgram NON e ammesso. Motivo, da b.172: in
//     produzione `/api/stt-token` falliva (401/403 di identita e
//     soprattutto 503, perche la creazione della chiave temporanea
//     Deepgram non andava — chiave assente, senza permesso o a quota),
//     e quei fallimenti riempivano la console di «high error count».
//     La dettatura non si perde: restano il riconoscimento del browser
//     e soprattutto Whisper (/api/transcribe, OpenAI, gia pagato), che
//     funziona anche su telefono.
//
//   · INTERPRETE (faccia-a-faccia, useStreamingInterpreter): Deepgram
//     resta ammesso. Motivo: qui serve lo streaming continuo con
//     risultati parziali (i sottotitoli che compaiono mentre parli), e
//     Whisper a blocchi da 3 secondi non lo sa fare — e infatti la via
//     di ripiego, quando Deepgram non risponde. Se anche la chiave
//     manca, l'interprete degrada da solo sulla pipeline a blocchi.
//
// Questo file NON cambia il comportamento del programma rispetto a
// prima: lo mette per iscritto una volta sola. Per riaccendere
// Deepgram anche sulla traduzione si aggiunge MOTORE.DEEPGRAM alla
// riga TRADUZIONE qui sotto — e non serve toccare nessun hook.
// ═══════════════════════════════════════════════════════════════

/** I motori di dettatura conosciuti dal programma. */
export const MOTORE = {
  DEEPGRAM: 'deepgram',   // WebSocket streaming, fornitore esterno
  WHISPER: 'whisper',     // /api/transcribe (OpenAI), a blocchi
  BROWSER: 'browser',     // SpeechRecognition del dispositivo
};

/** A cosa serve la dettatura in quel momento. */
export const USO = {
  TRADUZIONE: 'traduzione',   // microfono della schermata normale
  INTERPRETE: 'interprete',   // modalita faccia-a-faccia
};

// L'ordine conta: il primo di ogni riga e il motore preferito, gli
// altri sono le vie di ripiego nell'ordine in cui vanno provate.
const AMMESSI = {
  [USO.TRADUZIONE]: [MOTORE.WHISPER, MOTORE.BROWSER],
  [USO.INTERPRETE]: [MOTORE.DEEPGRAM, MOTORE.WHISPER],
};

/**
 * I motori ammessi per quell'uso, in ordine di preferenza.
 * Un uso sconosciuto non e un errore: non ammette niente, cosi chi
 * sbaglia il nome non si ritrova acceso un motore che non voleva.
 * @param {string} uso — una delle costanti USO
 * @returns {string[]}
 */
export function motoriAmmessi(uso) {
  return [...(AMMESSI[uso] || [])];
}

/**
 * Quel motore e ammesso per quell'uso?
 * @param {string} motore — una delle costanti MOTORE
 * @param {string} uso — una delle costanti USO
 * @returns {boolean}
 */
export function motoreAmmesso(motore, uso) {
  return motoriAmmessi(uso).includes(motore);
}

/**
 * Scorciatoia per la sola domanda che oggi si fanno i due hook.
 * @param {string} uso — una delle costanti USO
 * @returns {boolean}
 */
export function deepgramAmmesso(uso) {
  return motoreAmmesso(MOTORE.DEEPGRAM, uso);
}

/**
 * Il motore da provare per primo, o null se per quell'uso non ne e
 * ammesso nessuno.
 * @param {string} uso — una delle costanti USO
 * @returns {string|null}
 */
export function motorePreferito(uso) {
  return motoriAmmessi(uso)[0] || null;
}

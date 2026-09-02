// b.599 — I NOMI DEGLI EVENTI, IN UN POSTO SOLO.
//
// Fino a qui ogni evento `bartalk:*` (finestra) e ogni tipo di messaggio
// `interpreter-*` (DataChannel fra i due interpreti) era una stringa
// scritta a mano in 9 file diversi. L'audit di architettura b.598 ha
// contato le conseguenze: un evento lanciato che NESSUNO ascoltava
// (`bartalk:voce-non-disponibile`), due contratti diversi per lo stesso
// caso («voce mancata»), e un refuso in una stringa sarebbe stato un
// guasto muto — nessuna prova lo avrebbe trovato.
//
// Qui non c'e' logica: solo nomi e due aiutanti minuscoli per lanciare
// gli eventi piu' usati, con la stessa guardia (`try`) che prima era
// copiata in cinque posti. Chi ascolta importa il nome da qui, chi
// lancia importa il nome da qui: un refuso diventa un errore di import.

// ── Eventi di finestra (window.dispatchEvent) ──
export const EVENTO = Object.freeze({
  /** la voce TRADOTTA sta suonando (detail: { attivo }) */
  TTS: 'bartalk:tts',
  /** l'utente LOCALE sta parlando (detail: { parlando }) — b.598 */
  VOCE_LOCALE: 'bartalk:voce-locale',
  /** il cursore del volume voce e' stato mosso: chi suona si adegua */
  VOL_TTS: 'bartalk:vol-tts',
  /** nessun motore vocale ha risposto (storico: nessun ascoltatore; il
   *  contratto vero e' MSG.VOCE_MANCATA + stato voceGuasta) */
  VOCE_NON_DISPONIBILE: 'bartalk:voce-non-disponibile',
  /** cambio strato del globo (Mondo) */
  MONDO_LAYER: 'bartalk:mondo-layer',
  /** modo dell'interprete video (Mondo) */
  INTERPRETE_VIDEO_MODO: 'bartalk:interprete-video-modo',
});

// ── Messaggi sul DataChannel fra i due interpreti ──
export const MSG = Object.freeze({
  SOTTOTITOLO: 'interpreter-subtitle',
  AUDIO: 'interpreter-audio',
  AUDIO_PARTE: 'interpreter-audio-part',
  VOCE_MANCATA: 'interpreter-voce-mancata',
});

/** Lancia un evento di finestra senza mai far cadere chi lo lancia
 *  (fuori dal browser, o con un ascoltatore che scoppia, si prosegue). */
export function lancia(nome, detail) {
  try {
    if (typeof window === 'undefined') return false;
    window.dispatchEvent(detail === undefined ? new CustomEvent(nome) : new CustomEvent(nome, { detail }));
    return true;
  } catch {
    return false;
  }
}

/** la voce tradotta comincia (true) o finisce (false) di suonare */
export const avvisaTTS = (attivo) => lancia(EVENTO.TTS, { attivo: !!attivo });
/** l'utente locale comincia (true) o smette (false) di parlare */
export const avvisaVoceLocale = (parlando) => lancia(EVENTO.VOCE_LOCALE, { parlando: !!parlando });

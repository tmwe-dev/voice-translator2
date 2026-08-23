// ═══════════════════════════════════════════════════════════════
// LA VOCE DI SISTEMA — l'ultimo ripiego, e finalmente in un posto solo
// (b.417)
//
// Questo codice esisteva gia, e funziona: stava dentro `useTTSEngine`,
// che e il motore della Stanza e del Taxi. E' stato SPOSTATO qui senza
// cambiarne la logica, per un motivo preciso.
//
// IL DIFETTO CHE LO HA RESO NECESSARIO. In produzione, oggi:
// «Edge TTS: sintesi riuscita ma audio vuoto» — 32 volte, 5 persone,
// l'ultima alle 10:18. Non e un guasto nostro (dieci lingue provate a
// mano rispondono con audio vero): e il fornitore che ogni tanto
// consegna zero byte. Cio che e nostro e COME reagiamo.
//
// La Stanza e il Taxi reagiscono bene: se il fornitore tace ripiegano,
// e alla fine ripiegano QUI. La Prima prova no — e la Prima prova e la
// prima cosa che tocca chi apre l'app. Restava muta e non lo diceva.
//
// Il commento di b.356 in PrimaProva PROMETTEVA gia questo ripiego («si
// ripiega sulla voce di sistema: meglio una voce che nessuna voce»), ma
// il codice ripiegava su /api/tts-edge, che e un'altra cosa: e un
// SERVER, non il telefono. La promessa era scritta e non mantenuta.
//
// PERCHE' NON /api/tts (OpenAI), che e il ripiego della Stanza: quella
// rotta passa dal portafoglio (`resolveAuth`, riserva/commit/release) e
// senza gettone risponde 401. Portarla nella Prima prova vorrebbe dire
// far spendere credito a chi sta solo provando l'app — una decisione di
// prodotto, non una riparazione. La voce del telefono non costa niente
// e non chiede permesso a nessuno.
//
// COSA RESTITUISCE, e conta: `true` solo se la voce E' PARTITA davvero
// (`onstart`), non se la funzione e stata chiamata. E' la lezione di
// b.262: «finito» e «mai partito» erano indistinguibili, e un telefono
// con l'audio bloccato sembrava aver parlato. Chi chiama deve poter
// distinguere, o torna a fingere.
// ═══════════════════════════════════════════════════════════════

// Le voci del telefono arrivano in modo asincrono (Chrome) e cambiano
// quando il sistema ne installa di nuove: la cache va svuotata, non
// tenuta per sempre.
let cacheVoci = {};
let ascoltoInstallato = false;

/** Svuota la cache delle voci. La chiama chi ascolta `voiceschanged`. */
export function svuotaCacheVoci() { cacheVoci = {}; }

/**
 * Prepara le voci del sistema e si iscrive ai loro cambiamenti.
 * Idempotente: chiamarla dieci volte installa un ascoltatore solo.
 */
export function preparaVociSistema() {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.getVoices();
  if (ascoltoInstallato) return;
  ascoltoInstallato = true;
  try { speechSynthesis.addEventListener('voiceschanged', svuotaCacheVoci); } catch { /* browser antico: pazienza, la cache si scalda comunque */ }
}

/**
 * La voce migliore che il telefono ha per quella lingua, o null.
 * Il punteggio premia le voci neurali e punisce quelle compatte: fra
 * una voce Google e una espeak non c'e partita.
 */
export function trovaVoceMigliore(lang) {
  if (typeof speechSynthesis === 'undefined') return null;
  if (cacheVoci[lang]) return cacheVoci[lang];
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const langLower = String(lang || '').toLowerCase();
  const langBase = langLower.split('-')[0];
  const matching = voices.filter((v) => v.lang.toLowerCase().split('-')[0] === langBase);
  if (matching.length === 0) return null;

  function punteggio(v) {
    let score = 0;
    const name = v.name.toLowerCase();
    if (v.lang.toLowerCase() === langLower) score += 10;
    if (name.includes('google')) score += 50;
    if (name.includes('microsoft')) score += 45;
    if (name.includes('neural')) score += 40;
    if (name.includes('natural')) score += 40;
    if (name.includes('premium')) score += 35;
    if (name.includes('enhanced')) score += 30;
    if (name.includes('wavenet')) score += 25;
    if (name.includes('compact')) score -= 20;
    if (name.includes('espeak')) score -= 30;
    return score;
  }

  matching.sort((a, b) => punteggio(b) - punteggio(a));
  const best = matching[0];
  cacheVoci[lang] = best;
  return best;
}

/**
 * Spezza il testo per il difetto dei 15 secondi di Chrome.
 * Sa dove tagliare anche in cinese, giapponese e thailandese, dove non
 * ci sono spazi e tagliare a caso vuol dire tagliare dentro una parola.
 */
export function spezzaPerLaVoce(text, maxChars = 180) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) { chunks.push(remaining); break; }
    let splitAt = -1;
    for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
      const ch = remaining[i];
      if ('.!?;。！？ฯ'.includes(ch)) { splitAt = i + 1; break; }
    }
    if (splitAt === -1) {
      for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.5; i--) {
        if (',、，'.includes(remaining[i])) { splitAt = i + 1; break; }
      }
    }
    if (splitAt === -1) {
      for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.3; i--) {
        if (remaining[i] === ' ') { splitAt = i + 1; break; }
      }
    }
    if (splitAt === -1) {
      for (let i = Math.min(maxChars, remaining.length) - 1; i >= maxChars * 0.4; i--) {
        const ch = remaining.charCodeAt(i);
        if (ch >= 0x0E40 && ch <= 0x0E44) { splitAt = i; break; }
      }
    }
    if (splitAt === -1) splitAt = maxChars;
    chunks.push(remaining.substring(0, splitAt).trim());
    remaining = remaining.substring(splitAt).trim();
  }
  return chunks.filter((c) => c.length > 0);
}

// Le lingue tonali vanno piu piano: in thailandese o in cinese un tono
// tirato via cambia la parola, non l'accento.
const RITMO = { th: 0.8, zh: 0.85, ja: 0.85, ko: 0.88, vi: 0.82, ar: 0.88, hi: 0.9 };

/** Un pezzo solo. Risolve `true` se la voce e PARTITA (b.262). */
function diciPezzo(text, lang, voce) {
  return new Promise((risolvi) => {
    if (typeof speechSynthesis === 'undefined') { risolvi(false); return; }
    let partita = false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const langBase = String(lang || '').split('-')[0].toLowerCase();
    u.rate = RITMO[langBase] || 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;
    if (voce) u.voice = voce;
    const attesaMax = Math.min(20000, Math.max(3000, text.length * 120));
    const salvagente = setTimeout(() => { speechSynthesis.cancel(); risolvi(partita); }, attesaMax);
    // b.417 — DICHIARATA PRIMA di `speak`, e non e pignoleria: nel codice
    // di partenza `tienilaSveglia` era un `const` DOPO la chiamata, e
    // `finito()` lo azzerava. Finche `onend` arriva dopo (i browser veri
    // fanno cosi) non si vede niente; una sintesi che risponde SUBITO —
    // una prova, un motore diverso, una voce assente — faceva scoppiare
    // `finito` prima che la variabile esistesse, e la promessa non si
    // risolveva piu: la voce restava «in corso» per sempre. Trovato da
    // questa prova, non a occhio.
    let tienilaSveglia = null;
    let concluso = false;
    function finito() {
      concluso = true;
      if (tienilaSveglia) clearInterval(tienilaSveglia);
      clearTimeout(salvagente);
      risolvi(partita);
    }
    u.onstart = () => { partita = true; };
    u.onend = finito;
    u.onerror = finito;
    if (speechSynthesis.paused) speechSynthesis.resume();
    speechSynthesis.speak(u);
    // Chrome mette in pausa la sintesi da solo dopo qualche secondo.
    // b.417 — e se la sintesi ha gia finito DENTRO `speak` (succede con
    // una voce assente, e succede nelle prove), il timer non si accende
    // proprio: acceso DOPO la fine, `finito()` e gia passato e non lo
    // spegnerebbe piu nessuno — resterebbe a girare ogni cinque secondi
    // per tutta la vita della pagina, chiamando `resume()` su una sintesi
    // che non ha piu niente da dire.
    // Nei browser veri `onend` arriva dopo, quindi non si vedeva; si
    // vede montando una sintesi che risponde subito. Costa una riga.
    if (concluso) return;
    tienilaSveglia = setInterval(() => {
      if (speechSynthesis.speaking && !speechSynthesis.paused) return;
      if (speechSynthesis.paused) speechSynthesis.resume();
    }, 5000);
  });
}

/**
 * Legge il testo con la voce del telefono.
 * @returns {Promise<boolean>} true se ALMENO UN pezzo e partito davvero.
 */
export async function parlaColSistema(text, lang) {
  if (typeof speechSynthesis === 'undefined') return false;
  const t = String(text || '').trim();
  if (!t) return false;
  speechSynthesis.cancel();
  const voce = trovaVoceMigliore(lang);
  let almenoUno = false;
  for (const pezzo of spezzaPerLaVoce(t)) {
    if (await diciPezzo(pezzo, lang, voce)) almenoUno = true;
  }
  return almenoUno;
}

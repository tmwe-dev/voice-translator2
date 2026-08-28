'use client';
import { useRef, useEffect } from 'react';
import { AVATAR_NAMES, AVATARS } from '../lib/constants.js';
// b.404 — LA VOCE DELLA STANZA ENTRA NEL REGISTRO. Finora questo motore
// suonava per conto suo: il telecomando non lo vedeva e lo Stop non lo
// fermava. Ora ogni blob che parte si annuncia, come fa Life da b.305.
import { suona as registraVoce } from '../lib/voce.js';
import { preparaVociSistema, svuotaCacheVoci, trovaVoceMigliore, parlaColSistema } from '../lib/voceSistema.js';

/**
 * useTTSEngine — All TTS engines extracted from useAudioSystem.
 *
 * Manages 4 TTS engines with fallback chain:
 * 1. ElevenLabs (Top PRO) → fallback to OpenAI
 * 2. OpenAI gpt-4o-mini-tts (PRO) → streaming, fallback to browser
 * 3. Edge TTS (FREE) → neural voices, fallback to browser
 * 4. Browser SpeechSynthesis (last resort)
 *
 * Also handles: voice scoring, text splitting for CJK/Thai,
 * language-specific speech rates, TTS pre-warming.
 *
 * Returns: { playEdgeTTS, playTTS, playTTSElevenLabs, browserSpeak,
 *            checkVoiceAvailability, playBlobAudio, playBlobNewAudio }
 */
export default function useTTSEngine({
  prefsRef,
  isTrialRef,
  canUseElevenLabsRef,
  selectedELVoice,
  clonedVoiceIdRef,
  roomIdRef,
  roomSessionTokenRef,
  getEffectiveToken,
  audioReady,
  getPersistentAudio,
  activeBlobUrlsRef,
}) {
  const ttsPrewarmedRef = useRef(false);

  // Preload browser voices (Chrome loads them asynchronously)
  // b.417 — la cache e l'ascolto di `voiceschanged` vivono nel modulo
  // condiviso: qui si scaldano e basta.
  useEffect(() => { preparaVociSistema(); svuotaCacheVoci(); }, []);

  // Pre-warm TTS connections when audio is ready
  useEffect(() => {
    if (!audioReady || ttsPrewarmedRef.current) return;
    ttsPrewarmedRef.current = true;
    fetch('/api/tts-edge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '.', langCode: 'en', gender: 'female' }),
      // b.363 — questo riscaldamento non aveva scadenza: restava appeso
      // in sottofondo tenendo occupata una connessione per niente.
      signal: AbortSignal.timeout(10000)
    }).catch(() => {});
    if (!isTrialRef.current) {
      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '.', voice: 'nova', langCode: 'en', userToken: getEffectiveToken() }),
        // b.363 — stesso motivo del riscaldamento qui sopra.
        signal: AbortSignal.timeout(10000)
      }).catch(() => {});
    }
  }, [audioReady]);

  // ═══════════════════════════════════════════════
  // BROWSER TTS
  // ═══════════════════════════════════════════════

  // b.417 — spostata in app/lib/voceSistema.js, che e l'unico posto
  // dove sta la voce del telefono. Il nome locale resta per non
  // toccare i sei punti che la chiamano.
  const findBestVoice = trovaVoceMigliore;

  // b.417 — spezzare il testo, dire un pezzo e leggere tutto con la
  // voce del telefono stanno in app/lib/voceSistema.js: lo stesso
  // codice, spostato, perche adesso serve anche alla Prima prova.
  // `spezzaPerLaVoce` qui non si chiama piu da sola: la usa
  // `parlaColSistema` dentro il modulo.
  const browserSpeak = parlaColSistema;

  function checkVoiceAvailability(lang) {
    if (typeof speechSynthesis === 'undefined') return { available: false, quality: 'none' };
    const voice = findBestVoice(lang);
    if (!voice) return { available: false, quality: 'none' };
    const name = voice.name.toLowerCase();
    let quality = 'basic';
    if (name.includes('google') || name.includes('microsoft') || name.includes('neural') || name.includes('natural')) quality = 'premium';
    else if (name.includes('enhanced') || name.includes('wavenet')) quality = 'good';
    else if (name.includes('compact') || name.includes('espeak')) quality = 'low';
    return { available: true, quality, voiceName: voice.name };
  }

  // ═══════════════════════════════════════════════
  // BLOB PLAYBACK HELPERS (shared by all engines)
  // ═══════════════════════════════════════════════

  // b.404 — il nome scritto sul telecomando mentre suona. Non e un
  // dettaglio: un telecomando che non dice COSA sta fermando e un
  // interruttore al buio.
  const etichettaVoce = 'BarTalk';

  function playBlobAudio(blobUrl) {
    return new Promise((resolve) => {
      const audio = getPersistentAudio();
      audio.onended = null;
      audio.onerror = null;
      const safetyTimer = setTimeout(() => { console.warn('[TTS] playBlobAudio timeout'); audio.pause(); cleanup(); resolve(false); }, 30000);
      function cleanup() { clearTimeout(safetyTimer); audio.onended = null; audio.onerror = null; }
      audio.onended = () => { cleanup(); resolve(true); };
      audio.onerror = (e) => { console.warn('[TTS] playBlobAudio error:', e?.type || e); cleanup(); resolve(false); };
      audio.src = blobUrl;
      // Ensure volume is up (may have been muted)
      audio.volume = 1.0;
      registraVoce(audio, etichettaVoce); // b.404 — il telecomando ora la vede
      audio.play().catch((e) => { console.warn('[TTS] playBlobAudio play() rejected:', e?.message || e); cleanup(); resolve(false); });
    });
  }

  function playBlobNewAudio(blobUrl) {
    return new Promise((resolve) => {
      // On iOS, new Audio() elements aren't activated by user gesture
      // Try persistent audio first with a fresh src, then fall back to new element
      const a = new Audio(blobUrl);
      a.volume = 1.0;
      a.playsInline = true;
      a.setAttribute('playsinline', '');
      const safetyTimer = setTimeout(() => { console.warn('[TTS] playBlobNewAudio timeout'); a.pause(); resolve(false); }, 30000);
      a.onended = () => { clearTimeout(safetyTimer); resolve(true); };
      a.onerror = (e) => { console.warn('[TTS] playBlobNewAudio error:', e?.type || e); clearTimeout(safetyTimer); resolve(false); };
      registraVoce(a, etichettaVoce); // b.404 — anche il percorso iOS
      a.play().catch((e) => { console.warn('[TTS] playBlobNewAudio play() rejected:', e?.message || e); clearTimeout(safetyTimer); resolve(false); });
    });
  }

  async function playBlobWithFallback(blob, text, lang) {
    const url = URL.createObjectURL(blob);
    activeBlobUrlsRef.current.add(url);
    let played = await playBlobAudio(url);
    if (!played) played = await playBlobNewAudio(url);
    // b.262 — il ripiego sulla voce del browser, se PARLA, e un successo:
    // prima qui si ritornava false anche a voce sentita.
    if (!played) played = await browserSpeak(text, lang);
    activeBlobUrlsRef.current.delete(url);
    URL.revokeObjectURL(url);
    return played;
  }

  // ═══════════════════════════════════════════════
  // EDGE TTS (FREE)
  // ═══════════════════════════════════════════════

  async function fetchEdgeTTSBlob(text, langCode, gender) {
    const controller = new AbortController();
    // b.251 — 5s erano troppo pochi: la rotta importa edge-tts a runtime e
    // parla con Microsoft; su rete mobile, o alla prima voce dopo un cold
    // start, si superano regolarmente. Ogni sforamento diventava la voce
    // ROBOTICA del browser (il ripiego) al posto della voce neurale.
    // Otto secondi restano sotto la soglia di attesa percepita e coprono
    // il caso normale; oltre, il ripiego resta giusto.
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      try {
        const res = await fetch('/api/tts-edge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, langCode: langCode || 'en',
            gender: gender || prefsRef.current?.edgeTtsVoiceGender || 'female',
            // b.167 — senza questo il server non puo sapere di quale stanza
            // si tratta e verificare se e Diretta: vedi fetchTTSBlob sopra,
            // stesso schema gia in uso li.
            roomId: roomIdRef.current || undefined,
            roomSessionToken: roomSessionTokenRef?.current || undefined,
          }),
          signal: controller.signal
        });
        // b.552 — 204 = «non c'e' niente da pronunciare»: il testo era
        // fatto di sole emoji o di sola punteggiatura e dopo la pulizia
        // non resta una parola. Non e' un guasto e non deve far ripiegare
        // sulla voce del browser, che leggerebbe il vuoto (o peggio, il
        // nome delle faccine). Si torna null e si sta zitti.
        if (res.status === 204) return null;
        if (!res.ok) throw new Error(`EdgeTTS ${res.status}`);
        return await res.blob();
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) { throw e; }
  }

  async function playEdgeTTS(text, langCode) {
    let blob;
    try {
      blob = await fetchEdgeTTSBlob(text, langCode);
      if (blob === null) return;   // b.552 — niente da dire: silenzio, non ripiego
    } catch {
      try {
        const alt = (prefsRef.current?.edgeTtsVoiceGender || 'female') === 'female' ? 'male' : 'female';
        blob = await fetchEdgeTTSBlob(text, langCode, alt);
        if (blob === null) return;
      } catch (e) {
        // b.363 — qui l'utente sente la voce meccanica del browser al
        // posto di quella neurale: era il ripiego piu visibile di tutti
        // e non lasciava nessuna traccia del motivo.
        console.warn('[TTS-Edge] entrambe le voci fallite, voce del browser:', e?.message || e);
        await browserSpeak(text, langCode);
        return;
      }
    }
    await playBlobWithFallback(blob, text, langCode);
  }

  // ═══════════════════════════════════════════════
  // OPENAI TTS (PRO) — streaming
  // ═══════════════════════════════════════════════

  async function fetchTTSBlob(text, langCode, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text, voice: prefsRef.current.voice || 'nova',
            langCode: langCode || undefined,
            userToken: getEffectiveToken(),
            roomId: roomIdRef.current || undefined,
            // b.161 — senza questo, resolveAuth rifiuta con 401 il
            // percorso roomId (vedi apiAuth.js, punto 2 quarto audit).
            roomSessionToken: roomSessionTokenRef?.current || undefined,
          }),
          // b.363 — la voce OpenAI non aveva scadenza: una richiesta
          // appesa bloccava la coda audio e il messaggio restava muto
          // senza mai ripiegare sulla voce del browser.
          signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) { if (attempt < retries) continue; throw new Error(`TTS ${res.status}`); }
        return await res.blob();
      } catch (e) { if (attempt < retries) continue; throw e; }
    }
  }

  async function playTTS(text, lang) {
    try {
      const blob = await fetchTTSBlob(text, lang);
      await playBlobWithFallback(blob, text, lang);
    } catch (e) {
      console.warn('[TTS-OpenAI] Failed, falling back to browser:', e.message);
      await browserSpeak(text, lang);
    }
  }

  // ═══════════════════════════════════════════════
  // ELEVENLABS TTS (TOP PRO)
  // ═══════════════════════════════════════════════

  function getAvatarName() {
    const avatar = prefsRef.current?.avatar;
    if (!avatar) return undefined;
    const idx = AVATARS.indexOf(avatar);
    return idx >= 0 ? AVATAR_NAMES[idx] : undefined;
  }

  async function playTTSElevenLabs(text, langCode) {
    let blob;
    try {
      const res = await fetch('/api/tts-elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: clonedVoiceIdRef?.current || selectedELVoice || undefined,
          langCode: langCode || undefined,
          avatarName: getAvatarName(),
          userToken: getEffectiveToken(),
          roomId: roomIdRef.current || undefined,
          roomSessionToken: roomSessionTokenRef?.current || undefined,
        }),
        // b.363 — voce premium senza scadenza: restava appesa e il
        // messaggio non parlava ne con ElevenLabs ne col ripiego.
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      blob = await res.blob();
    } catch (e) {
      // b.363 — questo ripiego cambia la voce che l'utente sente (e
      // sposta la spesa su un altro fornitore) ma non registrava nulla:
      // in produzione la voce premium spariva senza spiegazione.
      console.warn('[TTS-ElevenLabs] non disponibile, ripiego su OpenAI:', e?.message || e);
      return playTTS(text, langCode); // Fallback to OpenAI
    }
    await playBlobWithFallback(blob, text, langCode);
  }

  // ═══════════════════════════════════════════════
  // b.111 — PROCURARE e FAR SUONARE, separati
  //
  // Le funzioni playXxx qui sopra fanno le due cose insieme: vanno a
  // prendere l'audio e lo suonano, in un `await` solo. Va benissimo
  // quando c'e una frase sola, ma in una conversazione significa che
  // l'audio della frase successiva si comincia a cercare solo quando
  // la precedente ha finito di parlare: fra una frase e l'altra resta
  // un silenzio lungo quanto la richiesta di rete.
  //
  // Separandole, la coda (lib/codaAudio.js) puo procurarsi la prossima
  // voce MENTRE quella corrente sta ancora parlando, e far suonare
  // tutto rigorosamente in ordine.
  //
  // Non sostituiscono le playXxx: quelle restano per il riascolto
  // manuale di un singolo messaggio, dove non c'e niente da anticipare.
  // ═══════════════════════════════════════════════

  /** Va a prendere l'audio. Non suona niente. @returns {Promise<Blob|null>} */
  async function procuraVoce(text, langCode) {
    const motore = prefsRef.current?.voiceEngine || 'auto';
    // b.204 — in auto la barra mostra "ElevenLabs" quando ne hai diritto:
    // la coda della conversazione dal vivo deve suonarla davvero, non solo
    // con una voce clonata. Prima l'auto senza voce clonata cadeva su Edge
    // (meccanica) pur mostrando ElevenLabs. Il ripiego 402/errore resta
    // (sotto: Edge, poi browser).
    const premium = motore === 'elevenlabs'
      || (motore === 'auto' && !!canUseElevenLabsRef?.current);

    if (premium) {
      try {
        const res = await fetch('/api/tts-elevenlabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voiceId: clonedVoiceIdRef?.current || selectedELVoice || undefined,
            langCode: langCode || undefined,
            avatarName: getAvatarName(),
            userToken: getEffectiveToken(),
            roomId: roomIdRef.current || undefined,
            roomSessionToken: roomSessionTokenRef?.current || undefined,
          }),
          // b.363 — anche la voce premium della coda era senza scadenza.
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) return await res.blob();
        // 402 = credito insufficiente: si ripiega sulla voce gratuita,
        // che e esattamente cio che la rotta si aspetta.
      } catch { /* voce premium non disponibile: si ripiega su quella gratuita */ }
    } else if (motore === 'openai') {
      // b.155 — audit dei setting: CONFERMATO che mancava questo ramo.
      // Chi sceglieva esplicitamente "OpenAI" come motore vocale
      // sentiva comunque Edge TTS in OGNI conversazione dal vivo: la
      // coda vera (accodaConAnticipo, sopra) passa sempre da qui, e
      // senza questo `else if` "openai" non veniva mai riconosciuto —
      // finiva dritto nel ripiego Edge qualche riga sotto, in silenzio.
      // Solo il riascolto manuale di un singolo messaggio (playMessage
      // in useAudioSystem.js) rispettava davvero la scelta. fetchTTSBlob
      // e la stessa funzione che usa playTTS, qui presa senza suonare.
      try {
        return await fetchTTSBlob(text, langCode);
      } catch { /* OpenAI non disponibile: si ripiega su Edge sotto */ }
    }

    try {
      return await fetchEdgeTTSBlob(text, langCode);
    } catch {
      try {
        const alt = (prefsRef.current?.edgeTtsVoiceGender || 'female') === 'female' ? 'male' : 'female';
        return await fetchEdgeTTSBlob(text, langCode, alt);
      } catch (e) {
        // b.363 — stesso ripiego visibile del caso qui sopra, dentro la
        // coda della conversazione dal vivo: senza registro non si
        // capiva perche mezza conversazione suonasse meccanica.
        console.warn('[TTS-Edge] coda: entrambe le voci fallite, voce del browser:', e?.message || e);
        return null;   // niente blob: chi suona ripieghera sulla voce del browser
      }
    }
  }

  /** Fa suonare quello che procuraVoce ha portato.
   * b.262 — ritorna true se QUALCOSA ha suonato (blob o voce browser):
   * serve a useAudioSystem per liberare la chiave di un messaggio che e
   * rimasto muto davvero, cosi puo riprovare al prossimo giro. */
  async function suonaVoce(blob, text, langCode) {
    if (!blob) return browserSpeak(text, langCode);
    return playBlobWithFallback(blob, text, langCode);
  }

  return {
    browserSpeak,
    checkVoiceAvailability,
    playEdgeTTS,
    playTTS,
    playTTSElevenLabs,
    playBlobAudio,
    playBlobNewAudio,
    procuraVoce,
    suonaVoce,
  };
}

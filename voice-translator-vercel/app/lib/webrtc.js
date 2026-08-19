import { createLogger } from './logger.js';
const log = createLogger('webrtc');

// ═══════════════════════════════════════════════
// WebRTC Helper — Direct phone-to-phone connection
//
// Supports:
// - DataChannel for direct message exchange (~50ms latency)
// - Audio/Video tracks for video calls
// - Signaling via Supabase Realtime broadcast
// ═══════════════════════════════════════════════

// ICE servers: STUN for NAT traversal + TURN for relay fallback
// Custom TURN via env vars: NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USER, NEXT_PUBLIC_TURN_PASS
// ═══ b.281 — IL PONTE GRATUITO ERA MORTO, E LO SPEDIVAMO AI TELEFONI ═══
// Scoperto dalla scatola nera (chiamata verso Android: "strada: NESSUNA")
// e verificato dal DNS: openrelay.metered.ca NON ESISTE PIU — il progetto
// del relay pubblico gratuito e stato chiuso. L'app consegnava ai telefoni
// QUATTRO indirizzi morti (1 STUN + 3 TURN): ogni chiamata perdeva tempo a
// bussare a porte inesistenti, e il "ponte" per le reti difficili non
// c'era proprio.
// Ora restano solo ponti VIVI e gratuiti, verificati: gli STUN di Google
// e quello di Cloudflare (pubblico, senza account). Bastano per tutte le
// reti in cui i telefoni possono vedersi (stessa rete, wi-fi domestici,
// la maggior parte degli operatori). NON coprono il caso peggiore — due
// reti mobili chiuse — per quello serve un relay: o uno proprio su un
// server gia nostro (coturn, software libero), o le variabili
// NEXT_PUBLIC_TURN_* qui sotto.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// ═══════════════════════════════════════════════
// b.111 — IL RELAY PROPRIO SOSTITUISCE QUELLO PUBBLICO
//
// Prima il TURN privato si AGGIUNGEVA a quello pubblico ("supplements
// free TURN"). Detto in chiaro: anche dopo aver pagato un relay
// proprio, una parte del traffico continuava a passare da un server di
// terzi con credenziali pubbliche — openrelayproject / openrelayproject,
// le stesse per chiunque al mondo.
//
// Il traffico resta cifrato due volte (DTLS di WebRTC piu AES-GCM
// nostro), quindi il relay non legge i contenuti. Ma vede CHI parla con
// CHI, quando e per quanto: metadati, che spesso dicono piu del testo.
// E non ha SLA, ne quote garantite, ne una politica di conservazione
// che possiamo mostrare a un utente che la chieda.
//
// Ora: se c'e un relay nostro, quello pubblico esce dalla lista.
// ═══════════════════════════════════════════════

/** Vero se stiamo usando il relay pubblico gratuito, cioe nessuno di nostro. */
export let RELAY_PUBBLICO = true;

// ═══ b.282 — IL PONTE ARRIVA DALLA PORTA /api/turn, NON DAL PACCHETTO ═══
// Le credenziali temporanee (HMAC, 4 ore) si chiedono al server appena
// l'app parte: se il relay e configurato (TURN_SECRET + TURN_URLS su
// Vercel), entrano nella lista PRIMA della prima chiamata. Se la porta
// risponde vuoto o non risponde, non cambia niente: restano gli STUN.
// Le variabili NEXT_PUBLIC_TURN_* qui sotto restano come strada di
// prova manuale, ma quella buona e questa: il segreto non tocca mai il
// browser.
if (typeof window !== 'undefined') {
  fetch('/api/turn')
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const voci = d?.iceServers;
      if (!Array.isArray(voci) || !voci.length) return;
      // via ogni relay precedente: comanda quello appena ricevuto
      for (let i = ICE_SERVERS.length - 1; i >= 0; i--) {
        const u = String(ICE_SERVERS[i].urls || '');
        if (u.startsWith('turn:') || u.startsWith('turns:')) ICE_SERVERS.splice(i, 1);
      }
      for (const v of voci) ICE_SERVERS.push(v);
      RELAY_PUBBLICO = false;
      log.debug('ponte ricevuto da /api/turn:', voci.map(x => x.urls).flat().join(' '));
    })
    .catch(() => { /* la porta non c'e o la rete manca: si prosegue con i soli STUN */ });
}

if (typeof window !== 'undefined') {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USER;
  const turnPass = process.env.NEXT_PUBLIC_TURN_PASS;

  if (turnUrl) {
    // Fuori i relay di terzi: restano solo gli STUN, che non
    // trasportano traffico ma dicono soltanto "il tuo indirizzo
    // pubblico e questo".
    for (let i = ICE_SERVERS.length - 1; i >= 0; i--) {
      const u = ICE_SERVERS[i].urls || '';
      if (String(u).startsWith('turn:') || String(u).startsWith('turns:')) {
        ICE_SERVERS.splice(i, 1);
      }
    }
    ICE_SERVERS.push({ urls: turnUrl, username: turnUser || '', credential: turnPass || '' });
    if (turnUrl.startsWith('turn:')) {
      ICE_SERVERS.push({
        urls: turnUrl.replace('turn:', 'turns:'),
        username: turnUser || '',
        credential: turnPass || '',
      });
    }
    RELAY_PUBBLICO = false;
  } else {
    // Non e un dettaglio da scoprire in produzione: si dice subito.
    log.warn(
      'Nessun relay configurato (NEXT_PUBLIC_TURN_URL): niente ponte. ' +
      'Le chiamate fra reti che non si vedono direttamente (doppia rete mobile) non si allacceranno. ' +
      'Il vecchio relay pubblico gratuito non esiste piu: b.281.'
    );
  }
}

/**
 * Create a new RTCPeerConnection with DataChannel + media support
 *
 * onStateChange receives: { source: 'ice'|'connection', state: string }
 * Important: 'disconnected' is TRANSIENT and should NOT trigger cleanup.
 * Only 'failed' and 'closed' are terminal states.
 */
export function createPeerConnection(onMessage, onStateChange, onRemoteTrack) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.oniceconnectionstatechange = () => {
    log.debug('ICE state:', pc.iceConnectionState);
    onStateChange?.({ source: 'ice', state: pc.iceConnectionState });
  };

  pc.onconnectionstatechange = () => {
    log.debug('Connection state:', pc.connectionState);
    onStateChange?.({ source: 'connection', state: pc.connectionState });
  };

  // Handle incoming remote tracks (audio/video from partner)
  if (onRemoteTrack) {
    pc.ontrack = (event) => {
      onRemoteTrack(event.track, event.streams[0]);
    };
  }

  return pc;
}

/**
 * Create a DataChannel on the peer connection
 */
export function createDataChannel(pc, label = 'messages') {
  // ── Fully reliable + ordered (SCTP default per RFC 8831) ──
  // Previously used maxRetransmits:3 which could silently drop messages.
  // For chat messages, reliability is more important than latency.
  // SCTP retransmits automatically until delivered or connection fails.
  const dc = pc.createDataChannel(label, {
    ordered: true,
    // No maxRetransmits or maxPacketLifeTime → fully reliable delivery
  });
  return dc;
}

/**
 * Add local media tracks to peer connection
 * @param {RTCPeerConnection} pc
 * @param {MediaStream} stream - local camera/mic stream
 * @returns {RTCRtpSender[]} senders for later removal
 */
export function addMediaTracks(pc, stream) {
  const senders = [];
  for (const track of stream.getTracks()) {
    const sender = pc.addTrack(track, stream);
    senders.push(sender);
  }
  return senders;
}

/**
 * Remove media tracks from peer connection
 * @param {RTCPeerConnection} pc
 * @param {RTCRtpSender[]} senders
 */
export function removeMediaTracks(pc, senders) {
  for (const sender of senders) {
    try { pc.removeTrack(sender); } catch (e) { /* si sta smontando: se era gia chiuso non cambia nulla */ }
  }
}

/**
 * Get local camera + mic stream
 * @param {object} opts - { video: bool, audio: bool }
 * @returns {Promise<MediaStream>}
 */
export async function getLocalMediaStream(opts = { video: true, audio: false }) {
  const constraints = {
    video: opts.video ? {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: 'user',
    } : false,
    audio: opts.audio ? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    } : false,
  };
  // ═══ b.277 — LA VOCE DELLA CHIAMATA VIENE DAL MICROFONO UNICO ═══
  // Era una delle tre aperture parallele dell'hardware (sistema audio,
  // chiamata, interprete): su Android la terza apertura puo far revocare
  // il microfono alle prime due e rompe la cancellazione dell'eco.
  // Ora l'audio e una COPIA del master; il video resta un'acquisizione
  // sua, perche la telecamera non ha questo problema.
  // QUALUNQUE intoppo → si torna esattamente al percorso di prima:
  // questo modulo non deve mai essere il motivo per cui la chiamata
  // non parte.
  if (opts.audio) {
    let voceInPrestito = null;
    try {
      const { prendiVoce } = await import('./microfonoMaster.js');
      if (!opts.video) {
        const voce = await prendiVoce();
        vociInPrestito.set(voce, voce);
        return voce;
      }
      // b.279 — voce e telecamera si aprono INSIEME, non in fila.
      // b.277 le aveva messe una dopo l'altra e la chiamata, prima
      // immediata, impiegava secondi a partire (visto da Luca dal vivo):
      // due attese sommate invece di una. Ora corrono in parallelo e si
      // aspetta solo la piu lenta — com'era prima, ma con l'hardware
      // del microfono aperto una volta sola.
      const [esitoVoce, esitoVideo] = await Promise.allSettled([
        prendiVoce(),
        navigator.mediaDevices.getUserMedia({ video: constraints.video }),
      ]);
      // b.280 — SE LA TELECAMERA FALLISCE, LA VOCE VA RESA.
      // Con Promise.all, la copia del microfono gia presa restava in
      // prestito per sempre: il contatore del master non tornava a zero
      // e l'hardware restava aperto. Ora ogni esito e gestito.
      if (esitoVoce.status === 'fulfilled') voceInPrestito = esitoVoce.value;
      if (esitoVoce.status !== 'fulfilled' || esitoVideo.status !== 'fulfilled') {
        if (voceInPrestito) {
          const { rendiVoce } = await import('./microfonoMaster.js');
          rendiVoce(voceInPrestito);
          voceInPrestito = null;
        }
        // b.288 — il caso speculare: MICROFONO fallito ma TELECAMERA gia
        // accesa. Prima la camera restava aperta (lucina accesa) mentre
        // si passava al ripiego: ogni pezzo riuscito si spegne PRIMA.
        if (esitoVideo.status === 'fulfilled' && esitoVideo.value) {
          esitoVideo.value.getTracks().forEach(t => { try { t.stop(); } catch { /* traccia gia ferma: fermarla di nuovo non e un guasto */ } });
        }
        throw (esitoVideo.status !== 'fulfilled' ? esitoVideo.reason : esitoVoce.reason);
      }
      const insieme = new MediaStream([...esitoVideo.value.getVideoTracks(), ...voceInPrestito.getAudioTracks()]);
      // Il flusso combinato ricorda la sua copia in prestito: chi lo
      // rilascia con rilasciaLocalMediaStream la rende al master.
      vociInPrestito.set(insieme, voceInPrestito);
      return insieme;
    } catch (e) {
      log.warn('microfono unico non disponibile, apertura diretta:', e?.message || e);
    }
  }
  return await navigator.mediaDevices.getUserMedia(constraints);
}

// b.280 — il registro delle copie in prestito: flusso consegnato -> la
// copia della voce che contiene. WeakMap: quando il flusso muore, la
// voce non viene trattenuta.
const vociInPrestito = new WeakMap();

/**
 * L'UNICO modo giusto di spegnere un flusso ottenuto da
 * getLocalMediaStream: ferma le tracce e, se dentro c'era una copia del
 * microfono unico, la RENDE al master — cosi il contatore torna a zero e
 * l'hardware si spegne davvero. Chiamare track.stop() a mano lascia il
 * conto sospeso.
 */
export async function rilasciaLocalMediaStream(stream) {
  if (!stream) return;
  const voce = vociInPrestito.get(stream);
  vociInPrestito.delete(stream);
  stream.getTracks().forEach(t => { try { t.stop(); } catch { /* traccia gia ferma: fermarla di nuovo non e un guasto */ } });
  if (voce) {
    try {
      const { rendiVoce } = await import('./microfonoMaster.js');
      rendiVoce(voce);
    } catch { /* il master non c'e piu: le tracce sono comunque ferme */ }
  }
}

/**
 * Create SDP offer
 */
// ═══════════════════════════════════════════════════════════════
// b.272 — APPLE E ANDROID DEVONO PARLARE LA STESSA LINGUA VIDEO
//
// Fra due Apple la videochiamata si allaccia sempre; fra un Apple e un
// Android no (verificato da Luca sui telefoni veri). La ragione non e la
// rete: e la CODIFICA del video.
//
// Fino a qui non veniva dichiarata nessuna preferenza, quindi la sceglieva
// il browser. Chrome su Android mette davanti VP8; Safari sui dispositivi
// Apple ha l'accelerazione hardware su H.264 e con VP8 va in difficolta o
// non lo tratta affatto. Due Apple si accordano da soli su H.264 — ecco
// perche fra loro funziona — mentre nell'incrocio l'accordo puo cadere sul
// codec sbagliato: l'audio passa e il video resta nero.
//
// Ora: si riconosce il sistema dei due partecipanti e, se ANCHE UNO SOLO
// dei due e Apple, tutti e due mettono H.264 in cima. Se il dispositivo
// non sa fare H.264, o il browser non permette di esprimere preferenze,
// non si tocca niente e vale il comportamento di prima: una preferenza
// non esprimibile non deve mai diventare una chiamata persa.
// ═══════════════════════════════════════════════════════════════

/** 'apple' | 'android' | 'altro' — quale sistema sta usando chi legge. */
export function rilevaPiattaforma() {
  if (typeof navigator === 'undefined') return 'altro';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  const iOS = /iPad|iPhone|iPod/.test(ua)
    // iPad recenti si presentano come Macintosh: li smaschera il tocco.
    || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/.test(ua);
  if (iOS || safari) return 'apple';
  return 'altro';
}

/** Vero se in questa chiamata conviene mettere H.264 davanti a tutto. */
export function serveH264(miaPiattaforma, piattaformaPartner) {
  // b.273 — PRIMA ERA "se uno dei due e Apple, lo chiedono TUTTI E DUE",
  // e su Android la chiamata ha smesso di partire (Luca, dal vivo).
  // Riordinare i codec su un dispositivo che non ne ha bisogno e un
  // rischio senza guadagno: se il profilo H.264 messo davanti non e
  // quello che quel telefono sa trattare, la trattativa si incaglia.
  // Basta che la preferenza la esprima il lato APPLE: e' lui ad avere il
  // vincolo hardware, e chi sta di fronte accetta H.264 comunque.
  // Su Android non si tocca piu niente: vale il comportamento di sempre.
  void piattaformaPartner;
  return miaPiattaforma === 'apple';
}

/**
 * Mette H.264 in cima alle preferenze video della connessione.
 * Va chiamata DOPO che i canali video esistono e PRIMA di creare
 * l'offerta o la risposta. Non solleva mai: se non si puo fare, torna
 * false e la chiamata prosegue come prima.
 */
export function preferisciH264(pc) {
  try {
    if (!pc?.getTransceivers || typeof RTCRtpSender === 'undefined'
      || !RTCRtpSender.getCapabilities) return false;
    const capacita = RTCRtpSender.getCapabilities('video');
    const codec = capacita?.codecs || [];
    const h264 = codec.filter(c => /h264/i.test(c.mimeType || ''));
    if (!h264.length) return false;
    const resto = codec.filter(c => !/h264/i.test(c.mimeType || ''));
    let applicate = 0;
    for (const t of pc.getTransceivers()) {
      const tipo = t.receiver?.track?.kind || t.sender?.track?.kind;
      if (tipo !== 'video' || typeof t.setCodecPreferences !== 'function') continue;
      try { t.setCodecPreferences([...h264, ...resto]); applicate++; } catch { /* questo canale non accetta preferenze: si lascia com'e */ }
    }
    if (applicate) log.debug('H.264 messo davanti su', applicate, 'canali video');
    return applicate > 0;
  } catch (e) {
    log.warn('preferenza codec non applicabile:', e?.message || e);
    return false;
  }
}

export async function createOffer(pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return JSON.stringify(pc.localDescription);
}

/**
 * Create SDP answer from received offer
 */
export async function createAnswer(pc, offerSdpStr, primaDiRispondere) {
  let offer; try { offer = JSON.parse(offerSdpStr); } catch { throw new Error('Invalid offer SDP'); }
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  // b.272 — i canali video esistono solo ora, dopo l'offerta ricevuta: e
  // questo l'unico istante in cui si puo esprimere la preferenza sul
  // codec, prima che la risposta venga scritta.
  try { primaDiRispondere?.(pc); } catch { /* preferenza non applicata: si risponde comunque */ }
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return JSON.stringify(pc.localDescription);
}

/**
 * Accept SDP answer
 */
export async function acceptAnswer(pc, answerSdpStr) {
  let answer; try { answer = JSON.parse(answerSdpStr); } catch { throw new Error('Invalid answer SDP'); }
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

/**
 * Add ICE candidate
 */
export async function addIceCandidate(pc, candidateStr) {
  try {
    let candidate; try { candidate = JSON.parse(candidateStr); } catch { log.warn('Invalid ICE candidate JSON'); return; }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    log.error('ICE candidate error:', e);
  }
}

/**
 * Send a message via DataChannel.
 * Includes try/catch — dc.send() can throw on oversized messages
 * or when the channel is closing mid-send.
 */
export function sendViaDataChannel(dc, data) {
  if (dc && dc.readyState === 'open') {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      dc.send(payload);
      return true;
    } catch (e) {
      log.warn('DC send failed:', e.message, '| payload size:', JSON.stringify(data).length);
      return false;
    }
  }
  return false;
}

/**
 * Collect ICE candidates as they're generated
 */
export function collectIceCandidates(pc, callback) {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callback(JSON.stringify(event.candidate));
    }
  };
}

/**
 * Toggle video track on/off without renegotiation
 * @param {MediaStream} stream
 * @param {boolean} enabled
 */
export function setVideoEnabled(stream, enabled) {
  if (!stream) return;
  for (const track of stream.getVideoTracks()) {
    track.enabled = enabled;
  }
}

/**
 * Switch camera (front/back) on mobile
 * @param {MediaStream} currentStream
 * @param {RTCRtpSender[]} senders
 * @returns {Promise<MediaStream>} new stream
 */
export async function switchCamera(currentStream, senders) {
  // Stop current video tracks
  for (const track of currentStream.getVideoTracks()) {
    track.stop();
  }
  // Get current facing mode
  const currentTrack = currentStream.getVideoTracks()[0];
  const currentFacing = currentTrack?.getSettings?.()?.facingMode || 'user';
  const newFacing = currentFacing === 'user' ? 'environment' : 'user';

  const newStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } },
  });

  // Replace track in senders
  const newVideoTrack = newStream.getVideoTracks()[0];
  if (newVideoTrack && senders.length > 0) {
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        await sender.replaceTrack(newVideoTrack);
      }
    }
  }
  return newStream;
}

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
const ICE_SERVERS = [
  // Google STUN servers (fast, reliable)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Open Relay STUN
  { urls: 'stun:openrelay.metered.ca:80' },
  // ── TURN servers (relay for ~15-20% of users behind symmetric NAT) ──
  // Metered.ca Open Relay Project — free public TURN (20GB/month)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
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
      'Nessun TURN privato configurato (NEXT_PUBLIC_TURN_URL). ' +
      'Si usa il relay pubblico gratuito: va bene per le prove, non per gli utenti veri. ' +
      'Vede chi parla con chi, non ha quote garantite ne SLA.'
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
  return await navigator.mediaDevices.getUserMedia(constraints);
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

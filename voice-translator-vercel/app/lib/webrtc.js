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

// Add custom TURN server if configured via env vars (supplements free TURN)
if (typeof window !== 'undefined') {
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USER;
  const turnPass = process.env.NEXT_PUBLIC_TURN_PASS;
  if (turnUrl) {
    ICE_SERVERS.push({
      urls: turnUrl,
      username: turnUser || '',
      credential: turnPass || '',
    });
    if (turnUrl.startsWith('turn:')) {
      ICE_SERVERS.push({
        urls: turnUrl.replace('turn:', 'turns:'),
        username: turnUser || '',
        credential: turnPass || '',
      });
    }
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
    console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    onStateChange?.({ source: 'ice', state: pc.iceConnectionState });
  };

  pc.onconnectionstatechange = () => {
    console.log('[WebRTC] Connection state:', pc.connectionState);
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
    try { pc.removeTrack(sender); } catch {}
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
export async function createOffer(pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return JSON.stringify(pc.localDescription);
}

/**
 * Create SDP answer from received offer
 */
export async function createAnswer(pc, offerSdpStr) {
  let offer; try { offer = JSON.parse(offerSdpStr); } catch { throw new Error('Invalid offer SDP'); }
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
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
    let candidate; try { candidate = JSON.parse(candidateStr); } catch { console.warn('[WebRTC] Invalid ICE candidate JSON'); return; }
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('[WebRTC] ICE candidate error:', e);
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
      console.warn('[DC] send failed:', e.message, '| payload size:', JSON.stringify(data).length);
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

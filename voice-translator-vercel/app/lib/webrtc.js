// ═══════════════════════════════════════════════
// WebRTC Helper — Direct phone-to-phone connection
//
// Supports:
// - DataChannel for direct message exchange (~50ms latency)
// - Audio/Video tracks for video calls
// - Signaling via existing /api/room endpoint
// ═══════════════════════════════════════════════

// ICE servers: STUN for NAT traversal + optional TURN for relay fallback
// Configure TURN via env vars: NEXT_PUBLIC_TURN_URL, NEXT_PUBLIC_TURN_USER, NEXT_PUBLIC_TURN_PASS
// Recommended: Cloudflare TURN (free 1TB/month) or Twilio TURN
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Add TURN server if configured (needed for ~15% of users behind symmetric NAT)
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
    // Also add TURNS (TLS) variant if it's a turn: URL
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
 */
export function createPeerConnection(onMessage, onStateChange, onRemoteTrack) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.oniceconnectionstatechange = () => {
    onStateChange?.(pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    onStateChange?.(pc.connectionState);
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
  const dc = pc.createDataChannel(label, {
    ordered: true,
    maxRetransmits: 3,
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
  const offer = JSON.parse(offerSdpStr);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return JSON.stringify(pc.localDescription);
}

/**
 * Accept SDP answer
 */
export async function acceptAnswer(pc, answerSdpStr) {
  const answer = JSON.parse(answerSdpStr);
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

/**
 * Add ICE candidate
 */
export async function addIceCandidate(pc, candidateStr) {
  try {
    const candidate = JSON.parse(candidateStr);
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('[WebRTC] ICE candidate error:', e);
  }
}

/**
 * Send a message via DataChannel
 */
export function sendViaDataChannel(dc, data) {
  if (dc && dc.readyState === 'open') {
    dc.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
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

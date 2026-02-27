// ═══════════════════════════════════════════════
// WebRTC Helper — Direct phone-to-phone connection
//
// Uses WebRTC DataChannel for direct message exchange
// between two phones on the same WiFi network.
// Bypasses Redis polling entirely → ~50ms latency.
//
// Signaling goes through existing /api/room endpoint.
// ═══════════════════════════════════════════════

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Create a new RTCPeerConnection with DataChannel support
 */
export function createPeerConnection(onMessage, onStateChange) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  pc.oniceconnectionstatechange = () => {
    onStateChange?.(pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    onStateChange?.(pc.connectionState);
  };

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

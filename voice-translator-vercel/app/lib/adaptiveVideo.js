// ═══════════════════════════════════════════════
// Adaptive Video Quality — Network-aware resolution scaling
//
// Monitors WebRTC connection stats and adjusts video constraints:
// - Good network (>500kbps): 640x480 @ 24fps
// - Medium network (200-500kbps): 320x240 @ 15fps
// - Poor network (<200kbps): 160x120 @ 10fps (or disable video)
//
// Uses RTCPeerConnection.getStats() to measure actual throughput.
// Adjustments are smooth — no abrupt quality jumps.
// ═══════════════════════════════════════════════

const QUALITY_LEVELS = [
  { label: 'high', width: 640, height: 480, frameRate: 24, minBitrate: 500000 },
  { label: 'medium', width: 320, height: 240, frameRate: 15, minBitrate: 200000 },
  { label: 'low', width: 160, height: 120, frameRate: 10, minBitrate: 50000 },
];

/**
 * Start monitoring connection quality and adapting video.
 * @param {RTCPeerConnection} pc
 * @param {RTCRtpSender[]} senders - video senders to constrain
 * @param {function(string)} onQualityChange - callback with quality label
 * @returns {function} stop monitoring
 */
export function startAdaptiveVideo(pc, senders, onQualityChange) {
  let lastBytesSent = 0;
  let lastTimestamp = 0;
  let currentLevel = 0; // Start at high
  let stableCount = 0; // Count consecutive stable readings before upgrading

  const interval = setInterval(async () => {
    if (!pc || pc.connectionState === 'closed') {
      clearInterval(interval);
      return;
    }

    try {
      const stats = await pc.getStats();
      let bytesSent = 0;
      let timestamp = 0;

      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          bytesSent = report.bytesSent || 0;
          timestamp = report.timestamp || 0;
        }
      });

      if (lastTimestamp > 0 && timestamp > lastTimestamp) {
        const dtMs = timestamp - lastTimestamp;
        const bitrate = ((bytesSent - lastBytesSent) * 8 * 1000) / dtMs; // bits per second

        const targetLevel = QUALITY_LEVELS.findIndex(q => bitrate >= q.minBitrate);
        const newLevel = targetLevel >= 0 ? targetLevel : QUALITY_LEVELS.length - 1;

        if (newLevel > currentLevel) {
          // Downgrade immediately on poor network
          currentLevel = newLevel;
          stableCount = 0;
          applyQuality(senders, QUALITY_LEVELS[currentLevel]);
          onQualityChange?.(QUALITY_LEVELS[currentLevel].label);
        } else if (newLevel < currentLevel) {
          // Upgrade only after 3 consecutive good readings (prevent oscillation)
          stableCount++;
          if (stableCount >= 3) {
            currentLevel = newLevel;
            stableCount = 0;
            applyQuality(senders, QUALITY_LEVELS[currentLevel]);
            onQualityChange?.(QUALITY_LEVELS[currentLevel].label);
          }
        } else {
          stableCount = 0;
        }
      }

      lastBytesSent = bytesSent;
      lastTimestamp = timestamp;
    } catch {}
  }, 5000); // Check every 5s

  return () => clearInterval(interval);
}

/**
 * Apply video quality constraints to senders.
 */
function applyQuality(senders, quality) {
  for (const sender of senders) {
    if (sender.track?.kind !== 'video') continue;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = quality.minBitrate * 2; // Allow 2x headroom
    params.encodings[0].maxFramerate = quality.frameRate;
    // scaleResolutionDownBy adjusts resolution without renegotiation
    const currentWidth = sender.track.getSettings?.()?.width || 640;
    const scale = Math.max(1, Math.round(currentWidth / quality.width));
    params.encodings[0].scaleResolutionDownBy = scale;
    try {
      sender.setParameters(params);
    } catch (e) {
      console.warn('[AdaptiveVideo] Failed to set parameters:', e);
    }
  }
  console.log(`[AdaptiveVideo] Quality: ${quality.label} (${quality.width}x${quality.height}@${quality.frameRate}fps)`);
}

// Web Audio noise gate — cleans up mic input before STT/recording
// Uses AnalyserNode for level detection + GainNode for gating

/**
 * Create a noise gate on a MediaStream.
 * @param {MediaStream} stream - Raw microphone stream
 * @param {Object} opts - Options
 * @param {number} opts.threshold - Gate threshold in dB (default -50)
 * @param {number} opts.smoothing - Analyser smoothing (default 0.85)
 * @returns {{ cleanStream: MediaStream, analyser: AnalyserNode, destroy: Function }}
 */
export function createNoiseGate(stream, { threshold = -50, smoothing = 0.85 } = {}) {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);

  // Analyser for level detection
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = smoothing;

  // Gain node as gate
  const gate = ctx.createGain();
  gate.gain.value = 1;

  // High-pass filter to remove low rumble (< 85Hz)
  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 85;
  highPass.Q.value = 0.7;

  // Low-pass filter to remove high hiss (> 8000Hz for speech)
  const lowPass = ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 8000;
  lowPass.Q.value = 0.7;

  // Chain: source → highPass → lowPass → analyser → gate → destination
  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(analyser);
  analyser.connect(gate);

  const dest = ctx.createMediaStreamDestination();
  gate.connect(dest);

  // Noise gate loop — check level and gate accordingly
  const dataArray = new Float32Array(analyser.fftSize);
  let rafId = null;
  let open = true;

  function gateLoop() {
    analyser.getFloatTimeDomainData(dataArray);
    const rms = Math.sqrt(dataArray.reduce((sum, v) => sum + v * v, 0) / dataArray.length);
    const dB = rms > 0 ? 20 * Math.log10(rms) : -100;

    const shouldOpen = dB > threshold;
    if (shouldOpen && !open) {
      gate.gain.setTargetAtTime(1, ctx.currentTime, 0.01); // Fast attack
      open = true;
    } else if (!shouldOpen && open) {
      gate.gain.setTargetAtTime(0, ctx.currentTime, 0.05); // Slower release
      open = false;
    }

    rafId = requestAnimationFrame(gateLoop);
  }
  gateLoop();

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    try { source.disconnect(); } catch {}
    try { highPass.disconnect(); } catch {}
    try { lowPass.disconnect(); } catch {}
    try { analyser.disconnect(); } catch {}
    try { gate.disconnect(); } catch {}
    try { ctx.close(); } catch {}
  }

  return { cleanStream: dest.stream, analyser, destroy };
}

/**
 * Get current audio level from an AnalyserNode (0-1 normalized)
 */
export function getAudioLevel(analyser) {
  if (!analyser) return 0;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  return Math.min(1, rms * 5); // Amplify for UI display
}

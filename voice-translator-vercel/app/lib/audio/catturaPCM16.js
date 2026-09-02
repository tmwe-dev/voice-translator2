// b.602 — LA CATTURA DEL MICROFONO IN PCM16, UNA VOLTA SOLA.
//
// Deepgram vuole campioni interi a 16 bit, 16 kHz, mono. L'audit di
// architettura b.598 ha contato TRE copie identiche di questo pezzo
// (ScriptProcessor → Float32 → Int16 → ws.send): SpeakerView.js,
// useDeepgramSTT.js, useStreamingInterpreter.js. Identiche tranne una
// riga: SpeakerView collegava il processore all'uscita audio
// (`processor.connect(audioCtx.destination)`), che le altre due
// evitavano con un commento esplicito — «this causes echo». La copia
// che nessuno aveva riletto aveva l'eco.
//
// Qui la versione unica. Il processore NON si collega mai all'uscita:
// serve a catturare, non a suonare. `ScriptProcessorNode` e' deprecato
// ma e' l'unico che gira ovunque senza worklet separato: quando si
// passera' ad AudioWorklet, si cambia QUI e basta.

/** Float32 [-1, 1] → Int16, con saturazione. Esportata per le prove. */
export function float32AInt16(input) {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm16;
}

/**
 * Avvia la cattura: ogni blocco di campioni arriva a `onPezzo` come
 * ArrayBuffer PCM16 pronto per la rete.
 *
 * @param {MediaStream} stream — la voce (di solito una copia del microfono unico)
 * @param {object} opz
 * @param {(buf: ArrayBuffer) => void} opz.onPezzo
 * @param {number} [opz.sampleRate=16000]
 * @param {number} [opz.bufferSize=4096]
 * @param {() => boolean} [opz.attiva] — se torna false il blocco si butta
 *   (es. WebSocket non ancora aperto)
 * @returns {{ audioCtx: AudioContext, processor: ScriptProcessorNode, ferma: () => void }}
 */
export function avviaCatturaPCM16(stream, { onPezzo, sampleRate = 16000, bufferSize = 4096, attiva } = {}) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  const audioCtx = new Ctx({ sampleRate });
  const source = audioCtx.createMediaStreamSource(stream);
  const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  processor.onaudioprocess = (e) => {
    if (attiva && !attiva()) return;
    try { onPezzo?.(float32AInt16(e.inputBuffer.getChannelData(0)).buffer); }
    catch { /* chi riceve i campioni non deve mai fermare la cattura: si perde un blocco e si prosegue */ }
  };
  source.connect(processor);
  // MAI processor.connect(audioCtx.destination): rimanderebbe il
  // microfono nelle casse — eco.
  let fermata = false;
  const ferma = () => {
    if (fermata) return;
    fermata = true;
    try { processor.onaudioprocess = null; } catch { /* era gia sganciato: sganciarlo due volte non e un guasto */ }
    try { processor.disconnect(); } catch { /* era gia sganciato: sganciarlo due volte non e un guasto */ }
    try { source.disconnect(); } catch { /* era gia sganciato: sganciarlo due volte non e un guasto */ }
    try { if (audioCtx.state !== 'closed') audioCtx.close(); } catch { /* era gia chiuso: chiuderlo due volte non e un guasto */ }
  };
  return { audioCtx, processor, ferma };
}

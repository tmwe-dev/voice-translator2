// ═══════════════════════════════════════════════════════════════
// b.277 — UN SOLO MICROFONO PER TUTTA L'APPLICAZIONE
//
// Fino a qui il microfono veniva aperto fino a TRE volte insieme sullo
// stesso telefono: dal sistema audio, dalla videochiamata e
// dall'interprete. Su Android e la ricetta del disastro: il sistema
// audio del telefono puo revocare in silenzio il microfono a chi lo
// aveva gia, la cancellazione dell'eco salta (la voce del partner
// rientra nel microfono e l'interprete traduce se stesso), e tre
// catene di elaborazione scaldano il telefono fino a far cadere i
// fotogrammi della chiamata.
//
// Da adesso l'hardware si apre UNA volta. Chi ha bisogno della voce
// riceve una COPIA della traccia (clone): le copie viaggiano per conto
// loro, si possono fermare senza toccare le altre, e l'hardware resta
// aperto finche serve a qualcuno. Un contatore tiene il conto: quando
// l'ultima copia viene resa, il microfono vero si spegne.
//
// Se l'apertura unica fallisse per qualunque motivo, chi chiama e
// libero di ripiegare sull'apertura diretta di prima: questo modulo
// non deve MAI diventare il motivo per cui la voce non parte.
// ═══════════════════════════════════════════════════════════════
import { createLogger } from './logger.js';

const log = createLogger('micMaster');

let flussoMaster = null;        // il MediaStream dell'hardware, uno solo
let aperturaInCorso = null;     // la Promise dell'apertura, per non aprirne due
let inPrestito = 0;             // quante copie sono in giro

function vivo() {
  return !!flussoMaster && flussoMaster.getAudioTracks().some(t => t.readyState === 'live');
}

async function apriHardware() {
  // Un'apertura sola anche se arrivano dieci richieste insieme.
  if (aperturaInCorso) return aperturaInCorso;
  aperturaInCorso = navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000,
    },
  }).then(s => {
    flussoMaster = s;
    // Se il telefono ci toglie il microfono (chiamata di sistema, altra
    // app), il master muore: la prossima richiesta riapre da zero.
    s.getAudioTracks().forEach(t => { t.onended = () => { if (flussoMaster === s) flussoMaster = null; }; });
    const imp = s.getAudioTracks()[0]?.getSettings?.() || {};
    log.debug('microfono master aperto:', imp.sampleRate, 'Hz,', imp.channelCount, 'canali');
    return s;
  }).finally(() => { aperturaInCorso = null; });
  return aperturaInCorso;
}

/**
 * Una COPIA della voce, avvolta in un suo MediaStream.
 * Chi la riceve la tratta come se avesse aperto il microfono da solo:
 * quando ha finito chiama `rendi(stream)` — mai track.stop() sperando
 * che basti, perche il master deve sapere quando spegnersi.
 */
export async function prendiVoce() {
  if (!vivo()) await apriHardware();
  const traccia = flussoMaster.getAudioTracks()[0].clone();
  inPrestito++;
  return new MediaStream([traccia]);
}

/** Rende una copia presa con prendiVoce. Spenta l'ultima, spegne l'hardware. */
export function rendiVoce(stream) {
  try { stream?.getTracks?.().forEach(t => { try { t.stop(); } catch { /* copia gia ferma: fermarla due volte non e un guasto */ } }); } catch { /* flusso gia smontato */ }
  inPrestito = Math.max(0, inPrestito - 1);
  if (inPrestito === 0 && flussoMaster) {
    const s = flussoMaster;
    flussoMaster = null;
    s.getTracks().forEach(t => { try { t.stop(); } catch { /* la traccia era gia ferma: fermarla di nuovo non e un guasto */ } });
    log.debug('ultima copia resa: microfono hardware spento');
  }
}

/** Per il monitor: quante copie sono in giro adesso. */
export function copieInGiro() { return inPrestito; }

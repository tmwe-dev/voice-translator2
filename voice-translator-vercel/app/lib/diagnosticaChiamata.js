// ═══════════════════════════════════════════════════════════════
// b.274 — LA SCATOLA NERA DELLA CHIAMATA
//
// Fin qui, quando una videochiamata non si allacciava, non restava
// niente: ne dove si era fermata, ne con che codifica, ne se il traffico
// era passato dal relay. Si e cambiata la trattativa basandosi sul solo
// sintomo, e una volta ha peggiorato le cose (b.272 -> b.273).
//
// Questo file NON tocca la chiamata. Guarda e basta: a chiamata riuscita
// o fallita fa una fotografia di cio che il browser sa gia, la mette da
// parte, e la rende copiabile. Con UNA chiamata fallita si sapra se e
// stato il codec, la rete, o il permesso della telecamera.
//
// Regola: qualunque cosa vada storta qui, la chiamata non deve
// accorgersene. Tutto sotto try, nessun errore che risale.
// ═══════════════════════════════════════════════════════════════
import { createLogger } from './logger.js';

const log = createLogger('diagnostica');
const CHIAVE = 'vt-rapporti-chiamata';
const QUANTI = 5;

/** Fotografia di una chiamata: cosa e stato scelto, e per dove passa. */
export async function fotografiaChiamata(pc, extra = {}) {
  const r = {
    quando: new Date().toISOString(),
    esito: extra.esito || 'sconosciuto',
    miaPiattaforma: extra.miaPiattaforma || null,
    piattaformaPartner: extra.piattaformaPartner || null,
    tipoChiamata: extra.tipoChiamata || null,
  };
  try {
    if (!pc) return r;
    r.statoConnessione = pc.connectionState;
    r.statoRete = pc.iceConnectionState;
    r.statoTrattativa = pc.signalingState;
    if (typeof pc.getStats !== 'function') return r;

    const stats = await pc.getStats();
    let coppia = null, videoIn = null, audioIn = null, videoOut = null;
    stats.forEach(s => {
      if (s.type === 'candidate-pair' && (s.nominated || s.selected) && s.state === 'succeeded') coppia = s;
      if (s.type === 'inbound-rtp' && s.kind === 'video') videoIn = s;
      if (s.type === 'inbound-rtp' && s.kind === 'audio') audioIn = s;
      if (s.type === 'outbound-rtp' && s.kind === 'video') videoOut = s;
    });

    if (coppia) {
      const loc = stats.get?.(coppia.localCandidateId);
      const rem = stats.get?.(coppia.remoteCandidateId);
      r.stradaLocale = loc?.candidateType || null;   // host | srflx | relay
      r.stradaRemota = rem?.candidateType || null;
      r.viaRelay = r.stradaLocale === 'relay' || r.stradaRemota === 'relay';
      r.protocollo = loc?.protocol || null;
      r.andataRitornoMs = coppia.currentRoundTripTime != null
        ? Math.round(coppia.currentRoundTripTime * 1000) : null;
    } else {
      r.stradaLocale = null; r.stradaRemota = null; r.viaRelay = null;
      r.nessunaStradaTrovata = true;   // ICE non ha chiuso: e' qui che e' morta
    }

    const codecDi = (rtp) => {
      const c = rtp?.codecId ? stats.get?.(rtp.codecId) : null;
      if (!c) return null;
      return {
        nome: (c.mimeType || '').replace('video/', '').replace('audio/', ''),
        profilo: c.sdpFmtpLine || null,
      };
    };
    r.codecVideoRicevuto = codecDi(videoIn);
    r.codecVideoInviato = codecDi(videoOut);
    r.codecAudioRicevuto = codecDi(audioIn);
    r.fotogrammiRicevuti = videoIn?.framesDecoded ?? null;
    r.pacchettiVideoRicevuti = videoIn?.packetsReceived ?? null;
    r.pacchettiAudioRicevuti = audioIn?.packetsReceived ?? null;
  } catch (e) {
    r.erroreDiagnostica = String(e?.message || e).slice(0, 120);
  }
  return r;
}

/** Mette da parte l'ultima manciata di rapporti, il piu recente per primo. */
export function salvaRapporto(r) {
  try {
    const vecchi = leggiRapporti();
    localStorage.setItem(CHIAVE, JSON.stringify([r, ...vecchi].slice(0, QUANTI)));
    log.debug('rapporto salvato:', r.esito, r.stradaLocale, r.codecVideoRicevuto?.nome);
  } catch { /* memoria piena o navigazione privata: si prosegue senza */ }
  try { if (typeof window !== 'undefined') window.__bartalkChiamate = leggiRapporti(); } catch { /* fuori dal browser (o finestra non disponibile): la copia comoda in window salta, il rapporto resta comunque in memoria */ }
}

export function leggiRapporti() {
  try { const v = JSON.parse(localStorage.getItem(CHIAVE) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

/** Il rapporto piu recente, in una forma che si puo incollare in chat. */
export function ultimoRapportoTesto() {
  const [r] = leggiRapporti();
  if (!r) return 'Nessun rapporto: non e ancora stata tentata una chiamata su questo telefono.';
  const riga = (etichetta, valore) => `${etichetta}: ${valore ?? '—'}`;
  return [
    `CHIAMATA ${r.esito} · ${r.quando}`,
    riga('sistemi', `${r.miaPiattaforma || '?'} -> ${r.piattaformaPartner || '?'}`),
    riga('tipo', r.tipoChiamata),
    riga('stato', `${r.statoConnessione} / rete ${r.statoRete} / trattativa ${r.statoTrattativa}`),
    riga('strada', r.nessunaStradaTrovata ? 'NESSUNA (la rete non ha trovato un passaggio)'
      : `${r.stradaLocale} -> ${r.stradaRemota}${r.viaRelay ? ' (via relay)' : ' (diretta)'}`),
    riga('ritardo', r.andataRitornoMs != null ? r.andataRitornoMs + ' ms' : null),
    riga('video ricevuto', r.codecVideoRicevuto ? `${r.codecVideoRicevuto.nome} · ${r.fotogrammiRicevuti ?? 0} fotogrammi` : 'nessuno'),
    riga('video inviato', r.codecVideoInviato?.nome),
    riga('profilo video', r.codecVideoRicevuto?.profilo || r.codecVideoInviato?.profilo),
    riga('audio ricevuto', r.codecAudioRicevuto ? `${r.codecAudioRicevuto.nome} · ${r.pacchettiAudioRicevuti ?? 0} pacchetti` : 'nessuno'),
    r.erroreDiagnostica ? riga('errore diagnostica', r.erroreDiagnostica) : null,
  ].filter(Boolean).join('\n');
}

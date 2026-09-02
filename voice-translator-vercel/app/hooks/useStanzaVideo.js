'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createPeerConnection, createDataChannel, createOffer, createAnswer, acceptAnswer,
  rilevaPiattaforma, serveH264, preferisciH264,
  addMediaTracks, collectIceCandidates, addIceCandidate, sendViaDataChannel,
} from '../lib/webrtc.js';
import { applicaProfiloVideoGruppo } from '../lib/videoGruppoQualita.js';
import { subscribeTick } from '../lib/ticker.js';
// b.138 — gli avvisi di questo hook si leggono a schermo: vanno tradotti.
import { tFuori } from '../lib/i18n.js';
import { createLogger } from '../lib/logger.js';
const log = createLogger('useStanzaVideo');   // b.604 — niente console.* sparsi: tutto dal logger

// ═══════════════════════════════════════════════════════════════
// useStanzaVideo — la stanza video di gruppo.
//
// MODULO SEPARATO, di proposito. Riusa le PRIMITIVE gia collaudate di
// lib/webrtc.js (creazione connessione, canale dati, ICE, TURN): quelle
// lavorano su una connessione alla volta e vanno benissimo cosi.
//
// Non tocca useWebRTC.js, che continua a reggere la chiamata a due con
// il suo ducking, l'anti-eco e la gestione iOS. Se qui qualcosa non va,
// li non succede niente.
//
// L'UNICA VERA DIFFERENZA: dove c'era UNA connessione (`pcRef`) qui c'e
// una MAPPA nome -> connessione. Tutto il resto discende da questo.
//
// Ognuno manda il proprio video a tutti gli altri (a maglia, senza
// server di mezzo). E' il motivo per cui il tetto e otto persone: a
// otto, ognuno spedisce sette copie del proprio video.
// ═══════════════════════════════════════════════════════════════

const MAX_PARTECIPANTI = 8;
const RITMO_SEGNALI = 1200;   // quanto spesso si guarda la cassetta
const RITMO_PRESENZE = 5000;
const RITARDO_RIPRESA = 3500; // disconnected puo essere transitorio
const MAX_RIPRESE_PEER = 2;

export default function useStanzaVideo({ roomId, roomSessionToken, mioNome, attiva, conVideo = true }) {
  const [partecipanti, setPartecipanti] = useState([]);
  // b.292 — il palco: chi ha la parola, chi e in coda, a chi e offerta
  const [palco, setPalco] = useState({ posti: [], coda: [], offerta: null });   // [{ nome, stream, stato }]
  const [mioStream, setMioStream] = useState(null);
  const [stato, setStato] = useState('fermo');            // fermo | apro | dentro | errore
  const [errore, setErrore] = useState('');
  const [stanzaPiena, setStanzaPiena] = useState(false);

  // nome -> { pc, canale, stream }
  const peersRef = useRef(new Map());
  const mioStreamRef = useRef(null);
  const codaIceRef = useRef(new Map());   // candidati arrivati prima della descrizione
  const suTestoRef = useRef(null);        // callback: e arrivato del testo da qualcuno

  const api = useCallback(async (azione, extra = {}) => {
    if (!roomId || !roomSessionToken) return null;
    try {
      const r = await fetch('/api/stanza-video', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ azione, roomId, roomSessionToken, ...extra }),
        // b.363 — la cassetta dei segnali video girava senza scadenza:
        // una chiamata appesa fermava lo scambio di offerte e la stanza
        // restava a "collego" per sempre.
        signal: AbortSignal.timeout(10000),
      });
      // b.363 — corpo non-JSON (pagina d'errore del guardiano): la
      // lettura esplodeva e si perdeva il motivo del blocco.
      const d = await r.json().catch(() => null);
      if (!d) log.warn('[stanza-video] risposta non leggibile, stato', r.status, 'azione', azione);
      return d;
    } catch (e) {
      // b.363 — ripiego silenzioso su un percorso che l'utente vede
      // (nessun video): ora il motivo resta scritto.
      log.warn('[stanza-video] azione', azione, 'non riuscita:', e?.message || e);
      return null;
    }
  }, [roomId, roomSessionToken]);

  // ── Il riquadro di una persona ──
  const aggiornaPartecipante = useCallback((nome, campi) => {
    setPartecipanti(prima => {
      const i = prima.findIndex(p => p.nome === nome);
      if (i === -1) return [...prima, { nome, stream: null, stato: 'collego', ...campi }];
      const copia = [...prima];
      copia[i] = { ...copia[i], ...campi };
      return copia;
    });
  }, []);

  const chiudiPeer = useCallback((nome) => {
    const p = peersRef.current.get(nome);
    if (p) {
      if (p.ripresaTimer) clearTimeout(p.ripresaTimer);
      p.ripresaTimer = null;
      try { p.pc.close(); } catch { /* la connessione era gia chiusa */ }
      peersRef.current.delete(nome);
    }
    codaIceRef.current.delete(nome);
    setPartecipanti(prima => prima.filter(x => x.nome !== nome));
  }, []);

  // ── Una connessione verso UNA persona ──
  const apriPeer = useCallback((nome) => {
    const esistente = peersRef.current.get(nome);
    if (esistente) return esistente;

    let pc;

    const chiediRipresa = () => {
      const voce = peersRef.current.get(nome);
      if (!voce || voce.pc !== pc || voce.iniziatore !== false) return;
      const ora = Date.now();
      if (ora - (voce.ultimaRichiestaRipresa || 0) < RITARDO_RIPRESA) return;
      voce.ultimaRichiestaRipresa = ora;
      api('manda', { a: nome, segnale: { tipo: 'ricollega', dati: '' } });
      if (voce.ripresaTimer) clearTimeout(voce.ripresaTimer);
      voce.ripresaTimer = setTimeout(() => {
        const corrente = peersRef.current.get(nome);
        const statoPc = corrente?.pc?.connectionState;
        const statoIce = corrente?.pc?.iceConnectionState;
        if (corrente && (statoPc === 'failed' || statoPc === 'disconnected'
          || statoIce === 'failed' || statoIce === 'disconnected')) chiediRipresa();
      }, RITMO_PRESENZE);
    };

    const riprendi = async () => {
      const voce = peersRef.current.get(nome);
      if (!voce || voce.pc !== pc || voce.iniziatore !== true) return false;
      if (voce.riprese >= MAX_RIPRESE_PEER) {
        chiudiPeer(nome);
        return false;
      }
      voce.riprese++;
      if (voce.ripresaTimer) { clearTimeout(voce.ripresaTimer); voce.ripresaTimer = null; }
      aggiornaPartecipante(nome, { stato: 'ricollego' });
      try {
        if (typeof pc.restartIce === 'function') pc.restartIce();
        const offerta = await createOffer(pc);
        const d = await api('manda', { a: nome, segnale: { tipo: 'offerta', dati: offerta } });
        if (!d?.ok) throw new Error('segnale di ripresa non consegnato');
        return true;
      } catch (e) {
        log.warn('[StanzaVideo] ripresa peer non riuscita:', nome, e?.message || e);
        if (voce.riprese >= MAX_RIPRESE_PEER) chiudiPeer(nome);
        else voce.ripresaTimer = setTimeout(() => { riprendi(); }, RITARDO_RIPRESA);
        return false;
      }
    };

    pc = createPeerConnection(
      // testo che arriva dal canale dati di QUELLA persona
      (messaggio) => {
        try {
          const d = typeof messaggio === 'string' ? JSON.parse(messaggio) : messaggio;
          if (d?.tipo === 'parlato' && suTestoRef.current) {
            suTestoRef.current({ da: nome, testo: d.testo, lingua: d.lingua, id: d.id });
          }
        } catch { /* messaggio non nostro */ }
      },
      (nuovoStato) => {
        // b.288 — lo stato arriva come scheda { source, state }, non come
        // parola: il confronto diretto non scattava MAI, e un partecipante
        // caduto restava appeso nella griglia della stanza di gruppo.
        const statoPeer = typeof nuovoStato === 'object' ? nuovoStato.state : nuovoStato;
        aggiornaPartecipante(nome, { stato: statoPeer });
        const voce = peersRef.current.get(nome);
        if (!voce) return;

        if (statoPeer === 'connected' || statoPeer === 'completed') {
          if (voce.ripresaTimer) clearTimeout(voce.ripresaTimer);
          voce.ripresaTimer = null;
          voce.riprese = 0;
          voce.ultimaRichiestaRipresa = 0;
          return;
        }

        if (statoPeer === 'disconnected') {
          if (voce.ripresaTimer) clearTimeout(voce.ripresaTimer);
          voce.ripresaTimer = setTimeout(() => {
            const corrente = peersRef.current.get(nome);
            if (!corrente) return;
            if (corrente.iniziatore) riprendi();
            else chiediRipresa();
          }, RITARDO_RIPRESA);
          return;
        }

        if (statoPeer === 'failed') {
          if (voce.ripresaTimer) { clearTimeout(voce.ripresaTimer); voce.ripresaTimer = null; }
          if (voce.iniziatore) riprendi();
          else chiediRipresa();
          return;
        }

        if (statoPeer === 'closed') chiudiPeer(nome);
      },
      (traccia, flusso) => {
        // Il flusso di QUELLA persona finisce nel SUO riquadro: e la
        // ragione per cui serviva una mappa e non una variabile sola.
        aggiornaPartecipante(nome, { stream: flusso || new MediaStream([traccia]), stato: 'connesso' });
      }
    );

    collectIceCandidates(pc, (candidato) => {
      api('manda', { a: nome, segnale: { tipo: 'ice', dati: candidato } });
    });

    if (mioStreamRef.current) addMediaTracks(pc, mioStreamRef.current);

    const voce = {
      pc, canale: null, nome, iniziatore: null,
      riprese: 0, ripresaTimer: null, ultimaRichiestaRipresa: 0,
      riprendi, chiediRipresa,
    };
    peersRef.current.set(nome, voce);
    aggiornaPartecipante(nome, { stato: 'collego' });
    return voce;
  }, [api, aggiornaPartecipante, chiudiPeer]);

  // Il canale dati porta il PARLATO TRADOTTO, non l'audio. Ogni persona
  // ha il suo canale, quindi si sa sempre chi ha detto cosa.
  const ascoltaCanale = useCallback((canale, nome) => {
    canale.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d?.tipo === 'parlato' && suTestoRef.current) {
          suTestoRef.current({ da: nome, testo: d.testo, lingua: d.lingua, id: d.id });
        }
      } catch { /* non e roba nostra */ }
    };
  }, []);

  // ── Io chiamo lui ──
  const proponi = useCallback(async (nome) => {
    const voce = apriPeer(nome);
    voce.iniziatore = true;
    voce.canale = createDataChannel(voce.pc, 'parlato');
    ascoltaCanale(voce.canale, nome);
    // b.248 — CONFERMATO (audit esterno): apriPeer aveva GIA messo le
    // mie tracce con addTrack (una m-line per traccia, in sendrecv), e
    // qui si aggiungevano COMUNQUE due transceiver espliciti: l'offerta
    // usciva con le m-line doppie — doppio audio, doppio video, meta
    // linee senza niente dentro. Fragile e inutile. I transceiver
    // espliciti servono SOLO per i media che non sto gia inviando
    // (ricezione sola): senza, l'offerta non chiederebbe il video degli
    // altri. O le tracce o il transceiver, mai entrambi per lo stesso
    // media.
    const giaInviati = new Set(voce.pc.getSenders().map(s => s.track?.kind).filter(Boolean));
    if (!giaInviati.has('audio')) voce.pc.addTransceiver('audio', { direction: 'recvonly' });
    if (conVideo && !giaInviati.has('video')) voce.pc.addTransceiver('video', { direction: 'recvonly' });
    // b.272 — stessa regola della chiamata a due: se questo dispositivo e
    // Apple mette H.264 davanti, perche e quello che la sua accelerazione
    // hardware tratta davvero. Nella stanza di gruppo non si sa chi sono
    // gli altri, ma non serve: basta che il lato Apple lo chieda, e chi
    // sta su Android H.264 lo sa fare comunque.
    if (conVideo && serveH264(rilevaPiattaforma(), null)) preferisciH264(voce.pc);
    // createOffer restituisce gia una stringa JSON pronta da spedire.
    const offerta = await createOffer(voce.pc);
    await api('manda', { a: nome, segnale: { tipo: 'offerta', dati: offerta } });
  }, [apriPeer, api, conVideo, ascoltaCanale]);

  // ── Lui chiama me ──
  const rispondi = useCallback(async (nome, offertaJson) => {
    const voce = apriPeer(nome);
    if (voce.iniziatore === null) voce.iniziatore = false;
    voce.pc.ondatachannel = (e) => {
      voce.canale = e.channel;
      ascoltaCanale(e.channel, nome);
    };
    // createAnswer vuole la stringa e la stringa restituisce.
    const risposta = await createAnswer(voce.pc, offertaJson, (pcPronta) => {
      // b.272 — anche rispondendo: chi risponde tiene l'ordine di chi ha
      // chiesto, quindi il lato Apple deve rimetterlo a posto qui.
      if (serveH264(rilevaPiattaforma(), null)) preferisciH264(pcPronta);
    });
    await api('manda', { a: nome, segnale: { tipo: 'risposta', dati: risposta } });

    // I candidati arrivati prima della descrizione ora si possono usare.
    const coda = codaIceRef.current.get(nome) || [];
    for (const c of coda) { try { await addIceCandidate(voce.pc, c); } catch { /* la richiesta e scaduta: il giro successivo riprova */ } }
    codaIceRef.current.delete(nome);
  }, [apriPeer, api, ascoltaCanale]);

  // ── Leggo la mia cassetta ──
  const ritira = useCallback(async () => {
    const d = await api('ritira');
    if (!d?.ok) return;

    for (const s of d.segnali || []) {
      const da = s.da;
      try {
        if (s.tipo === 'offerta') {
          await rispondi(da, s.dati);
        } else if (s.tipo === 'risposta') {
          const voce = peersRef.current.get(da);
          if (voce) {
            await acceptAnswer(voce.pc, s.dati);
            voce.riprese = 0;
            const coda = codaIceRef.current.get(da) || [];
            for (const c of coda) { try { await addIceCandidate(voce.pc, c); } catch { /* la richiesta e scaduta: il giro successivo riprova */ } }
            codaIceRef.current.delete(da);
          }
        } else if (s.tipo === 'ice') {
          const voce = peersRef.current.get(da);
          if (voce?.pc.remoteDescription) {
            try { await addIceCandidate(voce.pc, s.dati); } catch { /* la richiesta e scaduta: il giro successivo riprova */ }
          } else {
            // Arrivato troppo presto: si mette da parte, non si butta.
            const coda = codaIceRef.current.get(da) || [];
            coda.push(s.dati);
            codaIceRef.current.set(da, coda);
          }
        } else if (s.tipo === 'ricollega') {
          const voce = peersRef.current.get(da);
          if (voce?.iniziatore) voce.riprendi?.();
        } else if (s.tipo === 'esco') {
          chiudiPeer(da);
        }
      } catch (e) {
        log.warn('[StanzaVideo] segnale non gestito:', s.tipo, e?.message);
      }
    }

    // Chi non e piu fra i presenti, sparisce dai riquadri.
    const vivi = (d.presenti || []).map(n => n.toLowerCase());
    for (const nome of [...peersRef.current.keys()]) {
      if (!vivi.includes(nome.toLowerCase())) chiudiPeer(nome);
    }
  }, [api, rispondi, chiudiPeer]);

  // b.248 — CONFERMATO (audit esterno): solo "stanza piena" fermava le
  // tracce; un ingresso fallito per QUALSIASI altro motivo tornava
  // indietro lasciando camera e microfono accesi — spia verde, senza
  // essere in stanza. Il rilascio ora e UN punto solo, chiamato da OGNI
  // percorso di errore e dall'uscita: se il punto e uno, non si puo
  // dimenticare un ramo.
  const voceInPrestitoRef = useRef(null);   // b.280 — la copia del microfono unico
  const spegniMioFlusso = useCallback(() => {
    if (mioStreamRef.current) {
      mioStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* era gia ferma */ } });
      mioStreamRef.current = null;
    }
    // b.280 — la copia della voce si rende al master, sempre.
    if (voceInPrestitoRef.current) {
      const voce = voceInPrestitoRef.current;
      voceInPrestitoRef.current = null;
      import('../lib/microfonoMaster.js').then(m => m.rendiVoce(voce)).catch(() => { /* master gia smontato: le tracce sono ferme comunque */ });
    }
    setMioStream(null);
  }, []);

  // ── Entro ──
  const entra = useCallback(async () => {
    if (!roomId || !roomSessionToken) return;
    setStato('apro'); setErrore(''); setStanzaPiena(false);
    try {
      // b.280 — anche la stanza di gruppo prende la voce dal microfono
      // UNICO: era l'ultima apertura parallela rimasta, e su Android due
      // acquisizioni insieme rompono l'eco e possono farsi revocare il
      // microfono. Telecamera a parte, ripiego totale su qualunque intoppo.
      let flusso;
      try {
        const { prendiVoce } = await import('../lib/microfonoMaster.js');
        const [voce, video] = await Promise.allSettled([
          prendiVoce(),
          conVideo
            ? navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } })
            : Promise.resolve(null),
        ]);
        if (voce.status !== 'fulfilled' || video.status === 'rejected') {
          if (voce.status === 'fulfilled') {
            const { rendiVoce } = await import('../lib/microfonoMaster.js');
            rendiVoce(voce.value);
          }
          throw (video.status === 'rejected' ? video.reason : voce.reason);
        }
        voceInPrestitoRef.current = voce.value;
        flusso = new MediaStream([
          ...(video.value ? video.value.getVideoTracks() : []),
          ...voce.value.getAudioTracks(),
        ]);
      } catch {
        voceInPrestitoRef.current = null;
        flusso = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: conVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
        });
      }
      mioStreamRef.current = flusso;
      setMioStream(flusso);

      const d = await api('entra');
      if (d?.error === 'stanza piena') {
        setStanzaPiena(true); setErrore(d.motivo || tFuori('roomFull')); setStato('errore');
        spegniMioFlusso();
        return;
      }
      if (!d?.ok) { spegniMioFlusso(); setErrore(tFuori('cannotEnter')); setStato('errore'); return; }

      setStato('dentro');
      // Propongo a chi era gia dentro: chi arriva dopo resta il chiamante
      // stabile della coppia e cosi si evita il glare.
      for (const nome of d.devoChiamare || []) await proponi(nome);
    } catch (e) {
      // Anche un errore a meta (permesso negato, offerta fallita) non
      // deve lasciare la spia della camera accesa.
      spegniMioFlusso();
      setErrore(e?.name === 'NotAllowedError'
        ? tFuori('needMicCamPermission')
        : tFuori('cannotStartMicCam'));
      setStato('errore');
    }
  }, [roomId, roomSessionToken, conVideo, api, proponi, spegniMioFlusso]);

  // ── Esco ──
  const esci = useCallback(async () => {
    for (const nome of [...peersRef.current.keys()]) {
      await api('manda', { a: nome, segnale: { tipo: 'esco', dati: '' } }).catch(() => {});
      chiudiPeer(nome);
    }
    await api('esci');
    spegniMioFlusso();
    setPartecipanti([]);
    setStato('fermo');
  }, [api, chiudiPeer, spegniMioFlusso]);

  // ── Mando il mio parlato tradotto a tutti ──
  const mandaTesto = useCallback((testo, lingua) => {
    if (!testo) return;
    // b.289 — P2-13: l'orologio non e un'identita (due frasi nello stesso
    // millisecondo si fondono). Nome + caso unico.
    const pacchetto = JSON.stringify({ tipo: 'parlato', testo, lingua, id: `${mioNome || 'io'}-${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2)}` });
    for (const voce of peersRef.current.values()) {
      if (voce.canale) sendViaDataChannel(voce.canale, pacchetto);
    }
  }, [mioNome]);

  const quandoArrivaTesto = useCallback((fn) => { suTestoRef.current = fn; }, []);

  // b.292 — le quattro mosse del palco; la risposta aggiorna subito lo stato
  const mossaPalco = useCallback(async (mossa) => {
    const d = await api('palco', { mossa });
    if (d?.ok && d.palco) setPalco(d.palco);
    return d?.palco || null;
  }, [api]);

  // La mesh cresce quadraticamente: quando entrano piu persone riduciamo
  // banda e fotogrammi di OGNI sender gia esistente, non solo dei nuovi.
  useEffect(() => {
    const totale = Math.min(MAX_PARTECIPANTI, partecipanti.length + 1);
    for (const voce of peersRef.current.values()) {
      applicaProfiloVideoGruppo(voce.pc, totale).catch(() => {});
    }
  }, [partecipanti.length]);

  // ── I due battiti: segnali svelti, presenze lente ──
  useEffect(() => {
    if (!attiva || stato !== 'dentro') return undefined;
    return subscribeTick(RITMO_SEGNALI, ritira, { immediate: true });
  }, [attiva, stato, ritira]);

  useEffect(() => {
    if (!attiva || stato !== 'dentro') return undefined;
    return subscribeTick(RITMO_PRESENZE, async () => {
      const d = await api('battito');
      if (!d?.ok) return;
      if (d.palco) setPalco(d.palco);
      // RETE DI SICUREZZA, non la via normale. Di norma chiama chi entra,
      // subito, verso chi ha trovato. Ma se quella proposta si perde
      // (rete ballerina, scheda in secondo piano) senza questo nessuno
      // riproverebbe mai e resterebbero due riquadri vuoti.
      //
      // Riprovo SOLO verso chi e arrivato prima di me: cosi il chiamante
      // resta sempre lo stesso dei due, e non ci si offre a vicenda.
      for (const nome of (d.arrivatiPrimaDiMe || [])) {
        if (peersRef.current.has(nome)) continue;
        proponi(nome);
      }
    }, { immediate: false });
  }, [attiva, stato, api, proponi]);

  // Chiudere la scheda senza salutare lascia riquadri fantasma agli altri.
  useEffect(() => () => { esci().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    partecipanti, mioStream, stato, errore, stanzaPiena,
    entra, esci, mandaTesto, quandoArrivaTesto,
    palco, mossaPalco,
    MAX_PARTECIPANTI,
  };
}
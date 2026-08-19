'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
// b.138 — gli avvisi di questo hook si leggono a schermo: vanno tradotti.
import { tFuori } from '../lib/i18n.js';

// ═══════════════════════════════════════════════════════════════
// useParlatoTradotto — chi prende la parola viene tradotto.
//
// LA SCELTA CHE DECIDE TUTTO IL RESTO:
// ognuno trascrive SOLO IL PROPRIO microfono, e manda agli altri il
// TESTO. Nessuno prova a trascrivere l'audio che arriva dagli altri.
//
// Perche. L'audio in arrivo e compresso, spesso mescolato, e non porta
// scritto di chi sia. E soprattutto: se in stanza ci sono sei persone e
// ognuna trascrivesse tutte le altre, la stessa frase verrebbe
// trascritta sei volte e pagata sei volte. Cosi invece si trascrive una
// volta sola, da chi l'ha detta.
//
// CHI PAGA COSA, e viene da se:
//   · parli   -> paghi la TUA trascrizione
//   · ascolti -> paghi la TUA traduzione (e la tua voce, se la vuoi)
// Nessuno paga per gli altri, ed e esattamente il modello a minuti che
// il portafoglio gia regge.
//
// SI ACCORGE DA SOLO. Un misuratore sul microfono: quando sali sopra la
// soglia si comincia a registrare, quando torni sotto per un secondo si
// chiude il pezzo e si manda. Non c'e un pulsante da tenere premuto.
// ═══════════════════════════════════════════════════════════════

const SOGLIA = 0.045;          // sotto questo livello e silenzio
const SILENZIO_CHIUDE = 1000;  // un secondo di quiete = frase finita
const PEZZO_MASSIMO = 15000;   // oltre, si taglia: nessuno parla 15s di fila
const MINIMO_UTILE = 400;      // sotto, e un colpo di tosse

export default function useParlatoTradotto({
  mioStream, miaLingua, mandaTesto, roomId, roomSessionToken, attivo,
}) {
  const [staScrivendo, setStaScrivendo] = useState(false);
  const [ultimoMio, setUltimoMio] = useState('');
  const [errore, setErrore] = useState('');

  const acRef = useRef(null);
  const analisiRef = useRef(null);
  const registratoreRef = useRef(null);
  const pezziRef = useRef([]);
  const parlandoRef = useRef(false);
  const daQuandoRef = useRef(0);
  const silenzioDaRef = useRef(0);
  const rafRef = useRef(null);

  // ── Manda il pezzo a trascrivere, e poi agli altri ──
  const chiudiPezzo = useCallback(async () => {
    const reg = registratoreRef.current;
    if (!reg || reg.state === 'inactive') return;
    reg.stop();
  }, []);

  const trascrivi = useCallback(async (blob, durataMs) => {
    if (!blob || blob.size < 1200 || durataMs < MINIMO_UTILE) return;
    setStaScrivendo(true);
    setErrore('');
    try {
      const fd = new FormData();
      fd.append('audio', new File([blob], 'parlato.webm', { type: 'audio/webm' }));
      fd.append('sourceLang', miaLingua || 'it');
      fd.append('durata', String(Math.round(durataMs / 1000)));
      // b.289 — l'identita della stanza viaggia con l'audio: autentica
      // l'ospite, attribuisce il consumo secondo le regole della stanza
      // e fa scattare la guardia delle Stanze Dirette sul server
      // (transcribe la verifica gia: le mancavano solo questi campi).
      if (roomId) fd.append('roomId', roomId);
      if (roomSessionToken) fd.append('roomSessionToken', roomSessionToken);
      try {
        const t = localStorage.getItem('vt-token');
        if (t) fd.append('userToken', t);
      } catch { /* navigazione privata o memoria piena: si prosegue senza salvare */ }

      const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
      if (!r.ok) { setErrore(tFuori('transcribeFailed')); return; }
      const d = await r.json();
      const testo = (d.original || '').trim();
      if (!testo) return;

      setUltimoMio(testo);
      // Agli altri va il testo NELLA MIA LINGUA: la traduzione la fa
      // ciascuno di loro, verso la propria, e la paga lui.
      mandaTesto?.(testo, miaLingua || 'it');

      if (d.creditoEsaurito) {
        window.dispatchEvent(new CustomEvent('wallet:esaurito'));
      }
    } catch {
      setErrore('Connessione assente');
    } finally {
      setStaScrivendo(false);
    }
  }, [miaLingua, mandaTesto, roomId, roomSessionToken]);

  // ── Il misuratore sul microfono ──
  useEffect(() => {
    if (!attivo || !mioStream) return undefined;

    let vivo = true;
    const ac = new AudioContext();
    acRef.current = ac;
    const sorgente = ac.createMediaStreamSource(mioStream);
    const analisi = ac.createAnalyser();
    analisi.fftSize = 512;
    sorgente.connect(analisi);
    analisiRef.current = analisi;
    const dati = new Uint8Array(analisi.frequencyBinCount);

    // Si registra solo l'audio: il video non serve a trascrivere e
    // peserebbe dieci volte tanto.
    const soloVoce = new MediaStream(mioStream.getAudioTracks());

    const avvia = () => {
      try {
        const reg = new MediaRecorder(soloVoce, { mimeType: 'audio/webm;codecs=opus' });
        pezziRef.current = [];
        reg.ondataavailable = (e) => { if (e.data?.size) pezziRef.current.push(e.data); };
        reg.onstop = () => {
          const durata = Date.now() - daQuandoRef.current;
          const blob = new Blob(pezziRef.current, { type: 'audio/webm' });
          pezziRef.current = [];
          trascrivi(blob, durata);
        };
        reg.start();
        registratoreRef.current = reg;
        daQuandoRef.current = Date.now();
      } catch {
        setErrore(tFuori('browserCannotRecord'));
      }
    };

    const guarda = () => {
      if (!vivo) return;
      analisi.getByteTimeDomainData(dati);
      // Quanto si discosta dal silenzio: 128 e la linea di mezzo.
      let somma = 0;
      for (let i = 0; i < dati.length; i++) {
        const v = (dati[i] - 128) / 128;
        somma += v * v;
      }
      const livello = Math.sqrt(somma / dati.length);
      const ora = Date.now();

      if (livello > SOGLIA) {
        silenzioDaRef.current = 0;
        if (!parlandoRef.current) {
          parlandoRef.current = true;
          avvia();
        } else if (ora - daQuandoRef.current > PEZZO_MASSIMO) {
          // Chi parla a lungo non deve aspettare la fine per essere letto.
          chiudiPezzo();
          setTimeout(() => { if (vivo && parlandoRef.current) avvia(); }, 60);
        }
      } else if (parlandoRef.current) {
        if (!silenzioDaRef.current) silenzioDaRef.current = ora;
        else if (ora - silenzioDaRef.current > SILENZIO_CHIUDE) {
          parlandoRef.current = false;
          silenzioDaRef.current = 0;
          chiudiPezzo();
        }
      }

      rafRef.current = requestAnimationFrame(guarda);
    };
    rafRef.current = requestAnimationFrame(guarda);

    return () => {
      vivo = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { registratoreRef.current?.stop(); } catch { /* la registrazione era gia ferma */ }
      try { ac.close(); } catch { /* era gia chiuso: chiudere due volte non e un guasto */ }
      parlandoRef.current = false;
    };
  }, [attivo, mioStream, trascrivi, chiudiPezzo]);

  return { staScrivendo, ultimoMio, errore };
}

// ═══════════════════════════════════════════════════════════════
// Traduce nella MIA lingua quello che ha detto un altro.
// Si tiene una memoria: la stessa frase non si ritraduce, e non si
// ripaga.
// ═══════════════════════════════════════════════════════════════
export function useTraduzioneInArrivo(miaLingua, { roomId, roomSessionToken, suTradotto = null } = {}) {
  const [battute, setBattute] = useState([]);   // [{ id, da, testo, tradotto, lingua }]
  const memoriaRef = useRef(new Map());

  const accogli = useCallback(async ({ da, testo, lingua, id }) => {
    if (!testo) return;
    // b.289 — P0: la chiave DEVE contenere anche la lingua di arrivo.
    // Senza, dopo un cambio lingua la memoria serviva la traduzione
    // nella lingua VECCHIA spacciandola per quella nuova.
    const chiave = `${lingua}|${miaLingua}|${testo}`;
    const gia = memoriaRef.current.get(chiave);

    const battuta = { id: id || `${Date.now()}`, da, testo, lingua, tradotto: gia || null };
    setBattute(prima => [...prima.slice(-40), battuta]);

    // Stessa lingua: non c'e niente da tradurre e niente da pagare.
    if (!miaLingua || lingua === miaLingua || gia) return;

    try {
      const r = await fetch('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testo, sourceLang: lingua, targetLang: miaLingua,
          // b.289 — la stanza entra nella richiesta: senza, un OSPITE
          // nella stanza video di un host PRO pagava (o falliva) di
          // tasca propria, mentre in chat l'addebito va all'host
          // (b.161). Stessa regola dappertutto.
          roomId: roomId || undefined,
          roomSessionToken: roomSessionToken || undefined,
          userToken: (() => { try { return localStorage.getItem('vt-token') || ''; } catch { return ''; } })(),
        }),
      });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.translated) return;
      memoriaRef.current.set(chiave, d.translated);
      setBattute(prima => prima.map(b => (b.id === battuta.id ? { ...b, tradotto: d.translated } : b)));
      // b.289 — P0-4: la voce tradotta, per chi la vuole. La riproduce la
      // coda audio del ricevente (motore, voce e volume SUOI).
      try { suTradotto?.(d.translated, battuta.id); } catch { /* la voce e un di piu: il testo e gia a schermo */ }
      if (d.creditoEsaurito) window.dispatchEvent(new CustomEvent('wallet:esaurito'));
    } catch { /* resta l'originale: meglio di niente */ }
  }, [miaLingua, roomId, roomSessionToken, suTradotto]);

  return { battute, accogli };
}

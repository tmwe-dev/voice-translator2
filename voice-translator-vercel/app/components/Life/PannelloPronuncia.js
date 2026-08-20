'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { FONT } from '../../lib/constants.js';
import { valutaPronuncia, paroleDaRivedere } from '../../lib/compagni/corsi/pronuncia.js';
import { parlaTurno } from '../../lib/compagni/cliente.js';
import { pausa as pausaAudioLife } from '../../lib/audioLife.js';
import { analizza, confronta, qualityGate } from '../../lib/fonia.js';
import GraficoFonia from './GraficoFonia.js';

// ═══════════════════════════════════════════════════════════════
// PANNELLO PRONUNCIA — dillo ad alta voce (Luca, b.244)
//
// Ripreso da RadioChat, dove era la funzione che teneva la gente lì: il
// Maestro propone una frase, tu la dici, e in due secondi vedi parola per
// parola com'è andata.
//
// La misura è onesta: si registra, si trascrive con Whisper (che BarTalk ha
// già) e si confronta con la frase proposta. Non è un modello fonetico — ma
// se la trascrizione ti capisce, un madrelingua ti capisce. È una misura
// indiretta e VERA, non un punteggio inventato.
//
// Il risultato torna al chiamante (onEsito) che lo consegna al Maestro: così
// le parole andate male tornano più avanti, dentro un'altra frase.
// ═══════════════════════════════════════════════════════════════

export default function PannelloPronuncia({ frase, lingua, userToken, onEsito, testoP, muto, accent, card, bordo }) {
  const [stato, setStato] = useState('pronto'); // pronto | registro | valuto | fatto
  const [esito, setEsito] = useState(null);
  const [errore, setErrore] = useState('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  // b.322 — ANALISI GRAFICA (Luca): la fascia della pronuncia ATTESA e la
  // tua onda sopra, colorata verde/arancio/rosso. `rifRef` e l'analisi del
  // riferimento vocale (catturata quando ascolti la frase); `confronto` e il
  // grafico corrente; `confrontoPrec` il tentativo prima (tratteggiato).
  const audioCtxRef = useRef(null);
  const rifRef = useRef(null);
  const [confronto, setConfronto] = useState(null);
  const [confrontoPrec, setConfrontoPrec] = useState(null);

  const decodifica = useCallback(async (blob) => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    const buf = await audioCtxRef.current.decodeAudioData(await blob.arrayBuffer());
    return { campioni: buf.getChannelData(0), sr: buf.sampleRate };
  }, []);

  // Il microfono si chiude sempre, anche uscendo a metà registrazione.
  const chiudiMicrofono = useCallback(() => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* il microfono era gia stato chiuso: chiuderlo due volte non e un guasto */ }
    streamRef.current = null;
  }, []);
  // b.317 — audit 6.11: allo smontaggio si ferma anche il REGISTRATORE, non
  // solo le tracce: altrimenti onstop scattava su un componente morto e si
  // pagava una trascrizione che nessuno avrebbe visto.
  useEffect(() => () => {
    try { if (recRef.current && recRef.current.state !== 'inactive') { recRef.current.onstop = null; recRef.current.stop(); } } catch { /* il registratore era gia fermo: fermarlo due volte non e un guasto */ }
    chiudiMicrofono();
  }, [chiudiMicrofono]);

  const valuta = useCallback(async (blob) => {
    setStato('valuto');
    // b.322 — QUALITY GATE (piano di Luca): un campione inaffidabile NON si
    // giudica e NON si paga: si dice il motivo e si richiede. E l'analisi
    // grafica: la tua onda contro la fascia attesa (se hai ascoltato la frase).
    let analisiUte = null;
    try {
      const { campioni, sr } = await decodifica(blob);
      const gate = qualityGate(campioni, sr);
      if (!gate.ok) { setErrore(gate.motivo); setStato('pronto'); return; }
      analisiUte = analizza(campioni, sr);
    } catch { /* l'analisi locale e un di piu: si prosegue con la trascrizione */ }
    if (analisiUte && rifRef.current) {
      setConfrontoPrec(confronto);
      setConfronto(confronta(rifRef.current, analisiUte));
    }
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'pronuncia.webm');
      fd.append('sourceLang', lingua || 'en');
      if (userToken) fd.append('userToken', userToken);
      const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      // b.317 — GESTIONE VERA degli errori (audit 6.10): un 402 di credito non
      // e un guasto del microfono, e va detto per quello che e.
      if (!r.ok || !d) {
        if (r.status === 402 || d?.creditoEsaurito) { setErrore('Credito esaurito: ricarica per continuare a esercitarti.'); setStato('pronto'); return; }
        throw new Error('trascrizione non riuscita');
      }
      // b.317 — IL BLOCCANTE dell'audit (6.1): la rotta risponde col campo
      // `original`, ma qui si leggevano solo text/transcript/testo — sempre
      // vuoti. Risultato: OGNI esercizio dava 0% con tutte le parole rosse,
      // da sempre. Ora si legge il campo giusto (gli alias restano come rete).
      const detto = d.original || d.text || d.transcript || d.testo || '';
      const e = valutaPronuncia(frase, detto);
      setEsito({ ...e, detto });
      setStato('fatto');
      onEsito?.({ punteggio: e.punteggio, daRivedere: paroleDaRivedere(e), detto });
    } catch {
      setErrore('Non sono riuscito a sentirti. Riprova.');
      setStato('pronto');
    }
  }, [frase, lingua, userToken, onEsito, decodifica, confronto]);

  // b.317 — ASCOLTA LA FRASE (audit 6.5): prima si chiedeva di pronunciare
  // una frase MAI SENTITA. Ora la voce la dice, alla velocita giusta,
  // nella lingua studiata; poi la ripeti.
  const [ascoltoFrase, setAscoltoFrase] = useState(false);
  const ascoltaFrase = useCallback(async () => {
    if (ascoltoFrase) return;
    setAscoltoFrase(true);
    try {
      await parlaTurno({ voceId: null, testo: frase, lingua: lingua || 'en', userToken, modoVoce: 'neutro' }, async (audio) => {
        // b.322 — mentre la voce dice la frase, si CATTURA il riferimento e
        // se ne calcola l'analisi: e la "fascia attesa" del grafico.
        try {
          const b = await fetch(audio.src).then((r) => r.blob());
          const { campioni, sr } = await decodifica(b);
          rifRef.current = analizza(campioni, sr);
        } catch { /* niente riferimento: il grafico restera vuoto, il resto funziona */ }
      });
    }
    catch { /* la voce e un di piu */ }
    finally { setAscoltoFrase(false); }
  }, [ascoltoFrase, frase, lingua, userToken, decodifica]);

  const registra = useCallback(async () => {
    if (stato === 'registro') { // secondo tocco: si ferma
      try { recRef.current?.stop(); } catch { /* la registrazione era gia finita da sola: fermarla di nuovo non e un guasto */ }
      return;
    }
    setErrore(''); setEsito(null);
    try {
      // b.317 — audit 6.7: se la lezione sta ancora parlando, il microfono
      // catturava il TTS e lo mandava a trascrivere. Prima si registra, si
      // mette in PAUSA la voce in corso.
      pausaAudioLife();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const pezzi = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) pezzi.push(e.data); };
      rec.onstop = async () => {
        chiudiMicrofono();
        const blob = new Blob(pezzi, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 800) await valuta(blob);
        else { setErrore('Non ho sentito niente. Riprova.'); setStato('pronto'); }
      };
      recRef.current = rec;
      rec.start();
      setStato('registro');
    } catch {
      setErrore('Serve il permesso del microfono.');
      setStato('pronto');
    }
  }, [stato, valuta, chiudiMicrofono]);

  const colorePunteggio = esito ? (esito.punteggio >= 80 ? accent : esito.punteggio >= 50 ? '#f59e0b' : '#f87171') : accent;

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: muto, marginBottom: 6 }}>Dillo ad alta voce</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: testoP, marginBottom: 10 }}>{frase}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={ascoltaFrase} disabled={ascoltoFrase || stato === 'registro'}
          style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${accent}`, fontFamily: FONT, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', color: accent, opacity: (ascoltoFrase || stato === 'registro') ? 0.6 : 1 }}>
          {ascoltoFrase ? '…' : '▶ Ascolta la frase'}
        </button>
        <button onClick={registra} disabled={stato === 'valuto'}
          style={{ padding: '10px 16px', borderRadius: 12, border: 'none', fontFamily: FONT, fontWeight: 800, cursor: stato === 'valuto' ? 'default' : 'pointer',
            background: stato === 'registro' ? '#f87171' : accent, color: '#04121c', opacity: stato === 'valuto' ? 0.6 : 1 }}>
          {stato === 'registro' ? 'Ho finito' : stato === 'valuto' ? 'Ascolto…' : stato === 'fatto' ? 'Riprova' : 'Registra'}
        </button>
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{errore}</div>}

      {/* b.322 — L'ANALISI GRAFICA: fascia attesa + la tua onda a colori.
          Compare appena c'e un confronto (serve aver ascoltato la frase). */}
      {confronto && <GraficoFonia confronto={confronto} precedente={confrontoPrec} muto={muto} card="rgba(255,255,255,0.04)" />}
      {confronto && (
        <div style={{ fontSize: 12, color: muto, marginTop: 4 }}>
          Fonia (melodia e ritmo): <b style={{ color: confronto.somiglianza >= 70 ? accent : confronto.somiglianza >= 45 ? '#f59e0b' : '#f87171' }}>{confronto.somiglianza}%</b>
          {confronto.rapportoDurata > 1.35 ? ' — sei più lento del riferimento' : confronto.rapportoDurata < 0.7 ? ' — sei più veloce del riferimento' : ''}
        </div>
      )}

      {esito && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: colorePunteggio }}>{esito.punteggio}%</div>
          {/* Parola per parola: si vede DOVE è andata storta, non solo quanto. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {esito.parole.map((p, i) => (
              <span key={i} style={{ fontSize: 14, padding: '3px 8px', borderRadius: 8,
                border: `1px solid ${p.ok ? accent : p.vicino ? '#f59e0b' : '#f87171'}`,
                color: p.ok ? accent : p.vicino ? '#f59e0b' : '#f87171' }}>{p.parola}</span>
            ))}
          </div>
          {esito.detto && <div style={{ fontSize: 12, color: muto, marginTop: 8 }}>Ho sentito: “{esito.detto}”</div>}
        </div>
      )}
    </div>
  );
}

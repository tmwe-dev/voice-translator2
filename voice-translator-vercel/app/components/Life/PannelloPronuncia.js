'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { FONT } from '../../lib/constants.js';
import { valutaPronuncia, paroleDaRivedere } from '../../lib/compagni/corsi/pronuncia.js';

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

  // Il microfono si chiude sempre, anche uscendo a metà registrazione.
  const chiudiMicrofono = useCallback(() => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* il microfono era gia stato chiuso: chiuderlo due volte non e un guasto */ }
    streamRef.current = null;
  }, []);
  useEffect(() => () => chiudiMicrofono(), [chiudiMicrofono]);

  const valuta = useCallback(async (blob) => {
    setStato('valuto');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'pronuncia.webm');
      fd.append('sourceLang', lingua || 'en');
      if (userToken) fd.append('userToken', userToken);
      const r = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) throw new Error('trascrizione non riuscita');
      const detto = d.text || d.transcript || d.testo || '';
      const e = valutaPronuncia(frase, detto);
      setEsito({ ...e, detto });
      setStato('fatto');
      onEsito?.({ punteggio: e.punteggio, daRivedere: paroleDaRivedere(e), detto });
    } catch {
      setErrore('Non sono riuscito a sentirti. Riprova.');
      setStato('pronto');
    }
  }, [frase, lingua, userToken, onEsito]);

  const registra = useCallback(async () => {
    if (stato === 'registro') { // secondo tocco: si ferma
      try { recRef.current?.stop(); } catch { /* la registrazione era gia finita da sola: fermarla di nuovo non e un guasto */ }
      return;
    }
    setErrore(''); setEsito(null);
    try {
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

      <button onClick={registra} disabled={stato === 'valuto'}
        style={{ padding: '10px 16px', borderRadius: 12, border: 'none', fontFamily: FONT, fontWeight: 800, cursor: stato === 'valuto' ? 'default' : 'pointer',
          background: stato === 'registro' ? '#f87171' : accent, color: '#04121c', opacity: stato === 'valuto' ? 0.6 : 1 }}>
        {stato === 'registro' ? 'Ho finito' : stato === 'valuto' ? 'Ascolto…' : stato === 'fatto' ? 'Riprova' : 'Registra'}
      </button>

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{errore}</div>}

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

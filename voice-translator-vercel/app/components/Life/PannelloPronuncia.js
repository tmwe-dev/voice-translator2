'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { FONT } from '../../lib/constants.js';
// b.482 — qui dentro c'erano una ventina di frasi in italiano scritte a
// mano, comandi ed errori compresi: chi studia con l'interfaccia in
// un'altra lingua leggeva «Registra» e «Non ho sentito niente» in
// italiano. Il traduttore non arriva da chi monta il pannello, quindi lo
// si prende dal contesto dell'applicazione, che qui c'e gia.
import { useApp } from '../../contexts/AppContext.js';
import { valutaPronuncia, paroleDaRivedere } from '../../lib/compagni/corsi/pronuncia.js';
import { parlaTurno, drillPronuncia } from '../../lib/compagni/cliente.js';
import { zittisci, suona as registraAudio } from '../../lib/voce.js';
import { analizza, confronta, qualityGate } from '../../lib/fonia.js';
import GraficoFonia from './GraficoFonia.js';
import Ascolta from '../Ascolta.js';

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

export default function PannelloPronuncia({ frase, lingua, userToken, onEsito, voceAssistente = null, nomeAssistente = '', testoP, muto, accent, card, bordo }) {
  const { L } = useApp();
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
  // b.331 — DRILL: dalla parola rossa nasce l'esercizio sul suono che
  // inganna (coppie minime), dette dalla voce madrelingua.
  const [drill, setDrill] = useState(null); // { parola, suono, coppie }
  const [drillCarico, setDrillCarico] = useState(false);
  const allena = useCallback(async (parola) => {
    if (drillCarico) return;
    setDrillCarico(true);
    try {
      const d = await drillPronuncia({ parola, linguaStudiata: lingua || 'en', lingua: 'it', userToken });
      setDrill({ parola, ...d });
    } catch { /* il drill e un di piu: l'esercizio resta valido */ }
    finally { setDrillCarico(false); }
  }, [drillCarico, lingua, userToken]);
  const diParola = useCallback((testo) => {
    parlaTurno({ voceId: voceAssistente || null, testo, lingua: lingua || 'en', userToken, modoVoce: 'neutro', chi: nomeAssistente || 'Pronuncia' }).catch(() => {});
  }, [voceAssistente, nomeAssistente, lingua, userToken]);

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
      // b.334 — ascolto LIBERO: senza lingua forzata l'ASR non autocorregge
      // (se dici male "sheep" scrive "ship", e noi lo vediamo).
      fd.append('libera', '1');
      if (userToken) fd.append('userToken', userToken);
      const r = await fetch('/api/transcribe', { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */, method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      // b.317 — GESTIONE VERA degli errori (audit 6.10): un 402 di credito non
      // e un guasto del microfono, e va detto per quello che e.
      if (!r.ok || !d) {
        if (r.status === 402 || d?.creditoEsaurito) { setErrore(L('creditExhausted')); setStato('pronto'); return; }
        throw new Error('trascrizione non riuscita');
      }
      // b.317 — IL BLOCCANTE dell'audit (6.1): la rotta risponde col campo
      // `original`, ma qui si leggevano solo text/transcript/testo — sempre
      // vuoti. Risultato: OGNI esercizio dava 0% con tutte le parole rosse,
      // da sempre. Ora si legge il campo giusto (gli alias restano come rete).
      const detto = d.original || d.text || d.transcript || d.testo || '';
      const e = valutaPronuncia(frase, detto, lingua); // b.335 — CJK: confronto per caratteri
      setEsito({ ...e, detto });
      setStato('fatto');
      // b.334 — DRILL AUTOMATICO (deciso): se il server segnala che una
      // parola e alla SECONDA volta, l'esercizio parte da solo.
      Promise.resolve(onEsito?.({ punteggio: e.punteggio, daRivedere: paroleDaRivedere(e), detto }))
        .then((r) => { if (r?.ricorrenti?.[0]) allena(r.ricorrenti[0]); })
        .catch(() => { /* l'esito e un di piu */ });
    } catch (e) {
      // b.363 — prima questo guasto non lasciava traccia da nessuna parte: nel
      // registro non compariva nulla, e il motivo vero (rete caduta, attesa
      // scaduta, credito finito, server rotto) restava irrecuperabile.
      if (e?.name !== 'AbortError') console.warn('[b.363] /api/transcribe:', e?.message || e);
      setErrore(L('lifeNoHear'));
      setStato('pronto');
    }
  }, [frase, lingua, userToken, onEsito, decodifica, confronto, allena, L]);

  // b.317 — ASCOLTA LA FRASE (audit 6.5): prima si chiedeva di pronunciare
  // una frase MAI SENTITA. Ora la voce la dice, alla velocita giusta,
  // nella lingua studiata; poi la ripeti.
  const [ascoltoFrase, setAscoltoFrase] = useState(false);
  const ascoltaFrase = useCallback(async () => {
    if (ascoltoFrase) return;
    setAscoltoFrase(true);
    try {
      // b.323 — la frase la dice l'ASSISTENTE MADRELINGUA (voce fissa del
      // personaggio), non una voce qualsiasi.
      await parlaTurno({ voceId: voceAssistente || null, testo: frase, lingua: lingua || 'en', userToken, modoVoce: 'neutro', chi: nomeAssistente || 'Pronuncia' }, async (audio) => {
        // b.322 — mentre la voce dice la frase, si CATTURA il riferimento e
        // se ne calcola l'analisi: e la "fascia attesa" del grafico.
        try {
          const b = await fetch(audio.src, { signal: AbortSignal.timeout(30000) /* b.363 — prima non c'era tetto di attesa: se la rete restava muta la chiamata pendeva per sempre e l'utente non vedeva mai un esito */ }).then((r) => r.blob());
          rifBlobRef.current = b; // b.323 — tenuto per la ripetizione LENTA
          const { campioni, sr } = await decodifica(b);
          rifRef.current = analizza(campioni, sr);
        } catch { /* niente riferimento: il grafico restera vuoto, il resto funziona */ }
      });
    }
    catch { /* la voce e un di piu */ }
    finally { setAscoltoFrase(false); }
  }, [ascoltoFrase, frase, lingua, userToken, decodifica, voceAssistente, nomeAssistente]);

  // b.323 — RIPETIZIONE LENTA: la stessa frase dell'Assistente, rallentata
  // in locale (gratis, nessuna nuova chiamata). Se il riferimento non c'e
  // ancora, prima lo si ascolta a velocita normale.
  const rifBlobRef = useRef(null);
  const ascoltaLenta = useCallback(() => {
    const b = rifBlobRef.current;
    if (!b) { ascoltaFrase(); return; }
    try {
      const a = new Audio(URL.createObjectURL(b));
      a.playbackRate = 0.7;
      // b.405 — l'unico `new Audio` di Life che non passa da `parlaTurno`
      // (il file e gia in mano nostra: si rallenta in locale, senza pagare
      // una seconda chiamata). Registrarlo a mano e obbligatorio, se no e
      // l'ultimo buco: lo Stop non lo prende e il microfono lo sente.
      registraAudio(a, nomeAssistente || L('lifeSlow'));
      const liberaUrl = () => { try { URL.revokeObjectURL(a.src); } catch { /* url gia revocato: non e un guasto */ } };
      a.onended = liberaUrl;
      // b.405 — audit P2.3: prima si liberava l'indirizzo SOLO a fine ascolto.
      // Un errore di lettura o un autoplay negato lo lasciavano appeso in
      // memoria, e dopo molte prove se ne accumulavano parecchi.
      a.onerror = liberaUrl;
      a.play().catch(() => { liberaUrl(); /* autoplay negato: si riprova col tasto */ });
    } catch { /* la ripetizione lenta e un di piu */ }
  }, [ascoltaFrase, nomeAssistente, L]);

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
      //
      // b.405 — MA NON BASTAVA, e per due motivi. Il primo: la voce di
      // riferimento di questo stesso pannello non era nel registro, quindi
      // la pausa non la prendeva — si chiedeva silenzio proprio all'unica
      // voce che non si poteva sentire. Il secondo: `pausa()` non diceva
      // QUANDO il silenzio era arrivato, e il microfono si apriva nella riga
      // dopo. Whisper poteva trascrivere il modello insieme allo studente e
      // il punteggio veniva falsato verso l'alto.
      //
      // Ora la voce di riferimento passa da `parlaTurno`, che la registra, e
      // qui si ASPETTA il silenzio prima di chiedere il microfono.
      await zittisci();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const pezzi = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) pezzi.push(e.data); };
      rec.onstop = async () => {
        chiudiMicrofono();
        const blob = new Blob(pezzi, { type: rec.mimeType || 'audio/webm' });
        if (blob.size > 800) await valuta(blob);
        else { setErrore(L('lifeHeardNothing')); setStato('pronto'); }
      };
      recRef.current = rec;
      rec.start();
      setStato('registro');
    } catch {
      setErrore(L('lifeMicPermission'));
      setStato('pronto');
    }
  }, [stato, valuta, chiudiMicrofono, L]);

  const colorePunteggio = esito ? (esito.punteggio >= 80 ? accent : esito.punteggio >= 50 ? '#f59e0b' : '#f87171') : accent;

  // b.482 — i fianchi della scatola vanno a 20, come tutte le altre della
  // schermata: erano 14 e questo pannello stava piu stretto degli altri.
  return (
    <div style={{ marginTop: 12, padding: '14px 20px', borderRadius: 14, background: card, border: `1px solid ${accent}` }}>
      <div style={{ fontSize: 12, color: muto, marginBottom: 6 }}>{L('lifeSayAloud')}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: testoP, marginBottom: 10 }}>{frase}</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {/* b.404 — il triangolo era scritto a mano nel testo (`▶ Lenta`),
            e per questo cambiava forma da una pagina all'altra. Ora e il
            componente comune, con l'icona vera del sistema. */}
        <Ascolta onAscolta={ascoltaFrase}
          preparando={ascoltoFrase}
          disabilitato={stato === 'registro'}
          parola={nomeAssistente ? L('lifeListenTo').replace('{x}', nomeAssistente) : L('lifeListenSentence')}
          colore={accent} bordo={`1px solid ${accent}`} />
        <Ascolta onAscolta={ascoltaLenta}
          preparando={ascoltoFrase}
          disabilitato={stato === 'registro'}
          parola={L('lifeSlow')} etichetta={L('lifeSlowTip')}
          colore={testoP} bordo={bordo} />
        {/* b.482 — il tasto della registrazione aveva solo il riempimento e
            restava sotto la misura di un dito: adesso ha i suoi 44. */}
        <button onClick={registra} disabled={stato === 'valuto'}
          style={{ padding: '10px 16px', minHeight: 44, borderRadius: 12, border: 'none', fontFamily: FONT, fontWeight: 600, cursor: stato === 'valuto' ? 'default' : 'pointer',
            background: stato === 'registro' ? '#f87171' : accent, color: '#04121c', opacity: stato === 'valuto' ? 0.6 : 1 }}>
          {stato === 'registro' ? L('lifeImDone') : stato === 'valuto' ? L('listeningDots') : stato === 'fatto' ? L('retryWord') : L('lifeRecord')}
        </button>
      </div>

      {errore && <div style={{ color: '#f87171', fontSize: 13, marginTop: 8 }}>{errore}</div>}

      {/* b.322 — L'ANALISI GRAFICA: fascia attesa + la tua onda a colori.
          Compare appena c'e un confronto (serve aver ascoltato la frase). */}
      {confronto && <GraficoFonia confronto={confronto} precedente={confrontoPrec} muto={muto} card="rgba(255,255,255,0.04)" />}
      {confronto && (
        <div style={{ fontSize: 12, color: muto, marginTop: 4 }}>
          {L('lifePhonics')}: <span style={{ fontWeight: 600, color: confronto.somiglianza >= 70 ? accent : confronto.somiglianza >= 45 ? '#f59e0b' : '#f87171' }}>{confronto.somiglianza}%</span>
          {confronto.rapportoDurata > 1.35 ? ` — ${L('lifeSlowerThanRef')}` : confronto.rapportoDurata < 0.7 ? ` — ${L('lifeFasterThanRef')}` : ''}
        </div>
      )}

      {esito && (
        <div style={{ marginTop: 12 }}>
          {/* b.482 — il punteggio era in nerissimo (900): il piu pesante
              che si ammette a schermo e 600, e vale anche per i numeri. */}
          <div style={{ fontSize: 22, fontWeight: 600, color: colorePunteggio }}>{esito.punteggio}%</div>
          {/* Parola per parola: si vede DOVE è andata storta, non solo quanto. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {esito.parole.map((p, i) => (
              <span key={i} style={{ fontSize: 14, padding: '3px 8px', borderRadius: 8,
                border: `1px solid ${p.ok ? accent : p.vicino ? '#f59e0b' : '#f87171'}`,
                color: p.ok ? accent : p.vicino ? '#f59e0b' : '#f87171' }}>{p.parola}</span>
            ))}
          </div>
          {esito.detto && <div style={{ fontSize: 12, color: muto, marginTop: 8 }}>{L('lifeIHeard').replace('{x}', esito.detto)}</div>}

          {/* b.331 — le parole ANDATE MALE si allenano: coppie minime sul
              suono che inganna, dette dalla voce madrelingua. */}
          {(() => {
            const rosse = (esito.parole || []).filter((p) => !p.ok && !p.vicino).map((p) => p.parola).slice(0, 2);
            if (!rosse.length) return null;
            return (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {/* b.482 — anche questi tasti avevano solo il riempimento e
                    restavano bassi: ora arrivano ai 44 che serve al dito. */}
                {rosse.map((w) => (
                  <button key={w} onClick={() => allena(w)} disabled={drillCarico}
                    style={{ padding: '6px 11px', minHeight: 44, borderRadius: 9, border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: FONT, opacity: drillCarico ? 0.6 : 1 }}>
                    {drillCarico ? '…' : L('lifeTrainWord').replace('{x}', w)}
                  </button>
                ))}
              </div>
            );
          })()}
          {drill && (
            <div style={{ marginTop: 10, padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: bordo }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: testoP, marginBottom: 8 }}>
                {L('lifeMinimalPairs')} — {drill.suono || L('lifeSoundOf').replace('{x}', drill.parola)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {drill.coppie.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Ascolta onAscolta={() => diParola(c.a)} parola={c.a} colore={testoP} bordo={bordo} etichetta={L('lifeListenTo').replace('{x}', c.a)} />
                    <span style={{ color: muto, fontSize: 12 }}>{L('lifeVersus')}</span>
                    <Ascolta onAscolta={() => diParola(c.b)} parola={c.b} colore={testoP} bordo={bordo} etichetta={L('lifeListenTo').replace('{x}', c.b)} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: muto, marginTop: 8 }}>{L('lifePairsHint')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

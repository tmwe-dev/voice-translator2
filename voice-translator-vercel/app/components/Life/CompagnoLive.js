'use client';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FONT, getLang } from '../../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// b.316 — COMPAGNO DAL VIVO (Luca): la chiacchierata 1-a-1 in Amico
// diventa una CONVERSAZIONE VOCALE in tempo reale — parli e lui parla,
// lo interrompi come al telefono. Architettura "ibrido chirurgico":
// UN solo agente conversazionale ElevenLabs per tutta la sezione, e la
// PERSONALITÀ del Compagno scelto viene iniettata all'avvio della
// sessione (variabili dinamiche). Un contenitore, mille personaggi.
//
// b.340 (Luca) — VIA IL WIDGET. Il popup preconfezionato portava stelline
// di voto, ID di conversazione e marchio altrui. Ora la linea vocale è la
// STESSA (libreria ufficiale @elevenlabs/client, stessa infrastruttura)
// ma l'interfaccia è nostra: stato, trascrizione dal vivo, microfono e
// chiusura, tutto nella grafica dell'app. Niente popup, niente voto.
// ═══════════════════════════════════════════════════════════════

// L'agente "Compagno Live — BarTalk (Amico)" su ElevenLabs.
const AGENTE_LIVE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AMICO_AGENT || 'agent_9101m0ev7nh8fa0ag1n2ys1s6p1n';
// b.317 — VOCE DEL SINGOLO COMPAGNO nel dal-vivo. Richiede che sull'agente
// ElevenLabs siano ABILITATI gli overrides (pannello → Security → voice_id):
// senza, la sessione con override viene rifiutata. Finché Luca non li abilita
// resta spento e tutti parlano con la voce di default dell'agente (italiana).
// Per accendere: NEXT_PUBLIC_ELEVEN_VOICE_OVERRIDE=1 su Vercel.
const OVERRIDE_VOCE = process.env.NEXT_PUBLIC_ELEVEN_VOICE_OVERRIDE === '1';

function CompagnoLive({ compagno, lingua, contesto, onChiudi, testoP, muto, accent, card, bordo }) {
  const [stato, setStato] = useState('collego'); // collego | vivo | errore | chiuso
  const [modo, setModo] = useState('listening'); // listening | speaking
  const [micSpento, setMicSpento] = useState(false);
  const [righe, setRighe] = useState([]); // trascrizione dal vivo [{chi, testo}]
  const [dettaglio, setDettaglio] = useState(''); // b.341 — l'errore VERO, mostrato
  const convRef = useRef(null);
  const vivoRef = useRef(true);
  const fondoRef = useRef(null);

  const nomeLingua = getLang(lingua)?.name || 'Italiano';
  const conTesto = String(contesto || '').slice(0, 4000);

  // b.341 — l'apertura e una funzione richiamabile (tasto Riprova), non piu
  // sepolta nell'effetto; e l'errore vero viene mostrato, non un indovinello:
  // prima QUALSIASI guasto diceva "controlla il microfono" anche a chi il
  // permesso l'aveva gia dato.
  const apriLinea = useCallback(async () => {
    setStato('collego'); setDettaglio('');
    try {
      // Prima il microfono, da solo: cosi un guasto di PERMESSO e distinto
      // da un guasto di COLLEGAMENTO, e il messaggio dice quello giusto.
      try {
        const flusso = await navigator.mediaDevices.getUserMedia({ audio: true });
        flusso.getTracks().forEach((t) => t.stop());
      } catch (e) {
        if (vivoRef.current) { setStato('errore'); setDettaglio(`Microfono non disponibile (${e?.name || 'permesso negato'}). Controlla il permesso e riprova.`); }
        return;
      }
      const { Conversation } = await import('@elevenlabs/client');
      const conv = await Conversation.startSession({
        agentId: AGENTE_LIVE_ID,
        connectionType: 'websocket',
        // Le variabili che il prompt dell'agente si aspetta: {{nome}},
        // {{ruolo}}, {{personalita}}, {{lingua}}, {{contesto}}, {{aggancio}}.
        // Il personaggio (e la discussione gia fatta) arrivano da QUI.
        dynamicVariables: {
          nome: compagno?.nome || 'il tuo Compagno',
          ruolo: compagno?.ruolo || '',
          personalita: (compagno?.personalita || '').slice(0, 2400),
          lingua: nomeLingua,
          contesto: conTesto || '(nessuna: la conversazione comincia adesso)',
          aggancio: conTesto
            ? 'Ho qui la nostra conversazione — riprendiamo da dove eravamo?'
            : 'Che bello sentirti a voce — dimmi pure, di cosa parliamo?',
        },
        ...(OVERRIDE_VOCE && compagno?.voce?.id ? { overrides: { tts: { voiceId: compagno.voce.id } } } : {}),
        onConnect: () => { if (vivoRef.current) setStato('vivo'); },
        onDisconnect: (d) => {
          if (!vivoRef.current) return;
          setStato((s) => (s === 'errore' ? s : 'chiuso'));
          if (d?.reason === 'error') setDettaglio(String(d?.message || ''));
        },
        onError: (messaggio) => {
          console.warn('[CompagnoLive] errore di linea:', messaggio);
          if (!vivoRef.current) return;
          // A linea gia aperta un errore puo essere passeggero: si mostra
          // senza buttare giu la chiamata. Prima dell'apertura, e fatale.
          setDettaglio(String(messaggio || ''));
          setStato((s) => (s === 'vivo' ? s : 'errore'));
        },
        onModeChange: ({ mode }) => { if (vivoRef.current) setModo(mode); },
        onMessage: ({ message, source }) => {
          if (!vivoRef.current || !message) return;
          setRighe((r) => [...r.slice(-24), { chi: source === 'user' ? 'tu' : 'lui', testo: String(message) }]);
        },
      });
      if (!vivoRef.current) { conv.endSession().catch(() => {}); return; }
      convRef.current = conv;
    } catch (e) {
      console.warn('[CompagnoLive] apertura fallita:', e);
      if (vivoRef.current) { setStato('errore'); setDettaglio(String(e?.message || e || 'guasto sconosciuto')); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compagno, nomeLingua, conTesto]);

  useEffect(() => {
    vivoRef.current = true;
    apriLinea();
    return () => {
      vivoRef.current = false;
      convRef.current?.endSession?.().catch?.(() => {});
      convRef.current = null;
    };
    // La sessione si apre UNA volta al montaggio: il contesto e la personalita
    // sono congelati all'avvio, come per una telefonata appena composta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fondoRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [righe]);

  const commutaMic = useCallback(() => {
    const c = convRef.current;
    if (!c) return;
    const nuovo = !micSpento;
    try {
      if (typeof c.setMicMuted === 'function') c.setMicMuted(nuovo);
      else c.micMuted = nuovo;
      setMicSpento(nuovo);
    } catch { /* il microfono resta com'era */ }
  }, [micSpento]);

  const chiudi = useCallback(() => {
    convRef.current?.endSession?.().catch?.(() => {});
    convRef.current = null;
    onChiudi?.();
  }, [onChiudi]);

  const statoTesto =
    stato === 'collego' ? 'Compongo il numero…'
    : stato === 'errore' ? (dettaglio || 'La linea non si apre. La chat scritta funziona comunque.')
    : stato === 'chiuso' ? 'Conversazione chiusa.'
    : micSpento ? 'Microfono spento — lui non ti sente'
    : modo === 'speaking' ? `${compagno?.nome || 'Il Compagno'} sta parlando…`
    : 'Ti ascolto — parla pure, puoi interromperlo';

  return (
    <div style={{ padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55`, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {compagno?.avatar && <img src={compagno.avatar} alt="" width={38} height={38} style={{ borderRadius: 10, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: testoP, fontSize: 14 }}>{compagno?.nome}</div>
          <div style={{ fontSize: 11, color: stato === 'errore' ? '#f87171' : muto }}>
            {stato === 'vivo' && (
              <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, marginRight: 5,
                background: modo === 'speaking' ? accent : '#4ade80',
                animation: 'vt-pulse 1.2s ease-in-out infinite' }} />
            )}
            {statoTesto}
          </div>
        </div>
        {(stato === 'errore' || stato === 'chiuso') && (
          <button onClick={apriLinea} aria-label="Riprova"
            style={{ background: accent, border: 'none', borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', color: '#04121c', fontFamily: FONT, fontSize: 13, fontWeight: 800 }}>
            Riprova
          </button>
        )}
        {stato === 'vivo' && (
          <button onClick={commutaMic} aria-pressed={micSpento} aria-label={micSpento ? 'Riaccendi microfono' : 'Spegni microfono'}
            style={{ background: micSpento ? '#f8717122' : 'none', border: bordo, borderRadius: 8, padding: '6px 10px',
              cursor: 'pointer', color: micSpento ? '#f87171' : testoP, fontFamily: FONT, fontSize: 13 }}>
            {micSpento ? 'Muto' : 'Mic'}
          </button>
        )}
        <button onClick={chiudi} aria-label="Chiudi"
          style={{ background: 'none', border: bordo, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: testoP, fontFamily: FONT, fontSize: 13 }}>✕</button>
      </div>

      {righe.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: bordo }}>
          {righe.map((r, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.4, color: r.chi === 'tu' ? muto : testoP, fontFamily: FONT }}>
              <span style={{ fontWeight: 700 }}>{r.chi === 'tu' ? 'Tu' : compagno?.nome || 'Lui'}: </span>{r.testo}
            </div>
          ))}
          <div ref={fondoRef} />
        </div>
      )}

      <style>{'@keyframes vt-pulse{0%,100%{opacity:.4}50%{opacity:1}}'}</style>
    </div>
  );
}

export default memo(CompagnoLive);

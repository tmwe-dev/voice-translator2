'use client';
import { memo, useEffect, useState } from 'react';
import { FONT, getLang } from '../../lib/constants.js';

// ═══════════════════════════════════════════════════════════════
// b.316 — COMPAGNO DAL VIVO (Luca): la chiacchierata 1-a-1 in Amico
// diventa una CONVERSAZIONE VOCALE in tempo reale — parli e lui parla,
// lo interrompi come al telefono. Architettura "ibrido chirurgico":
// UN solo agente conversazionale ElevenLabs per tutta la sezione, e la
// PERSONALITÀ del Compagno scelto viene iniettata all'avvio della
// sessione (variabili dinamiche). Un contenitore, mille personaggi.
// Podcast/Tavolo/Impara restano sulla nostra architettura multi-voce.
// ═══════════════════════════════════════════════════════════════

// L'agente "Compagno Live — BarTalk (Amico)" su ElevenLabs.
const AGENTE_LIVE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AMICO_AGENT || 'agent_9101m0ev7nh8fa0ag1n2ys1s6p1n';
// b.317 — VOCE DEL SINGOLO COMPAGNO nel dal-vivo. Richiede che sull'agente
// ElevenLabs siano ABILITATI gli overrides (pannello → Security → voice_id):
// senza, la sessione con override viene rifiutata. Finché Luca non li abilita
// resta spento e tutti parlano con la voce di default dell'agente (italiana).
// Per accendere: NEXT_PUBLIC_ELEVEN_VOICE_OVERRIDE=1 su Vercel.
const OVERRIDE_VOCE = process.env.NEXT_PUBLIC_ELEVEN_VOICE_OVERRIDE === '1';
const SCRIPT_WIDGET = 'https://unpkg.com/@elevenlabs/convai-widget-embed';

let scriptRichiesto = false;
function caricaScript(onPronto, onErrore) {
  if (typeof window === 'undefined') return;
  if (window.customElements?.get('elevenlabs-convai')) { onPronto(); return; }
  const esistente = document.querySelector(`script[src="${SCRIPT_WIDGET}"]`);
  const aggancia = (s) => {
    s.addEventListener('load', onPronto, { once: true });
    s.addEventListener('error', onErrore, { once: true });
  };
  if (esistente) { aggancia(esistente); return; }
  if (scriptRichiesto) return;
  scriptRichiesto = true;
  const s = document.createElement('script');
  s.src = SCRIPT_WIDGET;
  s.async = true;
  aggancia(s);
  document.head.appendChild(s);
}

function CompagnoLive({ compagno, lingua, contesto, onChiudi, testoP, muto, accent, card, bordo }) {
  const [stato, setStato] = useState('carico'); // carico | pronto | errore

  useEffect(() => {
    let vivo = true;
    caricaScript(() => vivo && setStato('pronto'), () => vivo && setStato('errore'));
    return () => { vivo = false; };
  }, []);

  const nomeLingua = getLang(lingua)?.name || 'Italiano';
  // Le variabili che il prompt dell'agente si aspetta: {{nome}}, {{ruolo}},
  // {{personalita}}, {{lingua}}, {{contesto}}, {{aggancio}}. Il personaggio
  // arriva da QUI, non dall'agente.
  // b.339 (Luca) — {{contesto}}: la discussione gia fatta in chat entra nella
  // sessione dal vivo, cosi il Compagno riprende il filo invece di ripartire
  // da zero. {{aggancio}} adatta il saluto: continuazione o primo incontro.
  const conTesto = String(contesto || '').slice(0, 4000);
  const variabili = JSON.stringify({
    nome: compagno?.nome || 'il tuo Compagno',
    ruolo: compagno?.ruolo || '',
    personalita: (compagno?.personalita || '').slice(0, 2400),
    lingua: nomeLingua,
    contesto: conTesto || '(nessuna: la conversazione comincia adesso)',
    aggancio: conTesto
      ? 'Ho qui la nostra conversazione — riprendiamo da dove eravamo?'
      : 'Che bello sentirti a voce — dimmi pure, di cosa parliamo?',
  });

  return (
    <div style={{ padding: 14, borderRadius: 14, background: card, border: `1px solid ${accent}55`, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {compagno?.avatar && <img src={compagno.avatar} alt="" width={38} height={38} style={{ borderRadius: 10, objectFit: 'cover' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: testoP, fontSize: 14 }}>{compagno?.nome}</div>
          <div style={{ fontSize: 11, color: muto }}>Conversazione dal vivo — parla e interrompi come al telefono</div>
        </div>
        <button onClick={onChiudi} aria-label="Chiudi"
          style={{ background: 'none', border: bordo, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: testoP, fontFamily: FONT, fontSize: 13 }}>✕</button>
      </div>

      {stato === 'carico' && <div style={{ fontSize: 13, color: muto, padding: '18px 0', textAlign: 'center' }}>Preparo la linea…</div>}
      {stato === 'errore' && <div style={{ fontSize: 13, color: '#f87171', padding: '12px 0' }}>La linea dal vivo non si carica. Riprova, oppure continua a scrivere qui sotto: la chat funziona comunque.</div>}
      {stato === 'pronto' && (
        // Il widget conversazionale: gestisce microfono, ascolto e interruzioni.
        <elevenlabs-convai
          agent-id={AGENTE_LIVE_ID}
          dynamic-variables={variabili}
          variant="expanded"
          {...(OVERRIDE_VOCE && compagno?.voce?.id ? { 'override-voice-id': compagno.voce.id } : {})}
        />
      )}
    </div>
  );
}

export default memo(CompagnoLive);

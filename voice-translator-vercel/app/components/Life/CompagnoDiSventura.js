'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { tocca, cosaDirgli } from '../../lib/compagni/sventura.js';
import { parlaAmico, parlaTurno } from '../../lib/compagni/cliente.js';
import AvatarImg from '../AvatarImg.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// IL COMPAGNO DI SVENTURA, a schermo.
//
// b.384, ordine di Luca. Una striscia sottile in fondo alla lezione, con
// la faccia di chi ti sta accanto e una riga sua ogni tanto.
//
// TRE REGOLE CHE LO RENDONO COMPAGNIA E NON DISTURBO:
//
//  1. NON SPINGE GIU' NIENTE. Occupa sempre la stessa altezza, che ci sia
//     una battuta o no: quando parla la battuta SOSTITUISCE il nome, non
//     si aggiunge sotto. E' la regola di casa e qui vale doppio, perche
//     comparire di colpo in mezzo a una lezione facendo saltare il testo
//     sarebbe insopportabile.
//
//  2. PARLA QUANDO IL MAESTRO TACE. Non si accavalla mai: chi lo monta
//     gli dice quando un pezzo e finito, e solo allora puo aprire bocca.
//
//  3. PUO' STARE ZITTO. Se non ha niente da dire non dice niente — e la
//     cosa che distingue una persona che ti sta accanto da un programma
//     che deve riempire un turno.
// ═══════════════════════════════════════════════════════════════

const ALTEZZA = 52;   // sempre questa, con o senza battuta

export default function CompagnoDiSventura({
  compagno, argomento, pezzo, indicePezzo, lingua, userToken,
  testoP, muto, accent, card, bordo, L,
}) {
  const [battuta, setBattuta] = useState('');
  const [pensa, setPensa] = useState(false);
  const ultimoRef = useRef(0);
  const fattoRef = useRef(-1);

  const reagisci = useCallback(async () => {
    if (pensa) return;
    setPensa(true);
    try {
      const d = await parlaAmico({
        compagnoId: compagno.id, lingua, userToken, obiettivi: [],
        superficie: 'sventura',
        messaggi: [{ ruolo: 'persona', testo: cosaDirgli({ argomento, pezzo, lingua }) }],
      });
      const testo = String(d?.risposta || '').trim();
      // b.384 — la riga vuota e una risposta valida: vuol dire "non ho
      // niente da dire". Non si insiste e non si mette un puntino.
      if (!testo) return;
      setBattuta(testo);
      ultimoRef.current = Date.now();
      // la voce la dice la rotta stessa: e la sua, non una che indoviniamo noi
      // b.405 — col nome sul telecomando: il compagno di banco parlava fuori
      // dal registro, quindi lo Stop non lo prendeva e poteva sovrapporsi al
      // Maestro proprio mentre la regola dice che parla quando il Maestro tace.
      parlaTurno({ voceId: d?.voceId || compagno.voce?.id || null, testo, lingua, userToken, modoVoce: d?.modoVoce || 'neutro', chi: compagno?.nome || 'Compagno' })
        .catch(() => { /* senza voce la battuta resta scritta: va bene lo stesso */ });
    } catch { /* il compagno non risponde: sta zitto, non e un guasto */ }
    finally { setPensa(false); }
  }, [pensa, compagno, argomento, pezzo, lingua, userToken]);

  useEffect(() => {
    if (!compagno || fattoRef.current === indicePezzo) return;
    if (!tocca(indicePezzo, ultimoRef.current || null)) return;
    fattoRef.current = indicePezzo;
    reagisci();
  }, [compagno, indicePezzo, reagisci]);

  if (!compagno) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      height: ALTEZZA, padding: '0 12px', borderRadius: 14,
      background: card, border: bordo, fontFamily: FONT,
      marginTop: 12, overflow: 'hidden', flexShrink: 0,
    }}>
      <AvatarImg src={compagno.avatar} alt={compagno.nome} size={34} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {/* la battuta PRENDE IL POSTO del nome: stessa riga, stessa altezza */}
        {battuta ? (
          <span style={{
            display: 'block', fontSize: 13.5, lineHeight: 1.35, color: testoP,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{battuta}</span>
        ) : (
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: testoP }}>
            {compagno.nome}
          </span>
        )}
        <span style={{ display: 'block', fontSize: 10.5, color: muto }}>
          {pensa ? '…' : battuta ? compagno.nome : L('sideCompanionHere')}
        </span>
      </span>
      <button onClick={() => { vibrate(6); reagisci(); }} disabled={pensa}
        aria-label={L('sideCompanionPoke')} title={L('sideCompanionPoke')}
        style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
          background: 'none', border: bordo, display: 'flex',
          alignItems: 'center', justifyContent: 'center', opacity: pensa ? 0.5 : 1,
        }}>
        <Icon name="chat" size={14} color={accent} />
      </button>
    </div>
  );
}

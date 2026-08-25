'use client';
import { memo, useState, useCallback } from 'react';
import { FONT } from '../../lib/constants.js';
// b.482 — le parole di questo pannello erano scritte a mano in italiano:
// chi studia con l'interfaccia in un'altra lingua leggeva «Lettura
// guidata» e «Leggila tu» in italiano. Chi monta il pannello non passa il
// traduttore, e per averlo senza cambiare come lo si chiama lo si prende
// dal contesto dell'applicazione, che qui c'e gia.
import { useApp } from '../../contexts/AppContext.js';
import { parlaTurno } from '../../lib/compagni/cliente.js';
import PannelloPronuncia from './PannelloPronuncia.js';
import Ascolta from '../Ascolta.js';  // b.404

// ═══════════════════════════════════════════════════════════════
// b.330 — PANNELLO LETTURA: l'esercizio chiesto da Luca per i corsi di
// lingua. Un brano in lingua originale, FRASE PER FRASE, col duetto:
//  - l'ASSISTENTE madrelingua la legge (anche lenta),
//  - poi la leggi TU: registrazione, confronto parola per parola e
//    grafico della fonia (riusa il pannello pronuncia, tale e quale).
// Il Maestro resta la guida nella tua lingua; qui parla solo chi la
// lingua la parla davvero.
// ═══════════════════════════════════════════════════════════════

function PannelloLettura({ frasi, lingua, voceAssistente, nomeAssistente, userToken, onEsito, testoP, muto, accent, card, bordo }) {
  const { L } = useApp();
  const [attiva, setAttiva] = useState(-1);   // frase selezionata per "leggila tu"
  const [dicendo, setDicendo] = useState(-1); // frase che l'Assistente sta dicendo

  const diLaFrase = useCallback(async (i, lenta = false) => {
    if (dicendo >= 0) return;
    setDicendo(i);
    try {
      // b.405 — il callback qui cambiava solo la velocita: l'audio non finiva
      // nel registro, e la lettura restava fuori dal telecomando. Ora la
      // registra `parlaTurno`; `chi` e il nome che compare sul comando.
      await parlaTurno({ voceId: voceAssistente || null, testo: frasi[i], lingua: lingua || 'en', userToken, modoVoce: 'neutro', chi: nomeAssistente || L('lifeReadingGuided') }, (a) => {
        if (lenta) { try { a.playbackRate = 0.7; } catch { /* il rallentamento e un di piu */ } }
      });
    } catch { /* la voce e un di piu */ }
    finally { setDicendo(-1); }
  }, [dicendo, frasi, lingua, voceAssistente, nomeAssistente, userToken, L]);

  if (!frasi?.length) return null;
  // b.482 — i fianchi della scatola vanno a 20, la misura di casa: erano
  // 14 e la lettura guidata stava piu stretta di tutto il resto.
  return (
    <div style={{ marginTop: 14, padding: '14px 20px', borderRadius: 14, background: card, border: bordo }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: muto, marginBottom: 4 }}>
        {nomeAssistente ? L('lifeReadingWith').replace('{x}', nomeAssistente) : L('lifeReadingGuided')}
      </div>
      <div style={{ fontSize: 11, color: muto, marginBottom: 10 }}>
        {L('lifeReadingHint')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {frasi.map((f, i) => (
          <div key={i} style={{ padding: '10px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: attiva === i ? `1px solid ${accent}` : bordo }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: testoP, lineHeight: 1.4 }}>{f}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {/* b.404 — grafica comune, e il triangolo non e piu una lettera */}
              <Ascolta onAscolta={() => diLaFrase(i)}
                preparando={dicendo === i} disabilitato={dicendo >= 0 && dicendo !== i}
                parola={nomeAssistente || L('listenWord')} colore={accent} bordo={`1px solid ${accent}`} />
              <Ascolta onAscolta={() => diLaFrase(i, true)}
                disabilitato={dicendo >= 0} parola={L('lifeSlow')}
                etichetta={L('lifeSlowTip')}
                colore={testoP} bordo={bordo} />
              {/* b.482 — il tasto aveva solo il riempimento e restava alto
                  una trentina: adesso il dito trova sempre i suoi 44. */}
              <button onClick={() => setAttiva(attiva === i ? -1 : i)}
                style={{ padding: '6px 11px', minHeight: 44, borderRadius: 9, border: 'none', background: attiva === i ? `${accent}22` : accent, color: attiva === i ? accent : '#04121c', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                {attiva === i ? L('closeWord') : L('lifeReadItYou')}
              </button>
            </div>
            {attiva === i && (
              <PannelloPronuncia key={f} frase={f} lingua={lingua} userToken={userToken}
                voceAssistente={voceAssistente} nomeAssistente={nomeAssistente}
                onEsito={onEsito}
                {...{ testoP, muto, accent, card, bordo }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(PannelloLettura);

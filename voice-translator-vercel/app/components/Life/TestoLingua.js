'use client';
import { useState, useCallback } from 'react';
import { FONT, vibrate } from '../../lib/constants.js';
import { pezziLezione } from '../../lib/compagni/corsi/lingua.js';
import { parlaTurno } from '../../lib/compagni/cliente.js';
import Icon from '../Icon.js';

// ═══════════════════════════════════════════════════════════════
// IL TESTO CHE PARLA — la lezione di lingua smette di essere lettura.
//
// b.375, collaudo di Luca sulla prima lezione di inglese: «non c'e il
// maestro con supporto vocale real time, non si capisce cosa fare», «le
// frasi non si possono cliccare».
//
// Aveva ragione, e il difetto era proprio nel mezzo del disegno. Il
// Maestro riceve l'ordine di marcare ogni parte in lingua straniera, e
// il sistema promette di farla dire a una voce madrelingua — cosi la
// persona sente la pronuncia giusta e non quella del maestro. Ma a
// schermo quei segni venivano TOLTI e il testo restava piatto: la voce
// madrelingua c'era, e non c'era modo di chiederle di parlare.
//
// Qui ogni pezzo in lingua straniera diventa una cosa che si TOCCA. Non
// e un vezzo: e la differenza fra leggere «si dice thank you» e sentire
// come suona thank you, che e l'unica ragione per cui uno apre un corso
// di lingua invece di un libro.
//
// E si vede che si tocca PRIMA di toccarlo: sottolineato, con l'altoparlante
// accanto. Una cosa cliccabile che non sembra cliccabile non esiste.
// ═══════════════════════════════════════════════════════════════

export default function TestoLingua({
  testo, lingua, voceAssistente = null, userToken,
  testoP, muto, accent, card, bordo, stile = {},
}) {
  const [dicendo, setDicendo] = useState(-1);
  const pezzi = pezziLezione(testo);

  const di = useCallback(async (i, frase) => {
    if (dicendo >= 0) return;
    vibrate(6);
    setDicendo(i);
    try {
      // b.405 — `chi` e il nome sul telecomando: da qui in poi anche questa
      // voce e nel registro unico (la registra `parlaTurno`), quindi Pausa e
      // Interrompi la prendono e non puo parlare sopra il Maestro.
      await parlaTurno({ voceId: voceAssistente || null, testo: frase, lingua: lingua || 'en', userToken, modoVoce: 'neutro', chi: 'Lingua' });
    } catch { /* la voce puo non arrivare (rete, credito): il testo resta leggibile lo stesso */ }
    finally { setDicendo(-1); }
  }, [dicendo, voceAssistente, lingua, userToken]);

  if (!pezzi.length) return null;

  return (
    <div style={{ fontSize: 15, lineHeight: 1.75, color: testoP, fontFamily: FONT, ...stile }}>
      {pezzi.map((p, i) => {
        if (!p.l2) return <span key={i}>{p.testo}</span>;
        const attivo = dicendo === i;
        return (
          <span key={i}
            role="button" tabIndex={0}
            onClick={() => di(i, p.testo)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); di(i, p.testo); } }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 7px 2px', margin: '0 1px', borderRadius: 8,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              background: attivo ? `${accent}2A` : `${accent}12`,
              border: `1px solid ${attivo ? accent : `${accent}3A`}`,
              color: accent, fontWeight: 500,
              transition: 'background .15s, border-color .15s',
            }}>
            <Icon name="speaker" size={12} color={accent} />
            {p.testo}
          </span>
        );
      })}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ═══════════════════════════════════════════════════════════════
// SOVRAPPOSIZIONE — il posto giusto dove montare una schermata che
// deve coprire TUTTA la finestra (b.516).
//
// b.514 aveva gia trovato e spiegato la trappola, ma l'aveva chiusa
// per un solo componente (PannelloLaterale). La trappola e questa, ed
// e prevista dal CSS, non e un difetto del browser:
//
//   un antenato con `transform` diverso da none diventa il containing
//   block di QUALSIASI `position: fixed` che sta dentro di lui;
//   un antenato con uno `z-index` proprio (qui: `position:relative;
//   z-index:5`, la colonna della sezione) crea un contesto di
//   impilamento, e allora lo `z-index: 300` scritto dentro non vale
//   piu niente fuori da quel contesto.
//
// Misurato dal vivo in produzione (b.515, finestra 657x749):
//   - SchedaArgomento (`fixed inset:0 z:300`) -> il suo tasto CHIUDI
//     finiva sotto l'intestazione della sezione (`z:6`): premendolo si
//     apriva il pannello Notizie e la scheda NON si chiudeva.
//   - FeedNotizieMondo (`fixed inset:0 z:97`) -> 440x691 a (109,58)
//     invece di 657x749 a (0,0): il "feed a tutta pagina" non era a
//     tutta pagina.
//   - MondoDiscussioni (`fixed inset:0 z:90`) -> stessa misura.
//
// Montare in `document.body` toglie il figlio da QUALSIASI antenato:
// `fixed` torna relativo alla finestra e lo z-index torna a contare.
// Un componente solo, cosi la prossima schermata a tutta pagina non
// ricasca nella stessa buca.
// ═══════════════════════════════════════════════════════════════
export default function Sovrapposizione({ children }) {
  // in SSR `document` non esiste: si monta al primo giro nel browser,
  // esattamente come fa PannelloLaterale da b.514.
  const [montato, setMontato] = useState(false);
  useEffect(() => { setMontato(true); }, []);
  if (!montato) return null;
  return createPortal(children, document.body);
}

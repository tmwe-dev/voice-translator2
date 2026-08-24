'use client';

// ═══════════════════════════════════════════════════════════════
// IL MICROFONO — uno solo, per tutta l'applicazione.
//
// b.467, ordine di Luca: «il microfono della home va usato anche nella
// chat (come sistema). L'uso dei microfoni nell'app deve essere uniforme
// (graficamente)». E, alla domanda se fosse roba da template: «il
// microfono e STRUTTURALE, non e grafica».
//
// Ha ragione, ed e il motivo per cui questo file esiste invece di una
// riga di stile copiata in tre punti. Erano tre disegni diversi per lo
// stesso gesto — nella Home un cerchio grande con l'alone, in «Parla ora»
// un altro cerchio con un'altra ombra, nella chat un tondo pieno con una
// sfumatura e un impulso. Chi impara uno non riconosce gli altri due. E
// tre copie sono tre posti dove sbagliare la prossima volta.
//
// Adesso ce n'e UNO. Cambia la MISURA, non la forma: l'alone, il bordo e
// il tratto bianco dentro sono sempre quelli, e si ricavano da una sola
// proporzione.
//
// I DUE SISTEMI, che Luca ricorda:
//   normale  — si tocca, si parla, si tocca di nuovo per mandare.
//   dal vivo — il Compagno ascolta di continuo (real time).
// Sono due COMPORTAMENTI, non due grafiche: la differenza si vede dal
// colore dell'alone, non da una forma nuova. Un secondo disegno per un
// secondo comportamento raddoppia le cose da imparare.
// ═══════════════════════════════════════════════════════════════

/**
 * La veste del microfono. Torna lo stile del cerchio, la misura del tratto
 * e il suo colore: chi chiama li applica al proprio bottone.
 *
 * @param {object}  p
 * @param {number}  [p.misura=96]  il diametro. 168 in Home e «Parla ora», 64 nella chat.
 * @param {boolean} [p.acceso]     sta registrando adesso
 * @param {boolean} [p.vivo]       modo dal vivo (Compagno): ascolta di continuo
 * @param {boolean} [p.spento]     non si puo usare (niente microfono su questo telefono)
 * @param {object}  [p.C]          i colori del tema (S.colors)
 */
export function vesteMicrofono({ misura = 96, acceso = false, vivo = false, spento = false, C = {} } = {}) {
  const accento = acceso
    ? (C.accent3 || '#ff5470')       // registra: rosso. E' uno STATO, non uno stile.
    : vivo
      ? (C.accent4 || '#3ddc84')     // dal vivo: verde, come tutto cio che e vivo
      : (C.accent1 || '#5b8cff');    // a riposo: il blu dell'applicazione

  // Le proporzioni sono quelle del microfono grande, riportate in scala:
  // cosi l'alone cresce col cerchio invece di restare uguale e sembrare
  // incollato addosso a un tondo piccolo.
  const k = misura / 168;
  const anello = Math.max(4, Math.round(10 * k));

  return {
    cerchio: {
      width: misura, height: misura, borderRadius: 999, padding: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid ${accento}57`,
      background: `radial-gradient(circle at 50% 38%, ${accento}4d, ${accento}14 62%, transparent 74%)`,
      boxShadow: `0 0 0 ${anello}px ${accento}0d,`
        + ` 0 ${Math.round(20 * k)}px ${Math.round(60 * k)}px -${Math.round(18 * k)}px ${accento}8c`,
      cursor: spento ? 'default' : 'pointer',
      opacity: spento ? 0.4 : 1,
      WebkitTapHighlightColor: 'transparent',
      transition: 'border-color .2s, box-shadow .2s, background .2s',
    },
    // b.467 — il tratto dentro e BIANCO, non colorato: e la regola del
    // template, confermata da Luca sulla Home. Il colore lo porta l'alone;
    // l'icona deve solo leggersi. In rosso solo mentre registra, perche li
    // il colore E' l'informazione.
    icona: Math.max(16, Math.round(30 * k)),
    coloreIcona: acceso ? (C.accent3 || '#ff5470') : (C.textPrimary || '#eef2ff'),
    accento,
  };
}

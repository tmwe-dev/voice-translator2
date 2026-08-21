// ═══════════════════════════════════════════════════════════════
// L'ACCIAIO — come si illuminano le icone d'argento di BarTalk.
//
// Ordine di Luca (b.363): «dietro le icone metti una ombreggiatura
// leggera a sinistra e in basso che sfumi. crea un effetto sulle icone
// come di un faro che le illumina da sinistra e in basso».
//
// Due cose, non una sola:
//
// 1. L'OMBRA. Non e un rettangolo dietro: e l'ombra della SAGOMA. Le
//    icone sono ritagliate (fondo trasparente), quindi l'ombra segue il
//    profilo del trofeo, della porta, del globo — non il riquadro che li
//    contiene. Cade a sinistra e in basso, e si perde sfumando.
//
// 2. IL FARO. Una luce bassa da sinistra: un alone caldo appoggiato
//    all'angolo in basso a sinistra dell'icona, che si spegne salendo.
//    Sta DIETRO l'icona, cosi il metallo la riprende sui bordi.
//
// Un posto solo: se domani la luce va spostata, si sposta qui e cambia
// dappertutto — menu in alto, menu in basso, home.
// ═══════════════════════════════════════════════════════════════

/**
 * L'ombra della sagoma, a sinistra e in basso. `scala` segue la misura
 * dell'icona: un'icona doppia vuole un'ombra doppia, altrimenti sparisce.
 */
export function ombraAcciaio(scala = 1) {
  const r = (n) => Math.round(n * 10) / 10;   // niente code decimali nel foglio di stile
  const x = r(-3 * scala);
  const y = r(4 * scala);
  const sf1 = r(6 * scala);
  const sf2 = r(12 * scala);
  return [
    `drop-shadow(${x}px ${y}px ${sf1}px rgba(0,0,0,0.55))`,
    `drop-shadow(${r(x * 1.6)}px ${r(y * 1.6)}px ${sf2}px rgba(0,0,0,0.32))`,
    // la luce radente che accende il bordo basso-sinistro del metallo
    `drop-shadow(${r(-1 * scala)}px ${r(1.5 * scala)}px ${r(0.5 * scala)}px rgba(226,238,255,0.30))`,
    'brightness(1.05)',
    'contrast(1.04)',
  ].join(' ');
}

/**
 * L'alone del faro: sta dietro l'icona, appoggiato in basso a sinistra,
 * e si spegne salendo. Va messo come sfondo del contenitore.
 */
export function faroAcciaio(intensita = 1) {
  const a = 0.20 * intensita;
  const b = 0.09 * intensita;
  return `radial-gradient(60% 60% at 22% 82%, rgba(198,220,255,${a}) 0%, rgba(198,220,255,${b}) 38%, rgba(198,220,255,0) 72%)`;
}

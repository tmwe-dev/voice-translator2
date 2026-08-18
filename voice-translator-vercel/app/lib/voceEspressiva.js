// ═══════════════════════════════════════════════════════════════
// VOCE ESPRESSIVA — dall'intento del parlante ai parametri ElevenLabs
// (Luca, b.238)
//
// Fino a b.237 la voce partiva SEMPRE con `style: 0.0` scritto a mano:
// il canale della prosodia esisteva, era cablato, ed era spento. Ogni
// Compagno leggeva col medesimo tono neutro qualunque cosa dicesse.
//
// La cura NON è una tabella "frustrato → style 0.72": sarebbe di nuovo
// handcode comportamentale, e per giunta sbagliato (il tono non dipende
// dall'emozione dell'altro, ma da come CHI PARLA vuole dire la cosa).
// Qui il modello dichiara il proprio intento — pensoso, caldo, serio… —
// e questo modulo lo traduce in parametri tecnici. L'handcode è lecito
// perché non decide il comportamento: traduce una decisione semantica.
//
// REGOLA DI FEDELTÀ: la TRADUZIONE fra persone resta a espressività
// neutra. Lì il compito è riportare fedelmente cosa ha detto un altro,
// non interpretarlo: aggiungere recitazione sarebbe un tradimento.
// L'espressività è solo dei Compagni, che parlano per sé.
//
// PURO e testabile: nessuna rete, nessuno stato.
// ═══════════════════════════════════════════════════════════════

/** @typedef {'neutro'|'pensoso'|'caldo'|'rassicurante'|'entusiasta'|'serio'|'autorevole'|'gentile'} ModoVoce */

// stability: più bassa = più variazione (e più espressione), più alta = più
// controllo. style: quanta interpretazione mettere. Sono scostamenti dal
// punto di partenza della rotta, non valori assoluti: così la logica per le
// lingue tonali resta quella che è sempre stata.
const MODI = {
  neutro:      { stability:  0.00, style: 0.00 },
  pensoso:     { stability: +0.05, style: 0.30 },
  caldo:       { stability: -0.10, style: 0.40 },
  rassicurante:{ stability: +0.05, style: 0.30 },
  entusiasta:  { stability: -0.15, style: 0.55 },
  serio:       { stability: +0.10, style: 0.20 },
  autorevole:  { stability: +0.05, style: 0.25 },
  gentile:     { stability: -0.05, style: 0.35 },
};

export const MODI_VOCE = Object.keys(MODI);

/** Il modo è valido? (tutto il resto ricade su 'neutro'). */
export function modoValido(modo) {
  return typeof modo === 'string' && Object.prototype.hasOwnProperty.call(MODI, modo);
}

const fra = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * I parametri di voce finali.
 * @param {object} opts
 * @param {number} opts.stability      il punto di partenza della rotta
 * @param {string} [opts.modo]         l'intento dichiarato da chi parla
 * @param {boolean} [opts.tonale]      lingua tonale: la stabilità non scende
 * @returns {{stability:number, style:number}}
 */
export function parametriVoce({ stability = 0.65, modo = 'neutro', tonale = false } = {}) {
  const m = modoValido(modo) ? MODI[modo] : MODI.neutro;
  // Su una lingua tonale la stabilità non si abbassa MAI: il tono porta il
  // significato, e una voce "espressiva" cambierebbe le parole. Lo stile
  // invece si può alzare, ma con prudenza.
  const delta = tonale ? Math.max(0, m.stability) : m.stability;
  return {
    stability: fra(stability + delta, 0.3, 0.95),
    style: fra(tonale ? m.style * 0.5 : m.style, 0, 0.7),
  };
}

// ── Il marcatore con cui il Compagno dichiara come vuole dirlo ──
// Costa due parole in coda alla risposta, nessuna chiamata in più.
const MARCATORE = /\s*\[voce:\s*([a-zàèéìòù]+)\s*\]\s*$/i;

export const ISTRUZIONE_VOCE =
`Chiudi il messaggio con un marcatore che dice COME vuoi dirlo, in questa forma esatta: [voce: X] — dove X è uno fra ${MODI_VOCE.join(', ')}. Scegli tu, in base a cosa stai dicendo e a chi. Il marcatore non viene letto: serve solo alla tua voce.`;

/**
 * Stacca il marcatore dal testo: ritorna il testo pulito (da mostrare e
 * far leggere) e il modo dichiarato. Se manca, il modo è 'neutro' —
 * il testo non viene mai rovinato da un marcatore malformato.
 * @returns {{testo:string, modo:ModoVoce}}
 */
export function staccaModoVoce(testo) {
  const s = String(testo || '');
  const m = s.match(MARCATORE);
  if (!m) return { testo: s.trim(), modo: 'neutro' };
  const modo = m[1].toLowerCase();
  return { testo: s.slice(0, m.index).trim(), modo: modoValido(modo) ? modo : 'neutro' };
}

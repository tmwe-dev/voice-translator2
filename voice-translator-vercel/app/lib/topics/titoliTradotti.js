// ═══════════════════════════════════════════════════════════════
// I TITOLI DEL GIORNALE, NELLA TUA LINGUA.
//
// b.548, collaudo di Luca: «i testi non vengono tradotti anche se il
// setting dice di farlo». Vero, ed era una FEATURE ORFANA nel senso
// pieno: la preferenza «Titoli in altre lingue → Tradotti» esisteva nel
// pannello, si poteva accendere, si salvava — e nessuno la leggeva. Una
// sola riga in tutto il programma la guardava (MondoDiscussioni, per il
// titolo di una discussione): nel GIORNALE, dove Luca la vede ogni
// giorno su titoli inglesi, non arrivava.
//
// Qui c'e la logica, tenuta separata dalla schermata perche si possa
// provare davvero: cosa vale la pena tradurre, cosa no, e come non
// spendere due volte per la stessa frase.
// ═══════════════════════════════════════════════════════════════

/** Radice di una lingua: «it-IT» e «it» sono la stessa cosa. */
export function radice(l) {
  return String(l || '').split('-')[0].toLowerCase();
}

/**
 * Vale la pena tradurre questo testo?
 * No se: e' vuoto, e' cortissimo (una sigla, un numero), oppure e' gia
 * nella lingua di chi guarda — tradurre dall'italiano all'italiano e
 * solo una chiamata pagata per niente (la lezione di b.363).
 */
// ═══ b.572 — LE PAROLINE CHE TRADISCONO UNA LINGUA ═══
// Collaudo di Luca: «la traduzione crea un problema». Ed era vero, con
// una causa precisa: la regola qui sotto saltava la traduzione solo se
// la scheda DICHIARAVA la propria lingua. Ma i feed e i video quasi mai
// la dichiarano — e allora un titolo italiano finiva a farsi tradurre
// in italiano. Il modello non rifiuta: RISCRIVE. Chi guarda vede il
// titolo cambiare da solo sotto gli occhi, con altre parole, e noi
// paghiamo una chiamata per rovinarlo.
//
// Non serve un riconoscitore di lingue: serve rispondere a UNA domanda
// — «questo e' gia nella mia lingua?». Le parole piu comuni bastano:
// nessuna frase italiana di dodici lettere sta in piedi senza «il»,
// «di», «che», «per». Due spie e siamo sicuri abbastanza per TACERE, e
// tacere e' la mossa gratis: nel dubbio si lascia il titolo com'e.
const SPIE = {
  it: ['il', 'lo', 'la', 'gli', 'le', 'di', 'del', 'della', 'che', 'per', 'con', 'non', 'una', 'nel', 'sono', 'anche', 'piu', 'dopo'],
  en: ['the', 'of', 'and', 'to', 'in', 'for', 'with', 'that', 'is', 'are', 'on', 'from', 'after', 'says', 'has', 'was'],
  es: ['el', 'la', 'los', 'las', 'de', 'del', 'que', 'para', 'con', 'una', 'por', 'en', 'como', 'mas', 'este'],
  fr: ['le', 'la', 'les', 'des', 'du', 'que', 'pour', 'avec', 'une', 'dans', 'sur', 'est', 'plus', 'apres'],
  de: ['der', 'die', 'das', 'und', 'von', 'mit', 'fur', 'ist', 'im', 'auf', 'nicht', 'nach', 'eine', 'sich'],
  pt: ['o', 'os', 'as', 'de', 'do', 'da', 'que', 'para', 'com', 'uma', 'em', 'mais', 'nao'],
  nl: ['de', 'het', 'een', 'van', 'en', 'in', 'op', 'met', 'voor', 'niet', 'dat', 'is'],
};

/**
 * Questo testo sembra scritto nella lingua data? Conta le parole piu
 * comuni di quella lingua. Due bastano: si risponde di si solo per
 * decidere di NON tradurre, quindi un si sbagliato costa un titolo
 * lasciato in pace, non un titolo rovinato.
 */
export function sembraLingua(testo, lingua) {
  const spie = SPIE[radice(lingua)];
  if (!spie) return false;
  const parole = String(testo || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // «piu» prende anche «più»
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (parole.length < 3) return false;
  let colpi = 0;
  for (const w of parole) if (spie.includes(w)) { colpi += 1; if (colpi >= 2) return true; }
  return false;
}

export function daTradurre(testo, linguaTesto, miaLingua) {
  const t = String(testo || '').trim();
  if (t.length < 12) return false;
  const sua = radice(linguaTesto);
  const mia = radice(miaLingua);
  if (!mia) return false;
  if (sua && sua === mia) return false;
  // b.572 — la scheda non dice da dove viene: lo si chiede al testo.
  // Se e' gia la mia lingua non si tocca. Nel dubbio si traduce, come
  // prima: il difetto era tradurre CON la certezza contraria.
  if (!sua && sembraLingua(t, mia)) return false;
  return true;
}

/**
 * Le voci da tradurre di un mazzo di schede, senza doppioni e con un
 * tetto: si traduce cio che si sta guardando, non tutto l'archivio.
 * Ogni voce: { id, campo, testo } dove campo e 'titolo' o 'sintesi'.
 */
export function vociDaTradurre(schede, miaLingua, { massimo = 24 } = {}) {
  const fuori = [];
  const visti = new Set();
  for (const c of (Array.isArray(schede) ? schede : [])) {
    if (!c || !c.id) continue;
    for (const campo of ['titolo', 'sintesi']) {
      const testo = String(c[campo] || '').trim();
      if (!daTradurre(testo, c.lingua || c.lang, miaLingua)) continue;
      const impronta = `${campo}:${testo.slice(0, 80)}`;
      if (visti.has(impronta)) continue;
      visti.add(impronta);
      fuori.push({ id: c.id, campo, testo });
      if (fuori.length >= massimo) return fuori;
    }
  }
  return fuori;
}

/**
 * Applica le traduzioni arrivate, senza toccare l'originale: la scheda
 * porta con se sia il testo di partenza sia quello tradotto, cosi si
 * puo sempre tornare indietro e non si perde niente.
 * `rese` e una mappa «id|campo» -> testo tradotto.
 */
export function applicaTraduzioni(schede, rese) {
  if (!rese || !Object.keys(rese).length) return schede || [];
  return (Array.isArray(schede) ? schede : []).map((c) => {
    if (!c?.id) return c;
    const t = rese[`${c.id}|titolo`];
    const s = rese[`${c.id}|sintesi`];
    if (!t && !s) return c;
    return {
      ...c,
      titoloOriginale: t ? (c.titoloOriginale || c.titolo) : c.titoloOriginale,
      sintesiOriginale: s ? (c.sintesiOriginale || c.sintesi) : c.sintesiOriginale,
      titolo: t || c.titolo,
      sintesi: s || c.sintesi,
      tradotta: true,
    };
  });
}

/** La preferenza e accesa? Il predefinito e TRADOTTI (ordine di Luca, b.541). */
export function traduzioneAccesa(prefs) {
  return (prefs?.mondoTitoli || 'tradotti') === 'tradotti';
}

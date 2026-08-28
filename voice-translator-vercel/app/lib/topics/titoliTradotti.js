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
export function daTradurre(testo, linguaTesto, miaLingua) {
  const t = String(testo || '').trim();
  if (t.length < 12) return false;
  const sua = radice(linguaTesto);
  const mia = radice(miaLingua);
  if (!mia) return false;
  if (sua && sua === mia) return false;
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

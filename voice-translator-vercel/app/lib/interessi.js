// ═══════════════════════════════════════════════════════════════
// GLI INTERESSI — come si decide cosa mostrare per primo.
//
// b.363, ordine di Luca: «nel profilo interessi e preferenze possono
// determinare meglio quello che possiamo fargli vedere».
//
// GIUSTO, MA CON UN MODO PRECISO DI FARLO, se no diventa il difetto che
// vogliamo evitare.
//
// L'esempio di Luca era «le casalinghe non fanno bricolage». Il senso e
// chiaro: non mostrare a tutti la stessa roba. Ma se lo si prende alla
// lettera — dedurre gli interessi dalla CATEGORIA di una persona — si
// costruisce esattamente la macchina che rende insopportabili gli altri
// social: decidono chi sei e poi ti danno solo quello. E sbagliano
// spesso, perche una persona non e la sua categoria (di casalinghe che
// montano mobili ce ne sono parecchie, e il contrario pure).
//
// Qui si usano due sole sorgenti, tutte e due vere:
//
//   1. QUELLO CHE HA DETTO. Nel profilo si scelgono gli argomenti. E una
//      dichiarazione, non un'ipotesi: se cambia idea, la cambia.
//
//   2. QUELLO CHE HA FATTO. Cosa apre davvero. Se uno dichiara "cucina"
//      e poi apre solo economia, e l'economia che gli interessa.
//
// Mai un terzo: mai dedurre da eta, sesso, mestiere o paese. Non sono
// prove di niente e sbagliano proprio sulle persone che ci tengono di
// piu a non essere incasellate.
//
// E c'e un limite voluto: gli interessi ORDINANO, non FILTRANO. Cio che
// non interessa scende, non sparisce — se no ci si costruisce la propria
// bolla e non si scopre piu niente. In un posto che vive di curiosita
// da altri paesi, sarebbe un suicidio.
// ═══════════════════════════════════════════════════════════════

/** Quante aperture si ricordano per argomento: oltre, non serve. */
const TETTO_APERTURE = 20;

/** Quanto pesa un argomento dichiarato rispetto a uno solo osservato. */
const PESO_DICHIARATO = 3;

/**
 * Registra che una persona ha aperto qualcosa di questo argomento.
 * Restituisce le preferenze aggiornate: chi chiama decide se salvarle.
 */
export function segnaApertura(prefs, argomento) {
  if (!argomento) return prefs;
  const visti = { ...(prefs?.argomentiVisti || {}) };
  visti[argomento] = Math.min(TETTO_APERTURE, (visti[argomento] || 0) + 1);
  return { ...prefs, argomentiVisti: visti };
}

/**
 * Il punteggio di un argomento per questa persona: piu alto = piu vicino
 * a cio che le interessa. Zero significa "non ne sappiamo niente", non
 * "non le interessa".
 */
export function punteggioArgomento(prefs, argomento) {
  if (!argomento) return 0;
  const dichiarati = prefs?.interessi || [];
  const visti = prefs?.argomentiVisti || {};
  const dichiarato = dichiarati.includes(argomento) ? PESO_DICHIARATO : 0;
  const osservato = Math.min(PESO_DICHIARATO, (visti[argomento] || 0) / 3);
  return dichiarato + osservato;
}

/**
 * Ordina un elenco mettendo davanti cio che interessa — SENZA togliere
 * niente. A parita di interesse resta l'ordine di prima (il piu fresco,
 * il piu vivo), che e gia un buon ordine.
 *
 * `quale` dice dove trovare l'argomento dentro ogni voce.
 */
export function ordinaPerInteresse(elenco, prefs, quale = (x) => x.topic) {
  if (!Array.isArray(elenco) || elenco.length < 2) return elenco || [];
  const dichiarati = prefs?.interessi || [];
  const visti = prefs?.argomentiVisti || {};
  // se non sappiamo niente di questa persona, non si finge di sapere:
  // si lascia l'ordine naturale.
  if (!dichiarati.length && !Object.keys(visti).length) return elenco;

  return elenco
    .map((x, i) => ({ x, i, p: punteggioArgomento(prefs, quale(x)) }))
    .sort((a, b) => (b.p - a.p) || (a.i - b.i))
    .map((v) => v.x);
}

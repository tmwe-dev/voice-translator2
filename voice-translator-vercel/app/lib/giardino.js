// ═══════════════════════════════════════════════════════════════
// IL GIARDINO — le ricerche sono semi, e i semi fanno rami.
//
// b.541, dal disegno di Luca:
//   «le mie ricerche devono farti allargare automaticamente le ricerche.
//    e naturalmente includere con priorita in questo caso tom cruise e il
//    chelsea, ma devi allargare a altri attori che magari fanno film
//    simili, altri contenuti sul cinema, su altre squadre in champions
//    league oppure risultati eventi. in sostanza le ricerche sono un seme
//    che fa crescere una pianta in una determinata direzione. la pianta
//    nasce da un seme che sviluppa rami in tutte le direzioni e ogni ramo
//    ne crea altri quando ha esaurito le informazioni e i contenuti,
//    ramificando seguendo logiche che derivano dalle azioni utente e gli
//    interessi globali, separati in ordine per origine e per lingua e
//    posizione geografica.»
//
// IL DIFETTO CHE CHIUDE. Fino a ieri il feed mostrava i risultati di UNA
// ricerca: l'ultima. Le ricerche salvate con la stella e quelle recenti
// stavano nella sidebar come promemoria, e nel giornale non entravano
// mai — Luca: «se le mie ricerche ultime sono dentro perche nei reel non
// vedo piu questi contenuti?». Perche' nessuno le ripiantava.
//
// QUI C'E' SOLO LA LOGICA, e non parla con nessuno: quali semi ci sono,
// in che ordine si piantano, quando un ramo e' esaurito, quale ramo tocca
// adesso, come si evitano le ripetizioni. I rami VERI (le query derivate)
// li propone il server con un modello — /api/topics/rami — perche' sapere
// che accanto a Tom Cruise ci sono Brad Pitt e Mission Impossible e' una
// conoscenza del mondo, non una regola che si puo scrivere a mano.
// ═══════════════════════════════════════════════════════════════

/** Le famiglie di ramo. L'ordine conta: si alterna per non fare monocultura. */
export const TIPI_RAMO = ['stesso', 'vicino', 'ambito', 'evento', 'luogo'];

export function normalizza(q) {
  return String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * I SEMI dell'utente, in ordine di priorita:
 *   1. le ricerche salvate con la stella  — le ha scelte lui, valgono di piu
 *   2. le ultime ricerche fatte           — quello che gli interessa ADESSO
 *   3. i giri predefiniti (casa e viaggio) — perche il giardino non sia mai vuoto
 * Niente doppioni: la stessa query in piu elenchi resta un seme solo, con
 * la priorita piu alta che ha ottenuto.
 */
export function semiDi(prefs, predefinite = []) {
  const visti = new Set();
  const fuori = [];
  const aggiungi = (q, origine, peso) => {
    const n = normalizza(q);
    if (!n || visti.has(n)) return;
    visti.add(n);
    fuori.push({ query: String(q).trim(), origine, peso });
  };
  for (const r of (Array.isArray(prefs?.ricerchePreferite) ? prefs.ricerchePreferite : [])) aggiungi(r?.q, 'preferita', 3);
  for (const r of (Array.isArray(prefs?.ricercheRecenti) ? prefs.ricercheRecenti : [])) aggiungi(r?.q, 'recente', 2);
  // b.562 — GLI INTERESSI SCELTI ALL'INGRESSO sono semi a tutti gli
  // effetti: e' il motivo per cui li chiediamo. Stanno accanto alle
  // ricerche recenti (stesso peso) e prima delle predefinite, che sono
  // il ripiego per chi non ha scelto niente.
  for (const s of (Array.isArray(prefs?.semiInteressi) ? prefs.semiInteressi : [])) aggiungi(s?.query, 'interesse', 2);
  for (const g of predefinite) aggiungi(g?.query, 'predefinita', 1);
  return fuori;
}

/**
 * UN RAMO E' ESAURITO quando non porta piu roba nuova: o non ha dato
 * niente, o quel poco che ha dato lo avevamo gia. La soglia e bassa
 * apposta — meglio ramificare presto che far girare a vuoto lo
 * scorrimento (e' la regola «quando ha esaurito le informazioni»).
 */
export function esaurito({ trovati = 0, nuovi = 0 } = {}) {
  if (trovati === 0) return true;
  return nuovi <= 1;
}

/**
 * LA PIANTA. Dato lo stato del giardino, dice QUALE query si pianta
 * adesso. Le regole, nell'ordine:
 *   1. prima tutti i SEMI dell'utente, per peso (preferite, poi recenti,
 *      poi predefinite): Tom Cruise e il Chelsea si vedono subito;
 *   2. poi i RAMI, alternando le famiglie (stesso / vicino / ambito /
 *      evento / luogo) e alternando il seme di provenienza — cosi non
 *      escono sei ricerche di fila sullo stesso attore;
 *   3. mai una query gia usata;
 *   4. i rami di un seme piu importante vengono prima.
 * Torna null quando non c'e piu niente: e il momento in cui chi guarda
 * vede il campo «cerca ancora».
 */
export function prossimaQuery({ semi = [], rami = [], usate = [] } = {}) {
  const fatte = new Set(usate.map(normalizza));

  const semiLiberi = [...semi]
    .filter((s) => !fatte.has(normalizza(s.query)))
    .sort((a, b) => (b.peso || 0) - (a.peso || 0));
  if (semiLiberi.length) return { ...semiLiberi[0], livello: 0 };

  const liberi = rami.filter((r) => r && r.query && !fatte.has(normalizza(r.query)));
  if (!liberi.length) return null;

  // quante volte ho gia pescato da ogni famiglia e da ogni seme: si
  // sceglie il ramo che pareggia il conto, non il primo della lista.
  const contaTipo = new Map();
  const contaSeme = new Map();
  for (const u of usate) {
    const r = rami.find((x) => normalizza(x.query) === normalizza(u));
    if (!r) continue;
    contaTipo.set(r.tipo, (contaTipo.get(r.tipo) || 0) + 1);
    contaSeme.set(normalizza(r.seme), (contaSeme.get(normalizza(r.seme)) || 0) + 1);
  }
  const pesoSeme = new Map(semi.map((s) => [normalizza(s.query), s.peso || 0]));

  const punteggio = (r) => {
    const quantoTipo = contaTipo.get(r.tipo) || 0;
    const quantoSeme = contaSeme.get(normalizza(r.seme)) || 0;
    const importanza = pesoSeme.get(normalizza(r.seme)) || 0;
    const profondita = r.livello || 1;
    // meno hai pescato da questa famiglia e da questo seme, meglio e';
    // piu il seme e' importante, meglio e'; piu il ramo e' lontano dal
    // seme, dopo viene.
    return (quantoTipo * 10) + (quantoSeme * 6) + (profondita * 3) - (importanza * 2);
  };
  return [...liberi].sort((a, b) => punteggio(a) - punteggio(b) || TIPI_RAMO.indexOf(a.tipo) - TIPI_RAMO.indexOf(b.tipo))[0];
}

/**
 * Ripulisce i rami che tornano dal modello: niente vuoti, niente
 * doppioni, niente query lunghissime, niente famiglie inventate, e mai
 * un ramo uguale al proprio seme (sarebbe girare in tondo).
 */
export function sanaRami(grezzi, seme, livello = 1) {
  const semeN = normalizza(seme);
  const visti = new Set([semeN]);
  const fuori = [];
  for (const r of (Array.isArray(grezzi) ? grezzi : [])) {
    const query = String(r?.query || '').trim().slice(0, 80);
    const n = normalizza(query);
    if (!n || visti.has(n)) continue;
    const tipo = TIPI_RAMO.includes(r?.tipo) ? r.tipo : 'vicino';
    visti.add(n);
    fuori.push({ query, tipo, seme: String(seme || '').trim(), livello });
    if (fuori.length >= 8) break;
  }
  return fuori;
}
